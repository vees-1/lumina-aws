import os
import time
from typing import Any
from uuid import uuid4

import boto3
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from api.auth import get_current_actor
from api.dynamo_repo import get_dynamo_repo

jobs_router = APIRouter(tags=["jobs"])


class CreateJobRequest(BaseModel):
    job_type: str  # "intake_extraction" | "case_scoring"
    payload: dict[str, Any]


class JobManager:
    def __init__(self, queue_url: str | None = None, region: str | None = None):
        self.queue_url = (
            queue_url or os.getenv("LUMINA_SQS_QUEUE_URL") or os.getenv("SQS_QUEUE_URL") or ""
        )
        self.region = (
            region or os.getenv("AWS_REGION") or os.getenv("NEXT_PUBLIC_AWS_REGION") or "us-east-1"
        )
        self._sqs_client = None

    @property
    def sqs(self):
        if self._sqs_client is None:
            self._sqs_client = boto3.client("sqs", region_name=self.region)
        return self._sqs_client

    def create_job(self, user_id: str, job_type: str, payload: dict[str, Any]) -> dict[str, Any]:
        job_id = str(uuid4())
        now = int(time.time() * 1000)

        job_item = {
            "PK": f"JOB#{job_id}",
            "SK": "METADATA",
            "GSI1PK": f"USER#{user_id}",
            "GSI1SK": f"JOB#{now}",
            "id": job_id,
            "userId": user_id,
            "jobType": job_type,
            "status": "queued",
            "payload": payload,
            "result": None,
            "error": None,
            "createdAt": now,
            "updatedAt": now,
        }

        repo = get_dynamo_repo()
        try:
            repo.table.put_item(Item=job_item)
        except Exception:
            if "JOB#" + job_id not in repo._local_storage:
                repo._local_storage["JOB#" + job_id] = {}
            repo._local_storage["JOB#" + job_id]["METADATA"] = job_item

        # Enqueue SQS message if queue configured
        if self.queue_url:
            try:
                self.sqs.send_message(
                    QueueUrl=self.queue_url,
                    MessageBody=str(
                        {
                            "job_id": job_id,
                            "user_id": user_id,
                            "job_type": job_type,
                            "payload": payload,
                        }
                    ),
                )
            except Exception:
                pass

        return job_item

    def get_job(self, job_id: str, user_id: str | None = None) -> dict[str, Any] | None:
        repo = get_dynamo_repo()
        pk = f"JOB#{job_id}"
        item = None
        try:
            res = repo.table.get_item(Key={"PK": pk, "SK": "METADATA"})
            item = res.get("Item")
        except Exception:
            item = repo._local_storage.get(pk, {}).get("METADATA")

        if item and user_id and item.get("userId") != user_id:
            return None

        return item

    def update_job_status(
        self,
        job_id: str,
        status: str,
        result: dict[str, Any] | None = None,
        error: str | None = None,
    ) -> dict[str, Any]:
        repo = get_dynamo_repo()
        existing = self.get_job(job_id)
        if not existing:
            raise KeyError(f"Job {job_id} not found")

        now = int(time.time() * 1000)
        existing["status"] = status
        existing["updatedAt"] = now
        if result is not None:
            existing["result"] = result
        if error is not None:
            existing["error"] = error

        pk = f"JOB#{job_id}"
        try:
            repo.table.put_item(Item=existing)
        except Exception:
            if pk not in repo._local_storage:
                repo._local_storage[pk] = {}
            repo._local_storage[pk]["METADATA"] = existing

        return existing


_job_manager = JobManager()


def get_job_manager() -> JobManager:
    return _job_manager


@jobs_router.post("/jobs")
async def enqueue_job(body: CreateJobRequest, request: Request):
    user_id, _role = get_current_actor(request)
    if body.job_type not in {"intake_extraction", "case_scoring"}:
        raise HTTPException(status_code=400, detail="Invalid job_type")

    manager = get_job_manager()
    job = manager.create_job(user_id, body.job_type, body.payload)
    return job


@jobs_router.get("/jobs/{job_id}")
async def get_job_status(job_id: str, request: Request):
    user_id, _role = get_current_actor(request)
    manager = get_job_manager()
    job = manager.get_job(job_id, user_id=user_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job
