'use client';

interface CashMemoData {
  billNo: string;
  date: string;
  appNo: string;
  hn: string;
  barcode: string;
  patientName: string;
  patientAge: string | number;
  patientGender: string;
  patientMobile: string;
  patientAddress: string;
  conType: string;
  department: string;
  consultant: string;
  services: { name: string; amount: number }[];
  subTotal: number;
  netPayable: number;
  advance: number;
  due: number;
  inWords: string;
  isPaid: boolean;
  paymentLog: {
    paymentType: string;
    collectedBy: string;
    date: string;
    mode: string;
    amount: number;
  }[];
}

export function generateCashMemoPrint(data: CashMemoData) {
  const pw = window.open('', '_blank');
  if (!pw) return;

  const fmtAmt = (n: number) => n.toFixed(2);

  const paidBadge = data.isPaid
    ? `<div style="position:absolute;top:50%;left:5px;transform:translateY(-50%);font-size:28px;font-weight:900;color:rgba(22,163,74,0.12);writing-mode:vertical-lr;letter-spacing:4px;border:3px solid rgba(22,163,74,0.20);padding:6px 4px;border-radius:4px;">PAID</div>`
    : '';

  const logRows = data.paymentLog
    .map(
      (l) => `
    <tr>
      <td style="padding:2px 6px;border:1px solid #e2e8f0;text-align:center;font-size:8px;">${l.paymentType}</td>
      <td style="padding:2px 6px;border:1px solid #e2e8f0;text-align:center;font-size:8px;">${l.collectedBy}</td>
      <td style="padding:2px 6px;border:1px solid #e2e8f0;text-align:center;font-size:8px;">${l.date}</td>
      <td style="padding:2px 6px;border:1px solid #e2e8f0;text-align:center;font-size:8px;">${l.mode}</td>
      <td style="padding:2px 6px;border:1px solid #e2e8f0;text-align:right;font-size:8px;">${fmtAmt(l.amount)}</td>
    </tr>`
    )
    .join('');

  const svgBarcode = `<svg id="barcode"></svg>`;

  pw.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Cash Memo - Micare Health</title>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.12.3/dist/JsBarcode.all.min.js"><\/script>
  <style>
    @page { margin: 5mm 6mm; size: A5; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
      color: #1e293b;
      line-height: 1.3;
      font-size: 9px;
    }
    .invoice-wrap {
      max-width: 136mm;
      margin: 0 auto;
    }
    .header-section {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 5px;
      padding-bottom: 4px;
      border-bottom: 1.5px solid #e2e8f0;
    }
    .logo-area {
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .brand-area {
      flex: 1;
      text-align: center;
    }
    .brand-name {
      font-size: 14px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
    }
    .brand-details {
      font-size: 7px;
      color: #64748b;
      line-height: 1.3;
    }
    .cash-memo-wrapper {
      text-align: center;
      margin: 4px 0 6px;
    }
    .cash-memo-badge {
      display: inline-block;
      padding: 2px 16px;
      border: 1.5px solid #1e293b;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #1e293b;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2px 12px;
      margin-bottom: 5px;
      padding: 4px 8px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
    }
    .meta-item {
      display: flex;
      font-size: 8px;
    }
    .meta-label {
      font-weight: 600;
      color: #475569;
      min-width: 44px;
    }
    .meta-value {
      color: #0f172a;
      font-weight: 500;
    }
    .section-title {
      font-size: 9px;
      font-weight: 700;
      color: #0f172a;
      text-transform: uppercase;
      margin-bottom: 3px;
      padding-bottom: 2px;
      border-bottom: 1px solid #e2e8f0;
    }
    .patient-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1px 12px;
      margin-bottom: 4px;
    }
    .patient-row {
      display: flex;
      font-size: 8px;
    }
    .patient-label {
      font-weight: 600;
      color: #475569;
      min-width: 40px;
    }
    .patient-value {
      color: #0f172a;
      font-weight: 500;
    }
    .consultation-grid {
      margin-bottom: 4px;
    }
    .consultation-row {
      display: flex;
      font-size: 8px;
    }
    .consultation-label {
      font-weight: 600;
      color: #475569;
      min-width: 60px;
    }
    .consultation-value {
      color: #0f172a;
      font-weight: 500;
    }
    .services-table {
      width: 100%;
      margin-bottom: 4px;
    }
    .services-table th {
      text-align: left;
      padding: 3px 4px;
      font-size: 8px;
      font-weight: 700;
      color: #0f172a;
      border-bottom: 1px solid #e2e8f0;
    }
    .services-table th:last-child { text-align: right; }
    .services-table td {
      padding: 2px 4px;
      font-size: 8px;
      color: #334155;
    }
    .services-table td:last-child { text-align: right; font-weight: 600; }
    .totals-area {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 5px;
      position: relative;
    }
    .totals-left {
      width: 48%;
      position: relative;
    }
    .totals-right {
      width: 42%;
      margin-left: auto;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 1px 0;
      font-size: 9px;
    }
    .total-label { font-weight: 600; color: #475569; }
    .total-amount { font-weight: 600; color: #0f172a; }
    .total-row.net {
      border-top: 1.5px solid #1e293b;
      margin-top: 2px;
      padding-top: 2px;
      font-size: 10px;
    }
    .total-row.net .total-label,
    .total-row.net .total-amount { font-weight: 800; color: #0f172a; }
    .total-row.due .total-amount { color: #dc2626; }
    .in-words {
      font-size: 7px;
      color: #475569;
      margin-top: 3px;
      padding: 3px 6px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
    }
    .in-words strong { color: #0f172a; }
    .payment-log { margin-bottom: 5px; }
    .payment-log table { width: 100%; border-collapse: collapse; }
    .payment-log th {
      background: #f1f5f9;
      padding: 2px 4px;
      font-size: 7px;
      font-weight: 700;
      color: #475569;
      text-align: center;
      border: 1px solid #e2e8f0;
      text-transform: uppercase;
    }
    .payment-log th:last-child { text-align: right; }
    .payment-log td {
      padding: 2px 4px;
      font-size: 7px;
      border: 1px solid #e2e8f0;
    }
    .footer-tags {
      display: flex;
      justify-content: center;
      gap: 10px;
      padding-top: 4px;
      border-top: 1.5px solid #e2e8f0;
    }
    .footer-tag {
      padding: 2px 12px;
      border: 1px solid #334155;
      font-size: 7px;
      font-weight: 700;
      color: #334155;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="invoice-wrap">

    <!-- HEADER -->
    <div class="header-section">
      <div class="logo-area">
        <img src="https://iili.io/Cf3Yo8b.png" alt="Micare Health" style="height:32px;width:auto;object-fit:contain;" />
      </div>
      <div class="brand-area">
        <div class="brand-name">Micare Health</div>
        <div class="brand-details">
          Shyamoli Cinema Hall Building Complex, Ring Road Shyamoli, Dhaka-1207<br>
          Tel: +8801898803000 &nbsp;|&nbsp; Email: info@micare.com.bd<br>
          Web: www.micare.com.bd
        </div>
      </div>
      <div style="width:80px;flex-shrink:0;"></div>
    </div>

    <!-- CASH MEMO BADGE -->
    <div class="cash-memo-wrapper">
      <div class="cash-memo-badge">Cash Memo</div>
    </div>

    <!-- METADATA -->
    <div class="meta-grid">
      <div class="meta-item"><span class="meta-label">Bill No.:</span><span class="meta-value">${data.billNo}</span></div>
      <div class="meta-item"><span class="meta-label">Date:</span><span class="meta-value">${data.date}</span></div>
      <div class="meta-item"><span class="meta-label">App. No.:</span><span class="meta-value">${data.appNo}</span></div>
      <div class="meta-item"><span class="meta-label">HN:</span><span class="meta-value">${data.hn}</span></div>
      <div class="meta-item" style="grid-column: span 2;">
        <span class="meta-label">Barcode:</span>
        <span class="meta-value">${data.barcode ? svgBarcode : '-'}</span>
      </div>
    </div>

    <!-- PATIENT INFO -->
    <div class="section-title">Patient Information</div>
    <div class="patient-grid">
      <div class="patient-row"><span class="patient-label">Name:</span><span class="patient-value">${data.patientName}</span></div>
      <div class="patient-row"><span class="patient-label">Age:</span><span class="patient-value">${data.patientAge}</span></div>
      <div class="patient-row"><span class="patient-label">Gender:</span><span class="patient-value">${data.patientGender.charAt(0).toUpperCase() + data.patientGender.slice(1)}</span></div>
      <div class="patient-row"><span class="patient-label">Mobile:</span><span class="patient-value">${data.patientMobile}</span></div>
      <div style="grid-column: span 2;" class="patient-row"><span class="patient-label">Address:</span><span class="patient-value">${data.patientAddress || '-'}</span></div>
    </div>

    <!-- CONSULTATION DETAILS -->
    <div class="section-title">Consultation / Service Details</div>
    <div class="consultation-grid">
      <div class="consultation-row"><span class="consultation-label">Con. Type:</span><span class="consultation-value">${data.conType}</span></div>
      <div class="consultation-row"><span class="consultation-label">Department:</span><span class="consultation-value">${data.department}</span></div>
      <div class="consultation-row"><span class="consultation-label">Consultant:</span><span class="consultation-value">${data.consultant}</span></div>
    </div>

    <!-- SERVICES TABLE -->
    <div class="section-title">Financial Details</div>
    <table class="services-table">
      <thead>
        <tr>
          <th>Service Name</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        ${data.services
          .map(
            (s) =>
              `<tr><td>${s.name}</td><td>${fmtAmt(s.amount)}</td></tr>`
          )
          .join('')}
      </tbody>
    </table>

    <!-- TOTALS + PAID STAMP -->
    <div class="totals-area">
      <div class="totals-left">
        ${paidBadge}
        <div class="in-words"><strong>In Word:</strong> ${data.inWords}</div>
      </div>
      <div class="totals-right">
        <div class="total-row"><span class="total-label">Sub Total Tk.</span><span class="total-amount">${fmtAmt(data.subTotal)}</span></div>
        <div class="total-row net"><span class="total-label">Net Payable Tk.</span><span class="total-amount">${fmtAmt(data.netPayable)}</span></div>
        <div class="total-row ${data.advance > 0 ? '' : ''}"><span class="total-label">Advance Tk.</span><span class="total-amount">${fmtAmt(data.advance)}</span></div>
        <div class="total-row due"><span class="total-label">Due Tk.</span><span class="total-amount">${fmtAmt(data.due)}</span></div>
      </div>
    </div>

    <!-- PAYMENT LOG -->
    <div class="section-title">Payment Collection Log</div>
    <div class="payment-log">
      <table>
        <thead>
          <tr>
            <th>Payment Type</th>
            <th>Collected By</th>
            <th>Date</th>
            <th>Mode</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          ${logRows || '<tr><td colspan="5" style="padding:4px;text-align:center;font-size:8px;color:#94a3b8;">No payment records</td></tr>'}
        </tbody>
      </table>
    </div>

    <!-- FOOTER -->
    <div class="footer-tags">
      <span class="footer-tag">Diagnostic</span>
      <span class="footer-tag">Hospital</span>
      <span class="footer-tag">Research</span>
    </div>

  </div>

  <script>
    ${data.barcode ? `try { JsBarcode("#barcode", "${data.barcode}", { format: "CODE128", width: 1.2, height: 30, displayValue: false, margin: 5 }); } catch(e) {}` : ''}
    setTimeout(function() { window.print(); }, 600);
  <\/script>
</body>
</html>`);
  pw.document.close();
}
