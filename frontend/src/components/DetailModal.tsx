"use client";

import { useState, useEffect } from "react";
import { ReportDetailCreateInput } from "@/types";
import { X, CornerDownRight, Plus, Image as ImageIcon } from "lucide-react";

interface DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ReportDetailCreateInput) => Promise<void>;
  parentId: number | null;
  parentTitle?: string;
  isSibling?: boolean;
}

export function DetailModal({
  isOpen,
  onClose,
  onSubmit,
  parentId,
  parentTitle,
  isSibling = false,
}: DetailModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTitle("");
    setDescription("");
    setContent("");
    setImageUrl("");
    setError(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("항목 제목을 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        content: content.trim() || undefined,
        image_url: imageUrl.trim() || undefined,
        parent_id: parentId,
      });
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("항목 생성에 실패했습니다.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-xl bg-[#0f1422] border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.08] bg-[#141a2c]">
          <div>
            <h2 className="text-sm font-semibold text-white">
              {isSibling
                ? parentId
                  ? "동일 레벨 항목 추가"
                  : "최상위 항목 추가"
                : parentId
                  ? "하위 항목 추가"
                  : "최상위 항목 추가"}
            </h2>
            {parentId && parentTitle && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                {isSibling ? (
                  <>
                    <span>소속 그룹:</span>
                    <span className="text-slate-300 truncate max-w-[240px] font-medium">
                      {parentTitle}
                    </span>
                  </>
                ) : (
                  <>
                    <CornerDownRight className="w-3 h-3 text-blue-400" />
                    <span>상위 항목:</span>
                    <span className="text-slate-300 truncate max-w-[240px] font-medium">
                      {parentTitle}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-3.5 flex-1 text-xs">
          {error && (
            <div className="p-2.5 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-slate-400 font-medium mb-1">
              항목 제목 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 서버 CPU/메모리 부하 점검"
              className="w-full px-3 py-2 bg-[#090d16] border border-white/10 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">
              이미지 URL (선택)
            </label>
            <div className="relative">
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://... 또는 /images/... (모니터링 그래프/스크린샷)"
                className="w-full px-3 py-2 pl-8 bg-[#090d16] border border-white/10 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors font-mono"
              />
              <ImageIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">
              요약 설명 (Description)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="예: 피크 타임 사용률 78% 기록 및 스케일아웃 조치"
              className="w-full px-3 py-2 bg-[#090d16] border border-white/10 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">
              상세 본문 (Content / Markdown)
            </label>
            <textarea
              rows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="상세 작업 내역, 분석 결과, 조치 커맨드 등을 작성하세요..."
              className="w-full px-3 py-2 bg-[#090d16] border border-white/10 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono leading-relaxed"
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-white/[0.08]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 font-medium text-slate-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] rounded-lg transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
            >
              항목 추가
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
