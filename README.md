<div align="center">

# Lumina AWS

**Doctor-reviewed rare disease triage, phenotype scoring, and patient-safe referral generation on an AWS-native serverless architecture.**

[![Live Web App](https://img.shields.io/badge/Live%20App-CloudFront-blue?style=flat-square&logo=amazon-cloudfront)](https://d124bi3e327i7a.cloudfront.net/en)
[![API Gateway](https://img.shields.io/badge/API-AWS%20API%20Gateway-orange?style=flat-square&logo=amazon-apigateway)](https://twfg22gs48.execute-api.us-east-1.amazonaws.com/health)
[![AWS Architecture](https://img.shields.io/badge/AWS-Serverless-orange?style=flat-square&logo=amazon-aws)](docs/aws-architecture.md)
[![Terraform](https://img.shields.io/badge/IaC-Terraform-7B42BC?style=flat-square&logo=terraform)](#infrastructure--terraform)
[![Auth](https://img.shields.io/badge/Auth-Amazon%20Cognito-FF9900?style=flat-square&logo=amazoncognito)](#security--authentication)

</div>

---

## Live AWS Deployment Endpoints

| Component | Live Deployed Endpoint |
| :--- | :--- |
| **Web SPA Application** | [https://d124bi3e327i7a.cloudfront.net/en](https://d124bi3e327i7a.cloudfront.net/en) |
| **API Gateway Backend** | [https://twfg22gs48.execute-api.us-east-1.amazonaws.com/health](https://twfg22gs48.execute-api.us-east-1.amazonaws.com/health) |
| **Cognito Hosted UI Auth** | `https://lumina-app-prod-auth.auth.us-east-1.amazoncognito.com` |
| **AWS Region** | `us-east-1` |

---

## AWS Enterprise Architecture

```mermaid
graph TB
    subgraph Client ["Client Layer"]
        Users["Users (Doctors / Patients)"]
        Browser["Next.js Static Export SPA (Client Browser)"]
    end

    subgraph FrontEnd ["User & Front-End Layer"]
        CloudFront["Amazon CloudFront CDN"]
        S3Web["Amazon S3 (Static Web Bucket)"]
    end

    subgraph Identity ["Authentication & Identity Layer"]
        CognitoUI["Amazon Cognito Hosted UI"]
        CognitoPool["Amazon Cognito User Pool (Groups: doctor | patient)"]
    end

    subgraph Compute ["API & Compute Layer"]
        APIGateway["Amazon API Gateway (HTTP API)"]
        LambdaAPI["AWS Lambda (FastAPI API Handler)"]
    end

    subgraph Storage ["Data & Storage Layer"]
        DynamoDB[("Amazon DynamoDB (Single-Table Design: PK, SK, GSI1, GSI2)")]
        S3Uploads["Amazon S3 (Private Uploads Bucket)"]
        RefSQLite[("Read-Only HPO / Orphanet SQLite Dataset")]
    end

    subgraph AsyncAI ["Asynchronous Processing & AI Layer"]
        SQS["Amazon SQS (Jobs Queue + DLQ)"]
        LambdaWorker["AWS Lambda (Worker Handler)"]
        Bedrock["Amazon Bedrock (Claude 3 Haiku / Nova Micro)"]
    end

    subgraph Observability ["Observability, Security & Cost Guardrails"]
        OIDC["AWS IAM OIDC (GitHub Actions Deploy)"]
        CloudWatch["Amazon CloudWatch (7-Day Log Retention)"]
        Budgets["AWS Budgets ($5/Month Alert Limit)"]
    end

    %% Data Flow Sequence
    Users -->|1. Request Static Web App| CloudFront
    CloudFront -->|OAC Signed Request| S3Web
    Users -->|2. Authenticate Sign-in| CognitoUI
    CognitoUI -->|Issues RS256 JWT Token| Browser

    Browser -->|3. API Request with JWT Bearer Token| APIGateway
    APIGateway -->|4. Forwards to API Handler| LambdaAPI
    LambdaAPI -->|5. Verify Token & Enforce Group RBAC| CognitoPool

    LambdaAPI -->|6. CRUD Operations & State Management| DynamoDB
    LambdaAPI -->|7. Generate Presigned Upload/Download URLs| S3Uploads
    LambdaAPI -->|8. Query HPO Reference Ontology| RefSQLite

    LambdaAPI -->|9. Enqueue Async Extraction Job| SQS
    SQS -->|10. Trigger Worker Message| LambdaWorker
    LambdaWorker -->|11. Execute AI Phenotype Extraction| Bedrock
    LambdaWorker -->|12. Write Results & Update Job Status| DynamoDB

    LambdaAPI -.->|Log Traces| CloudWatch
    LambdaWorker -.->|Log Traces| CloudWatch
    OIDC -.->|Deploy Infrastructure| CloudFront
```

For complete technical specifications, see [docs/aws-architecture.md](docs/aws-architecture.md).

---

## Migration Status & Phased Roadmap

This repository tracks the complete, phased migration of Lumina into an AWS-native serverless SaaS architecture.

| Phase | Milestone | AWS Infrastructure / Feature Implemented | Status |
| :---: | :--- | :--- | :---: |
| **Phase 1** | Baseline Cleanup | Clean repo initialization under `vees-1/lumina-aws`. | **Complete** |
| **Phase 2** | Static Web Export | Next.js static export SPA (`apps/web/out`) for CloudFront + S3 static hosting. | **Complete** |
| **Phase 3** | Cognito Auth | Amazon Cognito Hosted UI integration, JWT RS256 signature validation, and RBAC (`doctor` / `patient`). | **Complete** |
| **Phase 4** | AWS Persistence | Single-table DynamoDB (`lumina-app`) and private S3 file upload pipeline with presigned URLs. | **Complete** |
| **Phase 5** | Async AI Jobs | SQS-backed background job queue, Lambda worker, Bedrock runtime adapter, and HPO validation. | **Complete** |
| **Phase 6** | Terraform & CI/CD | Modular Terraform (`infra/terraform`), GitHub Actions OIDC deploy workflow, and $5/mo cost alert. | **Complete** |

See [docs/aws-migration.md](docs/aws-migration.md) for full phase logs.

---

## Functional Workflows & Flowcharts

### 1. Doctor-in-the-Loop Clinical Triage Flow

Lumina enforces a strict **doctor-in-the-loop** principle: AI extracts candidate phenotypes, but only doctor-accepted Human Phenotype Ontology (HPO) findings are passed to the deterministic scoring engine.

```mermaid
flowchart TD
    Patient["Patient Intake"] -->|Upload Notes / Photos / Labs| IntakeStore["Private S3 & DynamoDB Store"]
    IntakeStore -->|Submission Pending| ReviewQueue["Doctor Patient Review Queue"]
    ReviewQueue -->|Open Case| PhenotypeExtract["AI Phenotype Extraction (Bedrock)"]
    PhenotypeExtract --> DoctorCheck{"Doctor Phenotype Review"}
    
    DoctorCheck -->|Reject| HallucinationFilter["Excluded From Scoring (Hallucination Control)"]
    DoctorCheck -->|Accept| AcceptedHPO["Doctor-Approved HPO Profile"]
    
    AcceptedHPO --> ScoringEngine["Deterministic Rare Disease Scoring Engine"]
    Genetics["Genetic Evidence"] --> ScoringEngine
    RefGraph[("Orphanet / HPO Knowledge Graph")] --> ScoringEngine

    ScoringEngine --> Results["Doctor-Facing Results Page (Top 10 Differentials)"]
    Results --> ReferralLetter["One-Page Editable Referral Letter"]
    
    ReferralLetter --> DoctorRelease{"Doctor Release Decision"}
    DoctorRelease -->|Release| PatientPortal["Patient Portal (Safe Summary & Letter Only)"]
    DoctorRelease -->|Need More Evidence| PatientMsg["Ask Patient For More Data"]
```

---

### 2. Asynchronous AI Extraction & Disease Scoring Pipeline

```mermaid
sequenceDiagram
    autonumber
    actor Patient as Patient / Doctor
    participant Web as Next.js Static SPA
    participant APIGW as API Gateway HTTP API
    participant LambdaAPI as Lambda (FastAPI API)
    participant Dynamo as Single-Table DynamoDB
    participant S3 as Private S3 Uploads Bucket
    participant SQS as SQS Jobs Queue
    participant Worker as Lambda Worker
    participant Bedrock as Amazon Bedrock AI Engine

    Patient->>Web: Uploads Clinical Note / Lab PDF / Photo
    Web->>APIGW: POST /submissions/{id}/uploads/presigned
    APIGGW->>LambdaAPI: Authorize & Generate Presigned PUT URL
    LambdaAPI-->>Web: Presigned S3 PUT URL
    Web->>S3: Upload File Directly (Private)
    
    Web->>APIGW: POST /jobs (enqueue extraction)
    APIGW->>LambdaAPI: Create JOB (State: queued)
    LambdaAPI->>Dynamo: PutItem (PK=JOB#id, Status=queued)
    LambdaAPI->>SQS: SendMessage (job_id, payload)
    LambdaAPI-->>Web: Return job_id (HTTP 200)

    SQS->>Worker: Trigger SQS Record
    Worker->>Dynamo: UpdateItem (Status=running)
    Worker->>Bedrock: Invoke Model (Extract Phenotypes)
    Bedrock-->>Worker: Raw HPO JSON Candidates
    Worker->>Worker: Validate HPO IDs against Local HPO Vocab
    Worker->>Dynamo: UpdateItem (Status=succeeded, Result=terms)

    Web->>APIGW: GET /jobs/{job_id} (Poll Status)
    APIGW->>LambdaAPI: GetItem (JOB#id)
    LambdaAPI-->>Web: Return Status & Extracted HPO Findings
```

---

## What Is Lumina?

Lumina is a clinical decision-support platform for rare disease diagnosis. It helps clinicians convert scattered patient evidence (clinical notes, facial photographs, lab PDFs, and genetic reports) into structured, doctor-reviewed Human Phenotype Ontology (HPO) findings, score candidate rare diseases against Orphanet/HPO knowledge, and generate a polished one-page referral letter.

### Key Principles

- **AI Suggests, Doctor Decides**: AI provides phenotype candidates; clinicians accept or reject each finding.
- **Hallucination Control**: Rejected and pending findings are strictly excluded from rare disease scoring.
- **Explainable Scoring**: Differential rankings use deterministic ontology similarity (Lin, Resnik/MICA, Jaccard) combined with genetic evidence calibration.
- **Patient Safety**: Raw scorecard confidence tables remain doctor-facing. Patients receive calm, doctor-approved summaries and referral letters.

---

## AWS Technology Stack

| Architecture Layer | AWS & Open-Source Technology |
| :--- | :--- |
| **Front-End & CDN** | Next.js Static Export SPA, React, TypeScript, Tailwind CSS, Amazon CloudFront, Amazon S3. |
| **Authentication** | Amazon Cognito Hosted UI & User Pools (RS256 JWT validation, `doctor` and `patient` groups). |
| **API & Serverless** | AWS Lambda (Python FastAPI API Handler & SQS Worker Handler), Amazon API Gateway HTTP API. |
| **Persistence** | Amazon DynamoDB (Single-table design: `PK`, `SK`, `GSI1`, `GSI2`), Amazon S3 (Private uploads). |
| **Async Processing** | Amazon SQS (Jobs queue + Dead Letter Queue). |
| **GenAI & Extraction** | Amazon Bedrock (Claude 3 Haiku / Nova Micro) with fallback `DEMO` provider mode. |
| **Knowledge Base** | Read-Only Orphanet & HPO SQLite medical ontology database packaged directly with Lambda. |
| **Infrastructure as Code** | Terraform (`infra/terraform`) with S3 state backend (`use_lockfile = true`). |
| **CI/CD Deployment** | GitHub Actions OIDC deployment workflow (`.github/workflows/deploy.yml`). |
| **Observability & Cost** | Amazon CloudWatch (7-day retention) and AWS Budgets ($5/month limit alert). |

---

## Local Development & Testing

### Prerequisites

- Node.js 20+ & `pnpm`
- Python 3.14+ & `uv`
- Terraform 1.5+ (optional for IaC validation)

### Quick Start

1. **Install Dependencies**:
   ```bash
   pnpm install
   ```

2. **Run Frontend (Static SPA)**:
   ```bash
   cd apps/web
   pnpm dev
   ```

3. **Run API Backend**:
   ```bash
   cd apps/api
   uv sync
   uv run uvicorn main:app --reload
   ```

4. **Execute Tests & Linters**:
   ```bash
   # Run backend pytest suite (17 tests)
   cd apps/api && uv run pytest

   # Run Python linter & format check
   cd apps/api && uv run ruff check . && uv run ruff format --check .

   # Run frontend lint & static build check
   pnpm --filter web lint && pnpm --filter web typecheck && pnpm --filter web build
   ```

5. **Validate Infrastructure as Code**:
   ```bash
   cd infra/terraform
   terraform fmt -check
   ```

---

## Disclaimer

Lumina is a research prototype for clinical decision support. It is **not a medical device** and does not provide automated diagnostic advice. All clinical decisions, diagnosis verifications, and referral releases must be made by qualified healthcare professionals.
