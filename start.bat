@echo off
REM Starts the Forge backend (FastAPI) and frontend (Expo) each in their own
REM window. Close either window (or Ctrl+C inside it) to stop that service.

setlocal
set ROOT=%~dp0

echo Checking Postgres is reachable...
where pg_isready >nul 2>nul
if %ERRORLEVEL%==0 (
    pg_isready -q
    if errorlevel 1 (
        echo.
        echo Postgres does not appear to be running. Start it first ^(e.g. via
        echo Services.msc -^> postgresql-x64-18^), then re-run start.bat.
        echo.
        pause
        exit /b 1
    )
) else (
    echo   pg_isready not found on PATH -- skipping the check, assuming Postgres is up.
)

echo Starting backend (FastAPI) on http://localhost:8000 ...
start "Forge Backend" cmd /k "cd /d "%ROOT%backend" && call .venv\Scripts\activate.bat && uvicorn app.main:app --reload --port 8000"

echo Starting frontend (Expo) ...
start "Forge Frontend" cmd /k "cd /d "%ROOT%frontend" && npx expo start"

echo.
echo Both started in separate windows. Close a window (or Ctrl+C inside it) to stop that service.
endlocal
