# CyberMind AI — Code Reviewer

## Status
Implementation added on `feature/code-reviewer`. Runtime verification and integration tests still need to be run locally before this feature is considered production-ready.

## Current flow
- The authenticated React dashboard provides the Code Review navigation item.
- A user chooses an enabled AI provider and a model, chooses review focus, and pastes source code.
- Code is sent only after the user explicitly presses **Review code**.
- The frontend calls `POST /api/code-review/analyze` with the existing Supabase bearer token.
- The backend verifies the authenticated user owns the selected enabled provider and that the model belongs to that provider.
- The existing AI gateway analyzes source text and returns normalized findings.
- Findings display a distinct severity color: critical (red), high (orange), medium (yellow), low (blue), and informational (gray).
- The user can export the resulting JSON report.

## Boundaries
- Source is limited to 60,000 characters per request.
- Code is treated as untrusted input; the service does not execute it.
- Findings are AI-assisted observations and should be verified by a developer.
- The response states that code was not executed or tested; an empty result is not proof of security.
- No raw source code or reports are persisted by this feature.
- Provider credentials remain server-side and are decrypted only through the existing provider service.

## Validation checklist
- [ ] Run frontend TypeScript build and lint.
- [ ] Run backend import/startup and API tests.
- [ ] Test missing/invalid bearer token.
- [ ] Test provider/model ownership and disabled-provider rejection.
- [ ] Test valid findings, empty findings, malformed model JSON, and provider errors.
- [ ] Confirm severity badges are distinct and readable in light/dark themes.
- [ ] Test large input and mobile layout.
- [ ] Confirm secrets and source snippets are absent from application logs.
