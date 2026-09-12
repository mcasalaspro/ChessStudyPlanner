@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title Chess Study Planner - publicar no GitHub
cd /d "%~dp0"

set "REPO=https://github.com/mcasalaspro/ChessStudyPlanner.git"
set "PAGES=https://mcasalaspro.github.io/ChessStudyPlanner/"

REM Se o Git estiver instalado num lugar diferente, escreva o caminho completo aqui
REM (exemplo: set "GIT=D:\Ferramentas\Git\cmd\git.exe") e o resto funciona igual.
set "GIT="

echo.
echo  ================================================
echo   Chess Study Planner - enviar/atualizar no GitHub
echo   %REPO%
echo  ================================================
echo.

REM ---- procurar o Git: no PATH e depois nos lugares habituais de instalacao ----
if not defined GIT (
  for /f "delims=" %%G in ('where git 2^>nul') do if not defined GIT set "GIT=%%G"
)
if not defined GIT (
  for %%P in (
    "%ProgramFiles%\Git\cmd\git.exe"
    "%ProgramW6432%\Git\cmd\git.exe"
    "%ProgramFiles(x86)%\Git\cmd\git.exe"
    "%LocalAppData%\Programs\Git\cmd\git.exe"
    "%UserProfile%\scoop\apps\git\current\cmd\git.exe"
    "C:\Program Files\Git\cmd\git.exe"
    "C:\Program Files (x86)\Git\cmd\git.exe"
  ) do if not defined GIT if exist %%P set "GIT=%%~P"
)

if not defined GIT (
  echo  [ERRO] Nao encontrei o Git neste computador.
  echo         Se ele ja estiver instalado, abra este arquivo no Bloco de Notas
  echo         e escreva o caminho na linha:  set "GIT=C:\caminho\para\git.exe"
  echo         Se ainda nao tiver, baixe em https://git-scm.com/download/win
  echo.
  pause
  exit /b 1
)

for %%D in ("%GIT%") do set "GITDIR=%%~dpD"
set "PATH=%GITDIR%;%PATH%"
for /f "delims=" %%V in ('"%GIT%" --version 2^>nul') do set "GITVER=%%V"
echo  Git: %GITVER%
echo  ^(%GIT%^)
echo.

if not exist "index.html" (
  echo  [ERRO] Nao encontrei o index.html nesta pasta.
  echo         Coloque este .bat na mesma pasta do site ^(index.html, css, js, assets^).
  echo.
  pause
  exit /b 1
)
if not exist "config.js" (
  echo  [ERRO] Nao encontrei o arquivo config.js nesta pasta.
  echo         Copie o seu config.js para ca antes de publicar.
  echo.
  pause
  exit /b 1
)
findstr /C:"supabaseUrl: ''" config.js >nul 2>nul
if not errorlevel 1 (
  echo  [AVISO] O config.js esta com o endereco do banco VAZIO.
  echo          O site vai abrir dizendo que nao esta conectado.
  set /p CONT=" Publicar assim mesmo? (s/n): "
  if /I not "!CONT!"=="s" exit /b 1
)

if not exist ".git" (
  echo  Primeira publicacao: preparando o repositorio local...
  "%GIT%" init -b main >nul 2>nul || ("%GIT%" init >nul && "%GIT%" checkout -b main >nul 2>nul)
  "%GIT%" config user.name >nul 2>nul || (
    set /p GITNAME=" Seu nome para os commits: "
    "%GIT%" config user.name "!GITNAME!"
  )
  "%GIT%" config user.email >nul 2>nul || (
    set /p GITEMAIL=" Seu e-mail do GitHub: "
    "%GIT%" config user.email "!GITEMAIL!"
  )
  "%GIT%" remote add origin "%REPO%" >nul 2>nul
)

REM site estatico: guardar os arquivos como estao, sem conversao de fim de linha
"%GIT%" config core.autocrlf false
"%GIT%" config pull.rebase false
"%GIT%" remote get-url origin >nul 2>nul || "%GIT%" remote add origin "%REPO%"

REM ---- pastas que sao repositorios por dentro (clones antigos) nao podem entrar ----
for /d %%D in (*) do (
  if exist "%%D\.git" (
    echo  [AVISO] A pasta "%%D" e um repositorio Git separado e sera ignorada.
    findstr /X /C:"%%D/" .gitignore >nul 2>nul || echo %%D/>> .gitignore
    "%GIT%" rm -r --cached "%%D" >nul 2>nul
  )
)

echo  Adicionando arquivos...
"%GIT%" add -A

for /f "tokens=1-3 delims=/ " %%a in ("%date%") do set HOJE=%%a-%%b-%%c
set AGORA=%time:~0,5%
"%GIT%" diff --cached --quiet
if errorlevel 1 (
  "%GIT%" commit -m "Atualizacao %HOJE% %AGORA%" >nul
  echo  Commit criado: Atualizacao %HOJE% %AGORA%
) else (
  echo  Nenhuma alteracao nova. Vou so garantir que o GitHub esta em dia.
)

echo.
echo  Enviando para o GitHub (se pedir login, use seu usuario e um Personal Access Token como senha)...
"%GIT%" push -u origin main
if not errorlevel 1 goto pronto

echo.
echo  O GitHub recusou o envio. Quase sempre e porque la ja existem arquivos
echo  ^(um README criado junto com o repositorio, por exemplo^) que nao estao aqui.
echo.
echo    [1] Juntar o que esta no GitHub com esta pasta  ^(recomendado^)
echo    [2] Substituir o GitHub por esta pasta          ^(apaga o que houver la^)
echo    [3] Cancelar
echo.
set /p OPC=" Escolha 1, 2 ou 3: "

if "!OPC!"=="1" (
  echo  Juntando...
  "%GIT%" pull origin main --allow-unrelated-histories --no-edit
  if errorlevel 1 (
    echo.
    echo  [ERRO] A juncao parou por causa de um conflito ^(o mesmo arquivo mudou dos dois lados^).
    echo         Rode o .bat de novo e escolha a opcao [2], ou resolva o conflito no Git.
    echo.
    pause
    exit /b 1
  )
  "%GIT%" push -u origin main
  if errorlevel 1 (
    echo.
    echo  [ERRO] Ainda nao deu. Verifique login/token e tente de novo.
    echo.
    pause
    exit /b 1
  )
  goto pronto
)

if "!OPC!"=="2" (
  echo  Substituindo o conteudo do GitHub por esta pasta...
  "%GIT%" push -u origin main --force
  if errorlevel 1 (
    echo.
    echo  [ERRO] Nao consegui substituir. Verifique login/token e permissao no repositorio.
    echo.
    pause
    exit /b 1
  )
  goto pronto
)

echo  Cancelado. Nada foi enviado.
pause
exit /b 1

:pronto
echo.
echo  ------------------------------------------------
echo   Pronto! Site: %PAGES%
echo   (leva 1 a 2 minutos para atualizar depois de cada envio)
echo   Se for a primeira vez, ative em Settings ^> Pages:
echo     Source "Deploy from a branch" / Branch main / Folder root
echo  ------------------------------------------------
echo.
pause
