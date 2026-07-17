import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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
    advance: number;
  }[];
}

const PRIMARY: [number, number, number] = [13, 93, 158];

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

function loadLogos(): Promise<{ header: string | null; watermark: string | null }> {
  if (headerLogoCache && watermarkLogoCache) return Promise.resolve({ header: headerLogoCache, watermark: watermarkLogoCache });

  return Promise.all([
    headerLogoCache ? Promise.resolve(headerLogoCache) : toBase64('/clinic-logo.png').then(d => { headerLogoCache = d; return d; }),
    watermarkLogoCache ? Promise.resolve(watermarkLogoCache) : toBase64('/watermark-logo.png').then(d => { watermarkLogoCache = d; return d; }),
  ]).then(([header, watermark]) => ({ header, watermark }));
}

export function generateAppointmentPDF(data: PDFExportData) {
  loadLogos().then(({ header, watermark }) => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    let headerEnd: number;

    if (header) {
      const headerH = 28;
      const props = doc.getImageProperties(header);
      const headerW = headerH * (props.width / props.height);
      doc.addImage(header, 'PNG', pageWidth / 2 - headerW / 2, 4, headerW, headerH);

      headerEnd = 4 + headerH + 4;

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text('Shyamoli Cinema Hall Building Complex, Ring Road Shyamoli, Dhaka-1207', pageWidth / 2, headerEnd + 4, { align: 'center' });
      doc.text('Tel: +8801898803000 | Email: info@micare.com.bd | Web: www.micare.com.bd', pageWidth / 2, headerEnd + 9, { align: 'center' });

      doc.setDrawColor(...PRIMARY);
      doc.setLineWidth(0.4);
      doc.line(10, headerEnd + 12, pageWidth - 10, headerEnd + 12);

      headerEnd += 14;
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(...PRIMARY);
      doc.text('MICARE HEALTH', pageWidth / 2, 12, { align: 'center' });

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text('Shyamoli Cinema Hall Building Complex, Ring Road Shyamoli, Dhaka-1207', pageWidth / 2, 18, { align: 'center' });
      doc.text('Tel: +8801898803000 | Email: info@micare.com.bd | Web: www.micare.com.bd', pageWidth / 2, 23, { align: 'center' });

      doc.setDrawColor(...PRIMARY);
      doc.setLineWidth(0.4);
      doc.line(10, 26, pageWidth - 10, 26);

      headerEnd = 28;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(data.title, 14, headerEnd + 4);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${data.date}`, 14, headerEnd + 10);
    doc.text(`Total: ${data.appointments.length}`, pageWidth - 14, headerEnd + 10, { align: 'right' });

    const tableStartY = headerEnd + 14;

    const headers = [['#', 'Serial', 'Patient', 'Phone', 'Age', 'Sex', 'Doctor', 'Department', 'Type', 'Status', 'Time', 'Date', 'Fee Type', 'Advance']];

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
      apt.time || '-',
      apt.date || '-',
      apt.feeType || '-',
      apt.advance || 0,
    ]);

    autoTable(doc, {
      startY: tableStartY,
      head: headers,
      body: rows,
      styles: { fontSize: 7.5, cellPadding: 2, overflow: 'ellipsize' },
      headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [235, 245, 255] },
      columnStyles: {
        0: { cellWidth: 10 },
        7: { cellWidth: 25 },
        13: { cellWidth: 18 },
      },
      margin: { left: 10, right: 10 },
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

    const fileName = `Micare_Appointments_${data.date.replace(/\//g, '-')}.pdf`;
    doc.save(fileName);
  });
}
