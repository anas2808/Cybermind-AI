# CyberMind AI — Code Reviewer

## Status
Updated on `feature/code-reviewer`. Runtime verification and integration tests still need to be run locally before this feature is considered production-ready.

## Current flow
- The authenticated React dashboard provides the Code Review navigation item.
- A user chooses an enabled AI provider and a model, chooses review focus, and pastes source code.
- Code is sent only after the user explicitly presses **Review & improve code**.
- The frontend calls `POST /api/code-review/analyze` with the existing Supabase bearer token.
- The backend verifies the authenticated user owns the selected enabled provider and that the model belongs to that provider.
- The existing AI gateway returns concise findings and, when a safe useful replacement is possible, a complete improved-code version.
- The UI shows a short change summary, lets the user copy improved code, and exports the full JSON report.
- Findings display distinct severity colours: critical (red), high (orange), medium (yellow), low (blue), and informational (gray).

## Prompt and output optimization
- Treats source code and comments as untrusted data, never instructions.
- Requests compact JSON only and explicitly forbids chain-of-thought and Markdown wrappers.
- Caps output at 12 findings, 5 improvement bullets, and 3 limitations to reduce unnecessary output tokens; the backend enforces the 12-finding limit even if a model ignores the prompt.
- Requests exact 1-based source line numbers and short evidence excerpts; the backend discards out-of-range lines and lines whose evidence does not match the indicated source line.
- Requires calibrated severity and non-duplicate, actionable findings.
- Requests complete replacement code only when the model can make a meaningful change without inventing missing project context; otherwise `improved_code` is null and the backend clears the improvement summary. The prompt checks imports, types/encodings, exception paths, resource cleanup, meaningful validation, cross-function password-hash consistency, subprocess validation/timeouts, placeholders, and platform-specific behavior.
- The backend rejects empty or NUL-containing replacement output and performs a Python AST syntax check when the declared language is Python. This is a syntax gate only; it does not prove correctness or security, and generated code is never executed.
- Bounds returned text fields and rejects oversized improved-code output.

## Boundaries
- Source is limited to 60,000 characters per request.
- Code is treated as untrusted input; the service does not execute it.
- Findings and suggested code are AI-assisted and must be reviewed before use.
- The response states that code was not executed or tested; an empty result is not proof of security.
- No raw source code or reports are persisted by this feature.
- Provider credentials remain server-side and are decrypted only through the existing provider service.

## Validation checklist
- [ ] Run frontend TypeScript build and lint.
- [ ] Run backend import/startup and API tests.
- [ ] Confirm the GitHub Actions frontend build/lint and backend compile/unit-test jobs pass on `feature/code-reviewer`.
- [ ] Test missing/invalid bearer token.
- [ ] Test provider/model ownership and disabled-provider rejection.
- [ ] Test valid findings, empty findings, malformed model JSON, and provider errors.
- [ ] Test improved code returned, omitted, malformed, and over the output limit.
- [ ] Verify line numbers match evidence and source lines.
- [ ] Confirm severity badges are distinct and readable in light/dark themes.
- [ ] Test large input and mobile layout.
- [ ] Confirm secrets and source snippets are absent from application logs.
