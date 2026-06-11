type PdfDocLike = {
  save: () => unknown;
  restore: () => unknown;
  rect: (x: number, y: number, w: number, h: number) => { fill: (color?: string) => unknown; fillAndStroke?: (fillColor?: string, strokeColor?: string) => unknown; stroke?: () => unknown };
  lineWidth: (width: number) => PdfDocLike;
  strokeColor: (color: string) => PdfDocLike;
  fillColor: (color: string) => PdfDocLike;
  moveTo: (x: number, y: number) => PdfDocLike;
  bezierCurveTo: (cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number) => { stroke: () => unknown };
  polygon: (...points: [number, number][]) => { fill: () => unknown };
  font: (name: string) => PdfDocLike;
  fontSize: (size: number) => PdfDocLike;
  text: (text: string, x?: number, y?: number, options?: Record<string, unknown>) => unknown;
};

export function drawPlnIconPlusLogo(doc: PdfDocLike, x: number, y: number, scale = 1) {
  const mark = 74 * scale;
  doc.save();

  doc.rect(x, y, mark, mark).fill("#fff200");
  doc.lineWidth(4.6 * scale).strokeColor("#26a9d6");
  for (let i = 0; i < 3; i++) {
    const yy = y + (28 + i * 11) * scale;
    doc.moveTo(x + 15 * scale, yy)
      .bezierCurveTo(x + 25 * scale, yy - 7 * scale, x + 36 * scale, yy + 7 * scale, x + 47 * scale, yy)
      .bezierCurveTo(x + 57 * scale, yy - 6 * scale, x + 65 * scale, yy + 2 * scale, x + 70 * scale, yy - 2 * scale)
      .stroke();
  }

  doc.fillColor("#ed1c24");
  doc.polygon(
    [x + 43 * scale, y + 10 * scale],
    [x + 27 * scale, y + 42 * scale],
    [x + 41 * scale, y + 38 * scale],
    [x + 31 * scale, y + 68 * scale],
    [x + 60 * scale, y + 27 * scale],
    [x + 46 * scale, y + 31 * scale]
  ).fill();

  const textX = x + 94 * scale;
  doc.font("Helvetica-Bold").fontSize(78 * scale).fillColor("#2aa7d7").text("PLN", textX, y - 6 * scale, { width: 180 * scale, characterSpacing: 7 * scale });
  doc.font("Helvetica").fontSize(42 * scale).fillColor("#245b66").text("Icon Plus", textX, y + 63 * scale, { width: 220 * scale });

  doc.restore();
}
