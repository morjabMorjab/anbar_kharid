@echo off
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
:: کپی فایل‌های اصلی
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

echo [3/3] اجرای فایل اسکیما (schema.sql) روی MySQL محلی...
echo توجه: اطلاعات قبلی در دیتابیس حذف یا اورراید نمی‌شوند و رکوردهای تکراری ذخیره نخواهند شد.
echo.

:: بررسی وجود دستور mysql در سیستم
where mysql >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo در حال ایجاد دیتابیس در صورت عدم وجود...
    mysql -u root -e "CREATE DATABASE IF NOT EXISTS anbar_kharid CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    
    echo در حال ایمپورت کردن ساختار جدول‌ها و داده‌های اولیه...
    mysql -u root anbar_kharid < "%SOURCE_DIR%schema.sql"
    echo اسکیما با موفقیت روی دیتابیس MySQL محلی اجرا شد.
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
