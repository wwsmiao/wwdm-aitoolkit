@echo off
cd /d "%~dp0"
call .\venv\Scripts\activate.bat
cd ui
echo Virtual environment is active. You can now run Python commands.
cmd /k