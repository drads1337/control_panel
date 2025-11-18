# Panel Project

Modern admin panel with React frontend and Python backend.

## Tech Stack

**Frontend:** React 19, TypeScript, Vite, TanStack Query, React Router, Tailwind CSS, Radix UI, Vitest

**Backend:** Python 3.11+, Flask, SQLAlchemy, Celery, PostgreSQL, Redis

## Requirements

- Node.js 18+
- Python 3.11+
- PostgreSQL 14+
- Redis

## Setup

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Available at `http://localhost:3000`

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create `.env` file:

```env
DATABASE_URL=postgresql://user:password@localhost/dbname
SECRET_KEY=your-secret-key
REDIS_URL=redis://localhost:6379/0
```

Run migrations and start server:

```bash
python scripts/setup_migrations.py
python scripts/run.py
```

Available at `http://localhost:5001`

## Testing

**Frontend:**
```bash
cd frontend
npm run test
```

**Backend:**
```bash
cd backend
pytest
```

## Production

**Frontend:**
```bash
cd frontend
npm run build:prod
```

**Backend:**
```bash
cd backend
gunicorn -c scripts/gunicorn.conf.py scripts.wsgi:application
```

## Architecture

```
frontend/src/
├── app/          # Pages and routes
├── components/   # Reusable components
├── hooks/        # Custom React hooks
├── entities/     # Business entities (API, types)
├── lib/          # Utilities
└── contexts/     # React contexts

backend/
├── routes/       # API endpoints
├── models/       # SQLAlchemy models
├── services/     # Business logic
├── schemas/      # Pydantic schemas
└── tasks/        # Celery tasks
```

## Authentication

HTTP-only cookies with CSRF protection enabled.