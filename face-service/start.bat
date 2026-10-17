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
python -m pip install -r requirements.txt
if errorlevel 1 (
    echo [LOI] Cai dependencies that bai. Kiem tra Python 3.10-3.12 va Microsoft C++ Build Tools.
    pause
    exit /b 1
)

python -c "import insightface, onnxruntime, flask, cv2"
if errorlevel 1 exit /b 1
if not defined INTERNAL_SERVICE_SECRET (
    echo [LOI] Can dat INTERNAL_SERVICE_SECRET giong backend truoc khi khoi dong.
    pause
    exit /b 1
)
echo [INFO] Khoi dong Face Service tren port 5001...
python app.py
pause
