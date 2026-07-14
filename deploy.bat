@echo off
:: تغییر مسیر فعال به پوشه جاری فایل بت (بسیار مهم برای زمانی که Run as Admin می‌شود)
cd /d "%~dp0"

:: فعال‌سازی یونیکد (UTF-8) برای نمایش درست متون فارسی در خط فرمان ویندوز
chcp 65001 >nul

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
:: بررسی وجود دستور mysql در سیستم
where mysql >nul 2>nul
if %ERRORLEVEL% equ 0 (
    
    :: بررسی اینکه آیا دیتابیس قدیمی anbar_kharid وجود دارد تا اطلاعاتش را منتقل کنیم
    mysql -u root -e "USE anbar_kharid;" 2>nul
    if %ERRORLEVEL% equ 0 (
        echo [انتقال اطلاعات] دیتابیس قدیمی 'anbar_kharid' شناسایی شد.
        echo در حال انتقال ایمن اطلاعات قبلی شما به دیتابیس جدید 'purchase_db' ...
        
        :: ایجاد دیتابیس جدید در صورت عدم وجود
        mysql -u root -e "CREATE DATABASE IF NOT EXISTS purchase_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
        
        :: گرفتن بکاپ از دیتابیس قدیمی و ایمپورت در جدید
        mysqldump -u root anbar_kharid > "%TEMP%\anbar_backup.sql" 2>nul
        if exist "%TEMP%\anbar_backup.sql" (
            mysql -u root purchase_db < "%TEMP%\anbar_backup.sql"
            echo [موفقیت] تمام کالاها، بخش‌ها و اسناد خرید قبلی با موفقیت منتقل شدند!
            del "%TEMP%\anbar_backup.sql"
        ) else (
            echo [خطا] امکان بکاپ‌گیری خودکار نبود. جدول‌ها را به صورت دستی کپی می‌کنیم...
            mysql -u root -e "CREATE TABLE IF NOT EXISTS purchase_db.items SELECT * FROM anbar_kharid.items;" 2>nul
            mysql -u root -e "CREATE TABLE IF NOT EXISTS purchase_db.departments SELECT * FROM anbar_kharid.departments;" 2>nul
            mysql -u root -e "CREATE TABLE IF NOT EXISTS purchase_db.purchase_requests SELECT * FROM anbar_kharid.purchase_requests;" 2>nul
            mysql -u root -e "CREATE TABLE IF NOT EXISTS purchase_db.purchase_request_items SELECT * FROM anbar_kharid.purchase_request_items;" 2>nul
            echo [موفقیت] جدول‌های اطلاعاتی کپی شدند.
        )
    ) else (
        echo دیتابیس قدیمی یافت نشد. در حال ایجاد دیتابیس جدید در صورت عدم وجود...
        mysql -u root -e "CREATE DATABASE IF NOT EXISTS purchase_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    )
    
    echo.
    echo در حال اجرای کدهای ساختار اولیه و داده‌های پیش‌فرض (بدون حذف داده‌های قبلی)...
    mysql -u root purchase_db < "%SOURCE_DIR%schema.sql"
    echo اسکیما با موفقیت بررسی و اعمال شد.
) else (
    echo [توجه] ابزار mysql در خط فرمان (PATH) ویندوز شما تعریف نشده است.
    echo لطفاً مطمئن شوید WampServer شما روشن است.
    echo در صورتی که دیتابیس خودکار آپدیت نشد، می‌توانید فایل schema.sql را به صورت دستی در phpMyAdmin ایمپورت کنید.
)

echo.
echo =======================================================
echo        عملیات دیپلوی با موفقیت به پایان رسید!
echo =======================================================
echo آدرس دسترسی به برنامه: http://localhost/anbar_kharid
echo =======================================================
echo.
pause
