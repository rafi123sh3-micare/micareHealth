import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getBranchHeader, type BranchHeader } from '@/lib/branch';

interface PDFExportData {
  title: string;
  date: string;
  appointments: {
    serial: string;
    patientName: string;
    phone: string;
    age: string | number;
    gender: string;
    doctor: string;
    department: string;
    type: string;
    status: string;
    time: string;
    date: string;
    feeType: string;
    bookedBy: string;
    createdAt: string;
  }[];
}

interface ReportPDFData {
  title: string;
  date: string;
  appointments: {
    serial: string;
    patientName: string;
    phone: string;
    age: string | number;
    gender: string;
    doctor: string;
    department: string;
    type: string;
    status: string;
    time: string;
    date: string;
    feeType: string;
    advance: number;
    paid: number;
    refunded: number;
    netPayble: number;
    due: number;
  }[];
}

const PRIMARY: [number, number, number] = [13, 93, 158];

/**
 * Draws the branch-aware invoice header (logo/brand + optional bold branch
 * title + address + contact) and returns the y position just below the rule
 * that separates it from the body.
 */
function drawPdfHeader(doc: jsPDF, pageWidth: number, headerImage: string | null, branch: BranchHeader): number {
  let y: number;

  if (headerImage) {
    const headerH = 28;
    const props = doc.getImageProperties(headerImage);
    const headerW = headerH * (props.width / props.height);
    doc.addImage(headerImage, 'PNG', pageWidth / 2 - headerW / 2, 4, headerW, headerH);
    y = 40;
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(...PRIMARY);
    doc.text('MICARE HEALTH', pageWidth / 2, 12, { align: 'center' });
    y = 18;
  }

  const size = headerImage ? 8 : 9;
  const gap = 5;
  doc.setTextColor(0, 0, 0);

  if (branch.boldTitle) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(size);
    doc.text(branch.boldTitle, pageWidth / 2, y, { align: 'center' });
    y += gap;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(size);
  doc.text(branch.address, pageWidth / 2, y, { align: 'center' });
  y += gap;
  doc.text(branch.contact, pageWidth / 2, y, { align: 'center' });

  const ruleY = y + 3;
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.4);
  doc.line(10, ruleY, pageWidth - 10, ruleY);

  return ruleY + 2;
}

function toBase64(url: string): Promise<string | null> {
  return fetch(url)
    .then(res => { if (!res.ok) throw new Error(); return res.blob(); })
    .then(blob => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    }))
    .catch(() => null);
}

let headerLogoCache: string | null = null;
let watermarkLogoCache: string | null = null;

function formatDateTime(iso?: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

function loadLogos(): Promise<{ header: string | null; watermark: string | null }> {
  if (headerLogoCache && watermarkLogoCache) return Promise.resolve({ header: headerLogoCache, watermark: watermarkLogoCache });

  return Promise.all([
    headerLogoCache ? Promise.resolve(headerLogoCache) : toBase64('/clinic-logo.png').then(d => { headerLogoCache = d; return d; }),
    watermarkLogoCache ? Promise.resolve(watermarkLogoCache) : toBase64('/watermark-logo.png').then(d => { watermarkLogoCache = d; return d; }),
  ]).then(([header, watermark]) => ({ header, watermark }));
}

export function generateReportPDF(data: ReportPDFData) {
  loadLogos().then(({ header, watermark }) => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const headerEnd = drawPdfHeader(doc, pageWidth, header, getBranchHeader());

    const totalPaid = data.appointments.reduce((s, a) => s + (a.paid || 0), 0);
    const totalRefunded = data.appointments.reduce((s, a) => s + (a.refunded || 0), 0);
    const totalNetPayble = data.appointments.reduce((s, a) => s + (a.netPayble || 0), 0);
    const totalDue = data.appointments.reduce((s, a) => s + (a.due || 0), 0);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(data.title, 14, headerEnd + 4);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${data.date}`, 14, headerEnd + 10);
    doc.text(`Total: ${data.appointments.length}`, pageWidth - 14, headerEnd + 10, { align: 'right' });

    const tableStartY = headerEnd + 14;

    const headers = [['#', 'Serial', 'Patient', 'Phone', 'Age', 'Sex', 'Doctor', 'Department', 'Type', 'Status', 'Paid', 'Refund', 'Net Payble', 'Due']];

    const rows = data.appointments.map((apt, idx) => [
      idx + 1,
      apt.serial || '-',
      apt.patientName,
      apt.phone || '-',
      apt.age || '-',
      apt.gender || '-',
      apt.doctor || '-',
      apt.department || '-',
      apt.type || '-',
      apt.status || '-',
      apt.paid || 0,
      apt.refunded || 0,
      apt.netPayble || 0,
      apt.due || 0,
    ]);

    // Add grand total row with custom cell formatting
    const totalRow: any[] = ['', '', '', '', '', '', '', '', '', '', '', '', '', ''];
    totalRow[9] = { content: 'GRAND TOTAL', styles: { fontStyle: 'bold', fillColor: [13, 93, 158], textColor: [255, 255, 255] } };
    totalRow[10] = { content: `Tk. ${totalPaid.toLocaleString()}`, styles: { fontStyle: 'bold', fillColor: [230, 245, 255] } };
    totalRow[11] = { content: `Tk. ${totalRefunded.toLocaleString()}`, styles: { fontStyle: 'bold', fillColor: [230, 245, 255] } };
    totalRow[12] = { content: `Tk. ${totalNetPayble.toLocaleString()}`, styles: { fontStyle: 'bold', fillColor: [255, 235, 235], textColor: [190, 30, 30] } };
    totalRow[13] = { content: `Tk. ${totalDue.toLocaleString()}`, styles: { fontStyle: 'bold', fillColor: [255, 235, 235], textColor: [190, 30, 30] } };
    rows.push(totalRow);

    autoTable(doc, {
      startY: tableStartY,
      head: headers,
      body: rows,
      styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [235, 245, 255] },
      // Fixed widths so money columns never get squeezed/truncated.
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 26 },
        2: { cellWidth: 27 },
        3: { cellWidth: 20 },
        4: { cellWidth: 9 },
        5: { cellWidth: 10 },
        6: { cellWidth: 24 },
        7: { cellWidth: 15 },
        8: { cellWidth: 11 },
        9: { cellWidth: 22 },
        10: { cellWidth: 21, halign: 'right' },
        11: { cellWidth: 21, halign: 'right' },
        12: { cellWidth: 25, halign: 'right' },
        13: { cellWidth: 25, halign: 'right' },
      },
      margin: { left: 10, right: 10 },
      showFoot: 'lastPage',
    });

    if (watermark) {
      const wmX = 0;
      const wmY = 0;
      const wmW = pageWidth;
      const wmH = pageHeight;
      (doc as any).setGState(new (doc as any).GState({ opacity: 0.04 }));
      doc.addImage(watermark, 'PNG', wmX, wmY, wmW, wmH);
      (doc as any).setGState(new (doc as any).GState({ opacity: 1 }));
    }

    const fileName = `Micare_Report_${data.date.replace(/\//g, '-')}.pdf`;
    doc.save(fileName);
  });
}

export function generateAppointmentPDF(data: PDFExportData, fileName?: string) {
  loadLogos().then(({ header, watermark }) => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const headerEnd = drawPdfHeader(doc, pageWidth, header, getBranchHeader());

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(data.title, 14, headerEnd + 4);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${data.date}`, 14, headerEnd + 10);
    doc.text(`Total: ${data.appointments.length}`, pageWidth - 14, headerEnd + 10, { align: 'right' });

    const tableStartY = headerEnd + 14;

    const headers = [['#', 'Serial', 'Patient', 'Phone', 'Doctor', 'Department', 'Type', 'Status', 'Booked By', 'Created', 'Fee Type']];

    const rows = data.appointments.map((apt, idx) => [
      idx + 1,
      apt.serial || '-',
      apt.patientName,
      apt.phone || '-',
      apt.doctor || '-',
      apt.department || '-',
      apt.type || '-',
      apt.status || '-',
      apt.bookedBy || '-',
      formatDateTime(apt.createdAt),
      apt.feeType || '-',
    ]);

    autoTable(doc, {
      startY: tableStartY,
      head: headers,
      body: rows,
      styles: { fontSize: 7, cellPadding: 1.5, overflow: 'ellipsize' },
      headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [235, 245, 255] },
      // Fixed widths summing to the full usable width (pageWidth 297 - margins 20 = 277mm)
      // Serial gets extra room so codes like DR01-001AN5572 are never truncated.
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 30 },
        2: { cellWidth: 36 },
        3: { cellWidth: 24 },
        4: { cellWidth: 42 },
        5: { cellWidth: 24 },
        6: { cellWidth: 12 },
        7: { cellWidth: 12 },
        8: { cellWidth: 22 },
        9: { cellWidth: 28 },
        10: { cellWidth: 25 },
      },
      margin: { left: 10, right: 10 },
      showFoot: 'lastPage',
    });

    if (watermark) {
      const wmX = 0;
      const wmY = 0;
      const wmW = pageWidth;
      const wmH = pageHeight;
      (doc as any).setGState(new (doc as any).GState({ opacity: 0.04 }));
      doc.addImage(watermark, 'PNG', wmX, wmY, wmW, wmH);
      (doc as any).setGState(new (doc as any).GState({ opacity: 1 }));
    }

    doc.save(fileName || `Micare_Appointments_${data.date.replace(/\//g, '-')}.pdf`);
  });
}

/** Same layout as the appointment export — lists only unpaid appointments (paid = 0 and refund = 0). */
export function generateAbsentPDF(data: PDFExportData) {
  generateAppointmentPDF(data, `Micare_Absent_${data.date.replace(/\//g, '-')}.pdf`);
}
