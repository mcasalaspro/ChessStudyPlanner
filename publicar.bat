@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title Chess Study Planner - publicar no GitHub
cd /d "%~dp0"

echo.
echo  ================================================
echo   Chess Study Planner - enviar/atualizar no GitHub
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

if not exist ".git" (
  echo  Primeira publicacao: preparando o repositorio local...
  git init -b main >nul 2>nul || (git init >nul && git checkout -b main >nul 2>nul)
  git config user.name >nul 2>nul || (
    set /p GITNAME=" Seu nome para os commits (ex.: Joao Silva): "
    git config user.name "!GITNAME!"
  )
  git config user.email >nul 2>nul || (
    set /p GITEMAIL=" Seu e-mail do GitHub: "
    git config user.email "!GITEMAIL!"
  )
  echo.
  echo  Crie um repositorio VAZIO em https://github.com/new  (pode ser publico ou privado)
  echo  e cole aqui o endereco dele, por exemplo: https://github.com/SEU-USUARIO/chess-study-planner.git
  set /p REMOTE=" Endereco do repositorio: "
  git remote add origin "!REMOTE!"
)

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
  echo  Nenhuma alteracao nova para enviar. Vou so garantir que o GitHub esta em dia.
)

echo.
echo  Enviando para o GitHub (se pedir login, use seu usuario e um Personal Access Token como senha)...
git push -u origin main
if errorlevel 1 (
  echo.
  echo  [ERRO] O envio falhou. Motivos comuns:
  echo    - endereco do repositorio errado  ^(veja com: git remote -v^)
  echo    - sem permissao / token expirado  ^(crie um token em GitHub ^> Settings ^> Developer settings^)
  echo    - o repositorio no GitHub nao esta vazio na primeira vez  ^(rode: git pull origin main --allow-unrelated-histories^)
  echo.
  pause
  exit /b 1
)

echo.
echo  ------------------------------------------------
echo   Pronto! Arquivos enviados.
echo   Na primeira vez, ative o GitHub Pages:
echo     GitHub ^> seu repositorio ^> Settings ^> Pages ^> Build and deployment
echo     Source: "Deploy from a branch"  /  Branch: main  /  Folder: / (root)  ^> Save
echo   O site fica em: https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/
echo   (leva 1 a 2 minutos para atualizar depois de cada envio)
echo  ------------------------------------------------
echo.
pause
