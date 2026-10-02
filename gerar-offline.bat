@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title BF Studio - modo offline
cd /d "%~dp0"

rem =====================================================================
rem  Gera uma versao do BF Studio em UM UNICO arquivo HTML que funciona
rem  sem servidor e sem internet: dist\index.html
rem
rem  Depois de gerar, voce pode copiar esse arquivo para qualquer lugar
rem  (pen drive, celular, outro PC) e abrir com dois cliques.
rem =====================================================================

echo.
echo  ==============================================================
echo    BF Studio - gerando a versao offline
echo  ==============================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo  [ERRO] O Node.js nao esta instalado.
    echo         Rode o iniciar.bat primeiro - ele instala tudo sozinho.
    goto :fim
)

if not exist "node_modules\vite\" (
    echo  [*] Instalando as dependencias do projeto...
    call npm install --no-audit --no-fund
    if errorlevel 1 goto :erro
)

echo  [*] Compilando o projeto...
echo.
call npm run build
if errorlevel 1 goto :erro

echo.
echo  [OK] Arquivo gerado em:  %CD%\dist\index.html
echo       Abrindo agora no navegador...
start "" "%CD%\dist\index.html"
goto :fim

:erro
echo.
echo  [ERRO] A geracao falhou. Veja as mensagens acima.

:fim
echo.
pause
endlocal
exit /b 0
