# Lumina AWS SaaS — Architecture Documentation

## Architecture Overview

```mermaid
graph TB
    subgraph Client ["Client Layer"]
        Users["Users (Doctors / Patients)"]
        Browser["Next.js Static Export SPA (Client Browser)"]
    end

    subgraph Edge ["Edge & Content Delivery Layer"]
        CloudFront["Amazon CloudFront CDN"]
        S3Web["Amazon S3 (Static Web Bucket)"]
        OAC["Origin Access Control (OAC)"]
    end

    subgraph Auth ["Authentication & Identity Layer"]
        CognitoUI["Amazon Cognito Hosted UI"]
        CognitoPool["Amazon Cognito User Pool"]
        UserPoolGroups["Groups: doctor | patient"]
    end

    subgraph API ["API & Compute Layer"]
        APIGateway["Amazon API Gateway (HTTP API)"]
        LambdaAPI["AWS Lambda (FastAPI API Handler)"]
    end

    subgraph Persistence ["Persistence Layer"]
        DynamoDB[("Amazon DynamoDB (Single-Table Design: PK, SK, GSI1, GSI2)")]
        S3Uploads["Amazon S3 (Private Uploads Bucket)"]
        RefSQLite[("Read-Only HPO / Orphanet SQLite Dataset")]
    end

    subgraph AsyncAI ["Async & AI Extraction Layer"]
        SQS["Amazon SQS (Jobs Queue + DLQ)"]
        LambdaWorker["AWS Lambda (Worker Handler)"]
        Bedrock["Amazon Bedrock (Claude 3 Haiku / Nova Micro)"]
    end

    subgraph Management ["Observability, Security & Cost Guardrails"]
        OIDC["GitHub Actions OIDC Deploy Role"]
        CloudWatch["Amazon CloudWatch (7-Day Log Retention)"]
        Budgets["AWS Budgets ($5/Month Alert Limit)"]
    end

    %% User Flow Connections
    Users -->|1. Requests Web App| CloudFront
    CloudFront -->|OAC Signed Request| S3Web
    Users -->|2. Authenticates| CognitoUI
    CognitoUI -->|Issues RS256 JWT Token| Browser

    %% API Request Flow
    Browser -->|3. API Call with Bearer Token| APIGateway
    APIGateway -->|4. Triggers Lambda| LambdaAPI
    LambdaAPI -->|5. Verifies JWT & Groups| CognitoPool

    %% Data Storage Flow
    LambdaAPI -->|6. CRUD Operations| DynamoDB
    LambdaAPI -->|7. Presigned Upload/Download| S3Uploads
    LambdaAPI -->|8. Local Ontology Queries| RefSQLite

    %% Async Jobs Flow
    LambdaAPI -->|9. Enqueues Extraction Job| SQS
    SQS -->|10. Triggers SQS Message| LambdaWorker
    LambdaWorker -->|11. Bedrock GenAI Extraction| Bedrock
    LambdaWorker -->|12. Updates Job Status| DynamoDB

    %% Observability & Security
    LambdaAPI -.->|Log Traces| CloudWatch
    LambdaWorker -.->|Log Traces| CloudWatch
    OIDC -.->|Deploys Infrastructure| CloudFront
```

## Architectural Layer Breakdown

| Layer | Service / Component | Purpose & Configuration |
| :--- | :--- | :--- |
| **Edge & CDN** | **Amazon CloudFront** | Delivers static Next.js export web assets globally with HTTPS and Origin Access Control (OAC). |
| | **Amazon S3 (Web Bucket)** | Private S3 bucket storing static HTML/JS/CSS exported assets (`apps/web/out`). |
| **Authentication** | **Amazon Cognito Hosted UI** | Handles user sign-in/sign-up OAuth flow, issuing RS256-signed JWT tokens. |
| | **Amazon Cognito User Pool** | Manages user identity and role assignment (`doctor` and `patient` groups). |
| **API & Compute** | **Amazon API Gateway** | HTTP API Gateway handling CORS, routing, and passing Authorization Bearer headers. |
| | **AWS Lambda (FastAPI API)** | Serverless Python container running FastAPI API. Verifies JWT claims and executes business logic. |
| **Persistence** | **Amazon DynamoDB** | Single-table DynamoDB (`lumina-app`) storing Users, Submissions, Messages, Cases, and Jobs (`PK`, `SK`, `GSI1`, `GSI2`). |
| | **Amazon S3 (Uploads Bucket)** | Private storage for uploaded patient photos and lab reports using presigned URLs (`tenant/default/users/{sub}/submissions/{id}/{kind}/{uuid}`). |
| | **SQLite Reference DB** | Read-only HPO and Orphanet medical ontology database packaged directly with Lambda. |
| **Async & AI** | **Amazon SQS** | Job queue for asynchronous AI extraction and scoring tasks + Dead Letter Queue (DLQ). |
| | **AWS Lambda (Worker)** | Event-driven SQS worker executing extraction jobs and updating DynamoDB status idempotently. |
| | **Amazon Bedrock** | GenAI foundation model runtime (Claude 3 Haiku / Nova Micro) with $0 default `DEMO` fallback mode. |
| **Security & Operations**| **GitHub Actions OIDC** | Keyless IAM deployment authorization using GitHub OIDC token assumption. |
| | **Amazon CloudWatch** | Serverless log aggregation with 7-day retention to prevent storage bloat. |
| | **AWS Budgets** | Hard cost alert triggering email notifications if spending exceeds $5/month. |
