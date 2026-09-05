from decimal import Decimal

import boto3
import pytest
from moto import mock_aws

from api.dynamo_repo import DynamoDBRepository


@pytest.fixture(name="dynamo_repo")
def dynamo_repo_fixture():
    with mock_aws():
        client = boto3.client("dynamodb", region_name="us-east-1")
        client.create_table(
            TableName="lumina-app",
            KeySchema=[
                {"AttributeName": "PK", "KeyType": "HASH"},
                {"AttributeName": "SK", "KeyType": "RANGE"},
            ],
            AttributeDefinitions=[
                {"AttributeName": "PK", "AttributeType": "S"},
                {"AttributeName": "SK", "AttributeType": "S"},
                {"AttributeName": "GSI1PK", "AttributeType": "S"},
                {"AttributeName": "GSI1SK", "AttributeType": "S"},
                {"AttributeName": "GSI2PK", "AttributeType": "S"},
                {"AttributeName": "GSI2SK", "AttributeType": "S"},
            ],
            GlobalSecondaryIndexes=[
                {
                    "IndexName": "GSI1",
                    "KeySchema": [
                        {"AttributeName": "GSI1PK", "KeyType": "HASH"},
                        {"AttributeName": "GSI1SK", "KeyType": "RANGE"},
                    ],
                    "Projection": {"ProjectionType": "ALL"},
                },
                {
                    "IndexName": "GSI2",
                    "KeySchema": [
                        {"AttributeName": "GSI2PK", "KeyType": "HASH"},
                        {"AttributeName": "GSI2SK", "KeyType": "RANGE"},
                    ],
                    "Projection": {"ProjectionType": "ALL"},
                },
            ],
            BillingMode="PAY_PER_REQUEST",
        )
        repo = DynamoDBRepository(table_name="lumina-app", region="us-east-1")
        yield repo


def test_create_and_get_submission(dynamo_repo):
    item = dynamo_repo.create_submission(
        {
            "id": "sub-101",
            "patientOwnerId": "patient-alpha",
            "notes": "Patient notes for intake",
            "status": "doctor_review_pending",
        }
    )
    assert item["id"] == "sub-101"

    fetched = dynamo_repo.get_submission("sub-101")
    assert fetched is not None
    assert fetched["patientOwnerId"] == "patient-alpha"
    assert fetched["notes"] == "Patient notes for intake"


def test_list_submissions_by_owner_and_status(dynamo_repo):
    dynamo_repo.create_submission(
        {
            "id": "sub-1",
            "patientOwnerId": "patient-A",
            "notes": "Sub 1",
            "status": "doctor_review_pending",
        }
    )
    dynamo_repo.create_submission(
        {
            "id": "sub-2",
            "patientOwnerId": "patient-A",
            "notes": "Sub 2",
            "status": "in_review",
        }
    )
    dynamo_repo.create_submission(
        {
            "id": "sub-3",
            "patientOwnerId": "patient-B",
            "notes": "Sub 3",
            "status": "doctor_review_pending",
        }
    )
    dynamo_repo.create_case(
        {
            "id": "case-not-a-submission",
            "doctorOwnerId": "doctor-1",
            "caseData": {"rankings": []},
        }
    )

    p_a_subs = dynamo_repo.list_submissions(role="patient", user_id="patient-A")
    assert len(p_a_subs) == 2

    pending_subs = dynamo_repo.list_submissions(status="doctor_review_pending")
    assert len(pending_subs) == 2

    doctor_subs = dynamo_repo.list_submissions(role="doctor", user_id="doctor-1")
    assert len(doctor_subs) == 3
    assert all(item["PK"].startswith("SUBMISSION#") for item in doctor_subs)


def test_submission_messages(dynamo_repo):
    dynamo_repo.create_submission(
        {"id": "sub-msg-1", "patientOwnerId": "patient-C", "status": "needs_more_data"}
    )
    dynamo_repo.add_submission_message("sub-msg-1", "doctor-1", "Please upload lab report")

    messages = dynamo_repo.list_submission_messages("sub-msg-1")
    assert len(messages) == 1
    assert messages[0]["message"] == "Please upload lab report"
    assert messages[0]["doctorId"] == "doctor-1"


def test_create_and_get_case(dynamo_repo):
    case = dynamo_repo.create_case(
        {
            "id": "case-999",
            "doctorOwnerId": "doctor-10",
            "caseData": {"patientName": "John Doe", "rankings": []},
        }
    )
    assert case["id"] == "case-999"

    fetched = dynamo_repo.get_case("case-999")
    assert fetched is not None
    assert fetched["caseData"]["patientName"] == "John Doe"

    cases = dynamo_repo.list_cases(doctor_owner_id="doctor-10")
    assert len(cases) == 1


def test_case_persistence_converts_nested_floats_for_dynamodb(dynamo_repo):
    dynamo_repo.create_case(
        {
            "id": "case-floats",
            "doctorOwnerId": "doctor-10",
            "caseData": {
                "rankings": [
                    {
                        "confidence": 87.5,
                        "contributing_terms": [{"weight": 0.625}],
                    }
                ],
                "hpoTerms": [{"confidence": -0.75}],
            },
        }
    )

    fetched = dynamo_repo.get_case("case-floats")
    assert fetched is not None
    assert fetched["caseData"]["rankings"][0]["confidence"] == Decimal("87.5")
    assert fetched["caseData"]["rankings"][0]["contributing_terms"][0]["weight"] == Decimal("0.625")
    assert fetched["caseData"]["hpoTerms"][0]["confidence"] == Decimal("-0.75")


def test_list_cases_fetches_every_dynamodb_page(dynamo_repo):
    first_page = [
        {
            "PK": f"CASE#case-{index}",
            "SK": "METADATA",
            "GSI1PK": "USER#doctor-10",
            "GSI1SK": f"CASE#{index}",
            "id": f"case-{index}",
            "updatedAt": index,
        }
        for index in range(50)
    ]
    second_page = [
        {
            "PK": f"CASE#case-{index}",
            "SK": "METADATA",
            "GSI1PK": "USER#doctor-10",
            "GSI1SK": f"CASE#{index}",
            "id": f"case-{index}",
            "updatedAt": index,
        }
        for index in range(50, 100)
    ]

    class PaginatedTable:
        def __init__(self):
            self.calls = []

        def query(self, **kwargs):
            self.calls.append(kwargs)
            if "ExclusiveStartKey" not in kwargs:
                return {
                    "Items": first_page,
                    "LastEvaluatedKey": {"PK": "CASE#case-49", "SK": "METADATA"},
                }
            return {"Items": second_page}

    table = PaginatedTable()
    dynamo_repo._table = table

    cases = dynamo_repo.list_cases(doctor_owner_id="doctor-10")

    assert len(cases) == 100
    assert cases[0]["id"] == "case-99"
    assert cases[-1]["id"] == "case-0"
    assert len(table.calls) == 2
    assert table.calls[1]["ExclusiveStartKey"] == {
        "PK": "CASE#case-49",
        "SK": "METADATA",
    }
    assert table.calls[0]["ExpressionAttributeValues"][":gsi1sk"] == "CASE#"
    assert "#submission_id" in table.calls[0]["ProjectionExpression"]
    assert "#case_data.#source_submission_id" in table.calls[0]["ProjectionExpression"]
    assert "#case_data.referralLetterDraft" in table.calls[0]["ProjectionExpression"]
    assert "#case_data.rankings[0].#name" in table.calls[0]["ProjectionExpression"]
    assert "#case_data.hpoTerms[31].hpo_id" in table.calls[0]["ProjectionExpression"]
