-- SQL Schema for Internal Procurement System

CREATE TABLE IF NOT EXISTS items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    unit VARCHAR(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    request_date VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_request_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    request_id INT NOT NULL,
    item_id INT NOT NULL,
    department_id INT NOT NULL,
    quantity INT NOT NULL,
    purchased_quantity INT DEFAULT 0,
    description TEXT,
    FOREIGN KEY (request_id) REFERENCES purchase_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES items(id),
    FOREIGN KEY (department_id) REFERENCES departments(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed Data
INSERT IGNORE INTO departments (name) VALUES 
('اداری و پشتیبانی'), 
('بخش اورژانس'), 
('بخش جراحی'), 
('آزمایشگاه'), 
('داروخانه تک نسخه‌ای'), 
('امور مالی');

INSERT IGNORE INTO items (name, unit) VALUES 
('سرنگ ۵ سی سی لوئر لاک', 'عدد'),
('کابل شبکه Cat6 ده متری', 'عدد'),
('دستکش معاینه لایتکس', 'بسته'),
('کاغذ A4 کپی مکس', 'بسته'),
('گاز استریل ۱۰*۱۰', 'بسته'),
('آنژیوکت آبی', 'عدد');
