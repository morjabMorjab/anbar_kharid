import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer();
const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// In-memory data store
let departments = [
  { id: 1, name: 'اداری و پشتیبانی' },
  { id: 2, name: 'بخش اورژانس' },
  { id: 3, name: 'بخش جراحی' },
  { id: 4, name: 'آزمایشگاه' },
  { id: 5, name: 'داروخانه تک نسخه‌ای' },
  { id: 6, name: 'امور مالی' }
];

let items = [
  { id: 1, name: 'سرنگ ۵ سی سی لوئر لاک', unit: 'عدد' },
  { id: 2, name: 'کابل شبکه Cat6 ده متری', unit: 'عدد' },
  { id: 3, name: 'دستکش معاینه لایتکس', unit: 'بسته' },
  { id: 4, name: 'کاغذ A4 کپی مکس', unit: 'بسته' },
  { id: 5, name: 'گاز استریل ۱۰*۱۰', unit: 'بسته' },
  { id: 6, name: 'آنژیوکت آبی', unit: 'عدد' }
];

let purchaseRequests: any[] = [];
let purchaseRequestItems: any[] = [];
let nextRequestId = 1;
let nextPriId = 1;
let nextItemId = 7;
let nextDeptId = 7;

// Helper to get nested requests
const getFullRequests = () => {
  return purchaseRequests.map(req => {
    const reqItems = purchaseRequestItems.filter(pri => pri.request_id === req.id).map(pri => {
      const item = items.find(i => i.id === pri.item_id);
      const dept = departments.find(d => d.id === pri.department_id);
      return {
        ...pri,
        item_name: item?.name || 'Unknown',
        item_unit: item?.unit || '-',
        department_name: dept?.name || 'Unknown'
      };
    });
    return { ...req, items: reqItems };
  }).sort((a, b) => b.id - a.id);
};

// API Routes (mapping api.php)
app.all('/api.php', upload.none(), (req, res) => {
  const action = req.query.action || req.body.action;
  
  if (req.method === 'GET') {
    if (action === 'get_departments') {
      return res.json({ success: true, data: departments });
    }
    if (action === 'get_items') {
      return res.json({ success: true, data: items });
    }
    if (action === 'list') {
      return res.json({ success: true, data: getFullRequests() });
    }
  }

  if (req.method === 'POST') {
    if (action === 'create_item') {
      const { name, unit } = req.body;
      if (!name || !unit) return res.json({ success: false, message: 'نام کالا و واحد الزامی است.' });
      const newItem = { id: nextItemId++, name, unit };
      items.push(newItem);
      return res.json({ success: true, ...newItem });
    }
    if (action === 'create_department') {
      const { name } = req.body;
      if (!name) return res.json({ success: false, message: 'نام بخش الزامی است.' });
      const newDept = { id: nextDeptId++, name };
      departments.push(newDept);
      return res.json({ success: true, ...newDept });
    }
    if (action === 'create_request') {
      const { request_date, items: itemsJson } = req.body;
      const reqItems = JSON.parse(itemsJson || '[]');
      if (!request_date || reqItems.length === 0) {
        return res.json({ success: false, message: 'لطفا تاریخ درخواست و حداقل اطلاعات یک ردیف را وارد کنید.' });
      }
      const requestId = nextRequestId++;
      purchaseRequests.push({ id: requestId, request_date, created_at: new Date().toISOString() });
      reqItems.forEach((item: any) => {
        purchaseRequestItems.push({
          id: nextPriId++,
          request_id: requestId,
          item_id: parseInt(item.item_id),
          department_id: parseInt(item.department_id),
          quantity: parseInt(item.quantity),
          purchased_quantity: 0,
          description: item.description || ''
        });
      });
      return res.json({ success: true, message: 'سند خرید با موفقیت ثبت گردید.' });
    }
    if (action === 'update_request') {
      const { request_id, request_date, items: itemsJson } = req.body;
      const rid = parseInt(request_id);
      const reqItems = JSON.parse(itemsJson || '[]');
      const reqIdx = purchaseRequests.findIndex(r => r.id === rid);
      if (reqIdx === -1) return res.json({ success: false, message: 'سند یافت نشد.' });
      
      purchaseRequests[reqIdx].request_date = request_date;
      
      // Update or add items
      const keptIds: number[] = [];
      reqItems.forEach((item: any) => {
        const dbId = item.id ? parseInt(item.id) : null;
        if (dbId) {
          const idx = purchaseRequestItems.findIndex(pri => pri.id === dbId);
          if (idx !== -1) {
            purchaseRequestItems[idx] = {
              ...purchaseRequestItems[idx],
              item_id: parseInt(item.item_id),
              department_id: parseInt(item.department_id),
              quantity: parseInt(item.quantity),
              description: item.description || ''
            };
            keptIds.push(dbId);
          }
        } else {
          const newId = nextPriId++;
          purchaseRequestItems.push({
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
      purchaseRequestItems = purchaseRequestItems.filter(pri => pri.request_id !== rid || keptIds.includes(pri.id));
      
      return res.json({ success: true, message: `سند خرید شماره ${rid} با موفقیت ویرایش و به روز رسانی شد.` });
    }
    if (action === 'delete_request') {
      const rid = parseInt(req.body.request_id);
      purchaseRequests = purchaseRequests.filter(r => r.id !== rid);
      purchaseRequestItems = purchaseRequestItems.filter(pri => pri.request_id !== rid);
      return res.json({ success: true, message: `سند خرید شماره ${rid} و تمام اقلام آن با موفقیت حذف گردید.` });
    }
    if (action === 'update_purchase_progress') {
      const reqItems = JSON.parse(req.body.items || '[]');
      reqItems.forEach((item: any) => {
        const idx = purchaseRequestItems.findIndex(pri => pri.id === parseInt(item.id));
        if (idx !== -1) {
          purchaseRequestItems[idx].purchased_quantity = parseInt(item.purchased_quantity);
        }
      });
      return res.json({ success: true, message: 'آمار خرید با موفقیت به‌روزرسانی شد.' });
    }
    if (action === 'edit_item') {
      const { id, name, unit } = req.body;
      const idx = items.findIndex(i => i.id === parseInt(id));
      if (idx !== -1) {
        items[idx] = { id: parseInt(id), name, unit };
        return res.json({ success: true, message: 'مشخصات کالا با موفقیت ویرایش شد.' });
      }
      return res.json({ success: false, message: 'کالا یافت نشد.' });
    }
    if (action === 'delete_item') {
      const id = parseInt(req.body.id);
      items = items.filter(i => i.id !== id);
      return res.json({ success: true, message: 'کالا با موفقیت از سیستم حذف گردید.' });
    }
    if (action === 'edit_department') {
      const { id, name } = req.body;
      const idx = departments.findIndex(d => d.id === parseInt(id));
      if (idx !== -1) {
        departments[idx] = { id: parseInt(id), name };
        return res.json({ success: true, message: 'نام بخش با موفقیت ویرایش شد.' });
      }
      return res.json({ success: false, message: 'بخش یافت نشد.' });
    }
    if (action === 'delete_department') {
      const id = parseInt(req.body.id);
      departments = departments.filter(d => d.id !== id);
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
