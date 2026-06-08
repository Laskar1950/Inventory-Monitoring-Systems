"use client";

import { Printer } from "lucide-react";

export function SuratJalanPrintButton() {
  return <button className="sj-print-button" type="button" onClick={() => window.print()}><Printer size={16}/> Cetak / Simpan PDF</button>;
}
