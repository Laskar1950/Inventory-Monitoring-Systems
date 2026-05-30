import type { Metadata } from "next";
import "./globals.css";
import "./phase9b.css";
import "./phase9c.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "PLN ICON PLUS Inventory Monitoring Systems",
  description: "Inventory Monitoring Systems migrated to Next.js and Supabase",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
