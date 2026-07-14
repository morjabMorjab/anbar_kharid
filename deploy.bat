@echo off
:: تغییر مسیر فعال به پوشه جاری فایل بت (بسیار مهم برای زمانی که Run as Admin می‌شود)
cd /d "%~dp0"

:: فعال‌سازی یونیکد (UTF-8) برای نمایش درست متون فارسی در خط فرمان ویندوز
chcp 65001 >nul

:: فعال‌سازی Delayed Expansion برای حل مشکل بررسی متغیرها در حلقه‌ها و شرط‌ها
setlocal enabledelayedexpansion

echo =======================================================
echo     عملیات دیپلوی پروژه به سرور محلی WAMP (ویندوز)
echo =======================================================
echo.

:: مسیر مبدا (پوشه فعلی که فایل bat در آن قرار دارد)
set "SOURCE_DIR=%~dp0"

:: مسیر مقصد در پوشه WAMP
set "DEST_DIR=C:\wamp64\www\anbar_kharid"

echo [1/3] ایجاد پوشه مقصد در صورت عدم وجود...
if not exist "%DEST_DIR%" (
    mkdir "%DEST_DIR%"
    echo پوشه مقصد ایجاد شد: %DEST_DIR%
) else (
    echo پوشه مقصد از قبل وجود دارد.
)
echo.

echo [2/3] کپی کردن فایل‌ها و پوشه فونت...
:: کپی فایل‌های اصلی با اطمینان از اورراید شدن
copy /Y "%SOURCE_DIR%index.html" "%DEST_DIR%\"
copy /Y "%SOURCE_DIR%style.css" "%DEST_DIR%\"
copy /Y "%SOURCE_DIR%script.js" "%DEST_DIR%\"
copy /Y "%SOURCE_DIR%api.php" "%DEST_DIR%\"
copy /Y "%SOURCE_DIR%db.php" "%DEST_DIR%\"
copy /Y "%SOURCE_DIR%schema.sql" "%DEST_DIR%\"

:: کپی پوشه فونت به صورت کامل و زیرپوشه‌ها
if exist "%SOURCE_DIR%fonts" (
    xcopy "%SOURCE_DIR%fonts" "%DEST_DIR%\fonts" /E /I /Y /Q >nul
    echo پوشه فونت‌ها با موفقیت کپی شد.
) else (
    echo هشدار: پوشه fonts یافت نشد!
)
echo.

echo [3/3] پیکربندی و راه‌اندازی دیتابیس MySQL محلی...

:: یافتن مسیر صحیح برای اجرای دستورات mysql و mysqldump
set "MYSQL_CMD="
set "MYSQLDUMP_CMD="

:: ابتدا بررسی در PATH سیستم
where mysql >nul 2>nul
if !ERRORLEVEL! equ 0 (
    set "MYSQL_CMD=mysql"
    set "MYSQLDUMP_CMD=mysqldump"
) else (
    echo [جستجو] ابزار mysql در PATH سیستم تعریف نشده است.
    echo در حال جستجو در پوشه‌های پیش‌فرض WampServer...
    
    rem جستجو در WampServer 64 بیتی
    for /d %%d in (C:\wamp64\bin\mysql\mysql*) do (
        if exist "%%d\bin\mysql.exe" (
            set "MYSQL_CMD="%%d\bin\mysql.exe""
            set "MYSQLDUMP_CMD="%%d\bin\mysqldump.exe""
        )
    )
    
    rem جستجو در WampServer 32 بیتی (در صورت عدم یافتن نسخه 64 بیتی)
    if not defined MYSQL_CMD (
        for /d %%d in (C:\wamp\bin\mysql\mysql*) do (
            if exist "%%d\bin\mysql.exe" (
                set "MYSQL_CMD="%%d\bin\mysql.exe""
                set "MYSQLDUMP_CMD="%%d\bin\mysqldump.exe""
            )
        )
    )
)

if defined MYSQL_CMD (
    echo مسیر ابزار MySQL پیدا شد: !MYSQL_CMD!
    echo.
    
    rem بررسی وجود دیتابیس قدیمی anbar_kharid برای انتقال ایمن اطلاعات
    !MYSQL_CMD! -u root -e "USE anbar_kharid;" 2>nul
    if !ERRORLEVEL! equ 0 (
        echo [انتقال اطلاعات] دیتابیس قدیمی 'anbar_kharid' شناسایی شد.
        echo در حال انتقال ایمن اطلاعات قبلی به دیتابیس جدید 'purchase_db' ...
        
        rem ایجاد دیتابیس جدید در صورت عدم وجود
        !MYSQL_CMD! -u root -e "CREATE DATABASE IF NOT EXISTS purchase_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
        
        rem تلاش برای بکاپ‌گیری و انتقال اطلاعات با mysqldump
        !MYSQLDUMP_CMD! -u root anbar_kharid > "%TEMP%\anbar_backup.sql" 2>nul
        if exist "%TEMP%\anbar_backup.sql" (
            !MYSQL_CMD! -u root purchase_db < "%TEMP%\anbar_backup.sql"
            echo [موفقیت] تمام کالاها، بخش‌ها و اسناد خرید قبلی با موفقیت به دیتابیس جدید منتقل شدند!
            del "%TEMP%\anbar_backup.sql"
        ) else (
            echo [توجه] امکان بکاپ‌گیری خودکار نبود. جدول‌ها را به صورت مستقیم کپی می‌کنیم...
            !MYSQL_CMD! -u root -e "CREATE TABLE IF NOT EXISTS purchase_db.items SELECT * FROM anbar_kharid.items;" 2>nul
            !MYSQL_CMD! -u root -e "CREATE TABLE IF NOT EXISTS purchase_db.departments SELECT * FROM anbar_kharid.departments;" 2>nul
            !MYSQL_CMD! -u root -e "CREATE TABLE IF NOT EXISTS purchase_db.purchase_requests SELECT * FROM anbar_kharid.purchase_requests;" 2>nul
            !MYSQL_CMD! -u root -e "CREATE TABLE IF NOT EXISTS purchase_db.purchase_request_items SELECT * FROM anbar_kharid.purchase_request_items;" 2>nul
            echo [موفقیت] کپی مستقیم جدول‌ها انجام شد.
        )
    ) else (
        echo دیتابیس قدیمی یافت نشد یا از قبل منتقل شده است.
        echo در حال ایجاد دیتابیس 'purchase_db' در صورت عدم وجود...
        !MYSQL_CMD! -u root -e "CREATE DATABASE IF NOT EXISTS purchase_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    )
    
    echo.
    echo در حال اجرای ساختار اولیه و داده‌های پیش‌فرض روی 'purchase_db' ...
    !MYSQL_CMD! -u root purchase_db < "%SOURCE_DIR%schema.sql"
    echo اسکیما و داده‌های پایه با موفقیت بررسی و اعمال شدند.
) else (
    echo [خطا] ابزار mysql پیدا نشد!
    echo لطفاً مطمئن شوید WampServer شما روشن است و در مسیر استاندارد (C:\wamp64) نصب شده است.
    echo شما می‌توانید فایل schema.sql را به صورت دستی در phpMyAdmin ایمپورت کنید.
)

echo.
echo =======================================================
echo        عملیات دیپلوی با موفقیت به پایان رسید!
echo =======================================================
echo آدرس دسترسی به برنامه: http://localhost/anbar_kharid
echo =======================================================
echo.
pause
