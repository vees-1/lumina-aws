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

    p_a_subs = dynamo_repo.list_submissions(role="patient", user_id="patient-A")
    assert len(p_a_subs) == 2

    pending_subs = dynamo_repo.list_submissions(status="doctor_review_pending")
    assert len(pending_subs) == 2


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
