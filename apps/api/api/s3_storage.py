import os
from pathlib import Path
from uuid import uuid4

import boto3
from botocore.exceptions import ClientError


class S3Storage:
    def __init__(self, bucket_name: str | None = None, region: str | None = None):
        self.bucket_name = (
            bucket_name
            or os.getenv("LUMINA_S3_BUCKET")
            or os.getenv("S3_BUCKET_NAME")
            or "lumina-uploads-dev"
        )
        self.region = (
            region or os.getenv("AWS_REGION") or os.getenv("NEXT_PUBLIC_AWS_REGION") or "us-east-1"
        )
        self._s3_client = None

    @property
    def client(self):
        if self._s3_client is None:
            self._s3_client = boto3.client("s3", region_name=self.region)
        return self._s3_client

    def generate_s3_key(self, sub: str, submission_id: str, kind: str, file_name: str) -> str:
        ext = Path(file_name).suffix.lower() if file_name else ""
        unique_id = str(uuid4())
        return f"tenant/default/users/{sub}/submissions/{submission_id}/{kind}/{unique_id}{ext}"

    def create_presigned_upload(
        self, s3_key: str, content_type: str = "application/octet-stream", expires_in: int = 3600
    ) -> dict[str, str]:
        try:
            url = self.client.generate_presigned_url(
                "put_object",
                Params={
                    "Bucket": self.bucket_name,
                    "Key": s3_key,
                    "ContentType": content_type,
                },
                ExpiresIn=expires_in,
            )
            return {
                "upload_url": url,
                "s3_key": s3_key,
                "bucket": self.bucket_name,
                "content_type": content_type,
            }
        except ClientError as exc:
            raise RuntimeError(f"Failed to generate presigned S3 upload URL: {exc}") from exc

    def create_presigned_download(self, s3_key: str, expires_in: int = 3600) -> str:
        try:
            return self.client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket_name, "Key": s3_key},
                ExpiresIn=expires_in,
            )
        except ClientError as exc:
            raise RuntimeError(f"Failed to generate presigned S3 download URL: {exc}") from exc

    def put_object_bytes(
        self, s3_key: str, content: bytes, content_type: str = "application/octet-stream"
    ) -> str:
        self.client.put_object(
            Bucket=self.bucket_name,
            Key=s3_key,
            Body=content,
            ContentType=content_type,
        )
        return s3_key

    def get_object_bytes(self, s3_key: str) -> tuple[bytes, str | None]:
        try:
            response = self.client.get_object(Bucket=self.bucket_name, Key=s3_key)
            body = response["Body"].read()
            content_type = response.get("ContentType")
            return body, content_type
        except ClientError as exc:
            raise FileNotFoundError(f"S3 Key {s3_key} not found: {exc}") from exc

    def delete_object(self, s3_key: str) -> None:
        try:
            self.client.delete_object(Bucket=self.bucket_name, Key=s3_key)
        except ClientError:
            pass


_default_storage = S3Storage()


def get_s3_storage() -> S3Storage:
    return _default_storage
