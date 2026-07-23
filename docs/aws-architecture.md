# Lumina SaaS — AWS Enterprise Architecture

## Architectural Data & Request Flow

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

## AWS Component Specifications

| Architecture Layer | AWS Service | Technical Role & Specification |
| :--- | :--- | :--- |
| **Front-End & CDN** | **Amazon CloudFront** | Global edge distribution serving static web bundle with Origin Access Control (OAC). |
| | **Amazon S3 (Web Bucket)** | Private S3 bucket hosting Next.js static export bundle (`apps/web/out`). |
| **Authentication** | **Amazon Cognito** | Hosted UI and User Pool managing OAuth flow and issuing RS256 signed JWT tokens with `doctor` and `patient` groups. |
| **API & Compute** | **Amazon API Gateway** | HTTP API Gateway with CORS support routing requests to serverless compute. |
| | **AWS Lambda (FastAPI)** | Serverless Python container executing FastAPI API logic, validating JWT claims, and managing submission lifecycle. |
| **Data & Storage** | **Amazon DynamoDB** | Single-table DynamoDB (`lumina-app`) storing Users, Submissions, Messages, Cases, and Jobs using `PK`, `SK`, `GSI1`, `GSI2`. |
| | **Amazon S3 (Uploads)** | Private bucket for patient photos and lab reports accessed exclusively via time-limited presigned URLs. |
| | **SQLite Reference DB** | Read-only Orphanet and HPO medical ontology graph packaged directly within Lambda environment. |
| **Async & AI** | **Amazon SQS** | Asynchronous job queue for background document processing + Dead Letter Queue (DLQ). |
| | **AWS Lambda (Worker)** | Event-driven SQS worker executing AI extraction, HPO validation, and scoring tasks idempotently. |
| | **Amazon Bedrock** | GenAI foundation model runtime (Claude 3 Haiku / Nova Micro) with a $0 fallback `DEMO` mode default. |
| **Governance & Security**| **AWS IAM & OIDC** | Least-privilege execution roles and keyless GitHub Actions OIDC deployment role. |
| | **Amazon CloudWatch** | Serverless log aggregation with 7-day retention to prevent storage bloat. |
| | **AWS Budgets** | Hard cost alert triggering email notifications if spending exceeds $5/month. |
