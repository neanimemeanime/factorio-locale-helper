@echo off
chcp 65001 >nul
title Factorio Locale Duplicates Manager
cd /d "%~dp0"
python manage_duplicates.py %*
if errorlevel 1 pause
