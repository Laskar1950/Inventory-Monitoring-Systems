import type PDFDocument from "pdfkit";

export function drawPlnIconPlusLogo(doc: PDFDocument, x: number, y: number, scale = 1) {
  const box = 42 * scale;
  doc.save();
  doc.rect(x, y, box, box).fill("#fff200");
  doc.lineWidth(2.2 * scale).strokeColor("#25a9d8");
  for (let i = 0; i < 3; i++) {
    const yy = y + (16 + i * 9) * scale;
    doc.moveTo(x + 8 * scale, yy).bezierCurveTo(x + 16 * scale, yy - 5 * scale, x + 23 * scale, yy + 5 * scale, x + 31 * scale, yy).stroke();
  }
  doc.fillColor("#ed1c24");
  doc.polygon(
    [x + 22 * scale, y + 5 * scale],
    [x + 14 * scale, y + 25 * scale],
    [x + 22 * scale, y + 23 * scale],
    [x + 16 * scale, y + 40 * scale],
    [x + 33 * scale, y + 17 * scale],
    [x + 24 * scale, y + 20 * scale]
  ).fill();
  const textX = x + 56 * scale;
  doc.font("Helvetica-Bold").fontSize(34 * scale).fillColor("#25a9d8").text("PLN", textX, y - 2 * scale, { width: 160 * scale });
  doc.font("Helvetica").fontSize(20 * scale).fillColor("#225b68").text("Icon Plus", textX, y + 29 * scale, { width: 170 * scale });
  doc.restore();
}
