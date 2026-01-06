#!/bin/bash

HOST="38.242.149.188"
USER="root"
PASS="elbek2197"

echo "Подключаюсь к серверу $HOST..."

# Проверяем контейнеры
echo "Проверяю статус контейнеров..."
expect << EOF
set timeout 30
spawn ssh -o StrictHostKeyChecking=no ${USER}@${HOST} "docker ps -a"
expect {
    "password:" {
        send "${PASS}\r"
        exp_continue
    }
    eof
}
EOF

# Находим и запускаем docker-compose
echo "Ищу docker-compose.yml..."
expect << EOF
set timeout 30
spawn ssh -o StrictHostKeyChecking=no ${USER}@${HOST} "find /root -name 'docker-compose.yml' -type f 2>/dev/null | head -1"
expect {
    "password:" {
        send "${PASS}\r"
        exp_continue
    }
    eof
}
EOF

# Запускаем контейнеры
echo "Запускаю контейнеры..."
expect << EOF
set timeout 120
spawn ssh -o StrictHostKeyChecking=no ${USER}@${HOST} "cd /root/panel && docker-compose up -d || (find /root -name 'docker-compose.yml' -type f | head -1 | xargs dirname | xargs -I {} sh -c 'cd {} && docker-compose up -d')"
expect {
    "password:" {
        send "${PASS}\r"
        exp_continue
    }
    eof
}
EOF

# Проверяем статус
echo "Проверяю статус запущенных контейнеров..."
expect << EOF
set timeout 30
spawn ssh -o StrictHostKeyChecking=no ${USER}@${HOST} "docker ps"
expect {
    "password:" {
        send "${PASS}\r"
        exp_continue
    }
    eof
}
EOF

