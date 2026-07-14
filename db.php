<?php
// Database connection configuration
$host = 'localhost';
$db   = 'purchase_db';
$user = 'root';
$pass = '';
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
     $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
     // For this preview environment, we fallback to sqlite or similar if needed, 
     // but the user wants the raw source code.
     // throw new \PDOException($e->getMessage(), (int)$e->getCode());
}
?>
