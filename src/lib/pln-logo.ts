import { PLN_ICON_PLUS_LOGO_BASE64 } from "@/lib/pln-logo-data";

type PdfDocLike = {
  image: (src: Buffer, x: number, y: number, options?: Record<string, unknown>) => unknown;
};

export function drawPlnIconPlusLogo(doc: PdfDocLike, x: number, y: number, scale = 1) {
  const logo = Buffer.from(PLN_ICON_PLUS_LOGO_BASE64, "base64");
  doc.image(logo, x, y, {
    fit: [245 * scale, 95 * scale],
    align: "right",
    valign: "top",
  });
}
