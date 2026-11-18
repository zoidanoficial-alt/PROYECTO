@echo off
chcp 65001 >nul
rem Copia los presets de la carpeta "presets" a Camera Raw (Photoshop CC 2018 o posterior).
set "DEST=%APPDATA%\Adobe\CameraRaw\Settings"
if not exist "%DEST%" mkdir "%DEST%"
rem Quita versiones anteriores de estos paquetes (evita presets repetidos)
del /q "%DEST%\FT 0*.xmp" "%DEST%\FR 0*.xmp" "%DEST%\OS 20*.xmp" "%DEST%\SL3 20*.xmp" "%DEST%\SL3 - ISO*.xmp" 2>nul
for /r "%~dp0presets" %%F in (*.xmp) do copy /y "%%F" "%DEST%\" >nul && echo   + %%~nF
echo.
echo Listo. Cierra y vuelve a abrir Photoshop.
echo Los presets aparecen en Camera Raw, pestaña "Ajustes preestablecidos", grupos "FOTONEANDO · Frontera", "· Retrato", "· Óscar", "· Óscar SL3" y "· SL3 Ajustes".
pause
