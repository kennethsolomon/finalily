---
paths:
  - "routes/api.php"
  - "app/Http/Controllers/**"
  - "**/controllers/**"
  - "**/handlers/**"
  - "src/api/**"
---

# API Standards

## Conventions

- **Validation**: Validate all input at the boundary. Use form requests, schemas, or middleware — never trust raw input.
- **Error responses**: Return structured JSON errors with appropriate HTTP status codes. Include enough context to debug.
- **Authentication**: Every endpoint must explicitly declare its auth requirement (public, authenticated, admin).
- **Rate limiting**: Apply rate limits to public and authentication endpoints.
- **Versioning**: Use URL or header versioning for breaking changes.
- **Response shape**: Consistent response envelope — `{ data, meta, errors }` or framework convention.
- **Idempotency**: POST/PUT/PATCH operations should be idempotent where possible.
