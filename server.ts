import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer();
const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const dbFilePath = path.join(__dirname, 'db.json');

// داده‌های اولیه پیش‌فرض
const initialDb = {
  departments: [
    { id: 1, name: 'اداری و پشتیبانی' },
    { id: 2, name: 'بخش اورژانس' },
    { id: 3, name: 'بخش جراحی' },
    { id: 4, name: 'آزمایشگاه' },
    { id: 5, name: 'داروخانه تک نسخه‌ای' },
    { id: 6, name: 'امور مالی' }
  ],
  items: [
    { id: 1, name: 'سرنگ ۵ سی سی لوئر لاک', unit: 'عدد' },
    { id: 2, name: 'کابل شبکه Cat6 ده متری', unit: 'عدد' },
    { id: 3, name: 'دستکش معاینه لایتکس', unit: 'بسته' },
    { id: 4, name: 'کاغذ A4 کپی مکس', unit: 'بسته' },
    { id: 5, name: 'گاز استریل ۱۰*۱۰', unit: 'بسته' },
    { id: 6, name: 'آنژیوکت آبی', unit: 'عدد' }
  ],
  purchaseRequests: [] as any[],
  purchaseRequestItems: [] as any[],
  nextRequestId: 1,
  nextPriId: 1,
  nextItemId: 7,
  nextDeptId: 7
};

let dbData = { ...initialDb };

// لود داده‌ها از فایل محلی db.json در صورت وجود
if (fs.existsSync(dbFilePath)) {
  try {
    const raw = fs.readFileSync(dbFilePath, 'utf8');
    dbData = JSON.parse(raw);
    if (!dbData.departments) dbData.departments = initialDb.departments;
    if (!dbData.items) dbData.items = initialDb.items;
    if (!dbData.purchaseRequests) dbData.purchaseRequests = initialDb.purchaseRequests;
    if (!dbData.purchaseRequestItems) dbData.purchaseRequestItems = initialDb.purchaseRequestItems;
    if (dbData.nextRequestId === undefined) dbData.nextRequestId = initialDb.nextRequestId;
    if (dbData.nextPriId === undefined) dbData.nextPriId = initialDb.nextPriId;
    if (dbData.nextItemId === undefined) dbData.nextItemId = initialDb.nextItemId;
    if (dbData.nextDeptId === undefined) dbData.nextDeptId = initialDb.nextDeptId;
  } catch (e) {
    console.error('Error reading db.json', e);
  }
} else {
  try {
    fs.writeFileSync(dbFilePath, JSON.stringify(dbData, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing initial db.json', e);
  }
}

// ذخیره‌سازی داده‌ها در فایل محلی
const saveDb = () => {
  try {
    fs.writeFileSync(dbFilePath, JSON.stringify(dbData, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving db.json', e);
  }
};

// کمکی برای استخراج رکوئست کامل با اقلام آن
const getFullRequests = () => {
  return dbData.purchaseRequests.map((req: any) => {
    const reqItems = dbData.purchaseRequestItems.filter((pri: any) => pri.request_id === req.id).map((pri: any) => {
      const item = dbData.items.find((i: any) => i.id === pri.item_id);
      const dept = dbData.departments.find((d: any) => d.id === pri.department_id);
      return {
        ...pri,
        item_name: item?.name || 'Unknown',
        item_unit: item?.unit || '-',
        department_name: dept?.name || 'Unknown'
      };
    });
    return { ...req, items: reqItems };
  }).sort((a: any, b: any) => b.id - a.id);
};

// API Routes (mapping api.php)
app.all('/api.php', upload.none(), (req, res) => {
  const action = req.query.action || req.body.action;
  
  if (req.method === 'GET') {
    if (action === 'get_departments') {
      return res.json({ success: true, data: dbData.departments });
    }
    if (action === 'get_items') {
      return res.json({ success: true, data: dbData.items });
    }
    if (action === 'list') {
      return res.json({ success: true, data: getFullRequests() });
    }
  }

  if (req.method === 'POST') {
    if (action === 'create_item') {
      const { name, unit } = req.body;
      if (!name || !unit) return res.json({ success: false, message: 'نام کالا و واحد الزامی است.' });
      const newItem = { id: dbData.nextItemId++, name, unit };
      dbData.items.push(newItem);
      saveDb();
      return res.json({ success: true, ...newItem });
    }
    if (action === 'create_department') {
      const { name } = req.body;
      if (!name) return res.json({ success: false, message: 'نام بخش الزامی است.' });
      const newDept = { id: dbData.nextDeptId++, name };
      dbData.departments.push(newDept);
      saveDb();
      return res.json({ success: true, ...newDept });
    }
    if (action === 'create_request') {
      const { request_date, items: itemsJson } = req.body;
      const reqItems = JSON.parse(itemsJson || '[]');
      if (!request_date || reqItems.length === 0) {
        return res.json({ success: false, message: 'لطفا تاریخ درخواست و حداقل اطلاعات یک ردیف را وارد کنید.' });
      }
      const requestId = dbData.nextRequestId++;
      dbData.purchaseRequests.push({ id: requestId, request_date, created_at: new Date().toISOString() });
      reqItems.forEach((item: any) => {
        dbData.purchaseRequestItems.push({
          id: dbData.nextPriId++,
          request_id: requestId,
          item_id: parseInt(item.item_id),
          department_id: parseInt(item.department_id),
          quantity: parseInt(item.quantity),
          purchased_quantity: 0,
          description: item.description || ''
        });
      });
      saveDb();
      return res.json({ success: true, message: 'سند خرید با موفقیت ثبت گردید.' });
    }
    if (action === 'update_request') {
      const { request_id, request_date, items: itemsJson } = req.body;
      const rid = parseInt(request_id);
      const reqItems = JSON.parse(itemsJson || '[]');
      const reqIdx = dbData.purchaseRequests.findIndex((r: any) => r.id === rid);
      if (reqIdx === -1) return res.json({ success: false, message: 'سند یافت نشد.' });
      
      dbData.purchaseRequests[reqIdx].request_date = request_date;
      
      // Update or add items
      const keptIds: number[] = [];
      reqItems.forEach((item: any) => {
        const dbId = item.id ? parseInt(item.id) : null;
        if (dbId) {
          const idx = dbData.purchaseRequestItems.findIndex((pri: any) => pri.id === dbId);
          if (idx !== -1) {
            dbData.purchaseRequestItems[idx] = {
              ...dbData.purchaseRequestItems[idx],
              item_id: parseInt(item.item_id),
              department_id: parseInt(item.department_id),
              quantity: parseInt(item.quantity),
              description: item.description || ''
            };
            keptIds.push(dbId);
          }
        } else {
          const newId = dbData.nextPriId++;
          dbData.purchaseRequestItems.push({
            id: newId,
            request_id: rid,
            item_id: parseInt(item.item_id),
            department_id: parseInt(item.department_id),
            quantity: parseInt(item.quantity),
            purchased_quantity: 0,
            description: item.description || ''
          });
          keptIds.push(newId);
        }
      });
      
      // Remove items not in keptIds
      dbData.purchaseRequestItems = dbData.purchaseRequestItems.filter((pri: any) => pri.request_id !== rid || keptIds.includes(pri.id));
      saveDb();
      
      return res.json({ success: true, message: `سند خرید شماره ${rid} با موفقیت ویرایش و به روز رسانی شد.` });
    }
    if (action === 'delete_request') {
      const rid = parseInt(req.body.request_id);
      dbData.purchaseRequests = dbData.purchaseRequests.filter((r: any) => r.id !== rid);
      dbData.purchaseRequestItems = dbData.purchaseRequestItems.filter((pri: any) => pri.request_id !== rid);
      saveDb();
      return res.json({ success: true, message: `سند خرید شماره ${rid} و تمام اقلام آن با موفقیت حذف گردید.` });
    }
    if (action === 'update_purchase_progress') {
      const reqItems = JSON.parse(req.body.items || '[]');
      reqItems.forEach((item: any) => {
        const idx = dbData.purchaseRequestItems.findIndex((pri: any) => pri.id === parseInt(item.id));
        if (idx !== -1) {
          dbData.purchaseRequestItems[idx].purchased_quantity = parseInt(item.purchased_quantity);
        }
      });
      saveDb();
      return res.json({ success: true, message: 'آمار خرید با موفقیت به‌روزرسانی شد.' });
    }
    if (action === 'edit_item') {
      const { id, name, unit } = req.body;
      const idx = dbData.items.findIndex((i: any) => i.id === parseInt(id));
      if (idx !== -1) {
        dbData.items[idx] = { id: parseInt(id), name, unit };
        saveDb();
        return res.json({ success: true, message: 'مشخصات کالا با موفقیت ویرایش شد.' });
      }
      return res.json({ success: false, message: 'کالا یافت نشد.' });
    }
    if (action === 'delete_item') {
      const id = parseInt(req.body.id);
      dbData.items = dbData.items.filter((i: any) => i.id !== id);
      saveDb();
      return res.json({ success: true, message: 'کالا با موفقیت از سیستم حذف گردید.' });
    }
    if (action === 'edit_department') {
      const { id, name } = req.body;
      const idx = dbData.departments.findIndex((d: any) => d.id === parseInt(id));
      if (idx !== -1) {
        dbData.departments[idx] = { id: parseInt(id), name };
        saveDb();
        return res.json({ success: true, message: 'نام بخش با موفقیت ویرایش شد.' });
      }
      return res.json({ success: false, message: 'بخش یافت نشد.' });
    }
    if (action === 'delete_department') {
      const id = parseInt(req.body.id);
      dbData.departments = dbData.departments.filter((d: any) => d.id !== id);
      saveDb();
      return res.json({ success: true, message: 'بخش با موفقیت از سیستم حذف گردید.' });
    }
  }

  res.status(404).json({ success: false, message: 'Action not found' });
});

// Serve static files
app.use(express.static(__dirname));

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${port}`);
});
