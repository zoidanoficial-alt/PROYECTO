@echo off
chcp 65001 >nul
rem Arrastra una o varias imágenes de referencia sobre este archivo.
rem Crea un preset de Camera Raw por imagen y lo instala directamente.
if "%~1"=="" (
  echo Arrastra una o varias imagenes de referencia sobre este archivo.
  pause
  exit /b
)
python "%~dp0referencia_a_preset.py" %* --instalar --grupo "Mis referencias"
pause
