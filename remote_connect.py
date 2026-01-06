#!/usr/bin/env python3
import subprocess
import sys

# Параметры подключения
host = "38.242.149.188"
user = "root"
password = "elbek2197"

# Команда для проверки контейнеров и запуска docker-compose
commands = [
    "cd /root && pwd",
    "ls -la",
    "docker ps -a",
    "cd /root/panel && docker-compose ps || echo 'No docker-compose in /root/panel'",
    "find /root -name 'docker-compose.yml' -type f 2>/dev/null | head -5"
]

print(f"Подключаюсь к серверу {host}...")

# Используем sshpass через subprocess
for cmd in commands:
    full_cmd = f"sshpass -p '{password}' ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 {user}@{host} '{cmd}'"
    print(f"\n>>> Выполняю: {cmd}")
    try:
        result = subprocess.run(full_cmd, shell=True, capture_output=True, text=True, timeout=30)
        print(result.stdout)
        if result.stderr:
            print(f"STDERR: {result.stderr}", file=sys.stderr)
    except subprocess.TimeoutExpired:
        print("Таймаут при выполнении команды")
    except Exception as e:
        print(f"Ошибка: {e}")

print("\nЗапускаю docker-compose...")
# Попробуем найти и запустить docker-compose
start_cmd = "cd /root/panel && docker-compose up -d || (find /root -name 'docker-compose.yml' -type f | head -1 | xargs dirname | xargs -I {} sh -c 'cd {} && docker-compose up -d')"
full_start_cmd = f"sshpass -p '{password}' ssh -o StrictHostKeyChecking=no {user}@{host} '{start_cmd}'"

try:
    result = subprocess.run(full_start_cmd, shell=True, capture_output=True, text=True, timeout=120)
    print(result.stdout)
    if result.stderr:
        print(f"STDERR: {result.stderr}", file=sys.stderr)
except Exception as e:
    print(f"Ошибка при запуске: {e}")

print("\nПроверяю статус контейнеров...")
status_cmd = "docker ps"
full_status_cmd = f"sshpass -p '{password}' ssh -o StrictHostKeyChecking=no {user}@{host} '{status_cmd}'"
try:
    result = subprocess.run(full_status_cmd, shell=True, capture_output=True, text=True, timeout=30)
    print(result.stdout)
except Exception as e:
    print(f"Ошибка: {e}")

