"use client";

import { useEffect } from "react";
import { Button } from "./Button";
import { useI18n } from "@/contexts/I18nContext";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Modal({ open, title, onClose, children, footer }: ModalProps) {
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-lg bg-surface-high rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col border border-rim">
        <div className="flex items-center justify-between px-5 py-4 border-b border-rim">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-ink-subtle hover:bg-surface hover:text-ink-dim"
            aria-label={t.components.closeBtn}
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 flex-1">{children}</div>
        {footer && (
          <div className="px-5 py-4 border-t border-rim flex justify-end gap-2">{footer}</div>
        )}
      </div>
    </div>
  );
}

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
  danger?: boolean;
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
  danger,
}: ConfirmModalProps) {
  const { t } = useI18n();
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t.components.cancelBtn}
          </Button>
          <Button variant={danger ? "danger" : "primary"} size="sm" onClick={onConfirm}>
            {confirmLabel ?? t.components.confirmBtn}
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-dim">{message}</p>
    </Modal>
  );
}
