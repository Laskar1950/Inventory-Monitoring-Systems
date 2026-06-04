type StatusType = "aman" | "rendah" | "kritis" | "pending" | "approved" | "rejected";

const labelMap: Record<string, string> = {
  aman: "Aman", AMAN: "Aman",
  rendah: "Rendah", LOW_STOCK: "Low Stock", PERLU_PERHATIAN: "Perhatian",
  kritis: "Kritis", KRITIS: "Kritis", KOSONG: "Kosong",
  pending: "Pending", PENDING: "Pending",
  approved: "Approved", APPROVED: "Approved",
  rejected: "Rejected", REJECTED: "Rejected",
  OVER_STOCK: "Over",
};

function getVariant(status: string): string {
  const s = status.toUpperCase();
  if (["AMAN"].includes(s)) return "aman";
  if (["LOW_STOCK", "PERLU_PERHATIAN", "RENDAH"].includes(s)) return "rendah";
  if (["KRITIS", "KOSONG", "OVER_STOCK"].includes(s)) return "kritis";
  if (["PENDING"].includes(s)) return "pending";
  if (["APPROVED"].includes(s)) return "aman";
  if (["REJECTED", "REVISION"].includes(s)) return "kritis";
  return "pending";
}

export function StatusBadge({ status }: { status: string }) {
  const variant = getVariant(status);
  const label = labelMap[status] ?? status;
  return <span className={`dash-status-badge dash-status-${variant}`}>{label}</span>;
}
