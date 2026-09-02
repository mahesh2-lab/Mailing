"use client";

import { AlertTriangle, X } from "lucide-react";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  isDestructive = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <div className="modal-header-title">
            {isDestructive && <AlertTriangle className="destructive-icon" />}
            <h3>{title}</h3>
          </div>
          <button className="icon-button small" onClick={onCancel} aria-label="Close dialog">
            <X />
          </button>
        </div>
        <p className="modal-body">{description}</p>
        <div className="modal-actions">
          <button className="button-secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            className={isDestructive ? "button-destructive" : "button-primary"}
            onClick={() => {
              onConfirm();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
