import os
import time
from decimal import Decimal
from typing import Any
from uuid import uuid4

import boto3

SUBMISSION_STATUSES = (
    "submitted",
    "doctor_review_pending",
    "in_review",
    "needs_more_data",
    "approved",
    "scorecard_ready",
    "doctor_completed",
    "released_to_patient",
)


def _to_dynamodb_value(value: Any) -> Any:
    """Recursively convert JSON numbers into values accepted by DynamoDB."""
    if isinstance(value, float):
        return Decimal(str(value))
    if isinstance(value, dict):
        return {key: _to_dynamodb_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_to_dynamodb_value(item) for item in value]
    if isinstance(value, tuple):
        return tuple(_to_dynamodb_value(item) for item in value)
    return value


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

    @property
    def is_local_mode(self) -> bool:
        """Keep in-memory persistence strictly local; never hide AWS failures in production."""
        return os.getenv("LUMINA_AUTH_MODE", "").strip().lower() == "local"

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

        if self.is_local_mode:
            pk = item["PK"]
            sk = item["SK"]
            if pk not in self._local_storage:
                self._local_storage[pk] = {}
            if sk in self._local_storage[pk]:
                raise ValueError(f"Submission {submission_id} already exists")
            self._local_storage[pk][sk] = item
        else:
            self.table.put_item(
                Item=_to_dynamodb_value(item),
                ConditionExpression="attribute_not_exists(PK)",
            )

        return item

    def get_submission(
        self, submission_id: str, include_messages: bool = False
    ) -> dict[str, Any] | None:
        pk = f"SUBMISSION#{submission_id}"
        item = None
        if self.is_local_mode:
            item = self._local_storage.get(pk, {}).get("METADATA")
        else:
            res = self.table.get_item(Key={"PK": pk, "SK": "METADATA"})
            item = res.get("Item")

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

        if self.is_local_mode:
            for pk, sk_map in self._local_storage.items():
                if "METADATA" in sk_map and pk.startswith("SUBMISSION#"):
                    item = sk_map["METADATA"]
                    if role == "patient" and user_id and item.get("patientOwnerId") != user_id:
                        continue
                    if status and item.get("status") != status:
                        continue
                    results.append(item)
        else:
            if role == "patient" and user_id:
                query_args: dict[str, Any] = {
                    "IndexName": "GSI1",
                    "KeyConditionExpression": (
                        "GSI1PK = :gsi1pk AND begins_with(GSI1SK, :submission_prefix)"
                    ),
                    "ExpressionAttributeValues": {
                        ":gsi1pk": f"USER#{user_id}",
                        ":submission_prefix": "SUBMISSION#",
                    },
                    "ScanIndexForward": False,
                }
                while True:
                    res = self.table.query(**query_args)
                    results.extend(
                        item
                        for item in res.get("Items", [])
                        if item.get("PK", "").startswith("SUBMISSION#")
                        and item.get("SK") == "METADATA"
                    )
                    last_evaluated_key = res.get("LastEvaluatedKey")
                    if not last_evaluated_key:
                        break
                    query_args["ExclusiveStartKey"] = last_evaluated_key
            else:
                statuses = (status,) if status else SUBMISSION_STATUSES
                for submission_status in statuses:
                    query_args = {
                        "IndexName": "GSI2",
                        "KeyConditionExpression": "GSI2PK = :gsi2pk",
                        "ExpressionAttributeValues": {
                            ":gsi2pk": f"STATUS#{submission_status}"
                        },
                        "ScanIndexForward": False,
                    }
                    while True:
                        res = self.table.query(**query_args)
                        results.extend(
                            item
                            for item in res.get("Items", [])
                            if item.get("PK", "").startswith("SUBMISSION#")
                            and item.get("SK") == "METADATA"
                        )
                        last_evaluated_key = res.get("LastEvaluatedKey")
                        if not last_evaluated_key:
                            break
                        query_args["ExclusiveStartKey"] = last_evaluated_key

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

        if self.is_local_mode:
            if pk not in self._local_storage:
                self._local_storage[pk] = {}
            self._local_storage[pk]["METADATA"] = merged
        else:
            self.table.put_item(Item=_to_dynamodb_value(merged))

        return merged

    def delete_submission(self, submission_id: str) -> None:
        pk = f"SUBMISSION#{submission_id}"
        if self.is_local_mode:
            self._local_storage.pop(pk, None)
        else:
            messages = self.list_submission_messages(submission_id)
            for msg in messages:
                self.table.delete_item(Key={"PK": pk, "SK": f"MSG#{msg['timestamp']}#{msg['id']}"})
            self.table.delete_item(Key={"PK": pk, "SK": "METADATA"})

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

        if self.is_local_mode:
            pk = item["PK"]
            sk = item["SK"]
            if pk not in self._local_storage:
                self._local_storage[pk] = {}
            self._local_storage[pk][sk] = item
        else:
            self.table.put_item(Item=_to_dynamodb_value(item))

        return item

    def list_submission_messages(self, submission_id: str) -> list[dict[str, Any]]:
        pk = f"SUBMISSION#{submission_id}"
        results: list[dict[str, Any]] = []

        if self.is_local_mode:
            for sk, item in self._local_storage.get(pk, {}).items():
                if sk.startswith("MSG#"):
                    results.append(item)
        else:
            res = self.table.query(
                KeyConditionExpression="PK = :pk AND begins_with(SK, :sk_prefix)",
                ExpressionAttributeValues={":pk": pk, ":sk_prefix": "MSG#"},
                ScanIndexForward=False,
            )
            results = res.get("Items", [])

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

        if self.is_local_mode:
            pk = item["PK"]
            sk = item["SK"]
            if pk not in self._local_storage:
                self._local_storage[pk] = {}
            if sk in self._local_storage[pk]:
                raise ValueError(f"Case {case_id} already exists")
            self._local_storage[pk][sk] = item
        else:
            self.table.put_item(
                Item=_to_dynamodb_value(item),
                ConditionExpression="attribute_not_exists(PK)",
            )

        return item

    def get_case(self, case_id: str) -> dict[str, Any] | None:
        pk = f"CASE#{case_id}"
        if self.is_local_mode:
            return self._local_storage.get(pk, {}).get("METADATA")
        res = self.table.get_item(
            Key={"PK": pk, "SK": "METADATA"},
            ConsistentRead=True,
        )
        return res.get("Item")

    def get_case_by_submission_id(self, submission_id: str) -> dict[str, Any] | None:
        if self.is_local_mode:
            for pk, sk_map in self._local_storage.items():
                if pk.startswith("CASE#") and "METADATA" in sk_map:
                    item = sk_map["METADATA"]
                    if item.get("submissionId") == submission_id:
                        return item
        else:
            res = self.table.query(
                IndexName="GSI2",
                KeyConditionExpression="GSI2PK = :gsi2pk",
                ExpressionAttributeValues={":gsi2pk": f"SUBMISSION#{submission_id}"},
            )
            items = res.get("Items", [])
            if items:
                return items[0]
        return None

    def list_cases(self, doctor_owner_id: str) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []
        if self.is_local_mode:
            for pk, sk_map in self._local_storage.items():
                if pk.startswith("CASE#") and "METADATA" in sk_map:
                    item = sk_map["METADATA"]
                    if item.get("doctorOwnerId") == doctor_owner_id:
                        results.append(item)
        else:
            hpo_projection = ", ".join(
                f"#case_data.hpoTerms[{index}].hpo_id" for index in range(32)
            )
            query_args: dict[str, Any] = {
                "IndexName": "GSI1",
                "KeyConditionExpression": (
                    "GSI1PK = :gsi1pk AND begins_with(GSI1SK, :gsi1sk)"
                ),
                "ExpressionAttributeValues": {
                    ":gsi1pk": f"USER#{doctor_owner_id}",
                    ":gsi1sk": "CASE#",
                },
                "ProjectionExpression": (
                    "#id, #timestamp, updatedAt, #submission_id, #case_data.#id, "
                    "#case_data.#timestamp, #case_data.modalities, "
                    "#case_data.rankings[0].#name, "
                    "#case_data.rankings[0].confidence, "
                    "#case_data.patientContext.patientName, "
                    "#case_data.referralLetterDraft, "
                    "#case_data.#source_submission_id, #case_data.#outcome, "
                    f"{hpo_projection}"
                ),
                "ExpressionAttributeNames": {
                    "#id": "id",
                    "#timestamp": "timestamp",
                    "#submission_id": "submissionId",
                    "#case_data": "caseData",
                    "#name": "name",
                    "#source_submission_id": "sourceSubmissionId",
                    "#outcome": "outcome",
                },
                "ScanIndexForward": False,
            }
            while True:
                res = self.table.query(**query_args)
                results.extend(res.get("Items", []))
                last_evaluated_key = res.get("LastEvaluatedKey")
                if not last_evaluated_key:
                    break
                query_args["ExclusiveStartKey"] = last_evaluated_key

        results.sort(key=lambda x: x.get("updatedAt", 0), reverse=True)
        return results

    def update_case(self, case_id: str, updates: dict[str, Any]) -> dict[str, Any]:
        existing = self.get_case(case_id)
        if existing is None:
            raise KeyError(f"Case {case_id} not found")

        merged = {**existing, **updates}
        merged["updatedAt"] = updates.get("updatedAt") or int(time.time() * 1000)
        pk = f"CASE#{case_id}"

        if self.is_local_mode:
            if pk not in self._local_storage:
                self._local_storage[pk] = {}
            self._local_storage[pk]["METADATA"] = merged
        else:
            self.table.put_item(Item=_to_dynamodb_value(merged))

        return merged

    def delete_case(self, case_id: str) -> None:
        pk = f"CASE#{case_id}"
        if self.is_local_mode:
            self._local_storage.pop(pk, None)
        else:
            self.table.delete_item(Key={"PK": pk, "SK": "METADATA"})


_default_repo = DynamoDBRepository()


def get_dynamo_repo() -> DynamoDBRepository:
    return _default_repo
