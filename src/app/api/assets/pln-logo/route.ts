import { PLN_ICON_PLUS_LOGO_BASE64 } from "@/lib/pln-logo-data";

export const runtime = "nodejs";

export async function GET() {
  const image = Buffer.from(PLN_ICON_PLUS_LOGO_BASE64, "base64");

  return new Response(image, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
