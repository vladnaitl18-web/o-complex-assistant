#!/bin/zsh
set -e
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Установите Node.js 22.12+ и откройте этот файл снова."
  read "?Нажмите Enter для выхода..."
  exit 1
fi
if [ ! -d node_modules ]; then npm ci; fi
npm run build
printf '\nОткройте http://127.0.0.1:3001 в браузере. Для остановки нажмите Ctrl+C.\n\n'
npm start
