from sqlmodel import Field, SQLModel


class PatientSubmission(SQLModel, table=True):
    __tablename__ = "app_patient_submission"

    id: str = Field(primary_key=True)
    timestamp: int
    updated_at: int
    patient_owner_id: str = Field(index=True)
    doctor_reviewer_id: str | None = Field(default=None, index=True)
    patient_name: str | None = None
    age: str | None = None
    sex: str | None = None
    notes: str | None = None
    photo_file_name: str | None = None
    photo_path: str | None = None
    photo_content_type: str | None = None
    lab_file_name: str | None = None
    lab_path: str | None = None
    lab_content_type: str | None = None
    genetic_evidence_json: str | None = None
    status: str = Field(index=True)
    linked_case_id: str | None = Field(default=None, index=True)
    latest_doctor_message: str | None = None
    patient_summary_json: str | None = None
    released_letter_markdown: str | None = None
    released_case_id: str | None = Field(default=None, index=True)
    release_timestamp: int | None = None
    visit_recommendation: str | None = None


class DoctorRequestMessage(SQLModel, table=True):
    __tablename__ = "app_doctor_request_message"

    id: str = Field(primary_key=True)
    submission_id: str = Field(index=True)
    doctor_id: str
    message: str
    timestamp: int


class ClinicalCase(SQLModel, table=True):
    __tablename__ = "app_clinical_case"

    id: str = Field(primary_key=True)
    timestamp: int
    updated_at: int
    doctor_owner_id: str = Field(index=True)
    submission_id: str | None = Field(default=None, index=True)
    patient_owner_id: str | None = Field(default=None, index=True)
    case_json: str
