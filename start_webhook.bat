@echo off
REM RippleRead Webhook Auto-Start
REM Run this on login (press Win+R, type "shell:startup", put shortcut here)

cd /d "E:\RippleRead\RippleRead"

REM Read DEPLOY_SECRET from .env
for /f "tokens=2 delims==" %%a in ('findstr DEPLOY_SECRET .env') do set DEPLOY_SECRET=%%a

REM Start Docker if not running
docker compose up -d

REM Start webhook server in background
start /min "RippleRead-Deploy" python app\webhook_server.py

echo RippleRead started. Webhook listening on port 9000.
