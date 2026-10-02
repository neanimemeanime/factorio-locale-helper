@echo off
echo Building the project...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo Build failed!
    pause
    exit /b %ERRORLEVEL%
)

echo Creating archive...
:: Remove old zip if exists to avoid appending
if exist build.zip del build.zip
powershell -Command "Compress-Archive -Path dist\* -DestinationPath build.zip"

echo Done! build.zip created.
pause
