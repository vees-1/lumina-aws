<div align="center">

# Lumina AWS

**Doctor-reviewed rare disease triage, phenotype scoring, and patient-safe referral generation on an AWS-native serverless architecture.**

[![Live Web App](https://img.shields.io/badge/Live%20App-CloudFront-blue?style=flat-square&logo=amazon-cloudfront)](https://d124bi3e327i7a.cloudfront.net/en)
[![API Gateway](https://img.shields.io/badge/API-AWS%20API%20Gateway-orange?style=flat-square&logo=amazon-apigateway)](https://twfg22gs48.execute-api.us-east-1.amazonaws.com/health)
[![AWS Architecture](https://img.shields.io/badge/AWS-Serverless-orange?style=flat-square&logo=amazon-aws)](docs/aws-architecture.md)
[![IaC Terraform](https://img.shields.io/badge/IaC-Terraform-7B42BC?style=flat-square&logo=terraform)](#local-development)
[![Cognito Auth](https://img.shields.io/badge/Auth-Amazon%20Cognito-FF9900?style=flat-square&logo=amazoncognito)](#how-lumina-works)

</div>

---

## Live Deployed Endpoints

| Component | Live Deployed Endpoint |
| :--- | :--- |
| **Web SPA Application** | [https://d124bi3e327i7a.cloudfront.net/en](https://d124bi3e327i7a.cloudfront.net/en) |
| **API Gateway Backend** | [https://twfg22gs48.execute-api.us-east-1.amazonaws.com/health](https://twfg22gs48.execute-api.us-east-1.amazonaws.com/health) |
| **Cognito Hosted UI Auth** | `https://lumina-app-prod-auth.auth.us-east-1.amazoncognito.com` |
| **AWS Region** | `us-east-1` |

---

## AWS Enterprise Architecture

<div align="center">

![Official AWS Architecture Diagram](docs/assets/aws_official_architecture_diagram.png)

</div>

### Architecture Request & Execution Steps

1. **Static Web Serving**: The user browser loads the Next.js static export SPA from **Amazon CloudFront CDN** backed by a private **Amazon S3 Static Web Bucket** via Origin Access Control (OAC).
2. **Identity & OAuth**: The user authenticates via **Amazon Cognito Hosted UI & User Pool**, receiving an RS256-signed JWT token carrying role claims (`doctor` or `patient`).
3. **API Entry Point**: API calls pass to **Amazon API Gateway** (HTTP API) with the JWT `Authorization` header.
4. **Serverless Compute**: API Gateway routes requests to **AWS Lambda (FastAPI Handler)**, which validates JWT claims and executes business logic.
5. **Persistence**: Lambda reads/writes application state to a single-table **Amazon DynamoDB** (`lumina-aws-prod-app`).
6. **Private File Storage**: Uploaded patient photos and lab reports write directly to **Amazon S3 (Private Uploads Bucket)** using time-limited Presigned URLs.
7. **Async Job Queue**: Heavy extraction tasks are enqueued to an **Amazon SQS Jobs Queue**.
8. **AI Worker & Bedrock**: **AWS Lambda Worker** consumes SQS jobs, invokes **Amazon Bedrock** (Claude 3 Haiku / Nova Micro) for phenotype extraction, validates HPO IDs against the local **Orphanet/HPO SQLite** ontology graph, and writes results to DynamoDB.

---

## How Lumina Works

Lumina is a clinical decision-support platform for rare disease diagnosis designed around a strict **doctor-in-the-loop** safety model.

### 👤 Patient Dashboard Usecase
- **Remote Pre-Intake**: Patients log in via Cognito and submit clinical notes, medical photos, lab PDFs, or genetic variant files.
- **Direct S3 Uploads**: Files bypass application servers and write directly to encrypted private S3 storage via short-lived presigned URLs.
- **Status Tracking & Safe Release**: Patients track submission status (`doctor_review_pending` -> `in_review` -> `released_to_patient`). To prevent panic or confusion, patients **never see raw technical scorecards**—they receive calm, doctor-approved plain-language summaries and recommended specialist visit guides.

### 🩺 Doctor Dashboard Usecase
- **Review Queue**: Clinicians review pending submissions in the patient queue.
- **Phenotype Approval Controls**: Lumina extracts suggested Human Phenotype Ontology (HPO) terms (e.g. `HP:0001250 Seizures`). The doctor must **accept or reject** each suggested phenotype. Rejected/pending terms are strictly excluded to prevent AI hallucinations.
- **Deterministic Rare Disease Scoring**: Approved HPO findings and genetic evidence are scored against 6,000+ diseases using Lin & Resnik ontology similarity algorithms over Orphanet knowledge.
- **Referral Letter Generation & Release**: Lumina generates a doctor-editable one-page referral letter for medical genetics specialists. Once verified, the doctor releases the report to the patient portal.

---

## $0 / Month AWS Free Tier & AI Modes

This architecture is optimized for **$0.00 / month** portfolio and demo deployment:

- **Free Tier Components**: Amazon Cognito (50k MAUs), CloudFront (1 TB transfer), S3 (5 GB), API Gateway (1M calls), Lambda (1M calls), DynamoDB (25 GB), SQS (1M calls).
- **AI Provider Switch (`LUMINA_AI_PROVIDER`)**:
  - `demo` *(Default — $0.00 Cost)*: Uses local HPO dictionary matching ($0 API spend).
  - `bedrock`: Invokes real Amazon Bedrock Claude 3 Haiku / Nova Micro (~$0.00025 per 1,000 tokens).
- **Cost Guardrails**: 7-day CloudWatch log retention and an automated **$5.00 / month AWS Budget alert**.

---

## Local Development

```bash
# Install dependencies
pnpm install

# Run Web SPA locally (http://localhost:3000/en)
cd apps/web && pnpm dev

# Run FastAPI API locally
cd apps/api && uv sync && uv run uvicorn main:app --reload

# Execute tests & linters
cd apps/api && uv run pytest
pnpm --filter web lint && pnpm --filter web typecheck
```

---

## Disclaimer

Lumina is a research prototype for clinical decision support. It is **not a medical device** and does not provide automated diagnostic advice. All clinical decisions must be made by qualified healthcare professionals.
