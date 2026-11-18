@echo off
chcp 65001 >nul
rem Copia los presets de la carpeta "presets" a Camera Raw (Photoshop CC 2018 o posterior).
set "DEST=%APPDATA%\Adobe\CameraRaw\Settings"
if not exist "%DEST%" mkdir "%DEST%"
for /r "%~dp0presets" %%F in (*.xmp) do copy /y "%%F" "%DEST%\" >nul && echo   + %%~nF
echo.
echo Listo. Cierra y vuelve a abrir Photoshop.
echo Los presets aparecen en Camera Raw, pestaña "Ajustes preestablecidos", grupo "FOTONEANDO · Frontera".
pause
