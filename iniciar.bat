@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title BF Studio
cd /d "%~dp0"

rem =====================================================================
rem  BF Studio - inicializador para Windows
rem
rem  O que ele faz:
rem    1. confere se o Node.js esta instalado (e instala sozinho se nao estiver)
rem    2. instala as dependencias do projeto na primeira vez
rem    3. sobe o servidor em http://localhost:5173 e abre o navegador
rem
rem  Uso:
rem    iniciar.bat            usa a porta 5173
rem    iniciar.bat 3000       usa a porta 3000
rem =====================================================================

set "PORT=%~1"
if "%PORT%"=="" set "PORT=5173"

echo.
echo  ==============================================================
echo    BF Studio - editor, compilador e depurador de Brainfuck
echo  ==============================================================
echo.

if not exist "package.json" (
    echo  [ERRO] Nao achei o package.json nesta pasta:
    echo         %CD%
    echo         O iniciar.bat precisa ficar na raiz do projeto.
    goto :fim
)

rem --------------------------------------------------------------- 1. Node
call :tem_node
if not errorlevel 1 goto :node_ok

echo  [AVISO] O Node.js nao esta instalado neste computador.
echo          Vou tentar instalar automaticamente pelo winget...
echo.
where winget >nul 2>nul
if errorlevel 1 goto :node_manual

winget install --id OpenJS.NodeJS.LTS -e --silent --accept-source-agreements --accept-package-agreements
if errorlevel 1 goto :node_manual

call :recarrega_path
call :tem_node
if errorlevel 1 goto :node_manual
echo  [OK] Node.js instalado.

:node_ok
set "NODEVER=?"
for /f "delims=" %%V in ('node -v 2^>nul') do set "NODEVER=%%V"
set "NUM=!NODEVER:v=!"
set "NODEMAJOR="
for /f "tokens=1 delims=." %%M in ("!NUM!") do set "NODEMAJOR=%%M"
echo !NODEMAJOR!| findstr /r "^[0-9][0-9]*$" >nul
if errorlevel 1 goto :versao_ok
if !NODEMAJOR! GEQ 20 goto :versao_ok
echo  [AVISO] Seu Node.js e a versao !NODEVER! e o projeto precisa da 20.19 ou mais nova.
echo          Baixe a LTS em https://nodejs.org/ e rode o iniciar.bat outra vez.
goto :fim

:versao_ok
echo  [OK] Node.js !NODEVER!

rem -------------------------------------------------------- 2. Dependencias
if exist "node_modules\vite\" goto :deps_ok
echo  [*] Instalando as dependencias do projeto...
echo      Isso acontece apenas na primeira vez e pode levar alguns minutos.
echo.
call npm install --no-audit --no-fund
if errorlevel 1 goto :deps_erro
echo.
echo  [OK] Dependencias instaladas.
goto :run

:deps_ok
echo  [OK] Dependencias ja estavam instaladas.
goto :run

:deps_erro
echo.
echo  [ERRO] A instalacao das dependencias falhou.
echo         Confira sua conexao com a internet e tente de novo,
echo         ou rode manualmente o comando:  npm install
goto :fim

rem ------------------------------------------------------------ 3. Servidor
:run
echo.
echo  ==============================================================
echo    Endereco:   http://localhost:%PORT%
echo    O navegador abre sozinho. Deixe esta janela aberta.
echo    Para encerrar o servidor, feche a janela ou aperte Ctrl+C.
echo  ==============================================================
echo.
set "BF_PORT=%PORT%"
call npm run dev -- --host --open --port %PORT%
echo.
echo  [*] O servidor foi encerrado.

:fim
echo.
pause
endlocal
exit /b 0

rem =============================================================== subrotinas

:tem_node
where node >nul 2>nul
goto :eof

:node_manual
echo.
echo  [ERRO] Nao consegui instalar o Node.js automaticamente.
echo.
echo         Baixe a versao LTS em https://nodejs.org/ , instale,
echo         feche esta janela e execute o iniciar.bat de novo.
echo.
set "ABRIR=N"
set /p ABRIR="  Quer que eu abra a pagina de download agora? [S/N]: "
if /i "!ABRIR!"=="S" start "" "https://nodejs.org/"
goto :fim

:recarrega_path
set "SYS_PATH="
set "USR_PATH="
for /f "tokens=2,*" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul ^| findstr /i "REG_"') do set "SYS_PATH=%%B"
for /f "tokens=2,*" %%A in ('reg query "HKCU\Environment" /v Path 2^>nul ^| findstr /i "REG_"') do set "USR_PATH=%%B"
if defined SYS_PATH set "PATH=%SYS_PATH%"
if defined USR_PATH set "PATH=%PATH%;%USR_PATH%"
set "PATH=%PATH%;%ProgramFiles%\nodejs;%APPDATA%\npm"
goto :eof
