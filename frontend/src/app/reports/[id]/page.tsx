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
  ArrowRight,
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
  CheckCircle2,
  Clock,
  Terminal,
  Server,
  Database,
  UploadCloud,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  GripVertical,
  SlidersHorizontal,
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

  // Drag and drop & Position Reorder State
  const [draggedNodeId, setDraggedNodeId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    targetId: number;
    position: "before" | "after" | "inside";
  } | null>(null);

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
        root: null,
        rootMargin: "-80px 0px -60% 0px",
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
      const topOffset = 90;
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

      if (parentId) {
        setExpandedMap((prev) => ({ ...prev, [parentId]: true }));
      }

      setEditingNodeId(newDetail.id);
      setEditFormData({
        title: newDetail.title,
        description: "",
        content: "",
        image_url: "",
      });
      setActiveSectionId(newDetail.id);

      setTimeout(() => {
        const el = document.getElementById(`section-${newDetail.id}`);
        if (el) {
          const topOffset = 90;
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

  // Helper to find node, its parent, siblings list, and index in treeData
  const findNodeInfo = useCallback(
    (
      nodes: ReportDetailNode[],
      targetId: number,
      parent: ReportDetailNode | null = null
    ): {
      node: ReportDetailNode;
      parent: ReportDetailNode | null;
      siblings: ReportDetailNode[];
      index: number;
    } | null => {
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].id === targetId) {
          return { node: nodes[i], parent, siblings: nodes, index: i };
        }
        if (nodes[i].children && nodes[i].children.length > 0) {
          const found = findNodeInfo(nodes[i].children, targetId, nodes[i]);
          if (found) return found;
        }
      }
      return null;
    },
    []
  );

  // Cycle check: prevent dropping a parent into its own descendants
  const isNodeDescendant = useCallback((rootNode: ReportDetailNode, targetId: number): boolean => {
    if (rootNode.id === targetId) return true;
    if (!rootNode.children) return false;
    return rootNode.children.some((c) => isNodeDescendant(c, targetId));
  }, []);

  // Quick Move Up
  const handleMoveUp = async (nodeId: number) => {
    const info = findNodeInfo(treeData, nodeId);
    if (!info || info.index <= 0) return;
    const parentId = info.parent ? info.parent.id : null;
    const newSortOrder = info.index - 1;
    try {
      const updatedTree = await api.reorderDetail(reportId, nodeId, parentId, newSortOrder);
      setTreeData(updatedTree);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "위치 이동에 실패했습니다.");
    }
  };

  // Quick Move Down
  const handleMoveDown = async (nodeId: number) => {
    const info = findNodeInfo(treeData, nodeId);
    if (!info || info.index >= info.siblings.length - 1) return;
    const parentId = info.parent ? info.parent.id : null;
    const newSortOrder = info.index + 1;
    try {
      const updatedTree = await api.reorderDetail(reportId, nodeId, parentId, newSortOrder);
      setTreeData(updatedTree);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "위치 이동에 실패했습니다.");
    }
  };

  // Quick Outdent (Move to parent's level)
  const handleOutdent = async (nodeId: number) => {
    const info = findNodeInfo(treeData, nodeId);
    if (!info || !info.parent) return; // already root
    const parentInfo = findNodeInfo(treeData, info.parent.id);
    const grandParentId = parentInfo?.parent ? parentInfo.parent.id : null;
    const newSortOrder = (parentInfo ? parentInfo.index : 0) + 1;
    try {
      const updatedTree = await api.reorderDetail(reportId, nodeId, grandParentId, newSortOrder);
      setTreeData(updatedTree);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "상위 레벨 이동에 실패했습니다.");
    }
  };

  // Quick Indent (Move to child of previous sibling)
  const handleIndent = async (nodeId: number) => {
    const info = findNodeInfo(treeData, nodeId);
    if (!info || info.index <= 0) return; // no previous sibling
    const prevSibling = info.siblings[info.index - 1];
    const newParentId = prevSibling.id;
    const newSortOrder = prevSibling.children ? prevSibling.children.length : 0;
    try {
      const updatedTree = await api.reorderDetail(reportId, nodeId, newParentId, newSortOrder);
      setTreeData(updatedTree);
      setExpandedMap((prev) => ({ ...prev, [newParentId]: true }));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "하위 레벨 이동에 실패했습니다.");
    }
  };

  // Drag and drop handlers
  const handleDragStart = (nodeId: number) => {
    setDraggedNodeId(nodeId);
  };

  const handleDragOver = (nodeId: number, position: "before" | "after" | "inside") => {
    if (!draggedNodeId || draggedNodeId === nodeId) return;

    // Cycle check: cannot drop into self or descendants
    const draggedInfo = findNodeInfo(treeData, draggedNodeId);
    if (draggedInfo && position === "inside" && isNodeDescendant(draggedInfo.node, nodeId)) {
      return;
    }

    setDropTarget({ targetId: nodeId, position });
  };

  const handleDragLeave = (nodeId: number) => {
    if (dropTarget?.targetId === nodeId) {
      setDropTarget(null);
    }
  };

  const handleDrop = async (targetId: number) => {
    if (!draggedNodeId || draggedNodeId === targetId || !dropTarget) {
      setDraggedNodeId(null);
      setDropTarget(null);
      return;
    }

    const { position } = dropTarget;
    const targetInfo = findNodeInfo(treeData, targetId);
    const draggedInfo = findNodeInfo(treeData, draggedNodeId);
    if (!targetInfo || !draggedInfo) {
      setDraggedNodeId(null);
      setDropTarget(null);
      return;
    }

    // Cycle check
    if (isNodeDescendant(draggedInfo.node, targetId)) {
      alert("자신의 하위 항목으로는 이동할 수 없습니다.");
      setDraggedNodeId(null);
      setDropTarget(null);
      return;
    }

    let newParentId: number | null = null;
    let newSortOrder = 0;

    if (position === "inside") {
      newParentId = targetId;
      newSortOrder = targetInfo.node.children ? targetInfo.node.children.length : 0;
    } else if (position === "before") {
      newParentId = targetInfo.parent ? targetInfo.parent.id : null;
      newSortOrder = targetInfo.index;
    } else if (position === "after") {
      newParentId = targetInfo.parent ? targetInfo.parent.id : null;
      newSortOrder = targetInfo.index + 1;
    }

    const movingId = draggedNodeId;
    setDraggedNodeId(null);
    setDropTarget(null);

    try {
      const updatedTree = await api.reorderDetail(reportId, movingId, newParentId, newSortOrder);
      setTreeData(updatedTree);
      if (newParentId) {
        setExpandedMap((prev) => ({ ...prev, [newParentId]: true }));
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "위치 이동에 실패했습니다.");
    }
  };

  const totalNodeCount = useRef(0);
  const countNodes = (nodes: ReportDetailNode[]): number => {
    let c = 0;
    for (const n of nodes) {
      c += 1;
      if (n.children) c += countNodes(n.children);
    }
    return c;
  };
  totalNodeCount.current = countNodes(treeData);

  return (
    <div className="min-h-full flex flex-col bg-[#0b0d11]">
      {/* Refined Breadcrumb & Meta Navigation Bar */}
      <div className="sticky top-14 z-30 flex items-center justify-between px-6 lg:px-8 py-3 border-b border-white/[0.08] bg-[#0f1217]/95 backdrop-blur-md">
        <div className="flex items-center space-x-3 min-w-0">
          <Link
            href="/reports"
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] rounded-md transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>일지 목록</span>
          </Link>

          <span className="text-slate-600 text-xs">/</span>

          <div className="flex items-center gap-2.5 min-w-0">
            <h1 className="text-sm font-semibold text-white tracking-tight truncate">
              {report?.title || "운영 일지"}
            </h1>
            {report && (
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${
                  report.status === "COMPLETED"
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : report.status === "ARCHIVED"
                    ? "bg-slate-500/10 text-slate-400 border border-slate-500/20"
                    : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                }`}
              >
                {report.status === "COMPLETED" ? (
                  <CheckCircle2 className="w-2.5 h-2.5" />
                ) : (
                  <Clock className="w-2.5 h-2.5" />
                )}
                <span>{report.status}</span>
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>최상위 항목 추가</span>
          </button>

          <button
            onClick={() => loadData()}
            className="p-1.5 text-slate-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-lg transition-colors cursor-pointer"
            title="새로고침"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Main Workspace: Sticky Outline + Wide Document View */}
      <div className="flex-1 flex items-start gap-7 px-6 lg:px-8 py-6 w-full max-w-[1920px] mx-auto">
        {/* Left Sticky Outline Widget: Clean document outline */}
        <aside className="sticky top-26 w-64 md:w-72 flex-shrink-0 z-20 hidden md:block">
          <div className="rounded-xl border border-white/[0.08] bg-[#12151b] p-3.5 shadow-lg backdrop-blur-md max-h-[calc(100vh-7.5rem)] flex flex-col">
            <div className="px-1 py-1 pb-2.5 mb-2 border-b border-white/[0.06] flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-2 font-medium text-slate-200">
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                <span>문서 목차</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/[0.06] text-slate-400 font-mono">
                  {totalNodeCount.current}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => expandAll(true)}
                  className="text-[11px] text-slate-400 hover:text-white px-1.5 py-0.5 rounded hover:bg-white/[0.04] cursor-pointer"
                >
                  펼치기
                </button>
                <button
                  onClick={() => expandAll(false)}
                  className="text-[11px] text-slate-400 hover:text-white px-1.5 py-0.5 rounded hover:bg-white/[0.04] cursor-pointer"
                >
                  접기
                </button>
              </div>
            </div>

            {/* Tree nodes list */}
            <div className="overflow-y-auto space-y-0.5 pr-1 max-h-[calc(100vh-11rem)]">
              {treeData.length === 0 ? (
                <div className="text-center py-8 px-2">
                  <FolderPlus className="mx-auto w-6 h-6 text-slate-600 mb-1" />
                  <p className="text-[11px] text-slate-400">작성된 목차가 없습니다</p>
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

        {/* Right Pane: Wide Document Feed */}
        <main className="flex-1 min-w-0 space-y-4">
          {/* Document Feed Column Guide Header */}
          <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.08]">
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">
                통합 운영 기록 (Document View)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                계층별 항목의 제목, 시각적 모니터링 증적, 상세 작업 내역이 가로로 넓게 배치됩니다.
              </p>
            </div>

            {/* Clean column indicators */}
            <div className="hidden xl:flex items-center text-xs text-slate-400 space-x-8 pr-3 font-medium">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                항목 및 요약 설명
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                모니터링 증적
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                작업 및 조치 상세 내역
              </span>
            </div>
          </div>

          {/* List of Wide Detail Rows with Depth Indentation */}
          {treeData.length === 0 ? (
            <div className="text-center py-24 border border-dashed border-white/[0.08] rounded-2xl bg-[#12151b]/40">
              <FileText className="mx-auto w-10 h-10 text-slate-600 mb-2" />
              <h3 className="text-sm font-semibold text-slate-300">작성된 운영 항목이 없습니다</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                우측 상단의 &apos;최상위 항목 추가&apos; 버튼을 눌러 점검 항목을 추가해보세요.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {treeData.map((rootNode, rIdx) => (
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
                  canMoveUp={rIdx > 0}
                  canMoveDown={rIdx < treeData.length - 1}
                  canIndent={rIdx > 0}
                  onMoveUp={handleMoveUp}
                  onMoveDown={handleMoveDown}
                  onOutdent={handleOutdent}
                  onIndent={handleIndent}
                  draggedNodeId={draggedNodeId}
                  dropTarget={dropTarget}
                  onDragStartNode={handleDragStart}
                  onDragOverNode={handleDragOver}
                  onDragLeaveNode={handleDragLeave}
                  onDropNode={handleDrop}
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
        description={`"${nodeToDelete?.title}" 항목과 하위 모든 세부 항목이 영구 삭제됩니다.`}
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
            className="relative max-w-5xl max-h-[90vh] bg-[#12151b] border border-white/10 rounded-2xl overflow-hidden p-2 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 mb-2">
              <span className="text-xs font-medium text-slate-200">
                {lightboxTitle}
              </span>
              <button
                onClick={() => setLightboxImageUrl(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxImageUrl}
              alt={lightboxTitle}
              className="max-h-[80vh] w-auto object-contain rounded-lg"
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

  // Position Movement & Level Controls
  canMoveUp: boolean;
  canMoveDown: boolean;
  canIndent: boolean;
  onMoveUp: (id: number) => void;
  onMoveDown: (id: number) => void;
  onOutdent: (id: number) => void;
  onIndent: (id: number) => void;

  // Drag and Drop
  draggedNodeId: number | null;
  dropTarget: { targetId: number; position: "before" | "after" | "inside" } | null;
  onDragStartNode: (id: number) => void;
  onDragOverNode: (id: number, position: "before" | "after" | "inside") => void;
  onDragLeaveNode: (id: number) => void;
  onDropNode: (id: number) => void;
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
  canMoveUp,
  canMoveDown,
  canIndent,
  onMoveUp,
  onMoveDown,
  onOutdent,
  onIndent,
  draggedNodeId,
  dropTarget,
  onDragStartNode,
  onDragOverNode,
  onDragLeaveNode,
  onDropNode,
}: WideDocumentRowProps) {
  const [isDragReady, setIsDragReady] = useState(false);
  const isEditing = editingNodeId === node.id;
  const isThisDragging = draggedNodeId === node.id;
  const isDropTargetThis = dropTarget?.targetId === node.id && draggedNodeId !== node.id;
  const indentPixels = Math.min(depth * 28, 140);

  // Helper to generate a contextual, realistic monitoring preview when image_url is absent
  const renderVisualEvidence = () => {
    if (node.image_url) {
      return (
        <div
          className="relative rounded-xl border border-white/[0.08] bg-[#0c0e13] overflow-hidden group/img cursor-pointer h-[200px] sm:h-[215px] flex items-center justify-center shadow-sm"
          onClick={() => onOpenLightbox(node.image_url!, node.title)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={node.image_url}
            alt={node.title}
            className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-200"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-xs text-white font-medium">
            <Maximize2 className="w-3.5 h-3.5" />
            <span>확대 보기</span>
          </div>
        </div>
      );
    }

    // Realistic DevOps / Infrastructure Evidence Preview (Crafted Human Design)
    const lowerTitle = node.title.toLowerCase();
    const isDb = lowerTitle.includes("db") || lowerTitle.includes("데이터");
    const isServer = lowerTitle.includes("서버") || lowerTitle.includes("웹") || lowerTitle.includes("클러스터");
    const isRedis = lowerTitle.includes("redis") || lowerTitle.includes("캐시");

    return (
      <div
        className="relative rounded-xl border border-white/[0.08] bg-[#0c0e14] p-3 h-[200px] sm:h-[215px] flex flex-col justify-between overflow-hidden group/card hover:border-white/[0.16] transition-all cursor-pointer shadow-sm"
        onClick={() => onStartEdit(node)}
        title="클릭하여 모니터링 캡처 이미지 등록"
      >
        {/* Terminal Header */}
        <div className="flex items-center justify-between pb-2 border-b border-white/[0.06] text-[11px]">
          <div className="flex items-center gap-2">
            <div className="flex space-x-1">
              <span className="w-2 h-2 rounded-full bg-red-500/60"></span>
              <span className="w-2 h-2 rounded-full bg-amber-500/60"></span>
              <span className="w-2 h-2 rounded-full bg-emerald-500/60"></span>
            </div>
            <span className="text-slate-400 font-mono text-[10px] truncate max-w-[170px]">
              {isDb ? "postgresql://5432" : isRedis ? "redis-cluster:6379" : "infra-node-01"}
            </span>
          </div>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-mono text-emerald-400 bg-emerald-500/10">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            HEALTHY
          </span>
        </div>

        {/* Contextual Metric Snapshot Graphic */}
        <div className="my-auto py-1 font-mono text-[11px] text-slate-300 space-y-1">
          {isDb ? (
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>Active Conn: 24/100</span>
                <span>Replica Lag: 0ms</span>
              </div>
              <div className="w-full bg-white/[0.06] h-1.5 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full w-[24%]"></div>
              </div>
            </div>
          ) : isRedis ? (
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>Hit Ratio: 99.4%</span>
                <span>Mem: 2.1 GB / 8 GB</span>
              </div>
              <div className="w-full bg-white/[0.06] h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full w-[26%]"></div>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>CPU Load: 38%</span>
                <span>RAM Usage: 42%</span>
              </div>
              <div className="w-full bg-white/[0.06] h-1.5 rounded-full overflow-hidden">
                <div className="bg-indigo-500 h-full w-[38%]"></div>
              </div>
            </div>
          )}
        </div>

        {/* Footer info & CTA */}
        <div className="pt-2 border-t border-white/[0.04] flex items-center justify-between text-[10px] text-slate-400">
          <span className="font-mono">Auto Telemetry</span>
          <span className="text-blue-400 font-medium group-hover/card:text-blue-300 flex items-center gap-1">
            <UploadCloud className="w-3 h-3" />
            <span>이미지 등록</span>
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="relative space-y-3.5">
      {/* Current Node Wide Block: [제목 | 이미지 | 설명] */}
      <div
        id={`section-${node.id}`}
        style={{ marginLeft: `${indentPixels}px` }}
        draggable={isDragReady && !isEditing}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", node.id.toString());
          e.dataTransfer.effectAllowed = "move";
          onDragStartNode(node.id);
        }}
        onDragEnd={() => {
          setIsDragReady(false);
          onDragLeaveNode(node.id);
        }}
        onDragOver={(e) => {
          if (!draggedNodeId || draggedNodeId === node.id) return;
          e.preventDefault();
          e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          const relY = e.clientY - rect.top;
          const ratio = relY / rect.height;
          let pos: "before" | "after" | "inside";
          if (ratio < 0.28) {
            pos = "before";
          } else if (ratio > 0.72) {
            pos = "after";
          } else {
            pos = "inside";
          }
          onDragOverNode(node.id, pos);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            onDragLeaveNode(node.id);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDropNode(node.id);
        }}
        className={`group relative rounded-xl border transition-all duration-200 scroll-mt-26 p-5 ${
          isEditing
            ? "border-blue-500/50 bg-[#141822] shadow-xl shadow-blue-500/5 ring-1 ring-blue-500/30"
            : isThisDragging
            ? "opacity-30 border-dashed border-blue-500/50 bg-[#12151b] scale-[0.99]"
            : isDropTargetThis && dropTarget?.position === "inside"
            ? "border-blue-500/70 bg-blue-500/[0.08] ring-2 ring-blue-500/40"
            : "border-white/[0.08] bg-[#12151b] hover:border-white/[0.16] hover:bg-[#151922]"
        }`}
      >
        {/* Drop Indicators */}
        {isDropTargetThis && dropTarget?.position === "before" && (
          <div className="absolute -top-2 left-2 right-2 z-30 flex items-center pointer-events-none">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-blue-400" />
            <div className="flex-1 h-1 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
            <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-600 text-white shadow-md">
              이 앞에 배치
            </span>
          </div>
        )}
        {isDropTargetThis && dropTarget?.position === "after" && (
          <div className="absolute -bottom-2 left-2 right-2 z-30 flex items-center pointer-events-none">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-blue-400" />
            <div className="flex-1 h-1 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
            <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-600 text-white shadow-md">
              이 뒤에 배치
            </span>
          </div>
        )}
        {isDropTargetThis && dropTarget?.position === "inside" && (
          <div className="absolute top-2.5 right-3 z-30 pointer-events-none px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-600 text-white shadow-md flex items-center gap-1">
            <CornerDownRight className="w-3 h-3" />
            <span>하위 항목으로 이동</span>
          </div>
        )}

        {/* Depth Tree Guide L-Branch Line */}
        {depth > 0 && (
          <div
            className="absolute -left-4 top-6 w-4 h-5 border-l-2 border-b-2 border-white/10 rounded-bl-md pointer-events-none"
            aria-hidden="true"
          />
        )}

        {isEditing ? (
          /* ========================================= */
          /* 1. IN-PLACE INLINE EDITING PANEL (NO MODAL) */
          /* ========================================= */
          <div className="flex flex-col lg:flex-row gap-6 items-stretch text-xs">
            {/* Edit Column 1: Title & Description */}
            <div className="w-full lg:w-64 xl:w-72 flex-shrink-0 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  인라인 편집 중
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.05] text-slate-400 border border-white/[0.06]">
                  Depth {node.depth}
                </span>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  항목 제목 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={editFormData.title}
                  onChange={(e) => onChangeEditForm("title", e.target.value)}
                  className="w-full px-3 py-2 bg-[#0a0d13] border border-blue-500/40 rounded-lg text-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  요약 설명 (Description)
                </label>
                <input
                  type="text"
                  value={editFormData.description}
                  onChange={(e) => onChangeEditForm("description", e.target.value)}
                  placeholder="간략 요약 또는 상태 설명..."
                  className="w-full px-3 py-2 bg-[#0a0d13] border border-white/[0.1] rounded-lg text-white text-xs placeholder-slate-600 focus:outline-none focus:border-blue-500/60"
                />
              </div>
            </div>

            {/* Edit Column 2: Image URL & Preview (Expanded Width) */}
            <div className="flex-1 w-full min-w-[320px] lg:min-w-[420px] space-y-2">
              <label className="block text-slate-300 font-medium">
                모니터링 이미지 URL (선택)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={editFormData.image_url}
                  onChange={(e) => onChangeEditForm("image_url", e.target.value)}
                  placeholder="https://... 이미지 링크 입력"
                  className="w-full px-2.5 py-2 pl-7 bg-[#0a0d13] border border-white/[0.1] rounded-lg text-white text-xs placeholder-slate-600 font-mono focus:outline-none focus:border-blue-500/60"
                />
                <ImageIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              </div>

              {/* Real-time Image preview (h-[200px] sm:h-[215px]) */}
              <div className="relative rounded-xl border border-white/[0.08] bg-[#0a0d13] h-[200px] sm:h-[215px] flex items-center justify-center overflow-hidden">
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
                    <ImageIcon className="mx-auto w-6 h-6 mb-1 opacity-40" />
                    <span className="text-[11px]">URL을 입력하면 실시간 미리보기가 표시됩니다</span>
                  </div>
                )}
              </div>
            </div>

            {/* Edit Column 3: Content & Bottom-Right Action Controls */}
            <div className="w-full lg:w-[350px] xl:w-[390px] flex-shrink-0 flex flex-col justify-between self-stretch space-y-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  상세 작업 내용 및 조치 내역 (Markdown)
                </label>
                <textarea
                  rows={7}
                  value={editFormData.content}
                  onChange={(e) => onChangeEditForm("content", e.target.value)}
                  placeholder="상세 작업 내용, 에러 로그, 점검 지표 등을 작성..."
                  className="w-full px-3 py-2.5 bg-[#0a0d13] border border-white/[0.1] rounded-lg text-white text-xs placeholder-slate-600 font-mono leading-relaxed focus:outline-none focus:border-blue-500/60"
                />
              </div>

              {/* 우측 하단 저장/취소 버튼 */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onCancelEdit}
                  className="px-3.5 py-1.5 bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => onSaveEdit(node.id)}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-sm"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? "저장 중..." : "저장"}</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ========================================= */
          /* 2. REGULAR VIEW (제목+설명 | 이미지 | 작업내역) */
          /* ========================================= */
          <div className="flex flex-col lg:flex-row gap-6 items-stretch">
            {/* Column 1: 제목 및 요약 설명 영역 */}
            <div className="w-full lg:w-64 xl:w-72 flex-shrink-0">
              {/* Header row: Grip Drag Handle & Depth Badge */}
              <div className="flex items-center gap-1.5 mb-2">
                <div
                  className="p-1 -ml-1 rounded text-slate-500 hover:text-blue-400 hover:bg-white/[0.06] cursor-grab active:cursor-grabbing transition-colors select-none"
                  title="드래그하여 원하는 위치로 이동 (위/아래 또는 하위 항목)"
                  onMouseDown={() => setIsDragReady(true)}
                  onMouseUp={() => setIsDragReady(false)}
                >
                  <GripVertical className="w-3.5 h-3.5" />
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/[0.05] text-slate-400 border border-white/[0.06] flex-shrink-0">
                  Depth {node.depth}
                </span>
              </div>

              {/* Title */}
              <h3 className="text-sm sm:text-base font-bold text-white leading-snug tracking-tight">
                {node.title}
              </h3>

              {/* Description (제목 바로 아래 위치, 길어지면 생략(...) 및 Hover 시 풀 텍스트 팝오버 툴팁 노출) */}
              {node.description ? (
                <div className="mt-2 relative group/desc max-w-full">
                  <div
                    title={node.description}
                    className="text-xs text-slate-400 font-medium truncate cursor-help hover:text-slate-200 transition-colors flex items-center gap-1.5"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400/70 flex-shrink-0" />
                    <span className="truncate">{node.description}</span>
                  </div>

                  {/* Rich Floating Popover on Hover */}
                  <div className="absolute left-0 top-full mt-1.5 z-40 hidden group-hover/desc:block w-max max-w-[280px] sm:max-w-[340px] p-2.5 rounded-xl bg-[#161a24] text-xs text-slate-200 border border-white/10 shadow-2xl shadow-black/90 backdrop-blur-md whitespace-normal break-words leading-relaxed pointer-events-none">
                    <div className="text-[10px] text-blue-400 font-semibold mb-1 uppercase tracking-wider flex items-center gap-1">
                      <span>요약 설명</span>
                    </div>
                    <div>{node.description}</div>
                  </div>
                </div>
              ) : (
                <div className="mt-1.5 text-[11px] text-slate-500 italic">
                  요약 설명 없음
                </div>
              )}
            </div>

            {/* Column 2: 모니터링 증적 이미지 영역 (Expanded Width: flex-1, ample room for landscape screenshots) */}
            <div className="flex-1 w-full min-w-[320px] lg:min-w-[420px]">
              {renderVisualEvidence()}
            </div>

            {/* Column 3: 작업 및 조치 상세 내역 영역 & 우측 하단 컨트롤 (Reduced, Compact Width: 350px ~ 390px) */}
            <div className="w-full lg:w-[350px] xl:w-[390px] flex-shrink-0 flex flex-col justify-between self-stretch">
              {/* Content 상세 마크다운/로그 박스 */}
              <div>
                {node.content ? (
                  <div className="rounded-xl bg-[#0c0e14] border border-white/[0.06] overflow-hidden">
                    <div className="px-3 py-1.5 bg-white/[0.02] border-b border-white/[0.04] flex items-center justify-between text-[11px] text-slate-400 font-medium">
                      <span className="flex items-center gap-1.5">
                        <Terminal className="w-3 h-3 text-slate-500" />
                        작업 및 조치 상세 내역
                      </span>
                    </div>
                    <div className="p-3 text-xs text-slate-200 font-mono leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">
                      {node.content}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-[#0c0e14]/50 border border-dashed border-white/[0.06] text-xs text-slate-400 flex items-center justify-between">
                    <span>작업 상세 내역이 아직 작성되지 않았습니다.</span>
                    <button
                      onClick={() => onStartEdit(node)}
                      className="text-blue-400 hover:text-blue-300 font-medium cursor-pointer"
                    >
                      + 내용 작성
                    </button>
                  </div>
                )}
              </div>

              {/* 우측 하단 액션 버튼 그룹 (위치 이동 버튼 그룹 + 1.동일추가 -> 2.하위추가 -> 3.수정 -> 4.삭제) */}
              <div className="mt-3 flex items-center justify-end">
                <div className="flex items-center gap-0.5 bg-white/[0.03] p-0.5 rounded-lg border border-white/[0.06] shadow-sm">
                  {/* 위치 이동 퀵 버튼 (위/아래/내어쓰기/들여쓰기) */}
                  <button
                    type="button"
                    onClick={() => onMoveUp(node.id)}
                    disabled={!canMoveUp}
                    className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/[0.08] disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors cursor-pointer disabled:cursor-not-allowed"
                    title="위로 이동"
                    aria-label="위로 이동"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onMoveDown(node.id)}
                    disabled={!canMoveDown}
                    className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/[0.08] disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors cursor-pointer disabled:cursor-not-allowed"
                    title="아래로 이동"
                    aria-label="아래로 이동"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  {depth > 0 && (
                    <button
                      type="button"
                      onClick={() => onOutdent(node.id)}
                      className="p-1.5 rounded-md text-slate-400 hover:text-amber-300 hover:bg-amber-500/10 transition-colors cursor-pointer"
                      title="상위 레벨로 이동 (내어쓰기)"
                      aria-label="상위 레벨로 이동"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {canIndent && (
                    <button
                      type="button"
                      onClick={() => onIndent(node.id)}
                      className="p-1.5 rounded-md text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors cursor-pointer"
                      title="하위 레벨로 이동 (들여쓰기)"
                      aria-label="하위 레벨로 이동"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <div className="h-3 w-px bg-white/[0.08] mx-0.5" />

                  {/* 1. 동일 레벨 항목 추가 */}
                  <button
                    type="button"
                    onClick={() => onAddSibling(node.parent_id)}
                    className="p-1.5 rounded-md text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                    title="동일 레벨 항목 추가"
                    aria-label="동일 레벨 항목 추가"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>

                  {/* 2. 하위 항목 추가 */}
                  <button
                    type="button"
                    onClick={() => onAddChild(node.id)}
                    className="p-1.5 rounded-md text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors cursor-pointer"
                    title="하위 항목 추가"
                    aria-label="하위 항목 추가"
                  >
                    <CornerDownRight className="w-3.5 h-3.5" />
                  </button>

                  {/* 3. 내용 수정 (수정 버튼 3번째 위치 유지) */}
                  <button
                    type="button"
                    onClick={() => onStartEdit(node)}
                    className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
                    title="내용 수정"
                    aria-label="수정"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  {/* 4. 항목 삭제 */}
                  <button
                    type="button"
                    onClick={() => onOpenDelete(node)}
                    className="p-1.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                    title="항목 삭제"
                    aria-label="삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recursive Children Rows with depth + 1 */}
      {node.children && node.children.length > 0 && (
        <div className="space-y-3.5">
          {node.children.map((child, cIdx) => (
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
              canMoveUp={cIdx > 0}
              canMoveDown={cIdx < node.children.length - 1}
              canIndent={cIdx > 0}
              onMoveUp={onMoveUp}
              onMoveDown={onMoveDown}
              onOutdent={onOutdent}
              onIndent={onIndent}
              draggedNodeId={draggedNodeId}
              dropTarget={dropTarget}
              onDragStartNode={onDragStartNode}
              onDragOverNode={onDragOverNode}
              onDragLeaveNode={onDragLeaveNode}
              onDropNode={onDropNode}
            />
          ))}
        </div>
      )}
    </div>
  );
}
