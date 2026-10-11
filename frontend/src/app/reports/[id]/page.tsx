"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Report,
  ReportDetail,
  ReportDetailNode,
  ReportDetailCreateInput,
  ReportDetailUpdateInput,
} from "@/types";
import { api } from "@/lib/api";
import { TreeNode } from "@/components/TreeNode";
import { ConfirmModal } from "@/components/ConfirmModal";
import {
  ArrowLeft,
  Calendar,
  User,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  FolderPlus,
  FileText,
  Layers,
  Image as ImageIcon,
  Activity,
  X,
  Maximize2,
  Save,
  CornerDownRight,
} from "lucide-react";

export default function ReportDetailPage() {
  const router = useRouter();
  const routeParams = useParams();
  const rawId = Array.isArray(routeParams.id) ? routeParams.id[0] : routeParams.id;
  const reportId = parseInt(rawId || "0", 10);

  const [report, setReport] = useState<Report | null>(null);
  const [treeData, setTreeData] = useState<ReportDetailNode[]>([]);
  const [activeSectionId, setActiveSectionId] = useState<number | null>(null);

  // In-place inline panel edit state (No modal!)
  const [editingNodeId, setEditingNodeId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<{
    title: string;
    description: string;
    content: string;
    image_url: string;
  }>({ title: "", description: "", content: "", image_url: "" });
  const [isSaving, setIsSaving] = useState(false);

  // Expanded state map for tree outline
  const [expandedMap, setExpandedMap] = useState<Record<number, boolean>>({});

  // Loading & error
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Delete modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [nodeToDelete, setNodeToDelete] = useState<ReportDetailNode | null>(null);

  // Image Lightbox state
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [lightboxTitle, setLightboxTitle] = useState<string>("");

  // Load report and tree data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [reportRes, treeRes] = await Promise.all([
        api.getReport(reportId),
        api.getDetailsTree(reportId),
      ]);
      setReport(reportRes);
      setTreeData(treeRes);

      // Expand all by default
      const map: Record<number, boolean> = {};
      const traverse = (nodes: ReportDetailNode[]) => {
        for (const n of nodes) {
          map[n.id] = true;
          if (n.children && n.children.length > 0) traverse(n.children);
        }
      };
      traverse(treeRes);
      setExpandedMap((prev) => ({ ...map, ...prev }));

      if (treeRes.length > 0 && activeSectionId === null) {
        setActiveSectionId(treeRes[0].id);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("데이터를 불러오지 못했습니다.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [reportId, activeSectionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ScrollSpy: Observe sections against viewport as user scrolls up/down
  useEffect(() => {
    if (treeData.length === 0) return;

    const sectionElements = document.querySelectorAll("[id^='section-']");
    if (sectionElements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries.filter((e) => e.isIntersecting);
        if (visibleEntries.length > 0) {
          visibleEntries.sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top
          );
          const topVisible = visibleEntries[0];
          const id = parseInt(topVisible.target.id.replace("section-", ""), 10);
          if (!isNaN(id)) {
            setActiveSectionId(id);
          }
        }
      },
      {
        root: null, // Viewport tracking
        rootMargin: "-70px 0px -60% 0px", // Active when near upper part of screen
        threshold: [0, 0.1, 0.4],
      }
    );

    sectionElements.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
    };
  }, [treeData]);

  // Toggle expand in tree outline
  const toggleExpand = (id: number) => {
    setExpandedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = (expand: boolean) => {
    const map: Record<number, boolean> = {};
    const traverse = (nodes: ReportDetailNode[]) => {
      for (const n of nodes) {
        map[n.id] = expand;
        if (n.children) traverse(n.children);
      }
    };
    traverse(treeData);
    setExpandedMap(map);
  };

  // Scroll to section when node clicked in outline
  const handleSelectNode = (node: ReportDetailNode) => {
    setActiveSectionId(node.id);
    const element = document.getElementById(`section-${node.id}`);
    if (element) {
      const topOffset = 85;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - topOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });

      element.classList.remove("section-highlight");
      void element.offsetWidth; // trigger reflow
      element.classList.add("section-highlight");
    }
  };

  // Direct Add without Modal: creates item immediately and activates inline editing panel
  const handleDirectAdd = async (parentId: number | null, defaultTitle: string = "새 운영 항목") => {
    try {
      const newDetail = await api.createDetail(reportId, {
        title: defaultTitle,
        parent_id: parentId,
      });

      // Reload tree so new node is present
      const [reportRes, treeRes] = await Promise.all([
        api.getReport(reportId),
        api.getDetailsTree(reportId),
      ]);
      setReport(reportRes);
      setTreeData(treeRes);

      // If parent exists, make sure parent is expanded in tree
      if (parentId) {
        setExpandedMap((prev) => ({ ...prev, [parentId]: true }));
      }

      // Immediately activate inline editing on the newly created node
      setEditingNodeId(newDetail.id);
      setEditFormData({
        title: newDetail.title,
        description: "",
        content: "",
        image_url: "",
      });
      setActiveSectionId(newDetail.id);

      // Smooth scroll to the newly created section and auto-focus title
      setTimeout(() => {
        const el = document.getElementById(`section-${newDetail.id}`);
        if (el) {
          const topOffset = 85;
          const elementPosition = el.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - topOffset;
          window.scrollTo({
            top: offsetPosition,
            behavior: "smooth",
          });
          const input = el.querySelector<HTMLInputElement>("input[type='text']");
          if (input) {
            input.focus();
            input.select();
          }
        }
      }, 100);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "항목 생성에 실패했습니다.");
    }
  };

  // Start in-place panel editing
  const handleStartEdit = (node: ReportDetailNode) => {
    setEditingNodeId(node.id);
    setEditFormData({
      title: node.title,
      description: node.description || "",
      content: node.content || "",
      image_url: node.image_url || "",
    });
  };

  // Cancel in-place panel editing
  const handleCancelEdit = () => {
    setEditingNodeId(null);
  };

  // Save in-place panel editing directly in panel
  const handleSaveInlineEdit = async (detailId: number) => {
    if (!editFormData.title.trim()) {
      alert("항목 제목을 입력해주세요.");
      return;
    }
    setIsSaving(true);
    try {
      await api.updateDetail(reportId, detailId, {
        title: editFormData.title.trim(),
        description: editFormData.description.trim() || undefined,
        content: editFormData.content.trim() || undefined,
        image_url: editFormData.image_url.trim() || undefined,
      });
      setEditingNodeId(null);
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete
  const handleDeleteNodeConfirm = async () => {
    if (!nodeToDelete) return;
    await api.deleteDetail(reportId, nodeToDelete.id);
    if (activeSectionId === nodeToDelete.id) {
      setActiveSectionId(null);
    }
    await loadData();
  };

  return (
    <div className="min-h-full flex flex-col bg-[#090d16]">
      {/* Sticky Top Breadcrumb & Status Header */}
      <div className="sticky top-13 z-30 flex items-center justify-between px-6 py-2.5 border-b border-white/[0.08] bg-[#0c101b]/95 backdrop-blur-md">
        <div className="flex items-center space-x-3 min-w-0">
          <Link
            href="/reports"
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] rounded-md transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>목록</span>
          </Link>

          <span className="text-slate-600 text-xs">/</span>

          <div className="flex items-center gap-2.5 min-w-0">
            <h1 className="text-sm font-semibold text-white tracking-tight truncate">
              {report?.title || "운영 일지"}
            </h1>
            {report && (
              <span className="text-[11px] px-2 py-0.5 rounded font-mono font-medium bg-white/[0.06] text-slate-300 border border-white/[0.08]">
                {report.status}
              </span>
            )}
          </div>

          <div className="hidden md:flex items-center gap-3 text-xs text-slate-400 pl-2">
            <span className="flex items-center gap-1 text-[11px]">
              <Calendar className="w-3 h-3 text-slate-500" />
              {report?.report_date}
            </span>
            <span className="flex items-center gap-1 text-[11px]">
              <User className="w-3 h-3 text-slate-500" />
              {report?.author || "미지정"}
            </span>
          </div>
        </div>

        {/* Top Actions */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleDirectAdd(null, "새 최상위 항목")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-md transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>최상위 항목 추가</span>
          </button>

          <button
            onClick={() => loadData()}
            className="p-1.5 text-slate-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-md transition-colors"
            title="새로고침"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Main Content Area: Sticky Compact Outline Widget + Wide Document Feed */}
      <div className="flex-1 flex items-start gap-6 px-6 lg:px-8 py-6 w-full max-w-[1920px] mx-auto">
        {/* Left Sticky Outline Widget:
            - 딱 계층 사이즈(내용 높이)만큼만 차지하는 컴팩트 박스
            - 스크롤을 내려도 sticky top-24 로 항상 뷰포트를 따라 내려옴 */}
        <aside className="sticky top-24 w-64 md:w-72 flex-shrink-0 z-20 hidden md:block">
          <div className="rounded-lg border border-white/[0.08] bg-[#0c101b] p-3 shadow-xl backdrop-blur-md max-h-[calc(100vh-7rem)] flex flex-col">
            <div className="px-1 py-1 pb-2 mb-1.5 border-b border-white/[0.06] flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-1.5 font-medium text-slate-300">
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                <span>계층 아웃라인</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => expandAll(true)}
                  className="text-[11px] text-slate-400 hover:text-white px-1 py-0.5 rounded hover:bg-white/[0.04]"
                >
                  펼치기
                </button>
                <button
                  onClick={() => expandAll(false)}
                  className="text-[11px] text-slate-400 hover:text-white px-1 py-0.5 rounded hover:bg-white/[0.04]"
                >
                  접기
                </button>
              </div>
            </div>

            {/* Tree nodes list - compact height fitting content */}
            <div className="overflow-y-auto space-y-0.5 pr-1 max-h-[calc(100vh-10.5rem)]">
              {treeData.length === 0 ? (
                <div className="text-center py-6 px-2">
                  <FolderPlus className="mx-auto w-6 h-6 text-slate-600 mb-1" />
                  <p className="text-[11px] text-slate-400">항목이 없습니다</p>
                </div>
              ) : (
                treeData.map((node) => (
                  <TreeNode
                    key={node.id}
                    node={node}
                    activeId={activeSectionId}
                    onSelect={handleSelectNode}
                    onAddChild={(parentId) => handleDirectAdd(parentId, "새 하위 항목")}
                    onAddSibling={(parentId) => handleDirectAdd(parentId, "새 운영 항목")}
                    onDelete={(n) => {
                      setNodeToDelete(n);
                      setIsDeleteModalOpen(true);
                    }}
                    depth={0}
                    expandedMap={expandedMap}
                    toggleExpand={toggleExpand}
                  />
                ))
              )}
            </div>
          </div>
        </aside>

        {/* Right Pane: Wide Document Rows Feed */}
        <main className="flex-1 min-w-0 space-y-4">
          {/* Document Feed Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                운영 상세 기록 (통합 뷰)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                계층별 항목의 제목, 이미지, 설명이 가로로 넓게 정렬되며, Depth가 깊어질수록 카드 앞쪽이 단계별로 들여쓰기됩니다.
              </p>
            </div>

            <div className="hidden xl:flex items-center text-xs font-mono text-slate-400 space-x-6 pr-2">
              <span>[항목 제목 / 액션]</span>
              <span>[모니터링 이미지]</span>
              <span>[설명 및 조치 내역]</span>
            </div>
          </div>

          {/* List of Wide Detail Rows with Depth Indentation */}
          {treeData.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-white/[0.08] rounded-xl">
              <FileText className="mx-auto w-10 h-10 text-slate-600 mb-2" />
              <h3 className="text-sm font-medium text-slate-300">작성된 운영 항목이 없습니다</h3>
              <p className="text-xs text-slate-500 mt-1">
                좌측 아웃라인 또는 상단 버튼을 눌러 첫 항목을 추가해보세요.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {treeData.map((rootNode) => (
                <WideDocumentRow
                  key={rootNode.id}
                  node={rootNode}
                  depth={0}
                  editingNodeId={editingNodeId}
                  editFormData={editFormData}
                  onChangeEditForm={(field, value) =>
                    setEditFormData((prev) => ({ ...prev, [field]: value }))
                  }
                  onStartEdit={handleStartEdit}
                  onSaveEdit={handleSaveInlineEdit}
                  onCancelEdit={handleCancelEdit}
                  isSaving={isSaving}
                  onAddChild={(parentId) => handleDirectAdd(parentId, "새 하위 항목")}
                  onAddSibling={(parentId) => handleDirectAdd(parentId, "새 운영 항목")}
                  onOpenDelete={(n) => {
                    setNodeToDelete(n);
                    setIsDeleteModalOpen(true);
                  }}
                  onOpenLightbox={(url, title) => {
                    setLightboxImageUrl(url);
                    setLightboxTitle(title);
                  }}
                />
              ))}
            </div>
          )}
        </main>
      </div>



      {/* Modal: Confirm Delete */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteNodeConfirm}
        title="세부 항목 삭제"
        description={`"${nodeToDelete?.title}" 항목과 포함된 하위 트리 노드가 영구적으로 삭제됩니다.`}
        confirmLabel="항목 일괄 삭제"
        isDanger={true}
      />

      {/* Image Lightbox Modal */}
      {lightboxImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          onClick={() => setLightboxImageUrl(null)}
        >
          <div
            className="relative max-w-5xl max-h-[90vh] bg-[#0f1422] border border-white/10 rounded-xl overflow-hidden p-2 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 mb-2">
              <span className="text-xs font-medium text-slate-200">
                {lightboxTitle}
              </span>
              <button
                onClick={() => setLightboxImageUrl(null)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxImageUrl}
              alt={lightboxTitle}
              className="max-h-[80vh] w-auto object-contain rounded"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// Wide Document Row (제목 | 이미지 | 설명)
// Depth에 따른 박스 앞쪽 들여쓰기 및 인라인 직접 수정 지원!
// ==========================================
interface WideDocumentRowProps {
  node: ReportDetailNode;
  depth: number;
  editingNodeId: number | null;
  editFormData: {
    title: string;
    description: string;
    content: string;
    image_url: string;
  };
  onChangeEditForm: (field: string, value: string) => void;
  onStartEdit: (node: ReportDetailNode) => void;
  onSaveEdit: (detailId: number) => Promise<void>;
  onCancelEdit: () => void;
  isSaving: boolean;
  onAddChild: (parentId: number) => void;
  onAddSibling: (parentId: number | null) => void;
  onOpenDelete: (node: ReportDetailNode) => void;
  onOpenLightbox: (url: string, title: string) => void;
}

function WideDocumentRow({
  node,
  depth,
  editingNodeId,
  editFormData,
  onChangeEditForm,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  isSaving,
  onAddChild,
  onAddSibling,
  onOpenDelete,
  onOpenLightbox,
}: WideDocumentRowProps) {
  const isEditing = editingNodeId === node.id;
  const indentPixels = Math.min(depth * 32, 160);

  return (
    <div className="relative space-y-3">
      {/* Current Node Wide Block: [제목 | 이미지 | 설명] */}
      <div
        id={`section-${node.id}`}
        style={{ marginLeft: `${indentPixels}px` }}
        className={`group relative rounded-lg border transition-all scroll-mt-24 p-4 ${
          isEditing
            ? "border-blue-500/60 bg-[#0e1628] shadow-lg shadow-blue-500/10"
            : "border-white/[0.08] bg-[#0d121f] hover:border-white/[0.16]"
        }`}
      >
        {/* Depth tree guide branch line */}
        {depth > 0 && (
          <div
            className="absolute -left-5 top-5 w-5 h-4 border-l-2 border-b-2 border-white/10 rounded-bl-md pointer-events-none"
            aria-hidden="true"
          />
        )}

        {isEditing ? (
          /* ========================================= */
          /* 1. IN-PLACE INLINE EDITING PANEL (NO MODAL) */
          /* ========================================= */
          <div className="flex flex-col lg:flex-row gap-5 items-start text-xs">
            {/* Edit Column 1: Title & Controls */}
            <div className="w-full lg:w-72 flex-shrink-0 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  편집 중
                </span>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">
                  제목 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={editFormData.title}
                  onChange={(e) => onChangeEditForm("title", e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#080c14] border border-blue-500/40 rounded-md text-white text-xs font-semibold focus:outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onSaveEdit(node.id)}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-md font-medium transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? "저장 중..." : "저장"}</span>
                </button>
                <button
                  type="button"
                  onClick={onCancelEdit}
                  className="px-2.5 py-1.5 bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 rounded-md transition-colors"
                >
                  취소
                </button>
              </div>
            </div>

            {/* Edit Column 2: Image URL & Preview */}
            <div className="w-full lg:w-[400px] flex-shrink-0 space-y-2">
              <label className="block text-slate-400 font-medium">
                이미지 URL (선택)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={editFormData.image_url}
                  onChange={(e) => onChangeEditForm("image_url", e.target.value)}
                  placeholder="https://... 또는 /images/..."
                  className="w-full px-2.5 py-1.5 pl-7 bg-[#080c14] border border-white/[0.1] rounded-md text-white text-xs placeholder-slate-600 font-mono focus:outline-none focus:border-blue-500"
                />
                <ImageIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              </div>

              {/* Real-time Image preview */}
              <div className="relative rounded-md border border-white/[0.08] bg-[#080c14] aspect-video flex items-center justify-center overflow-hidden">
                {editFormData.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={editFormData.image_url}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="text-center p-3 text-slate-500">
                    <ImageIcon className="mx-auto w-6 h-6 mb-1 opacity-50" />
                    <span>이미지 URL을 입력하면 실시간 미리보기가 표시됩니다</span>
                  </div>
                )}
              </div>
            </div>

            {/* Edit Column 3: Description & Content */}
            <div className="flex-1 w-full min-w-0 space-y-2.5">
              <div>
                <label className="block text-slate-400 font-medium mb-1">
                  요약 설명 (Description)
                </label>
                <input
                  type="text"
                  value={editFormData.description}
                  onChange={(e) => onChangeEditForm("description", e.target.value)}
                  placeholder="요약 설명 입력..."
                  className="w-full px-3 py-1.5 bg-[#080c14] border border-white/[0.1] rounded-md text-white text-xs placeholder-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">
                  상세 본문 (Content / Markdown)
                </label>
                <textarea
                  rows={6}
                  value={editFormData.content}
                  onChange={(e) => onChangeEditForm("content", e.target.value)}
                  placeholder="상세 작업 내용, 로그, 지표 등을 작성..."
                  className="w-full px-3 py-2 bg-[#080c14] border border-white/[0.1] rounded-md text-white text-xs placeholder-slate-600 font-mono leading-relaxed focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        ) : (
          /* ========================================= */
          /* 2. REGULAR VIEW (제목 | 이미지 | 설명)    */
          /* ========================================= */
          <div className="flex flex-col lg:flex-row gap-5 items-start">
            {/* Column 1: 제목 영역 (Width: 260px ~ 320px) */}
            <div className="w-full lg:w-72 flex-shrink-0">
              <h3 className="text-sm sm:text-base font-semibold text-white leading-snug">
                {node.title}
              </h3>

              {/* Compact Icon-only toolbar: [✏️ 수정] [➕ 동일 레벨 추가] [↳ 하위 추가] [🗑️ 삭제] */}
              <div className="mt-2.5 flex items-center gap-1 text-slate-400">
                <button
                  type="button"
                  onClick={() => onStartEdit(node)}
                  className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer border border-white/[0.06]"
                  title="수정"
                  aria-label="수정"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onAddSibling(node.parent_id)}
                  className="p-1.5 rounded-md text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-colors cursor-pointer border border-white/[0.06]"
                  title="동일 레벨 항목 추가"
                  aria-label="동일 레벨 항목 추가"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onAddChild(node.id)}
                  className="p-1.5 rounded-md text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/30 transition-colors cursor-pointer border border-white/[0.06]"
                  title="하위 항목 추가"
                  aria-label="하위 항목 추가"
                >
                  <CornerDownRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onOpenDelete(node)}
                  className="p-1.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-colors cursor-pointer border border-white/[0.06]"
                  title="삭제"
                  aria-label="삭제"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Column 2: 이미지 영역 (Width: 380px ~ 440px) */}
            <div className="w-full lg:w-[400px] flex-shrink-0">
              {node.image_url ? (
                <div
                  className="relative rounded-lg border border-white/[0.08] bg-[#090d16] overflow-hidden group/img cursor-pointer aspect-video flex items-center justify-center"
                  onClick={() => onOpenLightbox(node.image_url!, node.title)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={node.image_url}
                    alt={node.title}
                    className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-200"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2 text-xs text-white font-medium">
                    <Maximize2 className="w-4 h-4" />
                    <span>확대 보기</span>
                  </div>
                </div>
              ) : (
                /* Simulated / Placeholder Monitoring Graphic (이미지가 있다는 가정) */
                <div
                  className="relative rounded-lg border border-white/[0.08] bg-[#080c14] p-3 aspect-video flex flex-col justify-between overflow-hidden group/placeholder cursor-pointer"
                  onClick={() => onStartEdit(node)}
                  title="클릭하여 이미지 등록/수정"
                >
                  {/* Simulated Chart Header */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-white/[0.06] pb-2">
                    <div className="flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="font-mono text-slate-300">
                        METRIC: {node.title.slice(0, 18)}
                      </span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 font-mono">
                      STATUS: OK
                    </span>
                  </div>

                  {/* Simulated Wave SVG Graphic */}
                  <div className="py-1 flex-1 flex items-center">
                    <svg
                      className="w-full h-14 text-blue-500/60"
                      viewBox="0 0 300 60"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path
                        d="M0 40 Q 30 20, 60 35 T 120 25 T 180 45 T 240 15 T 300 30"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      <path
                        d="M0 40 Q 30 20, 60 35 T 120 25 T 180 45 T 240 15 T 300 30 L 300 60 L 0 60 Z"
                        fill="currentColor"
                        fillOpacity="0.08"
                      />
                    </svg>
                  </div>

                  {/* Simulated Chart Footer Metrics */}
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-white/[0.04]">
                    <span>CPU: 38.2%</span>
                    <span>MEM: 4.1GB</span>
                    <span className="text-blue-400 hover:underline flex items-center gap-0.5">
                      <ImageIcon className="w-2.5 h-2.5" /> 이미지 등록
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Column 3: 설명 및 상세 본문 영역 (Flex-1 / 나머지 너비) */}
            <div className="flex-1 w-full min-w-0 space-y-2.5">
              {/* Description 요약 박스 */}
              {node.description ? (
                <div className="px-3 py-2 rounded-md bg-white/[0.03] border border-white/[0.06] text-xs text-slate-300 font-medium">
                  <span className="text-slate-400 font-normal mr-1.5">[요약]</span>
                  {node.description}
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic">
                  요약 설명이 없습니다.
                </div>
              )}

              {/* Content 상세 마크다운/로그 박스 */}
              {node.content ? (
                <div className="p-3 rounded-lg bg-[#080c14] border border-white/[0.06] text-xs text-slate-200 font-mono leading-relaxed whitespace-pre-wrap max-h-56 overflow-y-auto">
                  {node.content}
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-[#080c14]/50 border border-dashed border-white/[0.06] text-xs text-slate-400 flex items-center justify-between">
                  <span>상세 본문(Content) 내용이 비어있습니다.</span>
                  <button
                    onClick={() => onStartEdit(node)}
                    className="text-blue-400 hover:text-blue-300 font-sans font-medium cursor-pointer"
                  >
                    + 본문 작성
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Recursive Children Rows with depth + 1 */}
      {node.children && node.children.length > 0 && (
        <div className="space-y-3">
          {node.children.map((child) => (
            <WideDocumentRow
              key={child.id}
              node={child}
              depth={depth + 1}
              editingNodeId={editingNodeId}
              editFormData={editFormData}
              onChangeEditForm={onChangeEditForm}
              onStartEdit={onStartEdit}
              onSaveEdit={onSaveEdit}
              onCancelEdit={onCancelEdit}
              isSaving={isSaving}
              onAddChild={onAddChild}
              onAddSibling={onAddSibling}
              onOpenDelete={onOpenDelete}
              onOpenLightbox={onOpenLightbox}
            />
          ))}
        </div>
      )}
    </div>
  );
}
