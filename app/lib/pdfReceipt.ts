import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export async function downloadReceiptPDF(
  elementId: string,
  filename: string,
  format: 'a4' | 'a5' = 'a5',
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) return;

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format });
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

  // For A4 multi-page: split canvas into page-height chunks
  if (format === 'a4' && pdfHeight > pdf.internal.pageSize.getHeight()) {
    const pageHeight = pdf.internal.pageSize.getHeight();
    const totalPages = Math.ceil(pdfHeight / pageHeight);
    for (let i = 0; i < totalPages; i++) {
      if (i > 0) pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, -i * pageHeight, pdfWidth, pdfHeight);
    }
  } else {
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
  }

  pdf.save(filename);
}
