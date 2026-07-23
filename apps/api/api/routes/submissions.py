import json
import shutil
import time
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlmodel import Session, select

from api.app_db import UPLOAD_DIR
from api.app_models import ClinicalCase, DoctorRequestMessage, PatientSubmission

router = APIRouter(tags=["submissions"])


def _now_ms() -> int:
    return int(time.time() * 1000)


def _actor(request: Request) -> tuple[str, str]:
    user_id = request.headers.get("x-lumina-user-id", "").strip()
    role = request.headers.get("x-lumina-role", "").strip()
    if not user_id or role not in {"doctor", "patient"}:
        raise HTTPException(status_code=401, detail="Missing Lumina actor headers")
    return user_id, role


def _submission_payload(
    row: PatientSubmission, *, include_messages: bool = False, session: Session | None = None
) -> dict:
    messages = []
    if include_messages and session is not None:
        rows = session.exec(
            select(DoctorRequestMessage)
            .where(DoctorRequestMessage.submission_id == row.id)
            .order_by(DoctorRequestMessage.timestamp.desc())
        ).all()
        messages = [
            {
                "id": item.id,
                "doctorId": item.doctor_id,
                "message": item.message,
                "timestamp": item.timestamp,
            }
            for item in rows
        ]
    return {
        "id": row.id,
        "timestamp": row.timestamp,
        "updatedAt": row.updated_at,
        "patientOwnerId": row.patient_owner_id,
        "doctorReviewerId": row.doctor_reviewer_id,
        "patientName": row.patient_name,
        "age": row.age,
        "sex": row.sex,
        "notes": row.notes,
        "photoFileName": row.photo_file_name,
        "labFileName": row.lab_file_name,
        "geneticEvidence": json.loads(row.genetic_evidence_json)
        if row.genetic_evidence_json
        else None,
        "status": row.status,
        "linkedCaseId": row.linked_case_id,
        "doctorMessage": row.latest_doctor_message,
        "patientSummary": json.loads(row.patient_summary_json)
        if row.patient_summary_json
        else None,
        "releasedLetterMarkdown": row.released_letter_markdown,
        "releasedCaseId": row.released_case_id,
        "releaseTimestamp": row.release_timestamp,
        "visitRecommendation": row.visit_recommendation,
        "messages": messages,
    }


def _case_payload(row: ClinicalCase) -> dict:
    payload = json.loads(row.case_json)
    payload["id"] = row.id
    if row.submission_id:
        payload["sourceSubmissionId"] = row.submission_id
    return payload


def _submission_upload_dir(submission_id: str) -> Path:
    return UPLOAD_DIR / submission_id


def _save_upload(
    submission_id: str, kind: str, upload: UploadFile | None
) -> tuple[str | None, str | None, str | None]:
    if upload is None or not upload.filename:
        return None, None, None
    target_dir = _submission_upload_dir(submission_id)
    target_dir.mkdir(parents=True, exist_ok=True)
    suffix = Path(upload.filename).suffix
    target = target_dir / f"{kind}{suffix}"
    with target.open("wb") as out:
        shutil.copyfileobj(upload.file, out)
    return upload.filename, str(target), upload.content_type


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
    if genetic_evidence:
        try:
            json.loads(genetic_evidence)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=400, detail="Invalid genetic evidence JSON") from exc

    submission_id = str(uuid4())
    photo_name, photo_path, photo_type = _save_upload(submission_id, "photo", photo)
    lab_name, lab_path, lab_type = _save_upload(submission_id, "lab", lab)
    now = _now_ms()
    row = PatientSubmission(
        id=submission_id,
        timestamp=now,
        updated_at=now,
        patient_owner_id=user_id,
        patient_name=patient_name or None,
        age=age or None,
        sex=sex or None,
        notes=notes.strip() if notes else None,
        photo_file_name=photo_name,
        photo_path=photo_path,
        photo_content_type=photo_type,
        lab_file_name=lab_name,
        lab_path=lab_path,
        lab_content_type=lab_type,
        genetic_evidence_json=genetic_evidence or None,
        status="doctor_review_pending",
    )
    with Session(request.app.state.app_db_engine) as session:
        session.add(row)
        session.commit()
        session.refresh(row)
        return _submission_payload(row)


@router.get("/submissions")
async def list_submissions(request: Request, status: str | None = None):
    user_id, role = _actor(request)
    with Session(request.app.state.app_db_engine) as session:
        statement = select(PatientSubmission)
        if role == "patient":
            statement = statement.where(PatientSubmission.patient_owner_id == user_id)
        if status:
            statement = statement.where(PatientSubmission.status == status)
        rows = session.exec(statement.order_by(PatientSubmission.updated_at.desc())).all()
        return [_submission_payload(row) for row in rows]


@router.get("/submissions/{submission_id}")
async def get_submission(submission_id: str, request: Request):
    user_id, role = _actor(request)
    with Session(request.app.state.app_db_engine) as session:
        row = session.get(PatientSubmission, submission_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Submission not found")
        if role == "patient" and row.patient_owner_id != user_id:
            raise HTTPException(status_code=403, detail="Not allowed")
        return _submission_payload(row, include_messages=True, session=session)


@router.get("/submissions/{submission_id}/files/{kind}")
async def get_submission_file(submission_id: str, kind: str, request: Request):
    user_id, role = _actor(request)
    if kind not in {"photo", "lab"}:
        raise HTTPException(status_code=404, detail="File not found")
    with Session(request.app.state.app_db_engine) as session:
        row = session.get(PatientSubmission, submission_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Submission not found")
        if role == "patient" and row.patient_owner_id != user_id:
            raise HTTPException(status_code=403, detail="Not allowed")
        path = row.photo_path if kind == "photo" else row.lab_path
        name = row.photo_file_name if kind == "photo" else row.lab_file_name
        content_type = row.photo_content_type if kind == "photo" else row.lab_content_type
        if not path or not Path(path).exists():
            raise HTTPException(status_code=404, detail="File not found")
        return FileResponse(path, media_type=content_type, filename=name)


@router.post("/submissions/{submission_id}/start-review")
async def start_review(submission_id: str, request: Request):
    user_id, role = _actor(request)
    if role != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can review")
    with Session(request.app.state.app_db_engine) as session:
        row = session.get(PatientSubmission, submission_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Submission not found")
        row.status = "in_review"
        row.doctor_reviewer_id = user_id
        row.updated_at = _now_ms()
        session.add(row)
        session.commit()
        session.refresh(row)
        return _submission_payload(row)


class RequestMoreDataBody(BaseModel):
    message: str


@router.post("/submissions/{submission_id}/request-more-data")
async def request_more_data(submission_id: str, body: RequestMoreDataBody, request: Request):
    user_id, role = _actor(request)
    if role != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can request more data")
    message = body.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")
    now = _now_ms()
    with Session(request.app.state.app_db_engine) as session:
        row = session.get(PatientSubmission, submission_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Submission not found")
        row.status = "needs_more_data"
        row.doctor_reviewer_id = user_id
        row.latest_doctor_message = message
        row.updated_at = now
        session.add(row)
        session.add(
            DoctorRequestMessage(
                id=str(uuid4()),
                submission_id=submission_id,
                doctor_id=user_id,
                message=message,
                timestamp=now,
            )
        )
        session.commit()
        session.refresh(row)
        return _submission_payload(row, include_messages=True, session=session)


class LinkCaseBody(BaseModel):
    case_id: str


def _complete_review(
    session: Session, submission_id: str, case_id: str, doctor_id: str
) -> PatientSubmission:
    row = session.get(PatientSubmission, submission_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Submission not found")
    row.status = "doctor_completed"
    row.linked_case_id = case_id
    row.doctor_reviewer_id = doctor_id
    row.updated_at = _now_ms()
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


@router.post("/submissions/{submission_id}/complete-review")
async def complete_review(submission_id: str, body: LinkCaseBody, request: Request):
    user_id, role = _actor(request)
    if role != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can complete reviews")
    with Session(request.app.state.app_db_engine) as session:
        row = _complete_review(session, submission_id, body.case_id, user_id)
        return _submission_payload(row)


@router.post("/submissions/{submission_id}/link-case")
async def link_case(submission_id: str, body: LinkCaseBody, request: Request):
    user_id, role = _actor(request)
    if role != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can link cases")
    with Session(request.app.state.app_db_engine) as session:
        row = _complete_review(session, submission_id, body.case_id, user_id)
        return _submission_payload(row)


class ReleaseSubmissionBody(BaseModel):
    case_id: str
    patient_summary: dict
    letter_markdown: str
    visit_recommendation: str


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
    now = _now_ms()
    with Session(request.app.state.app_db_engine) as session:
        row = session.get(PatientSubmission, submission_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Submission not found")
        case = session.get(ClinicalCase, body.case_id)
        if case is None or case.doctor_owner_id != user_id:
            raise HTTPException(status_code=403, detail="Case is not available for release")
        row.status = "released_to_patient"
        row.linked_case_id = body.case_id
        row.released_case_id = body.case_id
        row.patient_summary_json = json.dumps(body.patient_summary)
        row.released_letter_markdown = letter
        row.visit_recommendation = body.visit_recommendation
        row.release_timestamp = now
        row.doctor_reviewer_id = user_id
        row.updated_at = now
        session.add(row)
        session.commit()
        session.refresh(row)
        return _submission_payload(row)


class CaseBody(BaseModel):
    case_data: dict
    submission_id: str | None = None


def _clear_submission_case_state(submission: PatientSubmission, case_id: str) -> None:
    touched = False
    if submission.linked_case_id == case_id:
        submission.linked_case_id = None
        touched = True
    if submission.released_case_id == case_id:
        submission.released_case_id = None
        submission.patient_summary_json = None
        submission.released_letter_markdown = None
        submission.release_timestamp = None
        submission.visit_recommendation = None
        touched = True
    if touched:
        submission.status = (
            "in_review" if submission.doctor_reviewer_id else "doctor_review_pending"
        )
        submission.updated_at = _now_ms()


def _delete_submission_related_case(
    session: Session, submission_id: str, doctor_id: str | None = None
) -> ClinicalCase | None:
    row = session.exec(
        select(ClinicalCase).where(ClinicalCase.submission_id == submission_id)
    ).first()
    if row is None:
        return None
    if doctor_id is not None and row.doctor_owner_id != doctor_id:
        raise HTTPException(status_code=403, detail="Linked case is not available")
    session.delete(row)
    return row


@router.post("/cases")
async def create_case(body: CaseBody, request: Request):
    user_id, role = _actor(request)
    if role != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can save cases")
    case_id = str(body.case_data.get("id") or uuid4())
    body.case_data["id"] = case_id
    if body.submission_id:
        body.case_data["sourceSubmissionId"] = body.submission_id
    now = _now_ms()
    patient_owner_id = None
    with Session(request.app.state.app_db_engine) as session:
        if body.submission_id:
            submission = session.get(PatientSubmission, body.submission_id)
            if submission:
                patient_owner_id = submission.patient_owner_id
        row = ClinicalCase(
            id=case_id,
            timestamp=int(body.case_data.get("timestamp") or now),
            updated_at=now,
            doctor_owner_id=user_id,
            submission_id=body.submission_id,
            patient_owner_id=patient_owner_id,
            case_json=json.dumps(body.case_data),
        )
        session.add(row)
        session.commit()
        return body.case_data


@router.patch("/cases/{case_id}")
async def patch_case(case_id: str, body: CaseBody, request: Request):
    user_id, role = _actor(request)
    if role != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can update cases")
    with Session(request.app.state.app_db_engine) as session:
        row = session.get(ClinicalCase, case_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Case not found")
        if row.doctor_owner_id != user_id:
            raise HTTPException(status_code=403, detail="Not allowed")
        body.case_data["id"] = case_id
        if body.submission_id:
            body.case_data["sourceSubmissionId"] = body.submission_id
        row.case_json = json.dumps(body.case_data)
        row.updated_at = _now_ms()
        row.timestamp = int(body.case_data.get("timestamp") or row.timestamp)
        session.add(row)
        session.commit()
        return body.case_data


@router.get("/cases")
async def list_cases(request: Request):
    user_id, role = _actor(request)
    with Session(request.app.state.app_db_engine) as session:
        statement = select(ClinicalCase)
        if role == "doctor":
            statement = statement.where(ClinicalCase.doctor_owner_id == user_id)
        else:
            return []
        rows = session.exec(statement.order_by(ClinicalCase.updated_at.desc())).all()
        return [_case_payload(row) for row in rows]


@router.get("/cases/{case_id}")
async def get_case(case_id: str, request: Request):
    user_id, role = _actor(request)
    with Session(request.app.state.app_db_engine) as session:
        row = session.get(ClinicalCase, case_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Case not found")
        if role == "doctor" and row.doctor_owner_id != user_id:
            raise HTTPException(status_code=403, detail="Not allowed")
        if role == "patient":
            raise HTTPException(
                status_code=403, detail="Patients can only access released summaries"
            )
        return _case_payload(row)


@router.delete("/submissions/{submission_id}")
async def delete_submission(submission_id: str, request: Request):
    user_id, role = _actor(request)
    with Session(request.app.state.app_db_engine) as session:
        row = session.get(PatientSubmission, submission_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Submission not found")
        if role == "patient" and row.patient_owner_id != user_id:
            raise HTTPException(status_code=403, detail="Not allowed")
        if role == "doctor":
            if row.doctor_reviewer_id and row.doctor_reviewer_id != user_id:
                raise HTTPException(status_code=403, detail="Not allowed")
            _delete_submission_related_case(session, submission_id, user_id)
        else:
            _delete_submission_related_case(session, submission_id)
        for message in session.exec(
            select(DoctorRequestMessage).where(DoctorRequestMessage.submission_id == submission_id)
        ).all():
            session.delete(message)
        session.delete(row)
        session.commit()
    shutil.rmtree(_submission_upload_dir(submission_id), ignore_errors=True)
    return {"ok": True, "id": submission_id}


@router.delete("/cases/{case_id}")
async def delete_case(case_id: str, request: Request):
    user_id, role = _actor(request)
    if role != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can delete cases")
    with Session(request.app.state.app_db_engine) as session:
        row = session.get(ClinicalCase, case_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Case not found")
        if row.doctor_owner_id != user_id:
            raise HTTPException(status_code=403, detail="Not allowed")
        if row.submission_id:
            submission = session.get(PatientSubmission, row.submission_id)
            if submission is not None:
                _clear_submission_case_state(submission, case_id)
                session.add(submission)
        session.delete(row)
        session.commit()
    return {"ok": True, "id": case_id}
