"use client";

import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "primary" | "danger";
  loading?: boolean;
  icon?: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Ya, lanjutkan",
  cancelLabel = "Batal",
  variant = "primary",
  loading = false,
  icon,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  if (!open) return null;
  const confirmClass = variant === "danger" ? "btn-danger" : "btn-primary";

  return <div className="modal-backdrop">
    <div className="confirm-modal">
      <div className="confirm-icon">{icon ?? <AlertTriangle size={24} />}</div>
      <h3>{title}</h3>
      <p>{message}</p>
      <div className="confirm-actions">
        <button className="btn-ghost" type="button" onClick={onCancel} disabled={loading}>{cancelLabel}</button>
        <button className={confirmClass} type="button" onClick={onConfirm} disabled={loading}>{loading ? "Memproses..." : confirmLabel}</button>
      </div>
    </div>
  </div>;
}
