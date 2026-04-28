# Volunteer Coordination Platform

AI-powered system for smart resource allocation in community volunteer coordination.

## Project Overview

This platform ingests community need reports, structures them via NLP, prioritizes them, matches volunteers, optimizes routes, and closes the loop through feedback. Built as loosely coupled services communicating over REST APIs.

## Architecture

- **Frontend**: Next.js 14 (React) — Admin dashboard and volunteer interface
- **Backend API**: Node.js + Express — HTTP routing, auth, orchestration
- **AI/ML Microservice**: Python 3.11 + FastAPI — NLP, priority, matching, geo-optimization
- **Database**: PostgreSQL 15 — All persistent state

## Prerequisites

- Node.js 20+
- Python 3.11+
- PostgreSQL 15+
- Docker (optional, for containerized setup)

## Quick Start

Using Docker:

```bash
docker compose up
```

The services will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- AI Service: http://localhost:8000
- PostgreSQL: localhost:5432

## Local Development (without Docker)

### 1. Database Setup

Start PostgreSQL and create the database:

```bash
createdb volunteer_coordination
```

Run migrations:

```bash
cd db
./migrate.sh
```

Seed with CSV data:

```bash
python seed.py
```

### 2. AI Microservice

```bash
cd ai-service
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3. Backend API

```bash
cd backend
npm install
npm run dev
```

Runs on http://localhost:4000

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on http://localhost:3000

## Environment Variables

Copy `.env.example` to `.env` and configure:

- `DATABASE_URL` — PostgreSQL connection string
- `AI_SERVICE_URL` — AI microservice endpoint (default: http://localhost:8000)
- `NEXT_PUBLIC_API_URL` — Backend API endpoint for frontend (default: http://localhost:4000)
- `PORT` — Backend API port (default: 4000)
