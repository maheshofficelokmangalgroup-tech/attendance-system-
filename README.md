# Attendance & Leave Management System

Production-grade platform for 500+ employee companies — selfie + GPS check-in, full leave lifecycle, and a real-time admin dashboard.

---

## Project Structure

```
j-demo/
├── backend/          # FastAPI + SQLAlchemy + MySQL 8
├── admin-panel/      # React + Vite + TypeScript (port 3000)
├── mobile/           # React Native + TypeScript  [Phase 1 shell]
├── docker-compose.yml
└── README.md
```

---

## Quick Start (Docker — recommended)

```bash
# 1. Copy and edit environment files
cp backend/.env.example backend/.env
cp admin-panel/.env.example admin-panel/.env

# 2. Start MySQL + backend (runs migrations + seed automatically)
docker-compose up -d

# 3. Verify backend is healthy
curl http://localhost:8000/health

# 4. Open Swagger docs
open http://localhost:8000/docs

# 5. Start admin panel
cd admin-panel && npm install && npm run dev
# → http://localhost:3000
```

Default admin login: **admin@company.com** / **Admin@123**

---

## Manual Setup (Without Docker)

### Prerequisites

- Python 3.12+
- MySQL 8.0+
- Node.js 20+

### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env — set DB_HOST, DB_PASSWORD, SECRET_KEY

# Create database (MySQL)
mysql -u root -p -e "CREATE DATABASE attendance_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Run migrations
alembic upgrade head

# Seed data (roles, permissions, sample company, admin user)
python scripts/seed.py

# Start server
uvicorn main:app --reload --port 8000
```

### Admin Panel

```bash
cd admin-panel
cp .env.example .env
npm install
npm run dev
# → http://localhost:3000
```

---

## API Documentation

- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

All endpoints are versioned under `/api/v1/`. Authentication uses Bearer JWT tokens.

### Auth Flow

```
POST /api/v1/auth/login          → access_token + refresh_token
POST /api/v1/auth/refresh        → rotate refresh token
POST /api/v1/auth/logout         → revoke refresh token
POST /api/v1/auth/forgot-password
POST /api/v1/auth/reset-password
POST /api/v1/auth/change-password
GET  /api/v1/auth/me
```

---

## Roles & Permissions

| Role | Slug | Description |
|---|---|---|
| Admin | `admin` | Full system access |
| HR | `hr` | HR and policy management |
| Manager | `manager` | Team management |
| Employee | `employee` | Self-service |

Permission enforcement is server-side via a single RBAC dependency. See `backend/app/auth/rbac.py` for the full matrix.

---

## Build Phases

| Phase | Status | Description |
|---|---|---|
| 1 — Foundation | ✅ Complete | DB schema, JWT auth, RBAC, org config CRUD, employee CRUD, admin shell |
| 2 — Attendance Engine | ✅ Complete | Check-in/out with selfie + GPS + office geofence, status engine |
| 3 — Leave Management | ✅ Complete | Leave balances, 2-stage approval, LWP fallback, comp-off |
| 4 — Dashboard & Reports | ✅ Complete | KPI row, charts, 10 report types, muster roll |
| 5 — Notifications & Hardening | ✅ Complete | In-app/email/webhook notifications, security headers, rate limiting |
| 6 — Polish & Deployment | ✅ Complete | Dark mode (admin + mobile), Docker Compose deployment |

See [walkthrough.md](walkthrough.md) for a detailed, audited account of what each phase actually contains, including issues found and fixed.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Default |
|---|---|---|
| `DB_HOST` | MySQL host | `localhost` |
| `DB_PORT` | MySQL port | `3306` |
| `DB_NAME` | Database name | `attendance_db` |
| `DB_USER` | DB username | `root` |
| `DB_PASSWORD` | DB password | — |
| `SECRET_KEY` | JWT signing secret (generate with `openssl rand -hex 32`) | — |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access token TTL | `30` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Refresh token TTL | `30` |
| `ALLOWED_ORIGINS` | CORS origins (comma-separated) | `http://localhost:3000` |
| `ADMIN_EMAIL` | Seed admin email | `admin@company.com` |
| `ADMIN_PASSWORD` | Seed admin password | `Admin@123` |

### Admin Panel (`admin-panel/.env`)

| Variable | Description | Default |
|---|---|---|
| `VITE_API_URL` | Backend API base URL | `http://localhost:8000/api/v1` |

---

## Database

MySQL 8 with 21 tables (20 ORM models + 1 role/permission association table). Run migrations with:

```bash
alembic upgrade head         # apply all migrations
alembic downgrade -1         # roll back one migration
alembic revision --autogenerate -m "description"  # create new migration
```

---

## Code Architecture

```
routes → services → repositories → models

- Routes:       Parse request, call service, return DTO. Zero business logic.
- Services:     All business logic. Transaction boundaries owned here.
- Repositories: Data access. One repo per aggregate. No raw SQL.
- Models:       SQLAlchemy ORM. No business logic.
- Schemas:      Pydantic v2 DTOs. Validation at API boundary.
- Auth:         Single RBAC dependency — never scattered if-role checks.
```

---

## Security Notes

- JWT access tokens: 30-minute TTL
- Refresh tokens: stored as SHA-256 hashes in DB (never raw)
- Refresh token rotation: old token revoked on every refresh
- Password hashing: bcrypt
- Password complexity enforced at schema layer (uppercase + lowercase + digit + special)
- CORS restricted to configured origins
- All queries via SQLAlchemy ORM (no raw SQL injection risk)
- Upload validation: MIME type + size cap + randomized filenames (Phase 5)
