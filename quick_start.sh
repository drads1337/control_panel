#!/bin/bash
# Быстрый запуск Docker контейнеров
cd /var/www/panel

# Создать .env
python3 << 'EOF'
import secrets
with open('.env', 'w') as f:
    f.write(f'''POSTGRES_DB=panel
POSTGRES_USER=panel_user
POSTGRES_PASSWORD={secrets.token_urlsafe(16)}
POSTGRES_PORT=5432
REDIS_PASSWORD={secrets.token_urlsafe(16)}
REDIS_PORT=6380
SECRET_KEY={secrets.token_urlsafe(32)}
FLASK_ENV=production
FLASK_DEBUG=0
PANEL_MASTER_KEY={secrets.token_hex(32)}
JWT_SECRET_KEY={secrets.token_urlsafe(32)}
TOKEN_STATIC_WORD={secrets.token_urlsafe(32)}
OFFLINE_TICKET_SECRET={secrets.token_urlsafe(32)}
PROJECT_MASTER_KEY={secrets.token_hex(32)}
FRONTEND_URL=https://ovrin.xyz
CORS_ORIGINS=https://ovrin.xyz,https://www.ovrin.xyz
API_PORT=5001
NGINX_HTTP_PORT=80
NGINX_HTTPS_PORT=443
FLOWER_PORT=5555
FLOWER_BASIC_AUTH=admin:admin
''')
EOF

# SSL
mkdir -p nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout nginx/ssl/key.pem -out nginx/ssl/cert.pem -subj '/CN=ovrin.xyz' 2>/dev/null

# Запуск
docker-compose up -d --build

echo "✅ Контейнеры запущены!"
docker-compose ps

