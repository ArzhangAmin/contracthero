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

### Run in Development

```bash
pnpm dev
```

This starts:
- `apps/web` on http://localhost:3000
- `apps/api` on http://localhost:3001

---

## License

Private -- All rights reserved.
