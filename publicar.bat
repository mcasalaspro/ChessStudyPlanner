@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title Chess Study Planner - publicar no GitHub
cd /d "%~dp0"

set "REPO=https://github.com/mcasalaspro/ChessStudyPlanner.git"
set "PAGES=https://mcasalaspro.github.io/ChessStudyPlanner/"

echo.
echo  ================================================
echo   Chess Study Planner - enviar/atualizar no GitHub
echo   %REPO%
echo  ================================================
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo  [ERRO] O Git nao esta instalado ou nao esta no PATH.
  echo         Baixe em https://git-scm.com/download/win , instale e rode este arquivo de novo.
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
  git init -b main >nul 2>nul || (git init >nul && git checkout -b main >nul 2>nul)
  git config user.name >nul 2>nul || (
    set /p GITNAME=" Seu nome para os commits: "
    git config user.name "!GITNAME!"
  )
  git config user.email >nul 2>nul || (
    set /p GITEMAIL=" Seu e-mail do GitHub: "
    git config user.email "!GITEMAIL!"
  )
  git remote add origin "%REPO%" >nul 2>nul
)

git remote get-url origin >nul 2>nul || git remote add origin "%REPO%"

echo.
echo  Adicionando arquivos...
git add -A

for /f "tokens=1-3 delims=/ " %%a in ("%date%") do set HOJE=%%a-%%b-%%c
set AGORA=%time:~0,5%
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "Atualizacao %HOJE% %AGORA%" >nul
  echo  Commit criado: Atualizacao %HOJE% %AGORA%
) else (
  echo  Nenhuma alteracao nova. Vou so garantir que o GitHub esta em dia.
)

echo.
echo  Enviando para o GitHub (se pedir login, use seu usuario e um Personal Access Token como senha)...
git push -u origin main
if errorlevel 1 (
  echo.
  echo  [ERRO] O envio falhou. Motivos comuns:
  echo    - sem permissao / token expirado  ^(crie um token em GitHub ^> Settings ^> Developer settings^)
  echo    - o repositorio ja tem arquivos que voce nao tem aqui
  echo      ^(nesse caso rode: git pull origin main --allow-unrelated-histories^)
  echo.
  pause
  exit /b 1
)

echo.
echo  ------------------------------------------------
echo   Pronto! Site: %PAGES%
echo   (leva 1 a 2 minutos para atualizar depois de cada envio)
echo   Se for a primeira vez, ative em Settings ^> Pages:
echo     Source "Deploy from a branch" / Branch main / Folder root
echo  ------------------------------------------------
echo.
pause
