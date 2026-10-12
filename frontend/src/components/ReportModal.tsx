"use client";

import { useState, useEffect } from "react";
import { Report, ReportCreateInput } from "@/types";
import { X, Calendar, User, FileText, CheckCircle2 } from "lucide-react";

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ReportCreateInput) => Promise<void>;
  initialData?: Report | null;
  mode: "create" | "edit";
}

export function ReportModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  mode,
}: ReportModalProps) {
  const [title, setTitle] = useState("");
  const [reportDate, setReportDate] = useState("");
  const [author, setAuthor] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData && mode === "edit") {
      setTitle(initialData.title);
      setReportDate(initialData.report_date);
      setAuthor(initialData.author || "");
      setStatus(initialData.status);
    } else {
      setTitle("");
      setReportDate(new Date().toISOString().split("T")[0]);
      setAuthor("");
      setStatus("DRAFT");
    }
    setError(null);
  }, [initialData, mode, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("일지 제목을 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        title: title.trim(),
        report_date: reportDate || undefined,
        author: author.trim() || undefined,
        status,
      });
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("작업 중 오류가 발생했습니다.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[#12151b] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-white/[0.08] bg-[#161a22]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                {mode === "create" ? "새 운영 일지 작성" : "운영 일지 정보 수정"}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4.5">
          {error && (
            <div className="p-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              일지 제목 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 2026-10-12 정기 서버 점검 및 장애 조치 일지"
              className="w-full px-3.5 py-2.5 bg-[#0a0d13] border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs sm:text-sm transition-all"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                운영 일자
              </label>
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#0a0d13] border border-white/10 rounded-xl text-white text-xs sm:text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                작성자
              </label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="예: 최운영"
                className="w-full px-3.5 py-2.5 bg-[#0a0d13] border border-white/10 rounded-xl text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              진행 상태
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "DRAFT", label: "작성 중", color: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
                { id: "COMPLETED", label: "점검 완료", color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
                { id: "ARCHIVED", label: "보관됨", color: "text-slate-400 border-slate-500/30 bg-slate-500/10" },
              ].map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setStatus(item.id)}
                  className={`py-2 px-2.5 text-xs font-medium rounded-xl border transition-all text-center cursor-pointer ${
                    status === item.id
                      ? `${item.color} font-semibold ring-1 ring-offset-0`
                      : "border-white/5 bg-[#0a0d13] text-slate-400 hover:text-white"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end space-x-2 pt-4 border-t border-white/[0.08]">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] rounded-lg transition-colors cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition-colors cursor-pointer shadow-sm"
            >
              <span>{mode === "create" ? "일지 생성" : "변경사항 저장"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
