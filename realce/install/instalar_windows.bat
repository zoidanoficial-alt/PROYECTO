@echo off
rem Realce IA - instalador para Windows (Photoshop CC 2018 o posterior)
setlocal
set "SRC=%~dp0..\com.realce.panel"
set "DEST=%APPDATA%\Adobe\CEP\extensions\com.realce.panel"

echo === Realce IA ===
echo Copiando el panel en:
echo   %DEST%
if not exist "%DEST%" mkdir "%DEST%"
xcopy "%SRC%" "%DEST%\" /e /i /q /y >nul
if errorlevel 1 goto :error

echo Activando extensiones sin firmar (PlayerDebugMode)...
for %%v in (8 9 10 11 12) do reg add "HKCU\Software\Adobe\CSXS.%%v" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul

where python >nul 2>nul
if errorlevel 1 (
  echo.
  echo [!] No se encontro Python. Instala Python 3.8+ desde https://www.python.org
  echo     marcando "Add Python to PATH" y vuelve a ejecutar este instalador.
  goto :fin
)

echo Instalando dependencias de Python...
python -m pip install --user --upgrade -r "%DEST%\engine\requirements.txt"
if errorlevel 1 goto :error

echo Descargando modelos de IA...
python "%DEST%\engine\download_models.py" %*
if errorlevel 1 goto :error

echo.
echo Listo. Reinicia Photoshop y abre: Ventana ^> Extensiones ^> Realce IA
goto :fin

:error
echo.
echo [!] Hubo un error durante la instalacion.

:fin
pause
