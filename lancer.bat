@echo off
rem Windows : double-clic pour lancer Foulée
cd /d "%~dp0"
py serveur.py || python serveur.py
