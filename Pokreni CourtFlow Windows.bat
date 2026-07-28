@echo off
title CourtFlow 3x3 Organizator
set "APP_DIR=%~dp0"
set "APP_URL=http://localhost:3000/tournaments"
set "NODE_DOWNLOAD_URL=https://nodejs.org/en/download"

echo Pokrecem CourtFlow...
echo.
echo Ovaj fajl pokreci samo na glavnom racunaru.
echo Adresa za drugi laptop:
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ip=(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '169.254*' -and $_.IPAddress -ne '127.0.0.1' -and $_.PrefixOrigin -ne 'WellKnown' } | Select-Object -First 1 -ExpandProperty IPAddress); if ($ip) { Write-Host ('http://' + $ip + ':3000') } else { Write-Host 'Nisam nasao IP adresu. Proveri Wi-Fi mrezu.' }"
echo.

if not exist "%APP_DIR%package.json" (
  echo Ne mogu da nadjem package.json u folderu aplikacije.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nije instaliran. Pokusavam automatsku instalaciju...

  where winget >nul 2>nul
  if errorlevel 1 (
    echo Automatska instalacija nije dostupna.
    start "" "%NODE_DOWNLOAD_URL%"
    echo Instaliraj Node.js LTS, pa ponovo pokreni ovaj fajl.
    pause
    exit /b 1
  )

  winget install --id OpenJS.NodeJS.LTS -e --source winget --accept-source-agreements --accept-package-agreements
  if errorlevel 1 (
    start "" "%NODE_DOWNLOAD_URL%"
    echo Instalacija nije uspela. Instaliraj Node.js LTS rucno.
    pause
    exit /b 1
  )

  set "PATH=%ProgramFiles%\nodejs;%ProgramFiles(x86)%\nodejs;%PATH%"
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm nije dostupan. Zatvori prozor i pokreni fajl ponovo.
  pause
  exit /b 1
)

if not exist "%APP_DIR%node_modules" (
  echo Instaliram pakete aplikacije...
  pushd "%APP_DIR%"
  call npm install
  if errorlevel 1 (
    popd
    echo Instalacija paketa nije uspela. Proveri internet vezu.
    pause
    exit /b 1
  )
  popd
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "$listeners=Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue; if (-not $listeners) { exit 1 }; try { $html=(Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:3000' -TimeoutSec 5).Content } catch { $html='' }; if ($html -match 'CourtFlow|3x3 Organizator') { exit 0 }; foreach ($listener in $listeners) { Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue }; exit 1"

if errorlevel 1 (
  echo Pripremam i pokrecem aplikaciju...
  start "CourtFlow Server" /min cmd /k "pushd ""%APP_DIR%"" && npm run build && npm run start -- -H 0.0.0.0 -p 3000"
  timeout /t 12 /nobreak >nul
) else (
  echo CourtFlow server vec radi.
)

where msedge >nul 2>nul
if %errorlevel%==0 (
  start "" msedge --app="%APP_URL%"
) else (
  start "" "%APP_URL%"
)

exit
