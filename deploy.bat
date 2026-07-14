@echo off
:: Change directory to the folder where this batch file is located
cd /d "%~dp0"

echo =======================================================
echo     Deploying Project to Local WAMP Server (Windows)
echo =======================================================
echo.

:: Source directory (current folder)
set "SOURCE_DIR=%~dp0"

:: Destination directory in WAMP www folder
set "DEST_DIR=C:\wamp64\www\anbar_kharid"

echo [1/3] Creating destination folder if not exists...
if not exist "%DEST_DIR%" (
    mkdir "%DEST_DIR%"
    echo Created folder: %DEST_DIR%
) else (
    echo Destination folder already exists.
)
echo.

echo [2/3] Copying files and fonts...
:: Copy core files
copy /Y "%SOURCE_DIR%index.html" "%DEST_DIR%\"
copy /Y "%SOURCE_DIR%style.css" "%DEST_DIR%\"
copy /Y "%SOURCE_DIR%script.js" "%DEST_DIR%\"
copy /Y "%SOURCE_DIR%api.php" "%DEST_DIR%\"
copy /Y "%SOURCE_DIR%db.php" "%DEST_DIR%\"
copy /Y "%SOURCE_DIR%schema.sql" "%DEST_DIR%\"

:: Copy fonts folder if exists
if exist "%SOURCE_DIR%fonts" (
    xcopy "%SOURCE_DIR%fonts" "%DEST_DIR%\fonts" /E /I /Y /Q >nul
    echo Fonts copied successfully.
) else (
    echo Warning: fonts directory not found!
)
echo.

echo [3/3] Configuring local MySQL database...

:: Find path to mysql and mysqldump tools
set "MYSQL_CMD="
set "MYSQLDUMP_CMD="

:: First check if mysql is in system PATH
where mysql >nul 2>nul
if %ERRORLEVEL% equ 0 (
    set "MYSQL_CMD=mysql"
    set "MYSQLDUMP_CMD=mysqldump"
    goto :MYSQL_FOUND
)

echo [Search] mysql is not in system PATH. Searching in default WampServer folders...

:: Search in 64-bit WampServer
for /d %%d in (C:\wamp64\bin\mysql\mysql*) do (
    if exist "%%d\bin\mysql.exe" (
        set "MYSQL_CMD="%%d\bin\mysql.exe""
        set "MYSQLDUMP_CMD="%%d\bin\mysqldump.exe""
    )
)

if defined MYSQL_CMD goto :MYSQL_FOUND

:: Search in 32-bit WampServer
for /d %%d in (C:\wamp\bin\mysql\mysql*) do (
    if exist "%%d\bin\mysql.exe" (
        set "MYSQL_CMD="%%d\bin\mysql.exe""
        set "MYSQLDUMP_CMD="%%d\bin\mysqldump.exe""
    )
)

if defined MYSQL_CMD goto :MYSQL_FOUND

echo [Error] mysql tool was not found!
echo Please make sure WampServer is running and installed in default folder (C:\wamp64).
echo You can manually import schema.sql using phpMyAdmin.
goto :END_MYSQL

:MYSQL_FOUND
echo Found MySQL at: %MYSQL_CMD%
echo.

:: Check if old database anbar_kharid exists to safely migrate data
%MYSQL_CMD% -u root -e "USE anbar_kharid;" 2>nul
if %ERRORLEVEL% neq 0 goto :NO_OLD_DB

echo [Migration] Old database 'anbar_kharid' detected.
echo Safely migrating existing data to new database 'purchase_db'...

:: Create new database if not exists
%MYSQL_CMD% -u root -e "CREATE DATABASE IF NOT EXISTS purchase_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

:: Try to backup and migrate using mysqldump
%MYSQLDUMP_CMD% -u root anbar_kharid > "%TEMP%\anbar_backup.sql" 2>nul
if not exist "%TEMP%\anbar_backup.sql" goto :MANUAL_COPY

%MYSQL_CMD% -u root purchase_db < "%TEMP%\anbar_backup.sql"
echo [Success] All items, departments, and requests migrated successfully to purchase_db!
del "%TEMP%\anbar_backup.sql"
goto :RUN_SCHEMA

:MANUAL_COPY
echo [Notice] Automated dump failed. Copying tables directly...
%MYSQL_CMD% -u root -e "CREATE TABLE IF NOT EXISTS purchase_db.items SELECT * FROM anbar_kharid.items;" 2>nul
%MYSQL_CMD% -u root -e "CREATE TABLE IF NOT EXISTS purchase_db.departments SELECT * FROM anbar_kharid.departments;" 2>nul
%MYSQL_CMD% -u root -e "CREATE TABLE IF NOT EXISTS purchase_db.purchase_requests SELECT * FROM anbar_kharid.purchase_requests;" 2>nul
%MYSQL_CMD% -u root -e "CREATE TABLE IF NOT EXISTS purchase_db.purchase_request_items SELECT * FROM anbar_kharid.purchase_request_items;" 2>nul
echo [Success] Tables copied directly.
goto :RUN_SCHEMA

:NO_OLD_DB
echo No old database found or already migrated.
echo Creating database 'purchase_db' if not exists...
%MYSQL_CMD% -u root -e "CREATE DATABASE IF NOT EXISTS purchase_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

:RUN_SCHEMA
echo.
echo Running schema and default seeds on purchase_db...
%MYSQL_CMD% -u root purchase_db < "%SOURCE_DIR%schema.sql"
echo Schema and default seeds checked/applied successfully.

:END_MYSQL
echo.
echo =======================================================
echo          Deployment Completed Successfully!
echo =======================================================
echo Access your local app at: http://localhost/anbar_kharid
echo =======================================================
echo.
pause
