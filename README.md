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

# Email Configuration (for password reset)
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=true
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password  # Gmail App Password, not regular password!
MAIL_FROM=your-email@gmail.com
MAIL_FROM_NAME=Panel
FRONTEND_URL=http://localhost:3000
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

**Backend API:**
```bash
cd backend
gunicorn -c scripts/gunicorn.conf.py scripts.wsgi:application
```

**Celery Workers (MUST run separately from API):**
```bash
# Start workers for different queues (run in separate processes/containers)
python -m backend.scripts.celery_worker default      # Default queue (analytics, etc.)
python -m backend.scripts.celery_worker server_tasks # Server management tasks
python -m backend.scripts.celery_worker key_tasks     # Key generation tasks

# Or use systemd services (see backend/scripts/*.service files)
# Update paths in service files and install:
# sudo cp backend/scripts/celery_worker_*.service /etc/systemd/system/
# sudo systemctl enable celery-worker-default celery-worker-server-tasks celery-worker-key-tasks
# sudo systemctl start celery-worker-default celery-worker-server-tasks celery-worker-key-tasks
```

**Important:** Celery workers MUST run in separate processes/containers from the Flask API server. Do not start workers in the same process as Gunicorn.

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

### Password Reset

The application supports password reset via email. Configure email settings in `.env`:

**Gmail Setup:**
1. Enable 2-Step Verification in your Google Account
2. Generate an App Password: Google Account > Security > App passwords
3. Use the App Password (not your regular password) in `MAIL_PASSWORD`

**Other Email Providers:**
- **SendGrid:** `MAIL_SERVER=smtp.sendgrid.net`, `MAIL_USERNAME=apikey`, `MAIL_PASSWORD=your-api-key`
- **Mailgun:** `MAIL_SERVER=smtp.mailgun.org`, use your Mailgun credentials

**Important:** For password reset emails to work, Celery workers must be running (see Production section).

Added alias for product and change to the product 