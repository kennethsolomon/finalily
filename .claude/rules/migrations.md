---
paths:
  - "database/migrations/**"
  - "prisma/**"
  - "prisma/migrations/**"
  - "**/*.migration.ts"
  - "db/migrate/**"
  - "db/schema.rb"
  - "**/migrations/**"
  - "**/migrate/**"
  - "**/alembic/**"
  - "**/alembic/versions/**"
  - "**/drizzle/**"
  - "**/knex/migrations/**"
  - "**/sequelize/migrations/**"
  - "**/typeorm/migrations/**"
  - "**/flyway/**"
  - "**/liquibase/**"
---

# Database Migration Rules

- All migrations must be reversible — always implement `down()` or a rollback method
- Never modify an existing migration that has been merged — create a new one
- Adding columns to existing tables: always nullable or with a default — never NOT NULL without default
- Dropping columns in production: 3-step process (1: stop writing to column + deploy, 2: drop column, 3: clean up code)
- Always add an index on every foreign key column
- Naming: `create_users_table`, `add_email_to_users`, `drop_legacy_tokens_from_users`
- Wrap destructive operations (DROP, TRUNCATE, large UPDATEs) in transactions
- Run `migrate:fresh` (or equivalent) in CI to catch issues before production
- Seed data goes in seeders/fixtures — never hardcoded inside a migration
- Backfilling large tables: use batched updates — never update millions of rows in one transaction
- Index naming: explicit names like `idx_users_email` — do not rely on auto-generated names
