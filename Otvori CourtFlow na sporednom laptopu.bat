@echo off
title CourtFlow sporedni laptop

echo Na glavnom racunaru prvo pokreni CourtFlow.
echo.
set /p MAIN_IP=Upisi IP adresu glavnog racunara: 

if "%MAIN_IP%"=="" (
  echo IP adresa nije upisana.
  pause
  exit /b 1
)

set "APP_URL=http://%MAIN_IP%:3000/tournaments?server=http://%MAIN_IP%:3000"

where msedge >nul 2>nul
if %errorlevel%==0 (
  start "" msedge --app="%APP_URL%"
) else (
  start "" "%APP_URL%"
)

echo Otvaram %APP_URL%
exit
