@echo off
echo ============================================
echo  GymPro Face Recognition Service
echo ============================================
echo.

python --version >nul 2>&1
if errorlevel 1 (
    echo [LOI] Python chua duoc cai dat. Vui long cai Python 3.10+
    pause
    exit /b 1
)

if not exist venv (
    echo [INFO] Tao virtual environment...
    python -m venv venv
)

echo [INFO] Kich hoat virtual environment...
call venv\Scripts\activate

echo [INFO] Nang cap pip...
python -m pip install --upgrade pip

echo [INFO] Cai dat cac dependencies co ban...
pip install -r requirements.txt

python -c "import insightface" >nul 2>&1
if %errorlevel% EQU 0 goto START_SERVICE

echo [INFO] Dang cai dat insightface qua pre-built wheel (khong can C++ compiler)...
for /f "usebackq tokens=*" %%a in (`python -c "import sys; print(f'https://github.com/Gourieff/Assets/raw/main/Insightface/insightface-0.7.3-cp{sys.version_info.major}{sys.version_info.minor}-cp{sys.version_info.major}{sys.version_info.minor}-win_amd64.whl')"`) do set WHEEL_URL=%%a
echo [INFO] Dang tai va cai dat tu: %WHEEL_URL%
pip install %WHEEL_URL%

:START_SERVICE
echo [INFO] insightface da san sang.
echo [INFO] Khoi dong Face Service tren port 5001...
python app.py
pause
