#!/usr/bin/expect -f
set timeout 30
spawn ssh -o StrictHostKeyChecking=no root@38.242.149.188
expect "password:"
send "elbek2197\r"
expect "# "
send "cd /root && pwd && ls -la && docker ps -a\r"
expect "# "
send "exit\r"
expect eof

