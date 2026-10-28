@echo off
setlocal
cd /d "%~dp0"

echo.
echo  Jaguares CRM - Escuela Deportiva Jaguares
echo  ========================================
echo.

where pnpm >nul 2>nul
if errorlevel 1 (
  echo  [X] No encontre pnpm. Instalalo con: npm install -g pnpm
  pause
  exit /b 1
)

echo  [1/3] Levantando Postgres (docker)...
docker compose -f docker-compose.dev.yml up -d
if errorlevel 1 (
  echo  [X] Docker no respondio. Abre Docker Desktop y vuelve a intentar.
  pause
  exit /b 1
)

echo  [2/3] Aplicando migraciones...
call pnpm db:migrate

echo  [3/3] Arrancando el CRM en http://localhost:3010 ...
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 18; Start-Process 'http://localhost:3010'"
call pnpm dev

echo.
echo  El servidor se detuvo. Esta ventana se puede cerrar.
pause
