function toPersianDigits(str) {
    if (str === null || str === undefined) return '';
    const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return str.toString().replace(/\d/g, x => farsiDigits[x]);
}

function toEnglishDigits(str) {
    if (str === null || str === undefined) return '';
    return str.toString()
        .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
        .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
}

window.toPersianDigits = toPersianDigits;
window.toEnglishDigits = toEnglishDigits;

let cachedItems = [];
let cachedDepts = [];
let allRequests = [];
let currentPendingSelect = null;
let editingRequestId = null;

function cancelEditing() {
    editingRequestId = null;
    const submitBtn = document.querySelector('button[onclick="submitRequestForm()"]') || document.querySelector('#requestForm button[type="submit"]');
    if (submitBtn) {
        submitBtn.innerHTML = 'ثبت و ذخیره نهایی سند (Save)';
        submitBtn.style.backgroundColor = '';
    }
    const cancelBtn = document.getElementById('cancelEditBtn');
    if (cancelBtn) cancelBtn.remove();
    
    document.getElementById('requestForm').reset();
    document.getElementById('itemsTableBody').innerHTML = '';
    setupShamsiDate();
    addItemRow(); // ۱ ردیف پیش‌فرض
    showToast('info', 'ویرایش سند لغو شد.');
}

function gregorianToJalali(gy, gm, gd) {
    const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    let jy, jm, jd;
    let gy2 = (gm > 2) ? (gy + 1) : gy;
    let days = 355666 + (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + g_d_m[gm - 1];
    jy = -1595 + (33 * Math.floor(days / 12053));
    days %= 12053;
    jy += 4 * Math.floor(days / 1461);
    days %= 1461;
    if (days > 365) {
        jy += Math.floor((days - 1) / 365);
        days = (days - 1) % 365;
    }
    if (days < 186) {
        jm = 1 + Math.floor(days / 31);
        jd = 1 + (days % 31);
    } else {
        jm = 7 + Math.floor((days - 186) / 30);
        jd = 1 + ((days - 186) % 30);
    }
    return [jy, jm, jd];
}

function getTodayShamsi() {
    const today = new Date();
    const gy = today.getFullYear();
    const gm = today.getMonth() + 1;
    const gd = today.getDate();
    const [jy, jm, jd] = gregorianToJalali(gy, gm, gd);
    return {
        year: jy,
        month: jm.toString().padStart(2, '0'),
        day: jd.toString().padStart(2, '0')
    };
}

function initializeApp() {
    setupShamsiDate();
    
    // ۱. پاکسازی ردیف فال‌بک اولیه HTML و بازسازی ردیف کاملاً پویا و متصل به دیتابیس
    const container = document.getElementById('itemsTableBody');
    if (container) {
        container.innerHTML = '';
    }
    addItemRow(); // ساخت ۱ ردیف پیش‌فرض داینامیک دیتابیس
    
    loadInitialData();
    
    const filterStatus = document.getElementById('filter_status');
    if (filterStatus && typeof makeSearchable === 'function') {
        makeSearchable(filterStatus, "همه وضعیت‌ها");
    }
    
    if (typeof setupModalSearchEvents === 'function') {
        setupModalSearchEvents();
    }
    
    const requestForm = document.getElementById('requestForm');
    if (requestForm) {
        requestForm.addEventListener('submit', function(e) {
            e.preventDefault();
            submitRequestForm();
        });
    }
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            const activeEl = document.activeElement;
            if (activeEl && (activeEl.classList.contains('form-control-excel') || activeEl.classList.contains('form-select-excel'))) {
                e.preventDefault();
                const tr = activeEl.closest('tr');
                if (tr) {
                    // Find all interactive inputs/selects in this specific row
                    const rowInputs = Array.from(tr.querySelectorAll('input:not([disabled]), select:not([disabled])'));
                    const currentIndex = rowInputs.indexOf(activeEl);
                    
                    if (currentIndex >= 0 && currentIndex < rowInputs.length - 1) {
                        // Move to next input in the SAME row
                        rowInputs[currentIndex + 1].focus();
                    } else {
                        // We are at the last input of the row
                        const nextTr = tr.nextElementSibling;
                        if (nextTr) {
                            // Focus first input of the next row
                            const nextInputs = nextTr.querySelectorAll('input:not([disabled]), select:not([disabled])');
                            if (nextInputs.length > 0) {
                                nextInputs[0].focus();
                            }
                        } else {
                            // We are at the very last row, dynamically create a new row!
                            addItemRow();
                            // Wait a tiny bit for the DOM to update, then focus the first input of the newly added row
                            setTimeout(() => {
                                const lastTr = document.querySelector('#itemsTableBody tr:last-child');
                                if (lastTr) {
                                    const nextInputs = lastTr.querySelectorAll('input:not([disabled]), select:not([disabled])');
                                    if (nextInputs.length > 0) {
                                        nextInputs[0].focus();
                                    }
                                }
                            }, 10);
                        }
                    }
                }
            }
        }
    });
}

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

function setupShamsiDate() {
    const today = getTodayShamsi();
    const formatted = today.year + '/' + today.month + '/' + today.day;
    const dateInput = document.getElementById('request_date');
    if (dateInput) {
        dateInput.value = formatted;
    }
}

async function loadInitialData() {
    try { await fetchDepartments(); } catch(e) { console.log(e); }
    try { await fetchItems(); } catch(e) { console.log(e); }
    try { fetchRequests(); } catch(e) { console.log(e); }
}

function fetchDepartments() {
    return fetch('api.php?action=get_departments')
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                cachedDepts = data.data;
                updateAllDeptDropdowns();
                populateDeptFilter();
            }
        });
}

function fetchItems() {
    return fetch('api.php?action=get_items')
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                cachedItems = data.data;
                updateAllItemDropdowns();
            }
        });
}

function populateDeptFilter() {
    const filterSelect = document.getElementById('filter_dept');
    if (!filterSelect) return;
    filterSelect.innerHTML = '<option value="">همه بخش‌های متقاضی</option>';
    cachedDepts.forEach(dept => {
        const opt = document.createElement('option');
        opt.value = dept.id;
        opt.textContent = dept.name;
        filterSelect.appendChild(opt);
    });
    if (typeof makeSearchable === 'function') {
        makeSearchable(filterSelect, "همه بخش‌ها");
    }
}

function updateAllDeptDropdowns() {
    document.querySelectorAll('.dept-select').forEach(select => {
        const currentVal = select.value;
        populateDeptDropdown(select);
        select.value = currentVal;
        if (select.syncSearchable) {
            select.syncSearchable();
        }
    });
}

function populateDeptDropdown(select) {
    select.innerHTML = '<option value="">انتخاب بخش...</option>';
    cachedDepts.forEach(dept => {
        const opt = document.createElement('option');
        opt.value = dept.id;
        opt.textContent = dept.name;
        select.appendChild(opt);
    });
    const optNew = document.createElement('option');
    optNew.value = "ADD_NEW";
    optNew.textContent = "⚙️ تعریف بخش جدید...";
    select.appendChild(optNew);
}

function updateAllItemDropdowns() {
    document.querySelectorAll('.item-select').forEach(select => {
        const currentVal = select.value;
        populateItemDropdown(select);
        select.value = currentVal;
        if (select.syncSearchable) {
            select.syncSearchable();
        }
    });
}

function populateItemDropdown(select) {
    select.innerHTML = '<option value="">انتخاب کالا...</option>';
    cachedItems.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.id;
        opt.textContent = item.name;
        opt.dataset.unit = item.unit;
        select.appendChild(opt);
    });
    const optNew = document.createElement('option');
    optNew.value = "ADD_NEW";
    optNew.textContent = "⚙️ تعریف کالا جدید...";
    select.appendChild(optNew);
}

function generateUniqueId() {
    return 'row_' + Math.random().toString(36).substr(2, 9);
}

function recalculateRowNumbers() {
    document.querySelectorAll('#itemsTableBody tr').forEach((row, index) => {
        row.querySelector('.row-counter').textContent = toPersianDigits(index + 1);
    });
}

function addItemRow() {
    const container = document.getElementById('itemsTableBody');
    const rowId = generateUniqueId();
    const tr = document.createElement('tr');
    tr.id = rowId;
    tr.innerHTML = '<td class="row-counter"></td>' +
        '<td><select class="form-select form-select-excel item-select" onchange="checkNewItem(this)" required></select></td>' +
        '<td><select class="form-select form-select-excel dept-select" onchange="checkNewDept(this)" required></select></td>' +
        '<td><input type="number" class="form-control form-control-excel item-qty text-center" min="1" value="1" required></td>' +
        '<td class="text-center"><span class="badge bg-light text-dark item-unit-badge">-</span></td>' +
        '<td><input type="text" class="form-control form-control-excel item-desc" placeholder="..."></td>' +
        '<td class="text-center"><button type="button" class="btn btn-sm btn-outline-danger" style="padding: 4px 8px !important; min-width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; font-size: 14px;" onclick="removeItemRow(\'' + rowId + '\')">✕</button></td>';
    container.appendChild(tr);
    const itemSel = tr.querySelector('.item-select');
    const deptSel = tr.querySelector('.dept-select');
    populateItemDropdown(itemSel);
    populateDeptDropdown(deptSel);
    if (typeof makeSearchable === 'function') {
        makeSearchable(itemSel, "انتخاب کالا...");
        makeSearchable(deptSel, "انتخاب بخش...");
    }
    recalculateRowNumbers();
}

function removeItemRow(rowId) {
    const container = document.getElementById('itemsTableBody');
    if (container.children.length > 1) {
        document.getElementById(rowId).remove();
        recalculateRowNumbers();
    } else {
        showToast('error', 'حداقل یک ردیف باید باشد.');
    }
}

function checkNewItem(select) {
    if (select.value === "ADD_NEW") {
        currentPendingSelect = select;
        openModal('newItemModal');
    } else {
        const opt = select.options[select.selectedIndex];
        const unitBadge = select.closest('tr').querySelector('.item-unit-badge');
        unitBadge.textContent = (opt && opt.dataset.unit) ? opt.dataset.unit : '-';
    }
}

function cancelNewItem() {
    closeModal('newItemModal');
    if (currentPendingSelect) {
        currentPendingSelect.value = "";
        currentPendingSelect.closest('tr').querySelector('.item-unit-badge').textContent = '-';
    }
}

function saveNewItem() {
    const name = document.getElementById('new_item_name').value.trim();
    const unit = document.getElementById('new_item_unit').value.trim();
    if (!name || !unit) {
        showToast('error', 'نام و واحد کالا الزامی است.');
        return;
    }
    const fd = new FormData();
    fd.append('name', name);
    fd.append('unit', unit);
    fetch('api.php?action=create_item', { method: 'POST', body: fd })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                closeModal('newItemModal');
                showToast('success', 'کالا جدید ثبت شد.');
                document.getElementById('new_item_name').value = '';
                document.getElementById('new_item_unit').value = 'عدد';
                fetchItems().then(() => {
                    if (currentPendingSelect) {
                        currentPendingSelect.value = data.id;
                        currentPendingSelect.closest('tr').querySelector('.item-unit-badge').textContent = data.unit;
                    }
                });
            } else {
                showToast('error', data.message || 'خطا در ثبت کالا');
            }
        })
        .catch(() => showToast('error', 'خطا در ارتباط با سرور'));
}

function checkNewDept(select) {
    if (select.value === "ADD_NEW") {
        currentPendingSelect = select;
        openModal('newDeptModal');
    }
}

function cancelNewDept() {
    closeModal('newDeptModal');
    if (currentPendingSelect) {
        currentPendingSelect.value = "";
    }
}

function saveNewDept() {
    const name = document.getElementById('new_dept_name').value.trim();
    if (!name) {
        showToast('error', 'نام بخش الزامی است.');
        return;
    }
    const fd = new FormData();
    fd.append('name', name);
    fetch('api.php?action=create_department', { method: 'POST', body: fd })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                closeModal('newDeptModal');
                showToast('success', 'بخش جدید ثبت شد.');
                document.getElementById('new_dept_name').value = '';
                fetchDepartments().then(() => {
                    if (currentPendingSelect) {
                        currentPendingSelect.value = data.id;
                    }
                });
            } else {
                showToast('error', data.message || 'خطا در ثبت بخش');
            }
        })
        .catch(() => showToast('error', 'خطا در ارتباط با سرور'));
}

function submitRequestForm() {
    const rows = document.querySelectorAll('#itemsTableBody tr');
    const request_date = toEnglishDigits(document.getElementById('request_date').value.trim());
    const items = [];
    let hasIncompleteRow = false;
    
    rows.forEach(row => {
        const item_select = row.querySelector('.item-select');
        const dept_select = row.querySelector('.dept-select');
        const qty_input = row.querySelector('.item-qty');
        const desc_input = row.querySelector('.item-desc');
        
        const item_id = item_select ? item_select.value : '';
        const department_id = dept_select ? dept_select.value : '';
        const quantity = toEnglishDigits(qty_input ? qty_input.value : '');
        const description = desc_input ? desc_input.value : '';
        const db_item_id = row.getAttribute('data-db-item-id') || null;
        
        if (item_id || department_id || (quantity && quantity != '1') || description) {
            if (!item_id || !department_id || !quantity || quantity <= 0) {
                hasIncompleteRow = true;
            } else {
                items.push({ id: db_item_id, item_id, department_id, quantity, description });
            }
        }
    });
    
    if (!request_date) { showToast('error', 'تاریخ را وارد کنید.'); return; }
    if (hasIncompleteRow) {
        showToast('error', 'لطفاً برای تمامی ردیف‌های فعال، نام کالا، بخش متقاضی و تعداد معتبر وارد کنید.');
        return;
    }
    if (items.length === 0) { showToast('error', 'حداقل یک ردیف کامل وارد کنید.'); return; }
    
    const fd = new FormData();
    fd.append('request_date', request_date);
    fd.append('items', JSON.stringify(items));
    
    let url = 'api.php?action=create_request';
    if (editingRequestId) {
        url = 'api.php?action=update_request';
        fd.append('request_id', editingRequestId);
    }
    
    fetch(url, { method: 'POST', body: fd })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showToast('success', data.message);
                if (editingRequestId) {
                    cancelEditing();
                } else {
                    document.getElementById('requestForm').reset();
                    document.getElementById('itemsTableBody').innerHTML = '';
                    setupShamsiDate();
                    addItemRow(); // ۱ ردیف پیش‌فرض
                }
                fetchRequests();
            } else {
                showToast('error', data.message);
            }
        });
}

function fetchRequests() {
    fetch('api.php?action=list&_t=' + Date.now())
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                allRequests = data.data;
                filterRequestsList();
            }
        });
}

function filterRequestsList() {
    const tableBody = document.getElementById('requestsTableBody');
    const noData = document.getElementById('noDataMessage');
    tableBody.innerHTML = '';
    const query = document.getElementById('search_query').value.trim().toLowerCase();
    const filterDept = document.getElementById('filter_dept').value;
    const filterStatus = document.getElementById('filter_status').value;
    const filterDate = document.getElementById('filter_date').value.trim();
    const filtered = allRequests.filter(req => {
        const isFull = req.items.every(i => parseInt(i.purchased_quantity) >= parseInt(i.quantity));
        const totalPur = req.items.reduce((s, i) => s + parseInt(i.purchased_quantity), 0);
        if (filterStatus === 'purchased' && !isFull) return false;
        if (filterStatus === 'pending' && totalPur > 0) return false;
        if (filterStatus === 'partial' && (isFull || totalPur === 0)) return false;
        if (filterDept && !req.items.some(i => parseInt(i.department_id) === parseInt(filterDept))) return false;
        if (filterDate && !req.request_date.includes(filterDate)) return false;
        if (query) {
            const matchId = req.id.toString() === query || ("#" + req.id) === query;
            const matchItem = req.items.some(i => 
                i.item_name.toLowerCase().includes(query) || 
                i.department_name.toLowerCase().includes(query) ||
                (i.description && i.description.toLowerCase().includes(query))
            );
            if (!matchId && !matchItem) return false;
        }
        return true;
    });
    if (filtered.length === 0) {
        noData.classList.remove('d-none');
    } else {
        noData.classList.add('d-none');
        filtered.forEach(req => {
            const tr = document.createElement('tr');
            const isFull = req.items.every(i => parseInt(i.purchased_quantity) >= parseInt(i.quantity));
            const totalPur = req.items.reduce((s, i) => s + parseInt(i.purchased_quantity), 0);
            const totalReq = req.items.reduce((s, i) => s + parseInt(i.quantity), 0);
            let badge = '<span class="badge badge-pending">معلق</span>';
            if (isFull) badge = '<span class="badge badge-completed">✓ تامین کامل</span>';
            else if (totalPur > 0) badge = '<span class="badge badge-partial">تامین ناقص (' + toPersianDigits(totalPur) + ' از ' + toPersianDigits(totalReq) + ')</span>';
            tr.innerHTML = '<td><strong>' + toPersianDigits(req.id) + '</strong></td>' +
                '<td><span class="badge bg-dark">' + toPersianDigits(req.items.length) + ' ردیف</span></td>' +
                '<td>' + toPersianDigits(req.request_date) + '</td>' +
                '<td>' + badge + '</td>' +
                '<td>' +
                    '<button class="btn btn-sm btn-outline-official" onclick="showDetails(' + req.id + ')">🔍 مشاهده و پیگیری</button> ' +
                    '<button class="btn btn-sm btn-outline-warning" style="margin-right: 5px;" onclick="editDocument(' + req.id + ')">✏️ ویرایش</button> ' +
                    '<button class="btn btn-sm btn-outline-danger" style="margin-right: 5px;" onclick="deleteDocument(' + req.id + ')">🗑️ حذف</button>' +
                '</td>';
            tableBody.appendChild(tr);
        });
    }
}

function showDetails(id) {
    const req = allRequests.find(r => r.id === id);
    if (!req) return;
    document.getElementById('modalReqId').innerText = toPersianDigits(req.id);
    document.getElementById('modalDate').innerText = toPersianDigits(req.request_date);
    const itemsBody = document.getElementById('modalItemsBody');
    itemsBody.innerHTML = '';
    req.items.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td>' + toPersianDigits(index + 1) + '</td>' +
            '<td><strong>' + escapeHtml(item.item_name) + '</strong></td>' +
            '<td>' + escapeHtml(item.department_name) + '</td>' +
            '<td>' + toPersianDigits(item.quantity) + '</td>' +
            '<td><input type="number" class="form-control text-center purchased-input" style="width:80px;" data-id="' + item.id + '" max="' + item.quantity + '" min="0" value="' + item.purchased_quantity + '">' +
            '<button class="btn btn-xs btn-outline-official" onclick="markRowFullyPurchased(this, ' + item.quantity + ')">کامل</button></td>' +
            '<td>' + escapeHtml(item.item_unit) + '</td>' +
            '<td class="small">' + (escapeHtml(item.description) || '-') + '</td>';
        itemsBody.appendChild(tr);
    });
    document.getElementById('saveProgressBtn').onclick = savePurchaseProgress;
    document.getElementById('printModalBtn').onclick = function() { prepareAndPrint(req, false); };
    document.getElementById('printUnpurchasedBtn').onclick = function() { prepareAndPrint(req, true); };
    openModal('detailsModal');
}

function markRowFullyPurchased(btn, maxQty) {
    const input = btn.parentElement.querySelector('.purchased-input');
    if (input) input.value = maxQty;
}

function savePurchaseProgress() {
    const inputs = document.querySelectorAll('.purchased-input');
    const updateData = [];
    inputs.forEach(input => {
        if (input.dataset.id && input.value >= 0) {
            updateData.push({ id: input.dataset.id, purchased_quantity: input.value });
        }
    });
    if (updateData.length === 0) return;
    const fd = new FormData();
    fd.append('items', JSON.stringify(updateData));
    fetch('api.php?action=update_purchase_progress', { method: 'POST', body: fd })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showToast('success', data.message);
                closeModal('detailsModal');
                fetchRequests();
            } else {
                showToast('error', data.message);
            }
        });
}

function prepareAndPrint(req, unpurchasedOnly) {
    document.getElementById("p-req-id").innerText = toPersianDigits(req.id);
    document.getElementById("p-req-date").innerText = toPersianDigits(req.request_date);
    const pItemsBody = document.getElementById("p-items-body");
    pItemsBody.innerHTML = "";
    
    const printSubtitle = document.querySelector(".print-sub-title");
    if (unpurchasedOnly) {
        if (printSubtitle) printSubtitle.innerText = "برگه خرید کسریهای درخواست خرید";
    } else {
        if (printSubtitle) printSubtitle.innerText = "برگه درخواست خرید";
    }

    const printTableHead = document.querySelector(".print-table thead tr");
    
    if (unpurchasedOnly) {
        printTableHead.innerHTML = `
            <th class="print-col-shrink">ردیف</th>
            <th class="print-col-shrink">ش.درخواست</th>
            <th class="print-col-shrink">شرح کالا</th>
            <th class="print-col-shrink">بخش متقاضی</th>
            <th class="print-col-shrink">تعداد کسری</th>
            <th class="print-col-shrink">واحد</th>
        `;
    } else {
        printTableHead.innerHTML = `
            <th class="print-col-shrink">ردیف</th>
            <th class="print-col-shrink">شرح کالا</th>
            <th class="print-col-shrink">بخش متقاضی</th>
            <th class="print-col-shrink">تعداد</th>
            <th class="print-col-shrink">واحد</th>
            <th class="print-col-grow">توضیحات</th>
        `;
    }

    let indexCounter = 1;
    req.items.forEach(item => {
        const requested = parseInt(item.quantity);
        const purchased = parseInt(item.purchased_quantity);
        const diff = requested - purchased;
        if (unpurchasedOnly && diff <= 0) return;
        const displayQty = unpurchasedOnly ? diff : requested;
        const tr = document.createElement("tr");
        
        if (unpurchasedOnly) {
            tr.innerHTML = '<td class="print-col-shrink">' + toPersianDigits(indexCounter++) + '</td>' +
                '<td class="print-col-shrink"><strong>' + toPersianDigits(req.id) + '</strong></td>' +
                '<td class="print-col-shrink"><strong>' + escapeHtml(item.item_name) + '</strong></td>' +
                '<td class="print-col-shrink">' + escapeHtml(item.department_name) + '</td>' +
                '<td class="print-col-shrink">' + toPersianDigits(displayQty) + '</td>' +
                '<td class="print-col-shrink">' + escapeHtml(item.item_unit) + '</td>';
        } else {
            tr.innerHTML = '<td class="print-col-shrink">' + toPersianDigits(indexCounter++) + '</td>' +
                '<td class="print-col-shrink"><strong>' + escapeHtml(item.item_name) + '</strong></td>' +
                '<td class="print-col-shrink">' + escapeHtml(item.department_name) + '</td>' +
                '<td class="print-col-shrink">' + toPersianDigits(displayQty) + '</td>' +
                '<td class="print-col-shrink">' + escapeHtml(item.item_unit) + '</td>' +
                '<td class="print-col-grow">' + (escapeHtml(item.description) || "-") + '</td>';
        }
        pItemsBody.appendChild(tr);
    });
    if (pItemsBody.children.length === 0) {
        showToast("error", "هیچ قلمی برای پرینت وجود ندارد.");
        return;
    }
    triggerPrint();
}

function printAllUnpurchasedItems() {
    const unpurchasedReqIds = [];
    allRequests.forEach(req => {
        const hasUnpurchased = req.items.some(item => {
            const requested = parseInt(item.quantity);
            const purchased = parseInt(item.purchased_quantity || 0);
            return (requested - purchased) > 0;
        });
        if (hasUnpurchased) {
            unpurchasedReqIds.push(req.id);
        }
    });

    document.getElementById("p-req-id").innerText = toPersianDigits(unpurchasedReqIds.join(", "));
    document.getElementById("p-req-date").innerText = toPersianDigits(getTodayShamsi().year + "/" + getTodayShamsi().month + "/" + getTodayShamsi().day);
    
    const printSubtitle = document.querySelector(".print-sub-title");
    if (printSubtitle) printSubtitle.innerText = "برگه خرید کسریهای درخواست خرید";

    const pItemsBody = document.getElementById("p-items-body");
    pItemsBody.innerHTML = "";
    
    const printTableHead = document.querySelector(".print-table thead tr");
    printTableHead.innerHTML = `
        <th class="print-col-shrink">ردیف</th>
        <th class="print-col-shrink">ش.درخواست</th>
        <th class="print-col-shrink">شرح کالا</th>
        <th class="print-col-shrink">بخش متقاضی</th>
        <th class="print-col-shrink">تعداد کسری</th>
        <th class="print-col-shrink">واحد</th>
        <th class="print-col-grow">توضیحات</th>
    `;
    
    let indexCounter = 1;
    
    allRequests.forEach(req => {
        req.items.forEach(item => {
            const requested = parseInt(item.quantity);
            const purchased = parseInt(item.purchased_quantity || 0);
            const diff = requested - purchased;
            
            if (diff > 0) {
                const tr = document.createElement("tr");
                tr.innerHTML = '<td class="print-col-shrink">' + toPersianDigits(indexCounter++) + '</td>' +
                    '<td class="print-col-shrink"><strong>' + toPersianDigits(req.id) + '</strong></td>' +
                    '<td class="print-col-shrink"><strong>' + escapeHtml(item.item_name) + '</strong></td>' +
                    '<td class="print-col-shrink">' + escapeHtml(item.department_name) + '</td>' +
                    '<td class="print-col-shrink">' + toPersianDigits(diff) + '</td>' +
                    '<td class="print-col-shrink">' + escapeHtml(item.item_unit) + '</td>' +
                    '<td class="print-col-grow">' + (escapeHtml(item.description) || "-") + '</td>';
                pItemsBody.appendChild(tr);
            }
        });
    });
    
    if (pItemsBody.children.length === 0) {
        showToast("error", "هیچ قلم کسری در کل سیستم وجود ندارد.");
        return;
    }
    
    triggerPrint();
}

function editDocument(id) {
    const req = allRequests.find(r => r.id === id);
    if (!req) return;
    
    editingRequestId = id;
    showToast('info', 'در حال ویرایش سند شماره ' + id);
    
    const dateInput = document.getElementById('request_date');
    if (dateInput) dateInput.value = req.request_date;
    
    const container = document.getElementById('itemsTableBody');
    container.innerHTML = '';
    
    req.items.forEach(item => {
        addItemRow();
        const lastRow = container.lastElementChild;
        lastRow.setAttribute('data-db-item-id', item.id);
        
        const itemSelect = lastRow.querySelector('.item-select');
        const deptSelect = lastRow.querySelector('.dept-select');
        const qtyInput = lastRow.querySelector('.item-qty');
        const descInput = lastRow.querySelector('.item-desc');
        
        if (itemSelect) {
            itemSelect.value = item.item_id;
            itemSelect.dispatchEvent(new Event('change'));
        }
        if (deptSelect) {
            deptSelect.value = item.department_id;
            deptSelect.dispatchEvent(new Event('change'));
        }
        if (qtyInput) qtyInput.value = item.quantity;
        if (descInput) descInput.value = item.description || '';
    });
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    const submitBtn = document.querySelector('button[onclick="submitRequestForm()"]') || document.querySelector('#requestForm button[type="submit"]');
    if (submitBtn) {
        submitBtn.innerHTML = 'ثبت تغییرات سند (ویرایش)';
        submitBtn.style.backgroundColor = '#ff9800';
        
        if (!document.getElementById('cancelEditBtn')) {
            const cancelBtn = document.createElement('button');
            cancelBtn.id = 'cancelEditBtn';
            cancelBtn.type = 'button';
            cancelBtn.className = 'btn btn-secondary';
            cancelBtn.style.marginRight = '10px';
            cancelBtn.innerHTML = 'انصراف از ویرایش';
            cancelBtn.onclick = cancelEditing;
            submitBtn.parentNode.appendChild(cancelBtn);
        }
    }
}

function deleteDocument(id) {
    showConfirm("آیا از حذف کامل سند شماره " + id + " و تمام اقلام آن مطمئن هستید؟ این عملیات غیر قابل بازگشت است.", () => {
        const fd = new FormData();
        fd.append('request_id', id);
        
        fetch('api.php?action=delete_request', { method: 'POST', body: fd })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    showToast('success', data.message);
                    if (typeof cancelEditing === 'function' && editingRequestId === id) {
                        cancelEditing();
                    }
                    fetchRequests();
                } else {
                    showToast('error', data.message);
                }
            })
            .catch(error => {
                console.error('خطا:', error);
                showToast('error', 'خطا در ارتباط با سرور رخ داده است.');
            });
    });
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function openModal(id) {
    document.getElementById(id).style.display = 'block';
}

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}

function showConfirm(message, onConfirm) {
    document.getElementById('customConfirmMessage').innerText = message;
    const confirmBtn = document.getElementById('customConfirmBtn');
    
    // Clear previous event listeners by cloning the button
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    
    newConfirmBtn.addEventListener('click', () => {
        closeModal('customConfirmModal');
        onConfirm();
    });
    
    openModal('customConfirmModal');
}

function triggerPrint() {
    if (window.self !== window.top) {
        showToast("info", "توجه: به دلیل محدودیت‌های امنیتی مرورگر در حالت پیش‌نمایش، لطفاً ابتدا با کلیک روی نماد بالا سمت راست برنامه را در تب جدید (New Tab) باز کرده و سپس اقدام به چاپ نمایید.");
    }
    try {
        window.focus();
        window.print();
    } catch (e) {
        console.error("Print blocked:", e);
        showToast("error", "امکان پرینت مستقیم در پیش‌نمایش به دلیل محدودیت مرورگر وجود ندارد. لطفاً برنامه را در تب جدید باز کنید.");
    }
}

function showToast(type, message) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast-custom';
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(function() { toast.remove(); }, 3000);
}

// توابع فراخوانی پاپ‌آپ‌های مدیریت کالا و بخش‌ها از سایدبار (اضافه شده توسط پایتون)
function openManageItemsModal() {
    const body = document.getElementById("manageItemsTableBody");
    body.innerHTML = "";
    cachedItems.forEach(item => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td style="text-align: right; padding: 5px 10px;"><strong>${escapeHtml(item.name)}</strong></td>
            <td style="padding: 5px; text-align: center;">${escapeHtml(item.unit)}</td>
            <td style="padding: 5px; text-align: center; white-space: nowrap;">
                <button type="button" class="btn btn-sm btn-outline-official" onclick="editItemFromManage(${item.id})" style="padding: 2px 6px; font-size: 11px; margin-left: 3px;">ویرایش</button>
                <button type="button" class="btn btn-sm btn-outline-danger" onclick="deleteItemFromManage(${item.id})" style="padding: 2px 6px; font-size: 11px; background: none; border: 1px solid #f44336; color: #f44336; cursor: pointer; border-radius: 3px;">حذف</button>
            </td>
        `;
        body.appendChild(tr);
    });
    openModal("manageItemsModal");
}

function openManageDeptsModal() {
    const body = document.getElementById("manageDeptsTableBody");
    body.innerHTML = "";
    cachedDepts.forEach(dept => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td style="text-align: right; padding: 5px 10px;"><strong>${escapeHtml(dept.name)}</strong></td>
            <td style="padding: 5px; text-align: center; white-space: nowrap;">
                <button type="button" class="btn btn-sm btn-outline-official" onclick="editDeptFromManage(${dept.id})" style="padding: 2px 6px; font-size: 11px; margin-left: 3px;">ویرایش</button>
                <button type="button" class="btn btn-sm btn-outline-danger" onclick="deleteDeptFromManage(${dept.id})" style="padding: 2px 6px; font-size: 11px; background: none; border: 1px solid #f44336; color: #f44336; cursor: pointer; border-radius: 3px;">حذف</button>
            </td>
        `;
        body.appendChild(tr);
    });
    openModal("manageDeptsModal");
}

function editItemFromManage(id) {
    const item = cachedItems.find(i => i.id == id);
    if (!item) return;
    
    const nameInput = document.getElementById("editItemFromManageName");
    const unitInput = document.getElementById("editItemFromManageUnit");
    
    nameInput.value = item.name;
    unitInput.value = item.unit;
    
    const saveBtn = document.getElementById("editItemFromManageBtn");
    
    // Clear previous event listeners by cloning the button
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    
    newSaveBtn.addEventListener("click", () => {
        const newName = nameInput.value.trim();
        const newUnit = unitInput.value.trim();
        
        if (!newName) {
            showToast("error", "نام کالا نمی‌تواند خالی باشد.");
            return;
        }
        if (!newUnit) {
            showToast("error", "واحد اندازه‌گیری نمی‌تواند خالی باشد.");
            return;
        }
        
        const fd = new FormData();
        fd.append("id", id);
        fd.append("name", newName);
        fd.append("unit", newUnit);
        
        fetch("api.php?action=edit_item", { method: "POST", body: fd })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    showToast("success", data.message);
                    item.name = newName;
                    item.unit = newUnit;
                    updateAllItemDropdowns();
                    closeModal("editItemFromManageModal");
                    openManageItemsModal(); // بارگذاری مجدد لیست در پاپ‌آپ
                } else {
                    showToast("error", data.message);
                }
            })
            .catch(error => {
                console.error("خطا:", error);
                showToast("error", "خطا در ارتباط با سرور رخ داده است.");
            });
    });
    
    openModal("editItemFromManageModal");
}

function deleteItemFromManage(id) {
    const item = cachedItems.find(i => i.id == id);
    if (!item) return;
    
    showConfirm(`آیا از حذف کامل کالا "${item.name}" از کل سیستم مطمئن هستید؟`, () => {
        const fd = new FormData();
        fd.append("id", id);
        
        fetch("api.php?action=delete_item", { method: "POST", body: fd })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    showToast("success", data.message);
                    cachedItems = cachedItems.filter(i => i.id != id);
                    updateAllItemDropdowns();
                    openManageItemsModal(); // بارگذاری مجدد لیست در پاپ‌آپ
                } else {
                    showToast("error", data.message);
                }
            })
            .catch(error => {
                console.error("خطا:", error);
                showToast("error", "خطا در ارتباط با سرور رخ داده است.");
            });
    });
}

function editDeptFromManage(id) {
    const dept = cachedDepts.find(d => d.id == id);
    if (!dept) return;
    
    const nameInput = document.getElementById("editDeptFromManageName");
    nameInput.value = dept.name;
    
    const saveBtn = document.getElementById("editDeptFromManageBtn");
    
    // Clear previous event listeners by cloning the button
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    
    newSaveBtn.addEventListener("click", () => {
        const newName = nameInput.value.trim();
        
        if (!newName) {
            showToast("error", "نام بخش نمی‌تواند خالی باشد.");
            return;
        }
        
        const fd = new FormData();
        fd.append("id", id);
        fd.append("name", newName);
        
        fetch("api.php?action=edit_department", { method: "POST", body: fd })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    showToast("success", data.message);
                    dept.name = newName;
                    updateAllDeptDropdowns();
                    populateDeptFilter();
                    closeModal("editDeptFromManageModal");
                    openManageDeptsModal(); // بارگذاری مجدد لیست در پاپ‌آپ
                } else {
                    showToast("error", data.message);
                }
            })
            .catch(error => {
                console.error("خطا:", error);
                showToast("error", "خطا در ارتباط با سرور رخ داده است.");
            });
    });
    
    openModal("editDeptFromManageModal");
}

function deleteDeptFromManage(id) {
    const dept = cachedDepts.find(d => d.id == id);
    if (!dept) return;
    
    showConfirm(`آیا از حذف کامل بخش متقاضی "${dept.name}" از کل سیستم مطمئن هستید؟`, () => {
        const fd = new FormData();
        fd.append("id", id);
        
        fetch("api.php?action=delete_department", { method: "POST", body: fd })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    showToast("success", data.message);
                    cachedDepts = cachedDepts.filter(d => d.id != id);
                    updateAllDeptDropdowns();
                    populateDeptFilter();
                    openManageDeptsModal(); // بارگذاری مجدد لیست در پاپ‌آپ
                } else {
                    showToast("error", data.message);
                }
            })
            .catch(error => {
                console.error("خطا:", error);
                showToast("error", "خطا در ارتباط با سرور رخ داده است.");
            });
    });
}

// Expose functions globally to ensure they are fully accessible regardless of load conditions
window.submitRequestForm = submitRequestForm;
window.editDocument = editDocument;
window.deleteDocument = deleteDocument;
window.showDetails = showDetails;
window.addItemRow = addItemRow;
window.removeItemRow = removeItemRow;
window.cancelEditing = cancelEditing;
window.printAllUnpurchasedItems = printAllUnpurchasedItems;
window.openManageDeptsModal = openManageDeptsModal;
window.openManageItemsModal = openManageItemsModal;
window.editItemFromManage = editItemFromManage;
window.deleteItemFromManage = deleteItemFromManage;
window.editDeptFromManage = editDeptFromManage;
window.deleteDeptFromManage = deleteDeptFromManage;
window.checkNewItem = checkNewItem;
window.checkNewDept = checkNewDept;
window.cancelNewItem = cancelNewItem;
window.cancelNewDept = cancelNewDept;
window.saveNewItem = saveNewItem;
window.saveNewDept = saveNewDept;
window.showToast = showToast;
window.closeModal = closeModal;
window.openModal = openModal;
window.showConfirm = showConfirm;
window.triggerPrint = triggerPrint;
window.filterRequestsList = filterRequestsList;

function escapeHtml(text) {
    if (!text) return '';
    return text.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

window.activeSearchSelect = null;

function openSearchModal(select, type) {
    window.activeSearchSelect = select;
    const modalId = type === 'item' ? 'searchItemModal' : 'searchDeptModal';
    const searchInputId = type === 'item' ? 'modalSearchItemInput' : 'modalSearchDeptInput';
    
    // Open modal
    openModal(modalId);
    
    const searchInput = document.getElementById(searchInputId);
    if (searchInput) {
        searchInput.value = '';
        setTimeout(() => searchInput.focus(), 150);
    }
    
    renderModalSearchList(type);
}

function renderModalSearchList(type) {
    const select = window.activeSearchSelect;
    if (!select) return;
    
    const listId = type === 'item' ? 'modalSearchItemList' : 'modalSearchDeptList';
    const searchInputId = type === 'item' ? 'modalSearchItemInput' : 'modalSearchDeptInput';
    const listContainer = document.getElementById(listId);
    const searchInput = document.getElementById(searchInputId);
    if (!listContainer) return;
    
    listContainer.innerHTML = '';
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    
    // Filter options from original select
    const options = Array.from(select.options);
    
    options.forEach(opt => {
        // Skip default placeholders or "ADD_NEW" shortcuts in modal because we have buttons for that
        if (!opt.value) return;
        if (opt.value === 'ADD_NEW') return;
        
        const text = opt.textContent;
        if (query && !text.toLowerCase().includes(query)) return;
        
        const row = document.createElement('div');
        row.className = 'modal-search-item-row';
        if (opt.value === select.value) {
            row.classList.add('selected');
        }
        
        // Show unit if it's an item and has unit dataset
        if (type === 'item' && opt.dataset.unit) {
            row.innerHTML = `<span style="font-weight: bold;">${escapeHtml(text)}</span><span class="text-muted small" style="background: var(--sidebar-hover); color: var(--text-muted); padding: 2px 8px; border-radius: 4px; font-size: 11px;">${escapeHtml(opt.dataset.unit)}</span>`;
        } else {
            row.innerHTML = `<span style="font-weight: bold;">${escapeHtml(text)}</span>`;
        }
        
        row.addEventListener('click', () => {
            select.value = opt.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            
            // Sync searchable display
            if (select.syncSearchable) select.syncSearchable();
            
            closeModal(type === 'item' ? 'searchItemModal' : 'searchDeptModal');
        });
        
        listContainer.appendChild(row);
    });
    
    if (listContainer.children.length === 0) {
        const noResult = document.createElement('div');
        noResult.style.padding = '15px';
        noResult.style.textAlign = 'center';
        noResult.style.color = '#64748b';
        noResult.style.fontSize = '14px';
        noResult.textContent = 'موردی یافت نشد';
        listContainer.appendChild(noResult);
    }
}

function setupModalSearchEvents() {
    ['modalSearchItemInput', 'modalSearchDeptInput'].forEach(id => {
        const input = document.getElementById(id);
        if (!input) return;
        
        input.addEventListener('input', () => {
            const type = id === 'modalSearchItemInput' ? 'item' : 'dept';
            renderModalSearchList(type);
        });
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const type = id === 'modalSearchItemInput' ? 'item' : 'dept';
                const listId = type === 'item' ? 'modalSearchItemList' : 'modalSearchDeptList';
                const listContainer = document.getElementById(listId);
                if (listContainer) {
                    const firstRow = listContainer.querySelector('.modal-search-item-row');
                    if (firstRow) {
                        firstRow.click();
                    }
                }
            }
        });
    });
}

function makeModalSearchable(select, type, placeholder) {
    if (!select) return;
    if (select.syncSearchable) {
        select.syncSearchable();
        return;
    }

    // Hide original select
    select.style.setProperty('display', 'none', 'important');
    select.classList.add('d-none');

    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'searchable-select-wrapper';
    
    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);

    // Create display button styled like a form control field
    const btn = document.createElement('div');
    btn.className = 'searchable-select-btn';
    btn.style.cursor = 'pointer';
    btn.style.width = '100%';
    btn.style.height = '38px';
    btn.style.padding = '6px 15px';
    btn.style.fontSize = '14px';
    btn.style.border = '1.5px solid var(--border)';
    btn.style.borderRadius = '6px';
    btn.style.backgroundColor = 'var(--bg-body)';
    btn.style.display = 'flex';
    btn.style.justifyContent = 'space-between';
    btn.style.alignItems = 'center';
    btn.style.fontFamily = "'BNazanin', sans-serif";
    btn.style.fontWeight = 'bold';
    btn.style.boxSizing = 'border-box';
    btn.style.color = 'var(--text-main)';
    btn.style.transition = 'border-color 0.2s, box-shadow 0.2s';
    
    wrapper.appendChild(btn);

    function syncValue() {
        const selectedOpt = select.options[select.selectedIndex];
        if (selectedOpt && selectedOpt.value && selectedOpt.value !== 'ADD_NEW') {
            btn.innerHTML = `<span style="flex-grow: 1; text-align: center; color: var(--text-main);">${escapeHtml(selectedOpt.textContent)}</span>`;
        } else {
            btn.innerHTML = `<span style="flex-grow: 1; text-align: center; color: var(--text-muted); font-weight: normal;">${escapeHtml(placeholder)}</span>`;
        }
    }

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openSearchModal(select, type);
    });

    select.addEventListener('change', () => {
        syncValue();
    });

    select.syncSearchable = () => {
        syncValue();
    };

    syncValue();
}

function makeSearchable(select, placeholder = "انتخاب کنید...") {
    if (!select) return;

    // Check if it's the main request form inputs
    const isItem = select.classList.contains('item-select');
    const isDept = select.classList.contains('dept-select');
    
    if (isItem || isDept) {
        makeModalSearchable(select, isItem ? 'item' : 'dept', placeholder);
        return;
    }

    if (select.syncSearchable) {
        select.syncSearchable();
        return;
    }

    // Hide original select
    select.style.setProperty('display', 'none', 'important');
    select.classList.add('d-none');

    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'searchable-select-wrapper';
    
    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);

    // Create display button
    const btn = document.createElement('div');
    btn.className = 'searchable-select-btn';
    btn.textContent = placeholder;
    wrapper.appendChild(btn);

    // Create menu
    const menu = document.createElement('div');
    menu.className = 'searchable-select-menu d-none';
    
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'searchable-select-search';
    searchInput.placeholder = 'جستجو کنید...';
    menu.appendChild(searchInput);

    const optionsList = document.createElement('div');
    optionsList.className = 'searchable-select-options';
    menu.appendChild(optionsList);

    wrapper.appendChild(menu);

    function renderOptions() {
        optionsList.innerHTML = '';
        const searchVal = searchInput.value.toLowerCase().trim();
        
        Array.from(select.options).forEach(opt => {
            if (searchVal && !opt.textContent.toLowerCase().includes(searchVal)) {
                return;
            }
            const div = document.createElement('div');
            div.className = 'searchable-select-option';
            if (opt.value === select.value) {
                div.className += ' selected';
            }
            div.textContent = opt.textContent;
            div.addEventListener('click', (e) => {
                e.stopPropagation();
                select.value = opt.value;
                select.dispatchEvent(new Event('change', { bubbles: true }));
                closeMenu();
            });
            optionsList.appendChild(div);
        });
    }

    function syncValue() {
        const selectedOpt = select.options[select.selectedIndex];
        btn.textContent = selectedOpt ? selectedOpt.textContent : placeholder;
    }

    function openMenu() {
        document.querySelectorAll('.searchable-select-menu').forEach(m => {
            if (m !== menu) m.classList.add('d-none');
        });
        
        menu.classList.remove('d-none');
        searchInput.value = '';
        renderOptions();
        searchInput.focus();
    }

    function closeMenu() {
        menu.classList.add('d-none');
    }

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (menu.classList.contains('d-none')) {
            openMenu();
        } else {
            closeMenu();
        }
    });

    searchInput.addEventListener('input', () => {
        renderOptions();
    });

    document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target)) {
            closeMenu();
        }
    });

    select.addEventListener('change', () => {
        syncValue();
    });

    select.syncSearchable = () => {
        syncValue();
        renderOptions();
    };

    syncValue();
}

function saveNewItemFromManage() {
    const nameInput = document.getElementById('manage_new_item_name');
    const unitInput = document.getElementById('manage_new_item_unit');
    if (!nameInput || !unitInput) return;
    const name = nameInput.value.trim();
    const unit = unitInput.value.trim();
    if (!name || !unit) {
        showToast('error', 'نام و واحد کالا الزامی است.');
        return;
    }
    const fd = new FormData();
    fd.append('name', name);
    fd.append('unit', unit);
    fetch('api.php?action=create_item', { method: 'POST', body: fd })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showToast('success', 'کالا جدید ثبت شد.');
                nameInput.value = '';
                unitInput.value = 'عدد';
                fetchItems().then(() => {
                    // Auto-select the newly created item in the active row/select
                    if (window.activeSearchSelect && window.activeSearchSelect.classList.contains('item-select')) {
                        window.activeSearchSelect.value = data.id;
                        window.activeSearchSelect.dispatchEvent(new Event('change', { bubbles: true }));
                        if (window.activeSearchSelect.syncSearchable) {
                            window.activeSearchSelect.syncSearchable();
                        }
                    }
                    openManageItemsModal(); // Refresh the list inside the modal
                });
            } else {
                showToast('error', data.message || 'خطا در ثبت کالا');
            }
        })
        .catch(() => showToast('error', 'خطا در ارتباط با سرور'));
}

function saveNewDeptFromManage() {
    const nameInput = document.getElementById('manage_new_dept_name');
    if (!nameInput) return;
    const name = nameInput.value.trim();
    if (!name) {
        showToast('error', 'نام بخش الزامی است.');
        return;
    }
    const fd = new FormData();
    fd.append('name', name);
    fetch('api.php?action=create_department', { method: 'POST', body: fd })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showToast('success', 'بخش جدید ثبت شد.');
                nameInput.value = '';
                fetchDepartments().then(() => {
                    // Auto-select the newly created department in the active row/select
                    if (window.activeSearchSelect && window.activeSearchSelect.classList.contains('dept-select')) {
                        window.activeSearchSelect.value = data.id;
                        window.activeSearchSelect.dispatchEvent(new Event('change', { bubbles: true }));
                        if (window.activeSearchSelect.syncSearchable) {
                            window.activeSearchSelect.syncSearchable();
                        }
                    }
                    openManageDeptsModal(); // Refresh the list inside the modal
                });
            } else {
                showToast('error', data.message || 'خطا در ثبت بخش');
            }
        })
        .catch(() => showToast('error', 'خطا در ارتباط با سرور'));
}

window.makeSearchable = makeSearchable;
window.saveNewItemFromManage = saveNewItemFromManage;
window.saveNewDeptFromManage = saveNewDeptFromManage;
window.setupModalSearchEvents = setupModalSearchEvents;
window.openSearchModal = openSearchModal;
window.renderModalSearchList = renderModalSearchList;


