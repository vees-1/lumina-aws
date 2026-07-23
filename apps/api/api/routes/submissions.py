import json
import time
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

from api.auth import get_current_actor
from api.dynamo_repo import get_dynamo_repo
from api.s3_storage import get_s3_storage

router = APIRouter(tags=["submissions"])


def _now_ms() -> int:
    return int(time.time() * 1000)


def _actor(request: Request) -> tuple[str, str]:
    return get_current_actor(request)


class PresignedUploadRequest(BaseModel):
    kind: str  # "photo" | "lab"
    file_name: str
    content_type: str = "application/octet-stream"


class CompleteUploadRequest(BaseModel):
    kind: str  # "photo" | "lab"
    s3_key: str
    file_name: str
    content_type: str = "application/octet-stream"


class RequestMoreDataBody(BaseModel):
    message: str


class LinkCaseBody(BaseModel):
    case_id: str


class ReleaseSubmissionBody(BaseModel):
    case_id: str
    patient_summary: dict
    letter_markdown: str
    visit_recommendation: str


class CaseBody(BaseModel):
    case_data: dict
    submission_id: str | None = None


# --- Presigned Upload Routes ---


@router.post("/submissions/{submission_id}/uploads/presigned")
async def get_presigned_upload_url(
    submission_id: str, body: PresignedUploadRequest, request: Request
):
    user_id, role = _actor(request)
    if role != "patient":
        raise HTTPException(status_code=403, detail="Only patients can request upload URLs")

    if body.kind not in {"photo", "lab"}:
        raise HTTPException(status_code=400, detail="Invalid upload kind")

    repo = get_dynamo_repo()
    sub = repo.get_submission(submission_id)
    if sub and sub.get("patientOwnerId") != user_id:
        raise HTTPException(status_code=403, detail="Not allowed")

    s3 = get_s3_storage()
    s3_key = s3.generate_s3_key(user_id, submission_id, body.kind, body.file_name)
    presigned = s3.create_presigned_upload(s3_key, body.content_type)
    return {**presigned, "kind": body.kind, "file_name": body.file_name}


@router.post("/submissions/{submission_id}/uploads/complete")
async def complete_upload(submission_id: str, body: CompleteUploadRequest, request: Request):
    user_id, role = _actor(request)
    if role != "patient":
        raise HTTPException(status_code=403, detail="Only patients can finalize uploads")

    if body.kind not in {"photo", "lab"}:
        raise HTTPException(status_code=400, detail="Invalid upload kind")

    repo = get_dynamo_repo()
    sub = repo.get_submission(submission_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    if sub.get("patientOwnerId") != user_id:
        raise HTTPException(status_code=403, detail="Not allowed")

    updates = {}
    if body.kind == "photo":
        updates["photoS3Key"] = body.s3_key
        updates["photoFileName"] = body.file_name
        updates["photoContentType"] = body.content_type
    else:
        updates["labS3Key"] = body.s3_key
        updates["labFileName"] = body.file_name
        updates["labContentType"] = body.content_type

    updated = repo.update_submission(submission_id, updates)
    return updated


# --- Submissions CRUD ---


@router.post("/submissions")
async def create_submission(
    request: Request,
    patient_name: str | None = Form(default=None),
    age: str | None = Form(default=None),
    sex: str | None = Form(default=None),
    notes: str | None = Form(default=None),
    genetic_evidence: str | None = Form(default=None),
    photo: UploadFile | None = File(default=None),
    lab: UploadFile | None = File(default=None),
):
    user_id, role = _actor(request)
    if role != "patient":
        raise HTTPException(status_code=403, detail="Only patients can create submissions")

    if (
        not (notes and notes.strip())
        and photo is None
        and lab is None
        and not (genetic_evidence and genetic_evidence.strip())
    ):
        raise HTTPException(status_code=400, detail="Submission requires evidence")

    parsed_genetics = None
    if genetic_evidence:
        try:
            parsed_genetics = json.loads(genetic_evidence)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=400, detail="Invalid genetic evidence JSON") from exc

    submission_id = str(uuid4())
    s3 = get_s3_storage()

    photo_s3_key, photo_name, photo_type = None, None, None
    if photo and photo.filename:
        photo_bytes = await photo.read()
        photo_name = photo.filename
        photo_type = photo.content_type or "application/octet-stream"
        key = s3.generate_s3_key(user_id, submission_id, "photo", photo_name)
        photo_s3_key = s3.put_object_bytes(key, photo_bytes, photo_type)

    lab_s3_key, lab_name, lab_type = None, None, None
    if lab and lab.filename:
        lab_bytes = await lab.read()
        lab_name = lab.filename
        lab_type = lab.content_type or "application/octet-stream"
        key = s3.generate_s3_key(user_id, submission_id, "lab", lab_name)
        lab_s3_key = s3.put_object_bytes(key, lab_bytes, lab_type)

    now = _now_ms()
    payload = {
        "id": submission_id,
        "timestamp": now,
        "updatedAt": now,
        "patientOwnerId": user_id,
        "patientName": patient_name or None,
        "age": age or None,
        "sex": sex or None,
        "notes": notes.strip() if notes else None,
        "photoFileName": photo_name,
        "photoS3Key": photo_s3_key,
        "photoContentType": photo_type,
        "labFileName": lab_name,
        "labS3Key": lab_s3_key,
        "labContentType": lab_type,
        "geneticEvidence": parsed_genetics,
        "status": "doctor_review_pending",
    }

    repo = get_dynamo_repo()
    created = repo.create_submission(payload)
    return created


@router.get("/submissions")
async def list_submissions(request: Request, status: str | None = None):
    user_id, role = _actor(request)
    repo = get_dynamo_repo()
    return repo.list_submissions(role=role, user_id=user_id, status=status)


@router.get("/submissions/{submission_id}")
async def get_submission(submission_id: str, request: Request):
    user_id, role = _actor(request)
    repo = get_dynamo_repo()
    item = repo.get_submission(submission_id, include_messages=True)
    if not item:
        raise HTTPException(status_code=404, detail="Submission not found")
    if role == "patient" and item.get("patientOwnerId") != user_id:
        raise HTTPException(status_code=403, detail="Not allowed")
    return item


@router.get("/submissions/{submission_id}/files/{kind}")
async def get_submission_file(submission_id: str, kind: str, request: Request):
    user_id, role = _actor(request)
    if kind not in {"photo", "lab"}:
        raise HTTPException(status_code=404, detail="File not found")

    repo = get_dynamo_repo()
    item = repo.get_submission(submission_id)
    if not item:
        raise HTTPException(status_code=404, detail="Submission not found")
    if role == "patient" and item.get("patientOwnerId") != user_id:
        raise HTTPException(status_code=403, detail="Not allowed")

    s3_key = item.get("photoS3Key") if kind == "photo" else item.get("labS3Key")
    filename = item.get("photoFileName") if kind == "photo" else item.get("labFileName")

    if not s3_key:
        raise HTTPException(status_code=404, detail="File not found")

    s3 = get_s3_storage()
    try:
        content_bytes, content_type = s3.get_object_bytes(s3_key)
        media_type = content_type or "application/octet-stream"
        disposition = f'inline; filename="{filename}"' if filename else "inline"
        return Response(
            content=content_bytes,
            media_type=media_type,
            headers={"Content-Disposition": disposition},
        )
    except Exception as exc:
        raise HTTPException(status_code=404, detail=f"File not found: {exc}") from exc


@router.post("/submissions/{submission_id}/start-review")
async def start_review(submission_id: str, request: Request):
    user_id, role = _actor(request)
    if role != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can review")

    repo = get_dynamo_repo()
    item = repo.get_submission(submission_id)
    if not item:
        raise HTTPException(status_code=404, detail="Submission not found")

    updated = repo.update_submission(
        submission_id,
        {"status": "in_review", "doctorReviewerId": user_id},
    )
    return updated


@router.post("/submissions/{submission_id}/request-more-data")
async def request_more_data(submission_id: str, body: RequestMoreDataBody, request: Request):
    user_id, role = _actor(request)
    if role != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can request more data")

    message = body.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")

    repo = get_dynamo_repo()
    item = repo.get_submission(submission_id)
    if not item:
        raise HTTPException(status_code=404, detail="Submission not found")

    repo.add_submission_message(submission_id, user_id, message)
    repo.update_submission(
        submission_id,
        {
            "status": "needs_more_data",
            "doctorReviewerId": user_id,
            "latestDoctorMessage": message,
        },
    )
    return repo.get_submission(submission_id, include_messages=True)


@router.post("/submissions/{submission_id}/complete-review")
async def complete_review(submission_id: str, body: LinkCaseBody, request: Request):
    user_id, role = _actor(request)
    if role != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can complete reviews")

    repo = get_dynamo_repo()
    item = repo.get_submission(submission_id)
    if not item:
        raise HTTPException(status_code=404, detail="Submission not found")

    updated = repo.update_submission(
        submission_id,
        {
            "status": "doctor_completed",
            "linkedCaseId": body.case_id,
            "doctorReviewerId": user_id,
        },
    )
    return updated


@router.post("/submissions/{submission_id}/link-case")
async def link_case(submission_id: str, body: LinkCaseBody, request: Request):
    return await complete_review(submission_id, body, request)


@router.post("/submissions/{submission_id}/release")
async def release_submission(submission_id: str, body: ReleaseSubmissionBody, request: Request):
    user_id, role = _actor(request)
    if role != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can release patient results")

    letter = body.letter_markdown.strip()
    if not letter:
        raise HTTPException(status_code=400, detail="Finalized referral letter is required")

    if body.visit_recommendation not in {
        "urgent_clinic",
        "nearest_clinic",
        "routine_specialist",
        "more_data_first",
        "no_visit_needed",
    }:
        raise HTTPException(status_code=400, detail="Invalid visit recommendation")

    repo = get_dynamo_repo()
    sub = repo.get_submission(submission_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    case = repo.get_case(body.case_id)
    if not case or case.get("doctorOwnerId") != user_id:
        raise HTTPException(status_code=403, detail="Case is not available for release")

    now = _now_ms()
    updated = repo.update_submission(
        submission_id,
        {
            "status": "released_to_patient",
            "linkedCaseId": body.case_id,
            "releasedCaseId": body.case_id,
            "patientSummary": body.patient_summary,
            "releasedLetterMarkdown": letter,
            "visitRecommendation": body.visit_recommendation,
            "releaseTimestamp": now,
            "doctorReviewerId": user_id,
        },
    )
    return updated


@router.delete("/submissions/{submission_id}")
async def delete_submission(submission_id: str, request: Request):
    user_id, role = _actor(request)
    repo = get_dynamo_repo()
    item = repo.get_submission(submission_id)
    if not item:
        raise HTTPException(status_code=404, detail="Submission not found")

    if role == "patient" and item.get("patientOwnerId") != user_id:
        raise HTTPException(status_code=403, detail="Not allowed")

    if (
        role == "doctor"
        and item.get("doctorReviewerId")
        and item.get("doctorReviewerId") != user_id
    ):
        raise HTTPException(status_code=403, detail="Not allowed")

    # Delete related case if linked
    linked_case = repo.get_case_by_submission_id(submission_id)
    if linked_case:
        repo.delete_case(linked_case["id"])

    s3 = get_s3_storage()
    if item.get("photoS3Key"):
        s3.delete_object(item["photoS3Key"])
    if item.get("labS3Key"):
        s3.delete_object(item["labS3Key"])

    repo.delete_submission(submission_id)
    return {"ok": True, "id": submission_id}


# --- Clinical Cases CRUD ---


@router.post("/cases")
async def create_case(body: CaseBody, request: Request):
    user_id, role = _actor(request)
    if role != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can save cases")

    case_id = str(body.case_data.get("id") or uuid4())
    body.case_data["id"] = case_id
    if body.submission_id:
        body.case_data["sourceSubmissionId"] = body.submission_id

    repo = get_dynamo_repo()
    patient_owner_id = None
    if body.submission_id:
        sub = repo.get_submission(body.submission_id)
        if sub:
            patient_owner_id = sub.get("patientOwnerId")

    now = _now_ms()
    payload = {
        "id": case_id,
        "timestamp": int(body.case_data.get("timestamp") or now),
        "updatedAt": now,
        "doctorOwnerId": user_id,
        "submissionId": body.submission_id,
        "patientOwnerId": patient_owner_id,
        "caseData": body.case_data,
    }

    repo.create_case(payload)
    return body.case_data


@router.patch("/cases/{case_id}")
async def patch_case(case_id: str, body: CaseBody, request: Request):
    user_id, role = _actor(request)
    if role != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can update cases")

    repo = get_dynamo_repo()
    case_item = repo.get_case(case_id)
    if not case_item:
        raise HTTPException(status_code=404, detail="Case not found")

    if case_item.get("doctorOwnerId") != user_id:
        raise HTTPException(status_code=403, detail="Not allowed")

    body.case_data["id"] = case_id
    if body.submission_id:
        body.case_data["sourceSubmissionId"] = body.submission_id

    now = _now_ms()
    repo.update_case(
        case_id,
        {
            "caseData": body.case_data,
            "submissionId": body.submission_id or case_item.get("submissionId"),
            "updatedAt": now,
        },
    )
    return body.case_data


@router.get("/cases")
async def list_cases(request: Request):
    user_id, role = _actor(request)
    if role != "doctor":
        return []

    repo = get_dynamo_repo()
    cases = repo.list_cases(doctor_owner_id=user_id)
    return [c.get("caseData", {}) for c in cases]


@router.get("/cases/{case_id}")
async def get_case(case_id: str, request: Request):
    user_id, role = _actor(request)
    repo = get_dynamo_repo()
    case_item = repo.get_case(case_id)
    if not case_item:
        raise HTTPException(status_code=404, detail="Case not found")

    if role == "doctor" and case_item.get("doctorOwnerId") != user_id:
        raise HTTPException(status_code=403, detail="Not allowed")
    if role == "patient":
        raise HTTPException(status_code=403, detail="Patients can only access released summaries")

    return case_item.get("caseData", {})


@router.delete("/cases/{case_id}")
async def delete_case(case_id: str, request: Request):
    user_id, role = _actor(request)
    if role != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can delete cases")

    repo = get_dynamo_repo()
    case_item = repo.get_case(case_id)
    if not case_item:
        raise HTTPException(status_code=404, detail="Case not found")

    if case_item.get("doctorOwnerId") != user_id:
        raise HTTPException(status_code=403, detail="Not allowed")

    repo.delete_case(case_id)
    return {"ok": True, "id": case_id}
