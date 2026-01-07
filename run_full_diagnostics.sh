#!/bin/bash
# Полная проверка фронтенда и окружения от A до Я

set -euo pipefail
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
cd "$SCRIPT_DIR"

log() {
  echo "[D] $*"
}

log "1) Проверка статуса контейнеров"
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps --services --filter status=running

log "2) Проверка базовой доступности сервисов"
curl -sSf http://localhost:5001/api/health/live >/dev/null && echo "API /health ok" || echo "⚠️ API health недоступен"
curl -sSf http://localhost || true >/dev/null

log "3) Проверка nginx конфигурации"
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec nginx nginx -t

log "4) Проверка заголовков HTTPS"
curl -k -I https://ovrin.xyz | head -20
log "5) Проверка статических ассетов"
curl -k -I https://ovrin.xyz/assets/js/index-Ck0YAJ-G.js | head -10

log "6) Запуск детальной диагностики (final_check)
"; ./final_check.sh

log "7) Проверка списка ассетов"
./check_all_assets.sh

log "8) Проверка frontend (debug)"
./debug_frontend.sh

log "9) Просмотр последних логов nginx"
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=20 nginx

log "10) Проверка бесперебойности HTTPS и HTTP"
curl -k -I http://ovrin.xyz | grep -i 'cross-origin-opener' || true
curl -k -I https://ovrin.xyz | grep -i 'cross-origin-opener' || true

log "Готово. Если есть ошибки в браузере — см. DevTools Console/Network и пришлите вывод."
