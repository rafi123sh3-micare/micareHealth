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
    ? `<div style="position:absolute;top:50%;left:20px;transform:translateY(-50%);font-size:72px;font-weight:900;color:rgba(22,163,74,0.12);writing-mode:vertical-lr;letter-spacing:12px;border:6px solid rgba(22,163,74,0.20);padding:16px 8px;border-radius:12px;">PAID</div>`
    : '';

  const logRows = data.paymentLog
    .map(
      (l) => `
    <tr>
      <td style="padding:6px 12px;border:1px solid #e2e8f0;text-align:center;font-size:13px;">${l.paymentType}</td>
      <td style="padding:6px 12px;border:1px solid #e2e8f0;text-align:center;font-size:13px;">${l.collectedBy}</td>
      <td style="padding:6px 12px;border:1px solid #e2e8f0;text-align:center;font-size:13px;">${l.date}</td>
      <td style="padding:6px 12px;border:1px solid #e2e8f0;text-align:center;font-size:13px;">${l.mode}</td>
      <td style="padding:6px 12px;border:1px solid #e2e8f0;text-align:right;font-size:13px;">${fmtAmt(l.amount)}</td>
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
    @page { margin: 15mm 12mm; size: A4; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
      color: #1e293b;
      line-height: 1.5;
      position: relative;
    }
    .invoice-wrap {
      max-width: 210mm;
      margin: 0 auto;
      padding: 0;
    }
    .header-section {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 2px solid #e2e8f0;
    }
    .logo-area {
      width: 80px;
      height: 80px;
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
      font-size: 26px;
      font-weight: 800;
      letter-spacing: 1px;
      color: #0f172a;
      text-transform: uppercase;
    }
    .brand-details {
      font-size: 12px;
      color: #64748b;
      margin-top: 4px;
      line-height: 1.6;
    }
    .cash-memo-badge {
      display: inline-block;
      padding: 6px 32px;
      border-radius: 50px;
      border: 2px solid #1e293b;
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #1e293b;
      margin-bottom: 16px;
    }
    .cash-memo-wrapper {
      text-align: center;
      margin: 10px 0 18px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px 32px;
      margin-bottom: 16px;
      padding: 12px 16px;
      background: #f8fafc;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
    .meta-item {
      display: flex;
      align-items: center;
      font-size: 13px;
    }
    .meta-label {
      font-weight: 600;
      color: #475569;
      min-width: 80px;
    }
    .meta-value {
      color: #0f172a;
      font-weight: 500;
    }
    .section-title {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
      padding-bottom: 4px;
      border-bottom: 1px solid #e2e8f0;
    }
    .patient-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px 32px;
      padding: 8px 0;
      margin-bottom: 12px;
    }
    .patient-row {
      display: flex;
      align-items: center;
      font-size: 13px;
    }
    .patient-label {
      font-weight: 600;
      color: #475569;
      min-width: 70px;
    }
    .patient-value {
      color: #0f172a;
      font-weight: 500;
    }
    .consultation-grid {
      padding: 8px 0;
      margin-bottom: 12px;
    }
    .consultation-row {
      display: flex;
      align-items: center;
      font-size: 13px;
      margin-bottom: 4px;
    }
    .consultation-label {
      font-weight: 600;
      color: #475569;
      min-width: 100px;
    }
    .consultation-value {
      color: #0f172a;
      font-weight: 500;
    }
    .services-table {
      width: 100%;
      margin-bottom: 16px;
    }
    .services-table th {
      text-align: left;
      padding: 8px 4px;
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
      border-bottom: 1px solid #e2e8f0;
    }
    .services-table th:last-child {
      text-align: right;
    }
    .services-table td {
      padding: 6px 4px;
      font-size: 13px;
      color: #334155;
      border-bottom: none;
    }
    .services-table td:last-child {
      text-align: right;
      font-weight: 600;
    }
    .totals-area {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
      position: relative;
      min-height: 130px;
    }
    .totals-left {
      width: 45%;
      position: relative;
    }
    .totals-right {
      width: 40%;
      margin-left: auto;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      font-size: 13px;
    }
    .total-label {
      font-weight: 600;
      color: #475569;
    }
    .total-amount {
      font-weight: 600;
      color: #0f172a;
    }
    .total-row.net {
      border-top: 2px solid #1e293b;
      margin-top: 4px;
      padding-top: 6px;
      font-size: 15px;
    }
    .total-row.net .total-label,
    .total-row.net .total-amount {
      font-weight: 800;
      color: #0f172a;
    }
    .total-row.due .total-amount {
      color: #dc2626;
    }
    .in-words {
      font-size: 12px;
      color: #475569;
      margin-top: 12px;
      padding: 8px 12px;
      background: #f8fafc;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
    }
    .in-words strong {
      color: #0f172a;
    }
    .payment-log {
      margin-bottom: 20px;
    }
    .payment-log table {
      width: 100%;
      border-collapse: collapse;
    }
    .payment-log th {
      background: #f1f5f9;
      padding: 8px 12px;
      font-size: 12px;
      font-weight: 700;
      color: #475569;
      text-align: center;
      border: 1px solid #e2e8f0;
      text-transform: uppercase;
    }
    .payment-log th:last-child {
      text-align: right;
    }
    .footer-tags {
      display: flex;
      justify-content: center;
      gap: 24px;
      padding-top: 14px;
      border-top: 2px solid #e2e8f0;
      margin-top: 8px;
    }
    .footer-tag {
      padding: 6px 28px;
      border: 1.5px solid #334155;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 700;
      color: #334155;
      letter-spacing: 1px;
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
        <img src="https://iili.io/Cf3Yo8b.png" alt="Micare Health" style="height:72px;width:auto;object-fit:contain;" />
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
          ${logRows || '<tr><td colspan="5" style="padding:10px;text-align:center;font-size:13px;color:#94a3b8;">No payment records</td></tr>'}
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
