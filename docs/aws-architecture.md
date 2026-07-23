# Lumina Rare Disease SaaS — End-to-End System Architecture

## How Lumina Works: 4-Stage Functional Workflow

```mermaid
flowchart LR
    subgraph Stage1 ["Stage 1: Patient Intake & Evidence Collection"]
        P["Patient"] -->|1. Sign in via Cognito| WebSPA["Next.js Static Export SPA"]
        WebSPA -->|2. Upload Notes / Photos / Labs / Genetics| S3Private["Private S3 Uploads (Presigned URLs)"]
        WebSPA -->|3. Save Submission| DDB1[("DynamoDB (State: doctor_review_pending)")]
    end

    subgraph Stage2 ["Stage 2: Async AI Extraction & Disease Scoring"]
        DDB1 -->|4. Queue Job| SQS["Amazon SQS Queue"]
        SQS -->|5. Trigger Worker| Worker["Lambda Worker"]
        Worker -->|6. Extract Phenotypes| Bedrock["Amazon Bedrock AI Engine"]
        Worker -->|7. Match Reference Graph| ReferenceDB[("Orphanet / HPO Reference Graph")]
        Worker -->|8. Rank Candidate Diseases| DDB2[("DynamoDB (Save HPO & Rankings)")]
    end

    subgraph Stage3 ["Stage 3: Clinician Review & Verification"]
        Doc["Clinician / Doctor"] -->|9. Review Queue| DocDash["Clinician Dashboard"]
        DocDash -->|10. Accept / Edit / Reject HPO Terms| HPOQueue["HPO Approval Queue"]
        DocDash -->|11. Generate Referral Letter| AIProvider["AI Letter Generator"]
        DocDash -->|12. Release Report| DDB3[("DynamoDB (State: released_to_patient)")]
    end

    subgraph Stage4 ["Stage 4: Released Patient Report"]
        P -->|13. View Summary| PatientDash["Patient Portal"]
        PatientDash -->|14. Read Report & Recommendation| Report["Plain-Language Summary & Visit Guide"]
    end
```

## AWS Services Mapped to Lumina Features

| Lumina Feature | Functional Purpose | AWS Serverless Backend Component |
| :--- | :--- | :--- |
| **Patient Portal & Intake Form** | Static web interface for patient intake, evidence upload, and status tracking. | **CloudFront + S3 (Web Bucket)** hosting static Next.js export assets. |
| **Secure Authentication** | Role-based login (`doctor` vs `patient`) with JWT token verification. | **Amazon Cognito Hosted UI & User Pools** issuing RS256 JWT tokens. |
| **Private Evidence Storage** | Direct browser-to-S3 upload for clinical notes, photos, lab reports, and VCF files. | **Amazon S3 (Uploads Bucket)** via temporary Presigned Put/Get URLs. |
| **Submission & Case Records** | Single-table persistence for submissions, message history, and case evaluations. | **Amazon DynamoDB** (`lumina-app`) with GSIs for patient ownership & review status. |
| **Background AI Processing** | Decoupled background queue for heavy document processing and scoring tasks. | **Amazon SQS Queue + Lambda Worker** running background processing. |
| **Phenotype & GenAI Extraction** | Extracts structured HPO terms and generates clinical referral letters. | **Amazon Bedrock** (Claude 3 Haiku / Nova Micro) with $0 `DEMO` fallback. |
| **Rare Disease Scoring Engine** | Ranks 6,000+ rare diseases against patient's extracted phenotypic profile. | **AWS Lambda + Read-Only Orphanet/HPO SQLite** graph matching engine. |
| **Clinician Referral Letter Generator** | Streamed markdown referral letter generation for medical genetics specialists. | **FastAPI on AWS Lambda** with AI provider abstraction. |
