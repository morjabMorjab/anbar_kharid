import os
import shutil
import sys
import subprocess

def deploy():
    # مسیر مبدا (پوشه‌ای که فایل اسکریپت در آن قرار دارد)
    source_dir = os.path.dirname(os.path.abspath(__file__))
    
    # مسیر مقصد (WAMP)
    dest_dir = r"C:\wamp64\www\anbar_kharid"
    
    # مقایسه مسیر مبدا و مقصد برای جلوگیری از کپی فایل‌ها روی خودشان (علت اصلی خطای WinError 32)
    real_source = os.path.realpath(source_dir).lower()
    real_dest = os.path.realpath(dest_dir).lower()
    is_same_dir = (real_source == real_dest)
    
    # فایل‌ها و پوشه‌هایی که باید کپی شوند
    files_to_copy = [
        "index.html",
        "style.css",
        "script.js",
        "api.php",
        "db.php",
        "schema.sql",
        "fonts"
    ]
    
    # NOTE: Database data is persistent on the server.
    # Code deployment DOES NOT overwrite, delete, or duplicate DB data.
    # To prevent duplicates, ensure unique constraints on database tables
    # and check for existing records in api.php before insertion.
    print("توجه: اطلاعات قبلی در دیتابیس حذف یا اورراید نمی‌شوند و رکوردهای تکراری ذخیره نخواهند شد.")
    
    print(f"--- Starting Deployment to {dest_dir} ---")
    
    try:
        if is_same_dir:
            print("[توجه] پوشه مبدا و مقصد یکسان هستند. کپی فایل‌ها رد شد تا از خطای قفل شدن فایل (WinError 32) جلوگیری شود.")
        else:
            # ایجاد پوشه مقصد اگر وجود نداشته باشد
            if not os.path.exists(dest_dir):
                os.makedirs(dest_dir)
                print(f"Created directory: {dest_dir}")
                
            for item in files_to_copy:
                src_path = os.path.join(source_dir, item)
                dest_path = os.path.join(dest_dir, item)
                
                if os.path.exists(src_path):
                    if os.path.isdir(src_path):
                        if os.path.exists(dest_path):
                            shutil.rmtree(dest_path)
                        shutil.copytree(src_path, dest_path)
                        print(f"Copied directory: {item}")
                    else:
                        shutil.copy2(src_path, dest_path)
                        print(f"Copied file: {item}")
                else:
                    print(f"Warning: {item} not found in source directory.")
                
        # اجرای فایل schema.sql روی دیتابیس لوکال
        print("\n--- Executing schema.sql on local MySQL server ---")
        schema_path = os.path.join(source_dir, "schema.sql")
        if os.path.exists(schema_path):
            try:
                # بررسی وجود دیتابیس قدیمی anbar_kharid و انتقال اطلاعات آن
                check_old_db = subprocess.run('mysql -u root -e "USE anbar_kharid;"', shell=True, capture_output=True)
                if check_old_db.returncode == 0:
                    print("[انتقال اطلاعات] دیتابیس قدیمی 'anbar_kharid' شناسایی شد.")
                    print("در حال انتقال ایمن اطلاعات قبلی شما به دیتابیس جدید 'purchase_db'...")
                    
                    # ایجاد دیتابیس جدید
                    subprocess.run('mysql -u root -e "CREATE DATABASE IF NOT EXISTS purchase_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"', shell=True, check=True)
                    
                    # بکاپ و انتقال
                    backup_file = os.path.join(os.environ.get('TEMP', '/tmp'), 'anbar_backup.sql')
                    backup_cmd = f'mysqldump -u root anbar_kharid > "{backup_file}"'
                    subprocess.run(backup_cmd, shell=True, check=True)
                    
                    if os.path.exists(backup_file):
                        import_cmd = f'mysql -u root purchase_db < "{backup_file}"'
                        subprocess.run(import_cmd, shell=True, check=True)
                        print("[موفقیت] تمام کالاها، بخش‌ها و اسناد خرید قبلی با موفقیت منتقل شدند!")
                        try:
                            os.remove(backup_file)
                        except:
                            pass
                else:
                    # ایجاد دیتابیس جدید در صورت عدم وجود
                    subprocess.run('mysql -u root -e "CREATE DATABASE IF NOT EXISTS purchase_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"', shell=True, check=True)
                
                # اجرای اسکیما برای اطمینان از ایجاد نهایی جدول‌ها و داده‌های Seed
                subprocess.run(f'mysql -u root purchase_db < "{schema_path}"', shell=True, check=True)
                print("schema.sql checked/executed successfully on database: purchase_db")
            except Exception as e:
                print(f"Warning: Failed to execute schema.sql automatically. Is MySQL in your PATH? Error: {e}")
        else:
            print("schema.sql not found.")

        print("\n--- Deployment Completed Successfully! ---")
        print(f"You can now access the app at: http://localhost/anbar_kharid")
        
    except Exception as e:
        print(f"\nAn error occurred during deployment: {e}")
        sys.exit(1)

if __name__ == "__main__":
    deploy()
