"use client";

import { AlertTriangle, X } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title: string;
  description: string;
  confirmLabel?: string;
  isDanger?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "삭제",
  isDanger = true,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-[#111625] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-6">
          <div className="flex items-start space-x-4">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                isDanger
                  ? "bg-red-500/10 border border-red-500/20 text-red-400"
                  : "bg-indigo-500/10 border border-indigo-500/20 text-indigo-400"
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-white">{title}</h3>
              <p className="mt-1 text-sm text-slate-400 leading-relaxed">
                {description}
              </p>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] rounded-md transition-colors"
            >
              취소
            </button>
            <button
              type="button"
              onClick={async () => {
                await onConfirm();
                onClose();
              }}
              className={`px-3.5 py-1.5 text-xs font-medium text-white rounded-md transition-colors ${
                isDanger
                  ? "bg-red-600 hover:bg-red-500"
                  : "bg-blue-600 hover:bg-blue-500"
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
