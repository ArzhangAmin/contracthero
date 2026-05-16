# ContractHero

ContractHero is a contract management app designed for expats living in Germany.
Track your contracts (rent, insurance, gym, mobile, internet), monitor important deadlines,
and receive reminder emails before they expire.

---

## Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Frontend   | Next.js 15 (App Router)             |
| Backend    | NestJS                              |
| Database   | PostgreSQL + Prisma ORM             |
| Auth       | Self-hosted JWT (HTTP-only cookie)  |
| Email      | Resend                              |
| Queue      | BullMQ + Redis                      |
| i18n       | next-intl (DE + EN + FA)            |

---

## Monorepo Structure

```
contracthero/
  apps/
    web/        # Next.js 15 (App Router) - port 3000
    api/        # NestJS - port 3001
  packages/
    ui/         # Design system components
    shared/     # Shared types + utilities
  package.json  # pnpm workspace root
```

---

## Getting Started

### Requirements

- Node.js >= 20
- pnpm >= 9
- PostgreSQL >= 15
- Redis >= 7

### Install

```bash
pnpm install
```

### Environment Setup

Copy `.env.example` files in each app and fill in the values:

```bash
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env
```

### Database Migrations

After cloning or pulling new schema changes, run:

```bash
cd apps/api
pnpm prisma migrate deploy   # apply pending migrations
pnpm prisma generate         # refresh the Prisma Client types
```

### Run in Development

```bash
pnpm dev
```

This starts:
- `apps/web` on http://localhost:3000
- `apps/api` on http://localhost:3001

---

## API: Contracts

All `/contracts` endpoints require a valid `access_token` cookie (set on
register/login). Every request is scoped to the authenticated user — a user
can only see, modify, or delete their own contracts. Cross-tenant access
returns `404 Not Found` (never `403`) so the API does not leak the existence
of other users' rows.

| Method | Path              | Description                                       |
|--------|-------------------|---------------------------------------------------|
| POST   | `/contracts`      | Create a contract for the current user            |
| GET    | `/contracts`      | List the user's contracts (paginated, filterable) |
| GET    | `/contracts/:id`  | Fetch a single contract by id                     |
| PATCH  | `/contracts/:id`  | Partially update a contract                       |
| DELETE | `/contracts/:id`  | Soft-delete a contract (sets `deletedAt`)         |

### List query parameters

- `page` (default `1`, min `1`)
- `pageSize` (default `20`, min `1`, max `100`)
- `status` — one of `ACTIVE`, `EXPIRED`, `CANCELLED`
- `category` — one of `RENT`, `INSURANCE`, `GYM`, `MOBILE`, `INTERNET`, `UTILITIES`, `OTHER`
- `search` — case-insensitive substring match on `title` or `counterparty`

### Soft delete semantics

`DELETE /contracts/:id` sets `deletedAt = now()` instead of removing the row.
Subsequent reads exclude the row and return `404`. Re-deleting an
already-deleted row also returns `404` (we never silently mask the operation —
that would hide client-side caching bugs).

### Validation invariants

- `endDate` must be strictly **after** `startDate`. Enforced both at the DTO
  layer (`POST`) and re-validated by the service on `PATCH` against the
  persisted counterpart, so a partial update can never leave the row in an
  invalid state.
- `currency` is a 3-letter ISO 4217 code, auto-uppercased.
- `value` is a `NUMERIC(14, 2)` decimal serialized to the client as a
  **string** (to avoid IEEE-754 rounding).

Full request/response schemas are available at
`http://localhost:3001/api/docs` (Swagger UI) when the API is running.

---

## License

Private -- All rights reserved.
