# Lumina AWS Migration

This repository tracks the phased migration of Lumina into an AWS-native SaaS architecture.

## Defaults

- GitHub repository: `vees-1/lumina-aws`
- Visibility: private
- AWS region: `us-east-1`
- Cost posture: resume-demo/free-tier conscious
- Auth target: Amazon Cognito Hosted UI
- AI provider target: Amazon Bedrock
- Bedrock default before phase 5: `DEMO` mode, with no real inference unless explicitly configured
- Infrastructure as code target: Terraform
- Terraform state target: S3 backend with versioning and native S3 lockfile support

## Phase Tracker

1. Phase 1 - Repo + baseline cleanup
   - Create the private `vees-1/lumina-aws` repository.
   - Push a fresh baseline commit without old git history.
   - Add migration notes and validate the existing baseline.
   - Status: complete.

2. Phase 2 - Static AWS frontend
   - Convert the Next.js app to static export.
   - Prepare S3 and CloudFront compatible routing.
   - Remove runtime Next.js assumptions that block static hosting.
   - Status: complete after commit `chore: make frontend static export ready`.
   - Note: phase 2 uses a temporary local role/session shim so the frontend can be exported as static files. This is not secure auth and must be replaced by Cognito in phase 3.

3. Phase 3 - Cognito auth + backend trust fix
   - Replace Clerk with Cognito Hosted UI.
   - Stop trusting browser-sent `x-lumina-user-id` and `x-lumina-role` headers.
   - Enforce roles from Cognito JWT claims.
   - Status: next.

4. Phase 4 - AWS persistence
   - Move app data from local SQLite/localStorage to DynamoDB.
   - Move uploaded reports/photos to private S3 with presigned uploads.
   - Keep Orphanet/HPO reference data as a read-only artifact, not DynamoDB records.

5. Phase 5 - Async jobs + Bedrock adapter
   - Add SQS-backed extraction/scoring jobs.
   - Replace direct Groq usage with a provider abstraction.
   - Keep `DEMO` provider as the default to avoid accidental Bedrock spend.

6. Phase 6 - Terraform + deployment hardening
   - Add Terraform for Cognito, S3, CloudFront, API Gateway, Lambda, DynamoDB, SQS, IAM, CloudWatch, Budgets, and GitHub Actions OIDC.
   - Add deployment workflows and cost guardrails.

## Baseline Issues

- No blocking baseline failures found in phase 1.
- `pnpm --filter web lint` passes with existing warnings for React hook dependencies, unused `eslint-disable` comments, and `<img>` usage.
- `pnpm --filter web build` passes static export in phase 2. The build still logs non-blocking i18n formatting/missing-message warnings for several marketing pages and a Next.js `experimental.turbo` warning even though the checked-in `next.config.ts` no longer defines that key.
