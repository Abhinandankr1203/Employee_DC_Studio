// ===== DC SALARY TRACKER MODULE =====
const DCSalary = (function () {
    'use strict';

    let els = {};
    let toastTimer = null;

    function isAdminUser() { return localStorage.getItem('dc_role') === 'admin'; }

    // ---- Init / Destroy ----
    async function init() {
        cacheElements();
        bindEvents();
        // Always sync role from server before rendering admin UI
        await syncRole();
        applyAdminLayout();
        // Admin defaults to reimbursement tab; employees default to payslips
        switchTab(isAdminUser() ? 'reimbursement' : 'payslips');
        loadPayslips();
        loadProjectSuggestions();
        loadReimbursements();
    }

    async function syncRole() {
        try {
            const data = await apiFetch('/api/auth/me');
            if (data && data.role) {
                localStorage.setItem('dc_role', data.role);
            }
        } catch (_) {}
    }

    function applyAdminLayout() {
        // Always reset first so switching accounts in the same session works
        var submitSection = els.reimbForm ? els.reimbForm.closest('.sal-section') : null;
        if (submitSection) {
            var formTitle = submitSection.querySelector('.sal-section-title span:first-child');
            if (formTitle) formTitle.innerHTML = '<i class="fas fa-plus-circle"></i> Submit New Reimbursement Request';
        }
        if (els.forEmployeeWrap) els.forEmployeeWrap.style.display = 'none';
        if (els.forEmployee) els.forEmployee.required = false;
        // All users (including admin) see and submit their own reimbursements
    }

    async function loadEmployeeOptions() {
        if (!els.forEmployee) return;
        const data = await apiFetch('/api/users');
        const users = (data && data.users) ? data.users : [];
        if (!users.length) return;
        els.forEmployee.innerHTML = '<option value="" disabled selected>Select employee...</option>' +
            users.map(u => `<option value="${escHtml(u.id)}" data-name="${escHtml(u.name)}">${escHtml(u.name)}</option>`).join('');
    }

    function destroy() {}

    function cacheElements() {
        els = {
            tabs:              document.querySelectorAll('.sal-tab'),
            payslipsPane:      document.getElementById('salPayslipsPane'),
            reimbPane:         document.getElementById('salReimbPane'),
            payslipsBody:      document.getElementById('salPayslipsBody'),
            payslipsEmpty:     document.getElementById('salPayslipsEmpty'),
            reimbForm:         document.getElementById('salReimbForm'),
            billsList:         document.getElementById('salBillsList'),
            projectList:       document.getElementById('salProjectList'),
            reimbBody:         document.getElementById('salReimbBody'),
            reimbEmpty:        document.getElementById('salReimbEmpty'),
            toast:             document.getElementById('salToast'),
            forEmployeeWrap:   document.getElementById('salForEmployeeWrap'),
            forEmployee:       document.getElementById('salForEmployee'),
        };
    }

    function bindEvents() {
        els.tabs.forEach(tab => {
            tab.addEventListener('click', () => switchTab(tab.dataset.tab));
        });
        if (els.reimbForm) {
            els.reimbForm.addEventListener('submit', handleSubmitClaim);
        }
        const addBillBtn = document.getElementById('salAddBillBtn');
        if (addBillBtn) addBillBtn.addEventListener('click', addBillRow);
    }

    function switchTab(tabName) {
        els.tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
        if (els.payslipsPane) els.payslipsPane.classList.toggle('active', tabName === 'payslips');
        if (els.reimbPane)    els.reimbPane.classList.toggle('active',    tabName === 'reimbursement');
    }

    // ---- API helper ----
    async function apiFetch(path, opts) {
        try {
            const token = localStorage.getItem('dc_token');
            const headers = Object.assign({ 'Authorization': token ? 'Bearer ' + token : '' }, (opts && opts.headers) || {});
            const res = await fetch(path, Object.assign({}, opts, { headers }));
            if (res.status === 401) { window.location.reload(); return null; }
            return await res.json();
        } catch (_) { return null; }
    }

    // ==================== PAYSLIPS ====================

    async function loadPayslips() {
        const data = await apiFetch('/api/salary/payslips');
        renderPayslips(data && data.payslips ? data.payslips : []);
    }

    function renderPayslips(payslips) {
        if (!els.payslipsBody) return;
        if (!payslips.length) {
            els.payslipsBody.innerHTML = '';
            if (els.payslipsEmpty) els.payslipsEmpty.style.display = 'block';
            return;
        }
        if (els.payslipsEmpty) els.payslipsEmpty.style.display = 'none';
        els.payslipsBody.innerHTML = payslips.map(p => `
            <tr>
                <td data-label="Period"><strong>${escHtml(p.period)}</strong></td>
                <td data-label="Gross" class="sal-gross">${formatCurrency(p.gross_salary)}</td>
                <td data-label="Deductions" class="sal-deductions">${formatCurrency(p.total_deductions)}</td>
                <td data-label="Net Pay" class="sal-net-pay">${formatCurrency(p.net_pay)}</td>
                <td data-label="Status"><span class="sal-status sal-status-${p.status}">${capitalize(p.status)}</span></td>
                <td data-label="">
                    <button class="sal-action-btn" title="Download PDF" onclick="DCSalary.downloadPayslip(${p.id})">
                        <i class="fas fa-download"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    async function loadLogoDataURL() {
        try {
            const res = await fetch('/DC%20Studio%20Logo%20new%20end.png');
            const blob = await res.blob();
            return await new Promise(function(resolve) {
                var reader = new FileReader();
                reader.onload = function(e) { resolve(e.target.result); };
                reader.readAsDataURL(blob);
            });
        } catch (e) { return null; }
    }

    async function downloadPayslip(id) {
        const [data, logoDataURL] = await Promise.all([
            apiFetch(`/api/salary/payslips/${id}`),
            loadLogoDataURL()
        ]);
        if (!data || !data.payslip) {
            showToast('Could not load payslip data.', 'error');
            return;
        }
        generatePayslipPDF(data.payslip, data.leave_stats || {}, data.employee_profile || {}, logoDataURL);
    }

    function generatePayslipPDF(p, ls, ep, logoDataURL) {
        if (!window.jspdf) { showToast('PDF library not loaded.', 'error'); return; }
        var { jsPDF } = window.jspdf;
        var doc = new jsPDF({ unit: 'mm', format: 'a4' });
        var W = 210, pad = 12;
        var DK  = [30, 30, 30];
        var GY  = [110,110,110];
        var LG  = [190,190,190];
        var WH  = [255,255,255];
        var TBG = [245,245,245];
        var OG  = [235,120,70];
        var RED = [200, 30, 30];

        // ── Primitives ──────────────────────────────────────────────────────
        function txt(s, x, y, sz, clr, style, opts) {
            doc.setFont('helvetica', style || 'normal');
            doc.setFontSize(sz);
            doc.setTextColor(clr[0], clr[1], clr[2]);
            doc.text(String(s == null ? '' : s), x, y, opts || {});
        }
        function txtR(s, x, y, sz, clr, st) { txt(s, x, y, sz, clr, st, { align: 'right' }); }
        function txtC(s, x, y, sz, clr, st) { txt(s, x, y, sz, clr, st, { align: 'center' }); }
        function fill(x, y, w, h, clr) {
            doc.setFillColor(clr[0], clr[1], clr[2]);
            doc.rect(x, y, w, h, 'F');
        }
        function brect(x, y, w, h, fillClr) {
            if (fillClr) fill(x, y, w, h, fillClr);
            doc.setDrawColor(LG[0], LG[1], LG[2]);
            doc.setLineWidth(0.25);
            doc.rect(x, y, w, h, 'S');
        }
        function vl(x, y1, y2) {
            doc.setDrawColor(LG[0], LG[1], LG[2]);
            doc.setLineWidth(0.25);
            doc.line(x, y1, x, y2);
        }
        function hl(x1, x2, y) {
            doc.setDrawColor(LG[0], LG[1], LG[2]);
            doc.setLineWidth(0.25);
            doc.line(x1, y, x2, y);
        }
        function fc(v) { return (Number(v || 0)).toFixed(2); }
        function fd(d) {
            if (!d) return '';
            var s = d.split('-');
            return s.length === 3 ? s[2] + '-' + s[1] + '-' + s[0] : d;
        }

        var iw = W - pad * 2;   // inner width = 186mm
        var x0 = pad;
        var y  = pad;

        // ════════════════════════════════════════════════════════════════════
        // HEADER BOX: logo left | Payslip right
        // ════════════════════════════════════════════════════════════════════
        var hH = 45;
        brect(x0, y, iw, hH, WH);                          // outer border
        vl(x0 + iw / 2, y, y + hH);                        // centre divider

        // Left half — DC Studio logo image + address
        var logoX = x0 + 3, logoY = y + 4, logoW = 44, logoH = 24.75; // 44 / (16/9)

        if (logoDataURL) {
            try { doc.addImage(logoDataURL, 'PNG', logoX, logoY, logoW, logoH); } catch(e) { logoDataURL = null; }
        }
        if (!logoDataURL) {
            // Fallback text logo
            fill(x0 + 3, y + 5, 14, 14, OG);
            txt('DC', x0 + 5.5, y + 14.5, 10, WH, 'bold');
            txt('STUDIO', x0 + 19, y + 13, 13, DK, 'bold');
        }
        // Line 1: Moved up to -18
        txt('SRC- 45B, Shipra Riviera,', x0 + 3, y + hH - 18, 7, GY, 'normal');

// Line 2: Stays at -12
        txt('Gyan Khand-3, Indirapuram,', x0 + 3, y + hH - 12, 7, GY, 'normal');

// Line 3: Stays at -6
        txt('Ghaziabad Uttar Pradesh 201014', x0 + 3, y + hH - 6, 7, GY, 'normal');

        // Right half — Payslip title + period
        var rx = x0 + iw - 3;
        txtR('Payslip', rx, y + 17, 22, DK, 'bold');
        txtR(p.period || '', rx, y + 27, 10, OG, 'normal');

        y += hH;

        // ════════════════════════════════════════════════════════════════════
        // EMPLOYEE INFO TABLE
        // ════════════════════════════════════════════════════════════════════
        var rH  = 9;
        var lb  = ls.leave_balance_by_type || {};
        var eName = ep.name || localStorage.getItem('dc_name') || '';
        var L   = iw * 0.20;   // label column width
        var V   = iw * 0.30;   // value column width  (L+V = 50% = half)

        function eRow(lbl1, val1, lbl2, val2) {
            brect(x0,       y, L, rH, TBG); txt(lbl1, x0+2,     y+6.5, 7.5, GY,  'bold');
            brect(x0+L,     y, V, rH, WH);  txt(val1, x0+L+2,   y+6.5, 8,   DK,  'normal');
            brect(x0+L+V,   y, L, rH, TBG); txt(lbl2, x0+L+V+2, y+6.5, 7.5, GY,  'bold');
            brect(x0+L+V+L, y, V, rH, WH);  txt(val2, x0+L+V+L+2,y+6.5,8,   DK,  'normal');
            y += rH;
        }

        eRow('Emp ID',          ep.userId || '',        'DOJ',                  fd(ep.dateOfJoining));
        eRow('Emp Name',        eName,                  'PAN',                  ep.pan || '');
        eRow('Designation',     ep.designation || '',   'Department',           ep.department || '');
        eRow('Days this month', String(ls.days_in_month || 0), 'No. of Working Days', String(ls.working_days || 0));
        eRow('Present',         String(ls.present || 0),'LOP',                  String(ls.lop || 0));
        eRow('LWP',             String(ls.lwp || 0),    'Leave Balance',        String(ls.leave_balance || 0));

        // Leavenly Token row (label | spans remaining width)
        var clVal = lb.CL != null ? lb.CL : 0;
        var plVal = lb.PL != null ? lb.PL : 0;
        var slVal = lb.SL != null ? lb.SL : 0;
        var tokenStr = 'CL: ' + clVal + '     PL: ' + plVal + '     SL: ' + slVal;
        brect(x0,   y, L,      rH, TBG); txt('Leave Balance', x0+2,   y+6.5, 7.5, GY, 'bold');
        brect(x0+L, y, iw - L, rH, WH);  txt(tokenStr,        x0+L+2, y+6.5, 8,   DK, 'normal');
        y += rH;

        y += 4; // gap before earnings

        // ════════════════════════════════════════════════════════════════════
        // EARNINGS + DEDUCTIONS (side-by-side, matching reference layout)
        // ════════════════════════════════════════════════════════════════════
        var hW   = iw / 2;      // half-width for each section
        var aW   = 30;          // amount column width
        var pW   = hW - aW;     // particulars column width

        // Section headers
        var sHH = 8;
        brect(x0,      y, hW, sHH, TBG); txtC('Earnings',   x0 + hW/2,      y + 5.5, 9, DK, 'bold');
        brect(x0 + hW, y, hW, sHH, TBG); txtC('Deductions', x0 + hW + hW/2, y + 5.5, 9, DK, 'bold');
        vl(x0 + hW, y, y + sHH);
        y += sHH;

        // Sub-headers: Particulars | Amount
        var subHH = 7;
        brect(x0,          y, pW,  subHH, TBG); txt('Particulars',  x0 + 2,      y + 5, 7.5, GY, 'bold');
        brect(x0 + pW,     y, aW,  subHH, TBG); txtR('Amount',      x0 + hW - 2, y + 5, 7.5, GY, 'bold');
        brect(x0 + hW,     y, pW,  subHH, TBG); txt('Particulars',  x0 + hW + 2, y + 5, 7.5, GY, 'bold');
        brect(x0 + hW + pW,y, aW,  subHH, TBG); txtR('Amount',      x0 + iw - 2, y + 5, 7.5, GY, 'bold');
        vl(x0 + hW, y, y + subHH);
        y += subHH;

        // Earn / Deduct rows
        var earnRows = [
            ['Consolidated Salary', p.gross_salary],
            ['Incentive',           0]
        ];
        var dedRows = [];
        if (p.pf)               dedRows.push(['Provident Fund (PF)',  p.pf]);
        if (p.tds)              dedRows.push(['TDS',                   p.tds]);
        if (p.professional_tax) dedRows.push(['Professional Tax',      p.professional_tax]);

        var dRH = 8;
        var maxR = Math.max(earnRows.length, dedRows.length);
        for (var i = 0; i < maxR; i++) {
            var er = earnRows[i] || [];
            var dr = dedRows[i]  || [];
            brect(x0,           y, pW, dRH, WH);
            if (er[0]) txt(er[0], x0 + 2,       y + 5.5, 8, DK, 'normal');
            brect(x0 + pW,      y, aW, dRH, WH);
            if (er[1] != null)  txtR(fc(er[1]), x0 + hW - 2, y + 5.5, 8, DK, 'normal');
            brect(x0 + hW,      y, pW, dRH, WH);
            if (dr[0]) txt(dr[0], x0 + hW + 2,  y + 5.5, 8, DK, 'normal');
            brect(x0 + hW + pW, y, aW, dRH, WH);
            if (dr[1] != null)  txtR(fc(dr[1]), x0 + iw - 2, y + 5.5, 8, DK, 'normal');
            vl(x0 + hW, y, y + dRH);
            y += dRH;
        }

        // Totals row
        var totH = 9;
        brect(x0,           y, pW,  totH, TBG); txt('Total Earnings',     x0 + 2,       y + 6.5, 8.5, DK,  'bold');
        brect(x0 + pW,      y, aW,  totH, TBG); txtR(fc(p.gross_salary),  x0 + hW - 2,  y + 6.5, 8.5, OG,  'bold');
        brect(x0 + hW,      y, pW,  totH, TBG); txt('Total Deductions',   x0 + hW + 2,  y + 6.5, 8.5, DK,  'bold');
        brect(x0 + hW + pW, y, aW,  totH, TBG); txtR(fc(p.total_deductions), x0+iw-2,   y + 6.5, 8.5, RED, 'bold');
        vl(x0 + hW, y, y + totH);
        y += totH;

        // Net Pay row
        var npH = 11;
        fill(x0, y, iw, npH, DK);
        brect(x0, y, iw, npH);
        txt('Net Pay', x0 + 4, y + 7.5, 10, WH, 'bold');
        txtR(fc(p.net_pay), x0 + iw - 4, y + 7.5, 11, OG, 'bold');
        y += npH;

        // ════════════════════════════════════════════════════════════════════
        // FOOTER
        // ════════════════════════════════════════════════════════════════════
        y += 10;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(130, 130, 130);
        doc.text(
            'This is a computer generated document from DC Studio \u00A9 ' + new Date().getFullYear(),
            W / 2, y, { align: 'center' }
        );

        doc.save('Payslip_' + (p.period || 'slip').replace(/\s+/g, '_') + '.pdf');
        showToast('Payslip downloaded!', 'success');
    }

    // ==================== REIMBURSEMENTS ====================

    async function loadProjectSuggestions() {
        const data = await apiFetch('/api/tasks');
        if (!data || !data.tasks || !els.projectList) return;
        // Unique project-like names from task titles + assignees
        const options = data.tasks.map(t => `<option value="${escHtml(t.title)}">`);
        els.projectList.innerHTML = options.join('');
    }

    async function loadReimbursements() {
        const data = await apiFetch('/api/reimbursements');
        renderReimbursements(data && data.claims ? data.claims : []);
    }

    function renderReimbursements(claims) {
        if (!els.reimbBody) return;
        if (!claims.length) {
            els.reimbBody.innerHTML = '';
            if (els.reimbEmpty) els.reimbEmpty.style.display = 'block';
            return;
        }
        if (els.reimbEmpty) els.reimbEmpty.style.display = 'none';

        // Group by month of expense_date
        const groups = {};
        const groupOrder = [];
        claims.forEach(c => {
            const d = c.expense_date ? new Date(c.expense_date + 'T00:00:00') : new Date();
            const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
            const label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
            if (!groups[key]) { groups[key] = { label, items: [] }; groupOrder.push(key); }
            groups[key].items.push(c);
        });

        const nowKey = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0');

        let html = '';
        groupOrder.forEach(key => {
            const g = groups[key];
            const isExpanded = key === nowKey || groupOrder.length === 1;
            const chevId = 'sal-chev-' + key;
            const hidden = isExpanded ? '' : ' sal-row-hidden';
            html += `
            <tr class="sal-month-header-row" onclick="DCSalary._toggleMonth('${key}','${chevId}')">
                <td colspan="8">
                    <span class="sal-month-chevron" id="${chevId}" style="transform:rotate(${isExpanded ? 90 : 0}deg)">&#9654;</span>
                    <strong>${escHtml(g.label)}</strong>
                    <span class="sal-month-count">${g.items.length} claim${g.items.length !== 1 ? 's' : ''}</span>
                </td>
            </tr>`;
            g.items.forEach(c => {
                const actionCell = c.status === 'pending'
                    ? `<button class="sal-action-btn sal-delete-btn" title="Cancel Claim" onclick="event.stopPropagation();DCSalary.cancelClaim(${c.id})"><i class="fas fa-times"></i></button>`
                    : '—';
                html += `
                <tr class="sal-month-item${hidden}" data-group="${key}">
                    <td data-label="Date">${formatDate(c.expense_date)}</td>
                    <td data-label="Category"><span class="sal-category-badge sal-cat-${(c.category || 'others').toLowerCase()}">${escHtml(c.category || '—')}</span></td>
                    <td data-label="Project">${escHtml(c.project || '—')}</td>
                    <td data-label="Amount"><strong>${formatCurrency(c.amount)}</strong></td>
                    <td data-label="Description">${escHtml(c.description || '—')}</td>
                    <td data-label="Status"><span class="sal-status sal-status-${c.status}">${capitalize(c.status)}</span></td>
                    <td data-label="Comments">${escHtml(c.approver_comments || '—')}</td>
                    <td data-label="">${actionCell}</td>
                </tr>`;
            });
        });
        els.reimbBody.innerHTML = html;
    }

    function _toggleMonth(key, chevId) {
        const chev = document.getElementById(chevId);
        const rows = els.reimbBody ? els.reimbBody.querySelectorAll('tr[data-group="' + key + '"]') : [];
        const isHidden = rows.length > 0 && rows[0].classList.contains('sal-row-hidden');
        rows.forEach(function(r) { r.classList.toggle('sal-row-hidden', !isHidden); });
        if (chev) chev.style.transform = 'rotate(' + (isHidden ? 90 : 0) + 'deg)';
    }

    function addBillRow() {
        const list = document.getElementById('salBillsList');
        if (!list) return;
        const rows = list.querySelectorAll('.sal-bill-row');
        const newIndex = rows.length;

        const div = document.createElement('div');
        div.className = 'sal-bill-row';
        div.dataset.index = newIndex;
        div.innerHTML = `
            <div class="sal-bill-row-header">
                <span class="sal-bill-row-num"><i class="fas fa-receipt"></i> Bill #${newIndex + 1}</span>
                <button type="button" class="sal-bill-remove-btn" onclick="DCSalary.removeBillRow(this)" title="Remove">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="sal-form-row">
                <div class="sal-form-group">
                    <label>Date of Expense *</label>
                    <input type="date" name="expense_date" required>
                </div>
                <div class="sal-form-group">
                    <label>Amount Claimed *</label>
                    <input type="number" name="amount" placeholder="e.g., 150.50" min="0" step="0.01" required>
                </div>
                <div class="sal-form-group">
                    <label>Category *</label>
                    <select name="category" required>
                        <option value="" disabled selected>Select category...</option>
                        <option value="Food">Food</option>
                        <option value="Stay">Stay</option>
                        <option value="Travel">Travel</option>
                        <option value="Others">Others</option>
                    </select>
                </div>
                <div class="sal-form-group">
                    <label>Project (Optional)</label>
                    <input type="text" name="project" placeholder="Type or select a project..." list="salProjectList" autocomplete="off">
                </div>
            </div>
            <div class="sal-form-group">
                <label>Description / Reason *</label>
                <textarea name="description" placeholder="Describe the expense and purpose..." required></textarea>
            </div>
            <div class="sal-form-group">
                <label>Upload Bill (JPG, PNG, PDF)</label>
                <div class="sal-file-wrap">
                    <i class="fas fa-paperclip"></i>
                    <input type="file" name="bill_file" accept=".jpg,.jpeg,.png,.pdf">
                </div>
            </div>`;
        list.appendChild(div);
        updateRemoveButtons();
        div.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function removeBillRow(btn) {
        const row = btn.closest('.sal-bill-row');
        if (!row) return;
        row.remove();
        // Re-number remaining rows
        const list = document.getElementById('salBillsList');
        if (!list) return;
        list.querySelectorAll('.sal-bill-row').forEach((r, i) => {
            const label = r.querySelector('.sal-bill-row-num');
            if (label) label.innerHTML = `<i class="fas fa-receipt"></i> Bill #${i + 1}`;
            r.dataset.index = i;
        });
        updateRemoveButtons();
    }

    function updateRemoveButtons() {
        const list = document.getElementById('salBillsList');
        if (!list) return;
        const rows = list.querySelectorAll('.sal-bill-row');
        rows.forEach(r => {
            const btn = r.querySelector('.sal-bill-remove-btn');
            if (btn) btn.style.display = rows.length > 1 ? '' : 'none';
        });
        // Update submit button label
        const submitBtn = document.getElementById('salReimbSubmitBtn');
        if (submitBtn) {
            submitBtn.innerHTML = rows.length > 1
                ? `<i class="fas fa-paper-plane"></i> Submit All ${rows.length} Claims`
                : '<i class="fas fa-paper-plane"></i> Submit Claim';
        }
    }

    async function handleSubmitClaim(e) {
        e.preventDefault();
        const list = document.getElementById('salBillsList');
        if (!list) return;
        const rows = list.querySelectorAll('.sal-bill-row');

        // Collect all bill data
        const bills = [];
        let valid = true;
        rows.forEach(row => {
            const expenseDate = row.querySelector('[name="expense_date"]').value;
            const amount      = parseFloat(row.querySelector('[name="amount"]').value);
            const category    = row.querySelector('[name="category"]').value;
            const project     = row.querySelector('[name="project"]').value.trim();
            const description = row.querySelector('[name="description"]').value.trim();
            const fileInput   = row.querySelector('[name="bill_file"]');
            const fileObj     = fileInput && fileInput.files[0] ? fileInput.files[0] : null;
            const fileName    = fileObj ? fileObj.name : null;
            if (!expenseDate || !amount || !category || !description) { valid = false; }
            bills.push({ expense_date: expenseDate, amount, category, project, description, file_name: fileName, _fileObj: fileObj });
        });

        if (!valid) {
            showToast('Please fill in all required fields in every bill.', 'error');
            return;
        }

        // Read files as base64
        for (const bill of bills) {
            if (bill._fileObj) {
                bill.file_data = await new Promise(resolve => {
                    const reader = new FileReader();
                    reader.onload = e => resolve(e.target.result);
                    reader.onerror = () => resolve(null);
                    reader.readAsDataURL(bill._fileObj);
                });
            }
            delete bill._fileObj;
        }

        const btn = document.getElementById('salReimbSubmitBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

        // Admin: attach for_user_id + employee_name to each bill
        if (isAdminUser() && els.forEmployee && els.forEmployee.value) {
            const selOpt = els.forEmployee.options[els.forEmployee.selectedIndex];
            const empName = selOpt ? selOpt.dataset.name || selOpt.text : '';
            bills.forEach(b => {
                b.for_user_id = parseInt(els.forEmployee.value);
                b.employee_name = empName;
            });
        }

        let successCount = 0;
        let failCount = 0;
        for (const bill of bills) {
            const data = await apiFetch('/api/reimbursements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bill)
            });
            if (data && data.success) successCount++;
            else failCount++;
        }

        btn.disabled = false;
        updateRemoveButtons();

        if (failCount === 0) {
            showToast(bills.length > 1 ? `${bills.length} claims submitted successfully!` : 'Reimbursement claim submitted!', 'success');
            els.reimbForm.reset();
            // Remove extra rows, keep only first
            list.querySelectorAll('.sal-bill-row:not(:first-child)').forEach(r => r.remove());
            updateRemoveButtons();
            loadReimbursements();
        } else if (successCount > 0) {
            showToast(`${successCount} submitted, ${failCount} failed.`, 'error');
            loadReimbursements();
        } else {
            showToast('Failed to submit. Please try again.', 'error');
        }
    }

    // ---- Admin: Approve / Reject reimbursement ----
    function approveReimb(id) {
        openApprovalModal({
            title: 'Approve Reimbursement',
            msg: 'Approve this reimbursement claim? The amount will be processed for payment.',
            action: 'approve',
            commentLabel: 'Approval Comments (optional)',
            onConfirm: function (comments) {
                closeApprovalModal();
                doReimbAction(id, 'approved', comments);
            }
        });
    }

    function rejectReimb(id) {
        openApprovalModal({
            title: 'Reject Reimbursement',
            msg: 'Reject this reimbursement claim? Please provide a reason.',
            action: 'reject',
            commentLabel: 'Rejection Reason (optional)',
            onConfirm: function (comments) {
                closeApprovalModal();
                doReimbAction(id, 'rejected', comments);
            }
        });
    }

    async function doReimbAction(id, status, comments) {
        const data = await apiFetch(`/api/reimbursements/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status, approver_comments: comments })
        });
        if (data && data.success) {
            showToast(status === 'approved' ? 'Reimbursement approved!' : 'Reimbursement rejected.', 'success');
            loadReimbursements();
        } else {
            showToast((data && data.error) || 'Action failed. Please try again.', 'error');
        }
    }

    async function cancelClaim(id) {
        if (!confirm('Cancel this reimbursement claim?')) return;
        const data = await apiFetch(`/api/reimbursements/${id}`, { method: 'DELETE' });
        if (data && data.success) {
            showToast('Claim cancelled.', 'success');
            loadReimbursements();
        } else {
            showToast('Failed to cancel. Please try again.', 'error');
        }
    }

    // ---- Utilities ----
    function escHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        const [y, m, d] = dateStr.split('-');
        return `${d}/${m}/${y}`;
    }

    function formatCurrency(amount) {
        if (amount === null || amount === undefined || amount === '') return '—';
        return '\u20B9' + Number(amount).toLocaleString('en-IN');
    }

    function capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function showToast(msg, type) {
        if (!els.toast) return;
        els.toast.textContent = msg;
        els.toast.className = `sal-toast ${type} show`;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => els.toast.classList.remove('show'), 3000);
    }

    return { init, destroy, downloadPayslip, cancelClaim, removeBillRow, addBillRow, approveReimb, rejectReimb, _toggleMonth };
})();
