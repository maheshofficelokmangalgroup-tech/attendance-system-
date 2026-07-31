# 🚀 Production Deployment Guide — Attendance & Leave Management System

This guide outlines two deployment methods:
- **Method 1: Docker Compose Deployment** (Best for VPS / Single Server / Office Server)
- **Method 2: Free Cloud Hosting** (Render + Vercel + Aiven MySQL)

---

## 🛠️ Method 1: Docker Compose Deployment (Recommended for VPS / Office Server)

### Prerequisites
- Ubuntu 20.04/22.04 LTS or Windows Server
- Docker & Docker Compose installed

### Step-by-Step Instructions

1. **Clone the Repository**
   ```bash
   git clone https://github.com/maheshofficelokmangalgroup-tech/attendance-system-.git
   cd attendance-system-
   ```

2. **Configure Environment Variables**
   ```bash
   cp backend/.env.example backend/.env
   cp admin-panel/.env.example admin-panel/.env
   ```
   *Edit `backend/.env`:*
   - Change `SECRET_KEY` to a random 64-character string (e.g. `openssl rand -hex 32`).
   - Set `ALLOWED_ORIGINS` to your domain/IP (e.g., `http://YOUR_SERVER_IP:3000,http://localhost:3000`).

3. **Build & Start Containers**
   ```bash
   docker-compose up -d --build
   ```
   *This automatically:*
   - Starts MySQL 8.0 with utf8mb4 encoding
   - Runs database migrations (`alembic upgrade head`)
   - Seeds initial company, admin account, and sample data (`python scripts/seed.py`)
   - Launches Backend API on port `8000`
   - Launches Admin Panel on port `3000`

4. **Verify Deployment**
   - Health Check: `http://YOUR_SERVER_IP:8000/health`
   - Swagger API Docs: `http://YOUR_SERVER_IP:8000/docs`
   - Admin Panel: `http://YOUR_SERVER_IP:3000`

---

## ☁️ Method 2: Free Cloud Deployment (Vercel + Render + Aiven MySQL)

### Step 1: Free MySQL Database (Aiven.io or TiDB Cloud)
1. Sign up at [Aiven.io](https://aiven.io) or [TiDB Cloud](https://tidbcloud.com) (5 GB Free Forever).
2. Create a MySQL database instance (e.g. `attendance_db`).
3. Note down: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.

### Step 2: Backend API Deployment (Render.com)
1. Sign up at [Render.com](https://render.com).
2. Click **New +** ➔ **Web Service** ➔ Connect `maheshofficelokmangalgroup-tech/attendance-system-`.
3. Set configuration:
   - Root Directory: `backend`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `alembic upgrade head && python scripts/seed.py && uvicorn app.main:app --host 0.0.0.0 --port 10000`
4. Add Environment Variables in Render Dashboard:
   - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (From Aiven/TiDB)
   - `SECRET_KEY` (Random string)
   - `ALLOWED_ORIGINS` = `https://your-admin-panel.vercel.app`
5. Click **Deploy Web Service**. You will get a URL like `https://attendance-backend.onrender.com`.

### Step 3: Admin Panel Deployment (Vercel)
1. Sign up at [Vercel.com](https://vercel.com).
2. Import repository `maheshofficelokmangalgroup-tech/attendance-system-`.
3. Framework Preset: **Vite**.
4. Root Directory: `admin-panel`.
5. Add Environment Variable:
   - `VITE_API_URL` = `https://attendance-backend.onrender.com/api/v1`
6. Click **Deploy**. Your Admin Panel is live at `https://your-app.vercel.app`!

### Step 4: Mobile App (Android APK & iOS Safari PWA)
- **Android APK**: Run `cd mobile && npx expo run:android` or use EAS Build: `npx eas build -p android --profile preview` to get `.apk`.
- **iPhone (iOS)**: Open `https://your-app.vercel.app` in Safari ➔ Tap Share ➔ **Add to Home Screen**.

---

## 🔑 Seed Login Accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@company.com` | `Admin@123` |
| Employee (IT) | `aditya.joshi@acmecorp.com` | `Employee@123` |
| Employee (Const.) | `ganesh.patil@acmecorp.com` | `Employee@123` |
