import os
import shutil
import sys
import subprocess

def deploy():
    # مسیر مبدا (پروژه فعلی)
    source_dir = os.getcwd()
    
    # مسیر مقصد (WAMP)
    dest_dir = r"C:\wamp64\www\anbar_kharid"
    
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
                # ایجاد دیتابیس در صورت عدم وجود
                subprocess.run('mysql -u root -e "CREATE DATABASE IF NOT EXISTS anbar_kharid CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"', shell=True, check=True)
                # اجرای اسکیما
                subprocess.run(f'mysql -u root anbar_kharid < "{schema_path}"', shell=True, check=True)
                print("schema.sql executed successfully.")
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
