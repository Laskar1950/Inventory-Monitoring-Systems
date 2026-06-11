import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "./phase9b.css";
import "./phase9c.css";
import "./phase10c.css";
import "./phase10d.css";
import "./phase10e.css";
import "./phase12.css";
import "./phase14a.css";
import "./surat-jalan.css";
import "../styles/dashboard.css";
import "./modal-fixes.css";
import { Toaster } from "sonner";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "PLN ICONPLUS Inventory Systems",
  description: "Inventory Monitoring Systems migrated to Next.js and Supabase",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={inter.variable}>
      <body className={inter.className}>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
