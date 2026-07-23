from api.jobs import get_job_manager
from api.worker import process_job


def test_job_enqueueing_and_worker_processing():
    manager = get_job_manager()
    job = manager.create_job(
        user_id="user-job-test",
        job_type="intake_extraction",
        payload={"notes": "Patient has seizures and developmental delay"},
    )
    assert job["id"] is not None
    assert job["status"] == "queued"

    # Process job via worker
    result = process_job(
        job_id=job["id"],
        user_id="user-job-test",
        job_type="intake_extraction",
        payload=job["payload"],
    )
    assert result["status"] == "succeeded"
    assert "result" in result
    assert result["result"]["count"] > 0

    # Poll updated job
    polled = manager.get_job(job["id"], user_id="user-job-test")
    assert polled is not None
    assert polled["status"] == "succeeded"
    assert polled["result"]["count"] > 0
