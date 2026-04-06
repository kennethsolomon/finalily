---
paths:
  - "app/Exceptions/**"
  - "**/exceptions/**"
  - "**/errors/**"
  - "src/lib/**"
  - "src/services/**"
  - "app/Services/**"
---

# Error Handling Rules

- Fail loudly — never swallow exceptions with empty catch blocks
- Use specific error types: `NotFoundError`, `ValidationError`, `AuthError` — not generic `Error`
- Include enough context to debug: what was attempted, what failed, relevant IDs/params
- External API calls: always handle timeout, 4xx, 5xx — log the response body
- Database operations: handle constraint violations, deadlocks, connection failures explicitly
- User-facing errors: helpful message without internal details — "Email already registered" not "UNIQUE constraint failed: users.email"
- Retry transient failures (network, rate limits) with exponential backoff — max 3 attempts
- Never catch-all at low levels — let errors propagate to the appropriate handler
- Validation errors: return all field errors at once — not one at a time
- Log errors with structured context (JSON) — not string concatenation
