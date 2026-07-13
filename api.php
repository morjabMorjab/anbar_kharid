<?php
/**
 * API Request Handler for Internal Procurement System
 * Supports: items, departments, purchase requests, and supply tracking
 */

header('Content-Type: application/json; charset=utf-8');
require_once 'db.php';

$action = $_GET['action'] ?? $_POST['action'] ?? '';

// --- Read Actions (GET) ---

if ($action === 'get_departments') {
    try {
        $stmt = $pdo->query("SELECT * FROM departments ORDER BY name ASC");
        echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
    exit;
}

if ($action === 'get_items') {
    try {
        $stmt = $pdo->query("SELECT * FROM items ORDER BY name ASC");
        echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
    exit;
}

if ($action === 'list') {
    try {
        // Fetch all requests
        $stmt = $pdo->query("SELECT * FROM purchase_requests ORDER BY id DESC");
        $requests = $stmt->fetchAll();

        foreach ($requests as &$req) {
            $stmtItems = $pdo->prepare("
                SELECT pri.*, i.name as item_name, i.unit as item_unit, d.name as department_name
                FROM purchase_request_items pri
                JOIN items i ON pri.item_id = i.id
                JOIN departments d ON pri.department_id = d.id
                WHERE pri.request_id = ?
            ");
            $stmtItems->execute([$req['id']]);
            $req['items'] = $stmtItems->fetchAll();
        }

        echo json_encode(['success' => true, 'data' => $requests]);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
    exit;
}

// --- Write Actions (POST) ---

if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    if ($action === 'create_item') {
        $name = $_POST['name'] ?? '';
        $unit = $_POST['unit'] ?? '';
        if (!$name || !$unit) {
            echo json_encode(['success' => false, 'message' => 'نام کالا و واحد الزامی است.']);
            exit;
        }
        try {
            $stmt = $pdo->prepare("INSERT INTO items (name, unit) VALUES (?, ?)");
            $stmt->execute([$name, $unit]);
            echo json_encode(['success' => true, 'id' => $pdo->lastInsertId(), 'name' => $name, 'unit' => $unit]);
        } catch (PDOException $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        exit;
    }

    if ($action === 'create_department') {
        $name = $_POST['name'] ?? '';
        if (!$name) {
            echo json_encode(['success' => false, 'message' => 'نام بخش الزامی است.']);
            exit;
        }
        try {
            $stmt = $pdo->prepare("INSERT INTO departments (name) VALUES (?)");
            $stmt->execute([$name]);
            echo json_encode(['success' => true, 'id' => $pdo->lastInsertId(), 'name' => $name]);
        } catch (PDOException $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        exit;
    }

    if ($action === 'create_request') {
        $request_date = $_POST['request_date'] ?? '';
        $items = json_decode($_POST['items'] ?? '[]', true);

        if (!$request_date || empty($items)) {
            echo json_encode(['success' => false, 'message' => 'لطفا تاریخ درخواست و حداقل اطلاعات یک ردیف را وارد کنید.']);
            exit;
        }

        try {
            $pdo->beginTransaction();

            $stmt = $pdo->prepare("INSERT INTO purchase_requests (request_date) VALUES (?)");
            $stmt->execute([$request_date]);
            $requestId = $pdo->lastInsertId();

            $stmtItem = $pdo->prepare("
                INSERT INTO purchase_request_items (request_id, item_id, department_id, quantity, description)
                VALUES (?, ?, ?, ?, ?)
            ");

            foreach ($items as $item) {
                $stmtItem->execute([
                    $requestId,
                    $item['item_id'],
                    $item['department_id'],
                    $item['quantity'],
                    $item['description'] ?? ''
                ]);
            }

            $pdo->commit();
            echo json_encode(['success' => true, 'message' => 'سند خرید با موفقیت ثبت گردید.']);
        } catch (PDOException $e) {
            $pdo->rollBack();
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        exit;
    }

    if ($action === 'update_request') {
        $requestId = $_POST['request_id'] ?? '';
        $request_date = $_POST['request_date'] ?? '';
        $items = json_decode($_POST['items'] ?? '[]', true);

        if (!$requestId) {
            echo json_encode(['success' => false, 'message' => 'ID سند یافت نشد.']);
            exit;
        }

        try {
            $pdo->beginTransaction();

            // Update main record
            $stmt = $pdo->prepare("UPDATE purchase_requests SET request_date = ? WHERE id = ?");
            $stmt->execute([$request_date, $requestId]);

            // Track IDs to keep
            $keptIds = [];

            $stmtUpdate = $pdo->prepare("
                UPDATE purchase_request_items 
                SET item_id = ?, department_id = ?, quantity = ?, description = ?
                WHERE id = ? AND request_id = ?
            ");
            
            $stmtInsert = $pdo->prepare("
                INSERT INTO purchase_request_items (request_id, item_id, department_id, quantity, description)
                VALUES (?, ?, ?, ?, ?)
            ");

            foreach ($items as $item) {
                if (!empty($item['id'])) {
                    $stmtUpdate->execute([
                        $item['item_id'],
                        $item['department_id'],
                        $item['quantity'],
                        $item['description'] ?? '',
                        $item['id'],
                        $requestId
                    ]);
                    $keptIds[] = $item['id'];
                } else {
                    $stmtInsert->execute([
                        $requestId,
                        $item['item_id'],
                        $item['department_id'],
                        $item['quantity'],
                        $item['description'] ?? ''
                    ]);
                    $keptIds[] = $pdo->lastInsertId();
                }
            }

            // Delete removed items
            if (!empty($keptIds)) {
                $in = str_repeat('?,', count($keptIds) - 1) . '?';
                $stmtDel = $pdo->prepare("DELETE FROM purchase_request_items WHERE request_id = ? AND id NOT IN ($in)");
                $stmtDel->execute(array_merge([$requestId], $keptIds));
            } else {
                $stmtDel = $pdo->prepare("DELETE FROM purchase_request_items WHERE request_id = ?");
                $stmtDel->execute([$requestId]);
            }

            $pdo->commit();
            echo json_encode(['success' => true, 'message' => "سند خرید شماره $requestId با موفقیت ویرایش و به روز رسانی شد."]);
        } catch (PDOException $e) {
            $pdo->rollBack();
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        exit;
    }

    if ($action === 'delete_request') {
        $requestId = $_POST['request_id'] ?? '';
        if (!$requestId) exit;

        try {
            $pdo->beginTransaction();
            $pdo->prepare("DELETE FROM purchase_request_items WHERE request_id = ?")->execute([$requestId]);
            $pdo->prepare("DELETE FROM purchase_requests WHERE id = ?")->execute([$requestId]);
            $pdo->commit();
            echo json_encode(['success' => true, 'message' => "سند خرید شماره $requestId و تمام اقلام آن با موفقیت حذف گردید."]);
        } catch (PDOException $e) {
            $pdo->rollBack();
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        exit;
    }

    if ($action === 'update_purchase_progress') {
        $items = json_decode($_POST['items'] ?? '[]', true);
        try {
            $pdo->beginTransaction();
            $stmt = $pdo->prepare("UPDATE purchase_request_items SET purchased_quantity = ? WHERE id = ?");
            foreach ($items as $item) {
                $stmt->execute([$item['purchased_quantity'], $item['id']]);
            }
            $pdo->commit();
            echo json_encode(['success' => true, 'message' => 'آمار خرید با موفقیت به‌روزرسانی شد.']);
        } catch (PDOException $e) {
            $pdo->rollBack();
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        exit;
    }

    // --- New Actions for Items/Depts Management ---

    if ($action === 'edit_item') {
        $id = $_POST['id'] ?? '';
        $name = $_POST['name'] ?? '';
        $unit = $_POST['unit'] ?? '';
        try {
            $stmt = $pdo->prepare("UPDATE items SET name = ?, unit = ? WHERE id = ?");
            $stmt->execute([$name, $unit, $id]);
            echo json_encode(['success' => true, 'message' => 'مشخصات کالا با موفقیت ویرایش شد.']);
        } catch (PDOException $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        exit;
    }

    if ($action === 'delete_item') {
        $id = $_POST['id'] ?? '';
        try {
            $stmt = $pdo->prepare("DELETE FROM items WHERE id = ?");
            $stmt->execute([$id]);
            echo json_encode(['success' => true, 'message' => 'کالا با موفقیت از سیستم حذف گردید.']);
        } catch (PDOException $e) {
            echo json_encode(['success' => false, 'message' => 'خطا: احتمالا این کالا در اسناد خرید استفاده شده است.']);
        }
        exit;
    }

    if ($action === 'edit_department') {
        $id = $_POST['id'] ?? '';
        $name = $_POST['name'] ?? '';
        try {
            $stmt = $pdo->prepare("UPDATE departments SET name = ? WHERE id = ?");
            $stmt->execute([$name, $id]);
            echo json_encode(['success' => true, 'message' => 'نام بخش با موفقیت ویرایش شد.']);
        } catch (PDOException $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        exit;
    }

    if ($action === 'delete_department') {
        $id = $_POST['id'] ?? '';
        try {
            $stmt = $pdo->prepare("DELETE FROM departments WHERE id = ?");
            $stmt->execute([$id]);
            echo json_encode(['success' => true, 'message' => 'بخش با موفقیت از سیستم حذف گردید.']);
        } catch (PDOException $e) {
            echo json_encode(['success' => false, 'message' => 'خطا: احتمالا این بخش در اسناد خرید استفاده شده است.']);
        }
        exit;
    }
}

echo json_encode(['success' => false, 'message' => 'Invalid Action']);
