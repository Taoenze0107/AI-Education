@echo off
setlocal
cd /d "%~dp0"
if exist ".venv\Scripts\python.exe" goto check_python
where py >nul 2>nul
if errorlevel 1 goto use_python
py -3 -m venv .venv
if errorlevel 1 goto failed
goto check_python
:use_python
python -m venv .venv
if errorlevel 1 goto failed
:check_python
".venv\Scripts\python.exe" -c "import sys; sys.exit(0 if sys.version_info >= (3, 11) else 'Python 3.11 or newer is required. Rename .venv and run this again after installing Python.')"
if errorlevel 1 goto failed
".venv\Scripts\python.exe" -c "from pathlib import Path; import sys; p=Path('.venv/.adaptive-tutor-installed'); sys.exit(0 if not p.exists() or any(Path(f).stat().st_mtime > p.stat().st_mtime for f in ['pyproject.toml', 'requirements.txt']) else 1)"
if errorlevel 1 goto configured
echo Preparing this folder's Python environment (internet needed on first run)...
".venv\Scripts\python.exe" -m pip install --disable-pip-version-check -e .
if errorlevel 1 goto failed
type nul > ".venv\.adaptive-tutor-installed"
:configured
if not exist .env copy /y .env.example .env >nul
if not defined TUTOR_PORT set "TUTOR_PORT=8000"
if not defined TUTOR_HOST set "TUTOR_HOST=127.0.0.1"
echo Open http://127.0.0.1:%TUTOR_PORT% in your browser. Press Ctrl+C here to stop.
".venv\Scripts\python.exe" -m uvicorn app.main:app --host "%TUTOR_HOST%" --port "%TUTOR_PORT%"
if errorlevel 1 goto failed
exit /b 0
:failed
echo Startup failed. Python 3.11 or newer and internet access are needed for the first installation.
echo Read the message above, then see QUICKSTART.md for manual startup.
pause
exit /b 1
