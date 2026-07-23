import boto3
import pytest
from moto import mock_aws

from api.s3_storage import S3Storage


@pytest.fixture(name="s3_storage")
def s3_storage_fixture():
    with mock_aws():
        client = boto3.client("s3", region_name="us-east-1")
        client.create_bucket(Bucket="lumina-test-bucket")
        storage = S3Storage(bucket_name="lumina-test-bucket", region="us-east-1")
        yield storage


def test_s3_key_format(s3_storage):
    s3_key = s3_storage.generate_s3_key(
        sub="user-123",
        submission_id="sub-abc",
        kind="photo",
        file_name="rash.png",
    )
    assert s3_key.startswith("tenant/default/users/user-123/submissions/sub-abc/photo/")
    assert s3_key.endswith(".png")


def test_presigned_upload_and_put_get_object(s3_storage):
    key = s3_storage.generate_s3_key(
        sub="user-456",
        submission_id="sub-xyz",
        kind="lab",
        file_name="blood_test.pdf",
    )
    presigned = s3_storage.create_presigned_upload(key, "application/pdf")
    assert "upload_url" in presigned
    assert presigned["s3_key"] == key

    s3_storage.put_object_bytes(key, b"fake pdf content", "application/pdf")
    content, content_type = s3_storage.get_object_bytes(key)
    assert content == b"fake pdf content"
    assert content_type == "application/pdf"

    download_url = s3_storage.create_presigned_download(key)
    assert "lumina-test-bucket" in download_url
