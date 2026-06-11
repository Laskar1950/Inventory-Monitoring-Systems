"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function ViewportModal({ children, backdropClassName = "modal-backdrop" }: { children: React.ReactNode; backdropClassName?: string }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mounted]);

  if (!mounted) return null;

  return createPortal(
    <div className={backdropClassName}>{children}</div>,
    document.body
  );
}
