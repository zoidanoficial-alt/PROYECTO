@echo off
chcp 65001 >nul
rem Convierte los RAW .CR3 de la Canon Rebel SL3 / 250D a DNG para que
rem Photoshop CC 2018 (Camera Raw 10) pueda abrirlos.
rem Arrastra fotos .CR3 o una carpeta completa sobre este archivo.
rem Necesita Adobe DNG Converter (gratis): https://helpx.adobe.com/camera-raw/using/adobe-dng-converter.html

set "DNGC=%ProgramFiles%\Adobe\Adobe DNG Converter\Adobe DNG Converter.exe"
if not exist "%DNGC%" set "DNGC=%ProgramFiles(x86)%\Adobe\Adobe DNG Converter\Adobe DNG Converter.exe"
if not exist "%DNGC%" (
  echo No encuentro Adobe DNG Converter. Instalalo gratis desde:
  echo https://helpx.adobe.com/camera-raw/using/adobe-dng-converter.html
  pause
  exit /b
)
if "%~1"=="" (
  echo Arrastra fotos .CR3 o una carpeta sobre este archivo.
  pause
  exit /b
)
for %%A in (%*) do (
  if exist "%%~A\*" (
    if not exist "%%~A\DNG" mkdir "%%~A\DNG"
    echo Convirtiendo la carpeta %%~nxA ...
    for %%F in ("%%~A\*.CR3") do "%DNGC%" -c -p1 -cr7.1 -d "%%~A\DNG" "%%~fF"
  ) else (
    if not exist "%%~dpA\DNG" mkdir "%%~dpA\DNG"
    echo Convirtiendo %%~nxA ...
    "%DNGC%" -c -p1 -cr7.1 -d "%%~dpA\DNG" "%%~fA"
  )
)
echo.
echo Listo. Los DNG estan en la subcarpeta "DNG". Abrelos en Photoshop: se abriran en Camera Raw.
pause
