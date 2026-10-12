"use client";

import { useState, useEffect } from "react";
import { Report, ReportCreateInput } from "@/types";
import { X } from "lucide-react";

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
  const [reportDate, setReportDate] = useState("");
  const [timeSlot, setTimeSlot] = useState<"오전" | "오후">("오전");
  const [titleBody, setTitleBody] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [withSample, setWithSample] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData && mode === "edit") {
      const prefixMatch = initialData.title.match(/^\[(\d{4}-\d{2}-\d{2})\]\[(오전|오후)\]\s*(.*)$/);
      if (prefixMatch) {
        setReportDate(prefixMatch[1]);
        setTimeSlot(prefixMatch[2] as "오전" | "오후");
        setTitleBody(prefixMatch[3]);
      } else {
        setReportDate(initialData.report_date || new Date().toISOString().split("T")[0]);
        setTitleBody(initialData.title);
        const hour = new Date().getHours();
        setTimeSlot(hour < 12 ? "오전" : "오후");
      }
      setStatus(initialData.status);
    } else {
      const today = new Date().toISOString().split("T")[0];
      setReportDate(today);
      const hour = new Date().getHours();
      setTimeSlot(hour < 12 ? "오전" : "오후");
      setTitleBody("인프라 정기 점검");
      setStatus("DRAFT");
      setWithSample(true);
    }
    setError(null);
  }, [initialData, mode, isOpen]);

  if (!isOpen) return null;

  const fullTitle = `[${reportDate}][${timeSlot}] ${titleBody.trim() || "인프라 정기 점검"}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleBody.trim()) {
      setError("일지 제목을 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        title: fullTitle,
        report_date: reportDate || undefined,
        status,
        with_sample: mode === "create" ? withSample : undefined,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#11141a] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
          <h2 className="text-sm font-semibold text-white">
            {mode === "create" ? "새 운영 일지" : "일지 정보 수정"}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="px-3 py-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg">
              {error}
            </div>
          )}

          {/* 1. 운영 일자 & 오전/오후 구분 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                운영 일자
              </label>
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="w-full px-3 py-2 bg-[#0c0e14] border border-white/10 rounded-lg text-white text-xs font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                구분
              </label>
              <div className="flex bg-[#0c0e14] p-0.5 rounded-lg border border-white/10 h-[34px]">
                <button
                  type="button"
                  onClick={() => setTimeSlot("오전")}
                  className={`flex-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    timeSlot === "오전"
                      ? "bg-white/[0.12] text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  오전
                </button>
                <button
                  type="button"
                  onClick={() => setTimeSlot("오후")}
                  className={`flex-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    timeSlot === "오후"
                      ? "bg-white/[0.12] text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  오후
                </button>
              </div>
            </div>
          </div>

          {/* 2. 일지 제목 (접두어 결합형 인풋) */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              일지 제목
            </label>
            <div className="flex items-center rounded-lg border border-white/10 bg-[#0c0e14] focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/30 transition-all">
              <span className="pl-3 pr-1 text-xs font-mono font-medium text-slate-500 select-none">
                [{reportDate}][{timeSlot}]
              </span>
              <input
                type="text"
                value={titleBody}
                onChange={(e) => setTitleBody(e.target.value)}
                placeholder="인프라 정기 점검"
                className="flex-1 py-2 pr-3 bg-transparent text-xs text-white placeholder-slate-600 focus:outline-none"
                autoFocus
              />
            </div>
          </div>

          {/* 3. 초기 항목 구성 (템플릿 vs 빈 일지) */}
          {mode === "create" && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                초기 항목
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setWithSample(true)}
                  className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                    withSample
                      ? "bg-white/[0.08] border-white/25 text-white"
                      : "bg-[#0c0e14] border-white/[0.06] text-slate-400 hover:text-slate-300 hover:border-white/10"
                  }`}
                >
                  <div className="text-xs font-medium text-slate-200">기본 템플릿 포함</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">표준 점검 항목 자동 생성</div>
                </button>

                <button
                  type="button"
                  onClick={() => setWithSample(false)}
                  className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                    !withSample
                      ? "bg-white/[0.08] border-white/25 text-white"
                      : "bg-[#0c0e14] border-white/[0.06] text-slate-400 hover:text-slate-300 hover:border-white/10"
                  }`}
                >
                  <div className="text-xs font-medium text-slate-200">빈 일지로 시작</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">항목 없이 직접 작성</div>
                </button>
              </div>
            </div>
          )}

          {/* 4. 수정 모드일 때만 진행 상태 변경 옵션 제공 */}
          {mode === "edit" && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                진행 상태
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "DRAFT", label: "작성 중" },
                  { id: "COMPLETED", label: "점검 완료" },
                  { id: "ARCHIVED", label: "보관" },
                ].map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setStatus(item.id)}
                    className={`py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                      status === item.id
                        ? "bg-white/[0.12] border-white/25 text-white"
                        : "bg-[#0c0e14] border-white/[0.06] text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.08]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-3.5 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition-colors cursor-pointer shadow-sm"
            >
              {mode === "create" ? "일지 생성" : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
