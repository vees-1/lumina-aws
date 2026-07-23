import json
from typing import Any

from api.ai_provider import get_ai_provider
from api.jobs import get_job_manager


def process_job(
    job_id: str,
    user_id: str,
    job_type: str,
    payload: dict[str, Any],
    hpo_vocab: dict[str, str] | None = None,
) -> dict[str, Any]:
    manager = get_job_manager()
    job = manager.get_job(job_id)
    if not job:
        return {"status": "failed", "error": "Job not found"}

    if job.get("status") == "succeeded":
        return job  # Idempotent skip if already succeeded

    manager.update_job_status(job_id, "running")
    provider = get_ai_provider()

    try:
        if job_type == "intake_extraction":
            notes = payload.get("notes", "")
            terms = provider.extract_hpo_terms(notes, hpo_vocab=hpo_vocab)
            result = {"terms": terms, "count": len(terms)}
        elif job_type == "case_scoring":
            result = {"scoreStatus": "completed", "modalities": payload.get("modalities", 1)}
        else:
            result = {"status": "completed"}

        updated = manager.update_job_status(job_id, "succeeded", result=result)
        return updated
    except Exception as exc:
        updated = manager.update_job_status(job_id, "failed", error=str(exc))
        return updated


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    records = event.get("Records", [])
    processed = []

    for record in records:
        try:
            body_str = record.get("body", "{}")
            body = json.loads(body_str) if isinstance(body_str, str) else body_str
            job_id = body.get("job_id")
            user_id = body.get("user_id")
            job_type = body.get("job_type")
            payload = body.get("payload", {})

            if job_id:
                res = process_job(job_id, user_id, job_type, payload)
                processed.append(res)
        except Exception as exc:
            processed.append({"error": str(exc)})

    return {"statusCode": 200, "processed": len(processed)}
