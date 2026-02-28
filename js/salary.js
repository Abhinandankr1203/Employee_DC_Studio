// ===== DC SALARY TRACKER MODULE =====
const DCSalary = (function () {
    'use strict';

    let els = {};
    let toastTimer = null;

    // ---- Init / Destroy ----
    function init() {
        cacheElements();
        bindEvents();
        switchTab('payslips');
        loadPayslips();
        loadProjectSuggestions();
        loadReimbursements();
    }

    function destroy() {}

    function cacheElements() {
        els = {
            tabs:          document.querySelectorAll('.sal-tab'),
            payslipsPane:  document.getElementById('salPayslipsPane'),
            reimbPane:     document.getElementById('salReimbPane'),
            payslipsBody:  document.getElementById('salPayslipsBody'),
            payslipsEmpty: document.getElementById('salPayslipsEmpty'),
            reimbForm:     document.getElementById('salReimbForm'),
            expenseDate:   document.getElementById('salExpenseDate'),
            amount:        document.getElementById('salAmount'),
            project:       document.getElementById('salProject'),
            projectList:   document.getElementById('salProjectList'),
            description:   document.getElementById('salDescription'),
            billFile:      document.getElementById('salBillFile'),
            reimbBody:     document.getElementById('salReimbBody'),
            reimbEmpty:    document.getElementById('salReimbEmpty'),
            toast:         document.getElementById('salToast'),
        };
    }

    function bindEvents() {
        els.tabs.forEach(tab => {
            tab.addEventListener('click', () => switchTab(tab.dataset.tab));
        });
        if (els.reimbForm) {
            els.reimbForm.addEventListener('submit', handleSubmitClaim);
        }
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

    async function downloadPayslip(id) {
        const data = await apiFetch(`/api/salary/payslips/${id}`);
        if (!data || !data.payslip) {
            showToast('Could not load payslip data.', 'error');
            return;
        }
        generatePayslipPDF(data.payslip);
    }

    function generatePayslipPDF(p) {
        if (!window.jspdf) { showToast('PDF library not loaded.', 'error'); return; }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const W = 210, pad = 14;

        // Background
        doc.setFillColor(248, 248, 248);
        doc.rect(0, 0, W, 297, 'F');

        // Dark header bar
        doc.setFillColor(26, 26, 26);
        doc.rect(0, 0, W, 44, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.text('PAYSLIP', W / 2, 18, { align: 'center' });
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('DC Studio', W / 2, 28, { align: 'center' });
        doc.setFontSize(8);
        doc.setTextColor(180, 180, 180);
        doc.text('Computer Generated Document', W / 2, 37, { align: 'center' });

        // Period pill
        doc.setFillColor(235, 120, 70);
        doc.roundedRect(pad, 52, W - pad * 2, 14, 3, 3, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('Pay Period: ' + p.period, W / 2, 61, { align: 'center' });

        // Employee info card
        let y = 74;
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(pad, y, W - pad * 2, 22, 3, 3, 'F');
        doc.setTextColor(150, 150, 150);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text('EMPLOYEE', pad + 6, y + 7);
        doc.text('PAID ON', W / 2 + 10, y + 7);
        doc.setTextColor(30, 30, 30);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('DC Studio Employee', pad + 6, y + 16);
        doc.text(p.paid_on || '—', W / 2 + 10, y + 16);

        // ---- Earnings ----
        y = 104;
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(pad, y, W - pad * 2, 64, 3, 3, 'F');

        doc.setTextColor(235, 120, 70);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.text('EARNINGS', pad + 6, y + 9);

        const earnings = [
            ['Basic Salary',                  p.basic],
            ['House Rent Allowance (HRA)',     p.hra],
            ['Travel Allowance',               p.travel_allowance],
            ['Other Allowances',               p.other_allowance],
        ];
        earnings.forEach(([label, val], i) => {
            const ry = y + 18 + i * 9;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9.5);
            doc.setTextColor(80, 80, 80);
            doc.text(label, pad + 6, ry);
            doc.setTextColor(30, 30, 30);
            doc.text(formatCurrency(val), W - pad - 6, ry, { align: 'right' });
        });
        doc.setDrawColor(230, 230, 230);
        doc.line(pad + 4, y + 57, W - pad - 4, y + 57);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(30, 30, 30);
        doc.text('Gross Earnings', pad + 6, y + 63);
        doc.text(formatCurrency(p.gross_salary), W - pad - 6, y + 63, { align: 'right' });

        // ---- Deductions ----
        y = 176;
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(pad, y, W - pad * 2, 52, 3, 3, 'F');

        doc.setTextColor(220, 38, 38);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.text('DEDUCTIONS', pad + 6, y + 9);

        const deductions = [
            ['Provident Fund (PF)',           p.pf],
            ['Tax Deducted at Source (TDS)',  p.tds],
            ['Professional Tax',              p.professional_tax],
        ];
        deductions.forEach(([label, val], i) => {
            const ry = y + 18 + i * 9;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9.5);
            doc.setTextColor(80, 80, 80);
            doc.text(label, pad + 6, ry);
            doc.setTextColor(220, 38, 38);
            doc.text(formatCurrency(val), W - pad - 6, ry, { align: 'right' });
        });
        doc.setDrawColor(230, 230, 230);
        doc.line(pad + 4, y + 44, W - pad - 4, y + 44);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(220, 38, 38);
        doc.text('Total Deductions', pad + 6, y + 50);
        doc.text(formatCurrency(p.total_deductions), W - pad - 6, y + 50, { align: 'right' });

        // ---- Net Pay ----
        y = 236;
        doc.setFillColor(5, 150, 105);
        doc.roundedRect(pad, y, W - pad * 2, 22, 4, 4, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.text('NET PAY', pad + 10, y + 14);
        doc.text(formatCurrency(p.net_pay), W - pad - 10, y + 14, { align: 'right' });

        // ---- Footer ----
        doc.setFillColor(26, 26, 26);
        doc.rect(0, 272, W, 25, 'F');
        doc.setTextColor(150, 150, 150);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text('This is a computer-generated payslip and does not require a signature.', W / 2, 282, { align: 'center' });
        doc.setTextColor(235, 120, 70);
        doc.setFontSize(9);
        doc.text('DC Studio \u00A9 2026', W / 2, 291, { align: 'center' });

        doc.save('Payslip_' + p.period.replace(/\s+/g, '_') + '.pdf');
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
        els.reimbBody.innerHTML = claims.map(c => `
            <tr>
                <td data-label="Date">${formatDate(c.expense_date)}</td>
                <td data-label="Project">${escHtml(c.project || '—')}</td>
                <td data-label="Amount"><strong>${formatCurrency(c.amount)}</strong></td>
                <td data-label="Description">${escHtml(c.description || '—')}</td>
                <td data-label="Status"><span class="sal-status sal-status-${c.status}">${capitalize(c.status)}</span></td>
                <td data-label="">
                    ${c.status === 'pending'
                        ? `<button class="sal-action-btn sal-delete-btn" title="Cancel Claim" onclick="DCSalary.cancelClaim(${c.id})"><i class="fas fa-times"></i></button>`
                        : '—'}
                </td>
            </tr>
        `).join('');
    }

    async function handleSubmitClaim(e) {
        e.preventDefault();

        const expenseDate = els.expenseDate.value;
        const amount      = parseFloat(els.amount.value);
        const project     = els.project ? els.project.value.trim() : '';
        const description = els.description.value.trim();
        const fileName    = els.billFile && els.billFile.files[0] ? els.billFile.files[0].name : null;

        if (!expenseDate || !amount || !description) {
            showToast('Please fill in all required fields.', 'error');
            return;
        }

        const btn = els.reimbForm.querySelector('.sal-submit-btn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

        const data = await apiFetch('/api/reimbursements', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ expense_date: expenseDate, amount, project, description, file_name: fileName })
        });

        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Claim';

        if (data && data.success) {
            showToast('Reimbursement claim submitted!', 'success');
            els.reimbForm.reset();
            loadReimbursements();
        } else {
            showToast((data && data.error) || 'Failed to submit. Please try again.', 'error');
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

    return { init, destroy, downloadPayslip, cancelClaim };
})();
