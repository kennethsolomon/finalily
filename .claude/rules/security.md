---
paths:
  - "app/Http/Middleware/**"
  - "**/middleware/**"
  - "**/auth/**"
  - "**/authentication/**"
  - "**/authorization/**"
  - "src/security/**"
  - "**/crypto/**"
  - "**/encryption/**"
---

# Security Rules

- Never store passwords in plaintext — use bcrypt, argon2, or scrypt with library defaults
- Never roll your own crypto — use established libraries (sodium, openssl, bcrypt)
- SQL: parameterized queries only — never string concatenation
- XSS: escape all user-provided content before rendering — use framework auto-escaping
- CSRF: validate tokens on all state-changing requests
- Auth tokens: short-lived JWTs (15 min) with long-lived refresh tokens (7 days)
- Secrets: environment variables only — never in code, never in git
- Headers: set X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security
- Cookies: HttpOnly, Secure, SameSite=Lax at minimum
- File uploads: validate MIME type, enforce size limits, rename to random — never trust the filename
- Rate limit auth endpoints aggressively (5 attempts / 15 min)
- Log auth events (login, logout, failed attempts, password changes) — never log passwords or tokens
