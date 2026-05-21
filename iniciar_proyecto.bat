@echo off
title BioFacial - Panel de Control (Nube)
color 0B
cls

echo ==============================================================
echo   BIOFACIAL - SISTEMA DE BIOMETRIA 100%% EN LA NUBE (UNERG)
echo ==============================================================
echo.

:: Verificar si existe la variable de entorno MONGODB_URI o en .env
if "%MONGODB_URI%"=="" (
  echo [!] ADVERTENCIA: La variable de entorno MONGODB_URI no esta definida en la sesion actual.
  echo     Asegurate de tener configurado tu archivo .env en la carpeta 'backend'
  echo     o define la variable MONGODB_URI antes de arrancar.
  echo.
) else (
  echo [+] MongoDB Atlas configurado detectado en el entorno.
  echo.
)

echo ==============================================================
echo   INSTRUCCIONES PARA LA PRESENTACION EN LA NUBE:
echo ==============================================================
echo   1. Asegurate de que esta laptop tenga conexion activa a Internet.
echo   2. El backend se conectara directamente a MongoDB Atlas en la nube.
echo   3. El codigo QR en el punto de venta (BodeUnerg) apuntara a
echo      la plataforma en la nube (https://bankunerg1.netlify.app)
echo      para registrar los rostros de los estudiantes de forma remota.
echo   4. Los usuarios usaran sus propios datos moviles o Wi-Fi para el registro.
echo.
echo   * Direcciones Locales de Desarrollo:
echo     - Punto de Venta (BodeUnerg): https://localhost:5174
echo     - Portal de Registro Local (BankUnerg): https://localhost:5173
echo ==============================================================
echo.
pause

echo Iniciando servidores locales... Por favor espera.
echo.

:: Iniciar Backend
start "BioFacial - Backend (Puerto 5000)" cmd /k "cd backend && npm start"

:: Iniciar BankUnerg (Registro de Rostros)
start "BioFacial - BankUnerg (Puerto 5173)" cmd /k "cd BankUnerg && npm run dev -- --host --port 5173"

:: Iniciar BodeUnerg (Punto de Venta)
start "BioFacial - BodeUnerg (Puerto 5174)" cmd /k "cd BodeUnerg && npm run dev -- --host --port 5174"

:: Esperar un par de segundos a que arranquen los servidores
timeout /t 3 /nobreak >nul

:: Abrir el Punto de Venta en la laptop
start https://localhost:5174

echo [+] ¡Todo listo! Servidores ejecutandose en ventanas secundarias.
echo [+] El Punto de Venta se ha abierto en tu navegador de forma automatica.
echo [+] No cierres las otras ventanas para mantener el sistema activo.
echo.
pause
