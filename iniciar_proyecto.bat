@echo off
title BioFacial - Panel de Control (UNERG)
color 0B
cls

echo ==============================================================
echo   BIOFACIAL - SISTEMA DE BIOMETRIA (UNERG)
echo ==============================================================
echo.
echo Seleccione el modo de operacion para la presentacion:
echo.
echo [1] Modo Offline Local (Punto de Acceso Wi-Fi / Sin Internet)
echo     * Recomendado para lugares sin senal de red o sin datos moviles.
echo     * Requiere conectar la laptop y los telefonos al mismo hotspot.
echo.
echo [2] Modo Online Remoto (Senal de Telefono/Datos + Tunel HTTPS)
echo     * Recomendado si hay buena senal de telefono movil.
echo     * Crea un enlace publico seguro (HTTPS) accesible desde cualquier lugar
echo       usando datos moviles, sin necesidad de configurar hotspot local.
echo.
echo ==============================================================
set /p MODO="Elija una opcion (1 o 2) y presione ENTER: "

if "%MODO%"=="2" goto MODO_ONLINE
goto MODO_OFFLINE


:MODO_OFFLINE
cls
echo ==============================================================
echo   INICIANDO MODO OFFLINE LOCAL (HOTSPOT WI-FI)
echo ==============================================================
echo.

:: Obtener la dirección IP local de la laptop usando PowerShell (priorizando adaptador Wi-Fi/Wireless)
for /f "tokens=*" %%i in ('powershell -NoProfile -Command "$addr = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' }; $wifi = $addr | Where-Object { $_.InterfaceAlias -like '*Wi-Fi*' -or $_.InterfaceAlias -like '*Wireless*' -or $_.InterfaceAlias -like '*Wi Fi*' -or $_.InterfaceAlias -like '*inalambrica*' }; if ($wifi) { ($wifi | Select-Object -First 1).IPAddress } else { ($addr | Select-Object -First 1).IPAddress }"') do set LOCAL_IP=%%i

echo [+] Red local detectada. IP de esta Laptop: %LOCAL_IP%
echo.
echo ==============================================================
echo   INSTRUCCIONES PARA LA PRESENTACION EN LA UNIVERSIDAD (LOCAL):
echo ==============================================================
echo   1. Activen el "Punto de Acceso" (Hotspot Wi-Fi) en un celular.
echo      * Nota: No se necesitan datos moviles ni senal de telefono.
echo   2. Conecten esta laptop y los demas celulares a esa red Wi-Fi.
echo   3. En el celular del ESTUDIANTE (para registrarse), entren a:
echo      Link: https://%LOCAL_IP%:5173
echo   4. En esta laptop (para pagar en el punto de venta), entren a:
echo      Link: https://localhost:5174
echo.
echo   * Primera vez que abran el link en el celular o la laptop:
echo     El navegador mostrara una pequeña advertencia de seguridad.
echo     Hagan clic en "Configuracion Avanzada" y luego en "Continuar".
echo     Esto solo ocurre UNA SOLA VEZ. Despues ya no vuelve a aparecer.
echo ==============================================================
echo.
set START_TUNNEL=0
goto START_SERVERS


:MODO_ONLINE
cls
echo ==============================================================
echo   INICIANDO MODO ONLINE REMOTO (TUNEL PUBLICO HTTPS)
echo ==============================================================
echo.
echo Obteniendo IP publica de esta laptop (requerida por localtunnel)...
for /f "tokens=*" %%i in ('powershell -NoProfile -Command "try { (Invoke-RestMethod -Uri 'https://api.ipify.org').Trim() } catch { 'No disponible' }"') do set PUBLIC_IP=%%i

echo.
echo ==============================================================
echo   INSTRUCCIONES PARA LA PRESENTACION EN LA UNIVERSIDAD (ONLINE):
echo ==============================================================
echo   1. Esta laptop debe estar conectada a internet (compartir datos
echo      desde un celular o usar Wi-Fi del lugar).
echo   2. El celular del ESTUDIANTE (para registrarse) tambien debe
echo      tener datos moviles o internet. No necesitan estar en la misma red.
echo   3. Cuando inicie el tunel, se abrira una ventana con la URL publica.
echo      Los estudiantes abriran esa URL en su celular (ej: https://xxxx.localtunnel.me).
echo   4. En esta laptop (para pagar en el punto de venta), entren a:
echo      Link: https://localhost:5174
echo.
echo   * NOTA IMPORTANTE DE LOCALTUNNEL:
echo     Al abrir el enlace en el telefono por primera vez, localtunnel les
echo     pedira una contrasena de seguridad (el "Endpoint IP").
echo     Escriban la IP publica de esta laptop: %PUBLIC_IP%
echo     y presionen "Submit". Esto solo se hace la primera vez.
echo.
echo   * Ventaja: ¡No hay advertencias de seguridad SSL en el celular!
echo ==============================================================
echo.
set START_TUNNEL=1
goto START_SERVERS


:START_SERVERS
echo Iniciando servidores locales... Por favor espera.
echo.

:: Iniciar Backend
start "BioFacial - Backend (Puerto 5000)" cmd /k "cd backend && npm start"

:: Iniciar BankUnerg (con host para acceso externo y puerto fijo)
start "BioFacial - BankUnerg (Puerto 5173)" cmd /k "cd BankUnerg && npm run dev -- --host --port 5173"

:: Iniciar BodeUnerg (con host para acceso externo y puerto fijo)
start "BioFacial - BodeUnerg (Puerto 5174)" cmd /k "cd BodeUnerg && npm run dev -- --host --port 5174"

if "%START_TUNNEL%"=="1" (
  echo [+] Iniciando tunel publico localtunnel para BankUnerg (Puerto 5173)...
  echo [+] Escribe la URL de localtunnel que aparecera abajo en los celulares.
  echo.
  :: Iniciar localtunnel en una nueva ventana para que sea facil ver y copiar el enlace
  start "BioFacial - Tunel Publico (localtunnel)" cmd /k "npx localtunnel --port 5173"
)

:: Esperar un par de segundos a que arranquen los servidores
timeout /t 3 /nobreak >nul

:: Abrir el Punto de Venta en la laptop
start https://localhost:5174

echo [+] ¡Todo listo! Servidores ejecutandose en ventanas secundarias.
echo [+] El Punto de Venta se ha abierto en tu navegador de forma automatica.
echo [+] No cierren las otras ventanas para mantener el sistema activo.
echo.
pause

