import os
import time
from typing import Any
from uuid import uuid4

import boto3
from botocore.exceptions import ClientError


class DynamoDBRepository:
    def __init__(self, table_name: str | None = None, region: str | None = None):
        self.table_name = (
            table_name
            or os.getenv("LUMINA_DYNAMODB_TABLE")
            or os.getenv("DYNAMODB_TABLE")
            or "lumina-app"
        )
        self.region = (
            region or os.getenv("AWS_REGION") or os.getenv("NEXT_PUBLIC_AWS_REGION") or "us-east-1"
        )
        self._dynamodb_resource = None
        self._table = None
        self._local_storage: dict[str, dict[str, dict[str, Any]]] = {}

    @property
    def table(self):
        if self._table is None:
            if self._dynamodb_resource is None:
                self._dynamodb_resource = boto3.resource("dynamodb", region_name=self.region)
            self._table = self._dynamodb_resource.Table(self.table_name)
        return self._table

    def _is_local_mode(self) -> bool:
        return os.getenv("LUMINA_AUTH_MODE", "").strip().lower() == "local" or not os.getenv(
            "AWS_ACCESS_KEY_ID"
        )

    # --- Submissions ---

    def create_submission(self, data: dict[str, Any]) -> dict[str, Any]:
        submission_id = data.get("id") or str(uuid4())
        now = data.get("timestamp") or int(time.time() * 1000)
        patient_owner_id = data["patientOwnerId"]
        status = data.get("status", "doctor_review_pending")

        item = {
            "PK": f"SUBMISSION#{submission_id}",
            "SK": "METADATA",
            "GSI1PK": f"USER#{patient_owner_id}",
            "GSI1SK": f"SUBMISSION#{now}",
            "GSI2PK": f"STATUS#{status}",
            "GSI2SK": f"SUBMISSION#{now}",
            "id": submission_id,
            "timestamp": now,
            "updatedAt": data.get("updatedAt", now),
            "patientOwnerId": patient_owner_id,
            "doctorReviewerId": data.get("doctorReviewerId"),
            "patientName": data.get("patientName"),
            "age": data.get("age"),
            "sex": data.get("sex"),
            "notes": data.get("notes"),
            "photoFileName": data.get("photoFileName"),
            "photoS3Key": data.get("photoS3Key"),
            "photoContentType": data.get("photoContentType"),
            "labFileName": data.get("labFileName"),
            "labS3Key": data.get("labS3Key"),
            "labContentType": data.get("labContentType"),
            "geneticEvidence": data.get("geneticEvidence"),
            "status": status,
            "linkedCaseId": data.get("linkedCaseId"),
            "latestDoctorMessage": data.get("latestDoctorMessage"),
            "patientSummary": data.get("patientSummary"),
            "releasedLetterMarkdown": data.get("releasedLetterMarkdown"),
            "releasedCaseId": data.get("releasedCaseId"),
            "releaseTimestamp": data.get("releaseTimestamp"),
            "visitRecommendation": data.get("visitRecommendation"),
        }

        try:
            self.table.put_item(
                Item=item,
                ConditionExpression="attribute_not_exists(PK)",
            )
        except (ClientError, Exception):
            pk = item["PK"]
            sk = item["SK"]
            if pk not in self._local_storage:
                self._local_storage[pk] = {}
            self._local_storage[pk][sk] = item

        return item

    def get_submission(
        self, submission_id: str, include_messages: bool = False
    ) -> dict[str, Any] | None:
        pk = f"SUBMISSION#{submission_id}"
        item = None
        try:
            res = self.table.get_item(Key={"PK": pk, "SK": "METADATA"})
            item = res.get("Item")
        except (ClientError, Exception):
            item = self._local_storage.get(pk, {}).get("METADATA")

        if item is None:
            return None

        payload = dict(item)
        messages = []
        if include_messages:
            messages = self.list_submission_messages(submission_id)
        payload["messages"] = messages
        return payload

    def list_submissions(
        self,
        role: str | None = None,
        user_id: str | None = None,
        status: str | None = None,
    ) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []

        try:
            if role == "patient" and user_id:
                res = self.table.query(
                    IndexName="GSI1",
                    KeyConditionExpression="GSI1PK = :gsi1pk",
                    ExpressionAttributeValues={":gsi1pk": f"USER#{user_id}"},
                    ScanIndexForward=False,
                )
                items = res.get("Items", [])
                results = [item for item in items if item.get("SK") == "METADATA"]
            elif status:
                res = self.table.query(
                    IndexName="GSI2",
                    KeyConditionExpression="GSI2PK = :gsi2pk",
                    ExpressionAttributeValues={":gsi2pk": f"STATUS#{status}"},
                    ScanIndexForward=False,
                )
                items = res.get("Items", [])
                results = [item for item in items if item.get("SK") == "METADATA"]
            else:
                res = self.table.scan()
                items = res.get("Items", [])
                results = [item for item in items if item.get("SK") == "METADATA"]
        except (ClientError, Exception):
            for pk, sk_map in self._local_storage.items():
                if "METADATA" in sk_map and pk.startswith("SUBMISSION#"):
                    item = sk_map["METADATA"]
                    if role == "patient" and user_id and item.get("patientOwnerId") != user_id:
                        continue
                    if status and item.get("status") != status:
                        continue
                    results.append(item)

        results.sort(key=lambda x: x.get("updatedAt", 0), reverse=True)
        return results

    def update_submission(self, submission_id: str, updates: dict[str, Any]) -> dict[str, Any]:
        pk = f"SUBMISSION#{submission_id}"
        existing = self.get_submission(submission_id)
        if existing is None:
            raise KeyError(f"Submission {submission_id} not found")

        merged = {**existing, **updates}
        merged["updatedAt"] = updates.get("updatedAt") or int(time.time() * 1000)

        status = merged.get("status", "doctor_review_pending")
        now = merged.get("timestamp") or merged["updatedAt"]

        merged["GSI2PK"] = f"STATUS#{status}"
        merged["GSI2SK"] = f"SUBMISSION#{now}"

        try:
            self.table.put_item(Item=merged)
        except (ClientError, Exception):
            if pk not in self._local_storage:
                self._local_storage[pk] = {}
            self._local_storage[pk]["METADATA"] = merged

        return merged

    def delete_submission(self, submission_id: str) -> None:
        pk = f"SUBMISSION#{submission_id}"
        try:
            messages = self.list_submission_messages(submission_id)
            for msg in messages:
                self.table.delete_item(Key={"PK": pk, "SK": f"MSG#{msg['timestamp']}#{msg['id']}"})
            self.table.delete_item(Key={"PK": pk, "SK": "METADATA"})
        except (ClientError, Exception):
            self._local_storage.pop(pk, None)

    # --- Submission Messages ---

    def add_submission_message(
        self, submission_id: str, doctor_id: str, message: str
    ) -> dict[str, Any]:
        msg_id = str(uuid4())
        now = int(time.time() * 1000)
        item = {
            "PK": f"SUBMISSION#{submission_id}",
            "SK": f"MSG#{now}#{msg_id}",
            "id": msg_id,
            "submissionId": submission_id,
            "doctorId": doctor_id,
            "message": message,
            "timestamp": now,
        }

        try:
            self.table.put_item(Item=item)
        except (ClientError, Exception):
            pk = item["PK"]
            sk = item["SK"]
            if pk not in self._local_storage:
                self._local_storage[pk] = {}
            self._local_storage[pk][sk] = item

        return item

    def list_submission_messages(self, submission_id: str) -> list[dict[str, Any]]:
        pk = f"SUBMISSION#{submission_id}"
        results: list[dict[str, Any]] = []

        try:
            res = self.table.query(
                KeyConditionExpression="PK = :pk AND begins_with(SK, :sk_prefix)",
                ExpressionAttributeValues={":pk": pk, ":sk_prefix": "MSG#"},
                ScanIndexForward=False,
            )
            results = res.get("Items", [])
        except (ClientError, Exception):
            for sk, item in self._local_storage.get(pk, {}).items():
                if sk.startswith("MSG#"):
                    results.append(item)

        results.sort(key=lambda x: x.get("timestamp", 0), reverse=True)
        return results

    # --- Clinical Cases ---

    def create_case(self, data: dict[str, Any]) -> dict[str, Any]:
        case_id = data.get("id") or str(uuid4())
        now = data.get("timestamp") or int(time.time() * 1000)
        doctor_owner_id = data["doctorOwnerId"]
        submission_id = data.get("submissionId")

        item = {
            "PK": f"CASE#{case_id}",
            "SK": "METADATA",
            "GSI1PK": f"USER#{doctor_owner_id}",
            "GSI1SK": f"CASE#{now}",
            "id": case_id,
            "timestamp": now,
            "updatedAt": data.get("updatedAt", now),
            "doctorOwnerId": doctor_owner_id,
            "submissionId": submission_id,
            "patientOwnerId": data.get("patientOwnerId"),
            "caseData": data.get("caseData", {}),
        }

        if submission_id:
            item["GSI2PK"] = f"SUBMISSION#{submission_id}"
            item["GSI2SK"] = f"CASE#{case_id}"

        try:
            self.table.put_item(Item=item, ConditionExpression="attribute_not_exists(PK)")
        except (ClientError, Exception):
            pk = item["PK"]
            sk = item["SK"]
            if pk not in self._local_storage:
                self._local_storage[pk] = {}
            self._local_storage[pk][sk] = item

        return item

    def get_case(self, case_id: str) -> dict[str, Any] | None:
        pk = f"CASE#{case_id}"
        try:
            res = self.table.get_item(Key={"PK": pk, "SK": "METADATA"})
            return res.get("Item")
        except (ClientError, Exception):
            return self._local_storage.get(pk, {}).get("METADATA")

    def get_case_by_submission_id(self, submission_id: str) -> dict[str, Any] | None:
        try:
            res = self.table.query(
                IndexName="GSI2",
                KeyConditionExpression="GSI2PK = :gsi2pk",
                ExpressionAttributeValues={":gsi2pk": f"SUBMISSION#{submission_id}"},
            )
            items = res.get("Items", [])
            if items:
                return items[0]
        except (ClientError, Exception):
            for pk, sk_map in self._local_storage.items():
                if pk.startswith("CASE#") and "METADATA" in sk_map:
                    item = sk_map["METADATA"]
                    if item.get("submissionId") == submission_id:
                        return item
        return None

    def list_cases(self, doctor_owner_id: str) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []
        try:
            res = self.table.query(
                IndexName="GSI1",
                KeyConditionExpression="GSI1PK = :gsi1pk",
                ExpressionAttributeValues={":gsi1pk": f"USER#{doctor_owner_id}"},
                ScanIndexForward=False,
            )
            results = res.get("Items", [])
        except (ClientError, Exception):
            for pk, sk_map in self._local_storage.items():
                if pk.startswith("CASE#") and "METADATA" in sk_map:
                    item = sk_map["METADATA"]
                    if item.get("doctorOwnerId") == doctor_owner_id:
                        results.append(item)

        results.sort(key=lambda x: x.get("updatedAt", 0), reverse=True)
        return results

    def update_case(self, case_id: str, updates: dict[str, Any]) -> dict[str, Any]:
        existing = self.get_case(case_id)
        if existing is None:
            raise KeyError(f"Case {case_id} not found")

        merged = {**existing, **updates}
        merged["updatedAt"] = updates.get("updatedAt") or int(time.time() * 1000)
        pk = f"CASE#{case_id}"

        try:
            self.table.put_item(Item=merged)
        except (ClientError, Exception):
            if pk not in self._local_storage:
                self._local_storage[pk] = {}
            self._local_storage[pk]["METADATA"] = merged

        return merged

    def delete_case(self, case_id: str) -> None:
        pk = f"CASE#{case_id}"
        try:
            self.table.delete_item(Key={"PK": pk, "SK": "METADATA"})
        except (ClientError, Exception):
            self._local_storage.pop(pk, None)


_default_repo = DynamoDBRepository()


def get_dynamo_repo() -> DynamoDBRepository:
    return _default_repo
