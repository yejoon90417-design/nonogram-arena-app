@echo off
setlocal
set "MSG=%~1"
if "%MSG%"=="" set "MSG=chore: auto update"

git add -A
if errorlevel 1 exit /b %errorlevel%

git commit -m "%MSG%"
if errorlevel 1 exit /b %errorlevel%

git push
exit /b %errorlevel%
