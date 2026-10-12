"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Report, ReportCreateInput } from "@/types";
import { api } from "@/lib/api";
import { ReportModal } from "@/components/ReportModal";
import { ConfirmModal } from "@/components/ConfirmModal";
import {
  Plus,
  Search,
  Calendar,
  User,
  ListTree,
  Edit2,
  Trash2,
  ArrowRight,
  FileSpreadsheet,
  RefreshCw,
  CheckCircle2,
  Clock,
  Archive,
  BarChart3,
  Layers,
  Sparkles,
} from "lucide-react";

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<Report | null>(null);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(handler);
  }, [search]);

  // Fetch reports
  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getReports(page, 50, debouncedSearch);
      setReports(data.items);
      setTotal(data.total);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("리포트 목록을 불러오는데 실패했습니다.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Filtered reports by status tab
  const filteredReports = useMemo(() => {
    if (statusFilter === "ALL") return reports;
    return reports.filter((r) => r.status === statusFilter);
  }, [reports, statusFilter]);

  // Stats calculation
  const stats = useMemo(() => {
    const completedCount = reports.filter((r) => r.status === "COMPLETED").length;
    const draftCount = reports.filter((r) => r.status === "DRAFT").length;
    const totalDetails = reports.reduce((acc, curr) => acc + (curr.details_count || 0), 0);
    const completionRate = reports.length > 0 ? Math.round((completedCount / reports.length) * 100) : 0;
    return { completedCount, draftCount, totalDetails, completionRate };
  }, [reports]);

  // Handle Create / Edit submit
  const handleModalSubmit = async (inputData: ReportCreateInput) => {
    if (modalMode === "create") {
      await api.createReport(inputData);
    } else if (selectedReport) {
      await api.updateReport(selectedReport.id, inputData);
    }
    fetchReports();
  };

  // Handle Delete submit
  const handleDeleteConfirm = async () => {
    if (!reportToDelete) return;
    await api.deleteReport(reportToDelete.id);
    fetchReports();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            완료
          </span>
        );
      case "ARCHIVED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
            <Archive className="w-3 h-3" />
            보관
          </span>
        );
      case "DRAFT":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" />
            작성 중
          </span>
        );
    }
  };

  return (
    <div className="min-h-full py-8 px-6 lg:px-10 max-w-7xl mx-auto w-full">
      {/* Page Title & Main Action Bar */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">
              Operations Overview
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            운영 일지 관리
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            주간 정기 점검, 서버 리소스 모니터링 및 변경 작업 내역을 계층형으로 관리합니다.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchReports()}
            className="p-2 text-slate-400 hover:text-white bg-[#141720] hover:bg-[#1a1f2b] border border-white/[0.08] rounded-lg transition-colors cursor-pointer"
            title="새로고침"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => {
              setSelectedReport(null);
              setModalMode("create");
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm shadow-blue-600/30 transition-all cursor-pointer hover:shadow-md"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>새 운영 일지 작성</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Overview Cards (Human Designer Touch) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 my-6">
        <div className="p-4 rounded-xl bg-[#12151b] border border-white/[0.07] flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-400">총 운영 일지</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white tracking-tight">{total}</span>
            <span className="text-xs text-slate-400 font-medium">건 등록됨</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#12151b] border border-white/[0.07] flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-400">점검 완료율</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-400 tracking-tight">
              {stats.completionRate}%
            </span>
            <span className="text-xs text-slate-400 font-medium">
              {stats.completedCount}건 완료
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#12151b] border border-white/[0.07] flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-400">작성 진행 중</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-amber-400 tracking-tight">
              {stats.draftCount}
            </span>
            <span className="text-xs text-slate-400 font-medium">건 작성 중</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#12151b] border border-white/[0.07] flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-400">관리 세부 항목</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-blue-400 tracking-tight">
              {stats.totalDetails}
            </span>
            <span className="text-xs text-slate-400 font-medium">개 트리 노드</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
        {/* Status Filter Tabs */}
        <div className="flex items-center p-1 rounded-lg bg-[#12151b] border border-white/[0.07] self-start sm:self-auto">
          {[
            { id: "ALL", label: "전체", count: reports.length },
            { id: "COMPLETED", label: "완료", count: stats.completedCount },
            { id: "DRAFT", label: "작성 중", count: stats.draftCount },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                statusFilter === tab.id
                  ? "bg-white/[0.1] text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>{tab.label}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30 font-mono">
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="제목 또는 작성자로 검색..."
            className="w-full pl-9 pr-3 py-1.5 bg-[#12151b] border border-white/[0.08] rounded-lg text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          {error}
        </div>
      )}

      {/* Reports Grid */}
      {isLoading && reports.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-44 rounded-xl bg-[#12151b] border border-white/[0.04] animate-pulse"
            />
          ))}
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="text-center py-20 px-4 rounded-2xl bg-[#12151b]/50 border border-dashed border-white/[0.08]">
          <FileSpreadsheet className="mx-auto w-12 h-12 text-slate-600 mb-3" />
          <h3 className="text-sm font-semibold text-white">조건에 맞는 운영 일지가 없습니다</h3>
          <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
            {search ? `"${search}" 검색어에 일치하는 일지가 없습니다.` : "새로운 운영 일지를 작성하여 점검 내역을 기록해보세요."}
          </p>
          <button
            onClick={() => {
              if (search) {
                setSearch("");
                setStatusFilter("ALL");
              } else {
                setSelectedReport(null);
                setModalMode("create");
                setIsModalOpen(true);
              }
            }}
            className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{search ? "필터 초기화" : "첫 일지 작성하기"}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
          {filteredReports.map((report) => (
            <div
              key={report.id}
              className="group relative flex flex-col justify-between rounded-xl bg-[#12151b] border border-white/[0.08] hover:border-white/[0.18] hover:bg-[#161a22] transition-all duration-200 overflow-hidden shadow-sm hover:shadow-lg"
            >
              <div className="p-5">
                {/* Header: Date & Status */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>{report.report_date}</span>
                  </div>
                  {getStatusBadge(report.status)}
                </div>

                {/* Title */}
                <Link
                  href={`/reports/${report.id}`}
                  className="block group-hover:text-blue-400 transition-colors"
                >
                  <h2 className="text-base font-semibold text-white leading-snug line-clamp-2">
                    {report.title}
                  </h2>
                </Link>

                {/* Metadata Row */}
                <div className="mt-4 pt-3.5 border-t border-white/[0.05] flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-slate-800 border border-white/[0.1] flex items-center justify-center text-[10px] text-slate-300 font-medium">
                      {(report.author || "운")[0]}
                    </div>
                    <span className="text-slate-300 text-xs">{report.author || "미지정"}</span>
                  </div>

                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/[0.03] border border-white/[0.05] text-blue-400 font-mono text-[11px]">
                    <ListTree className="w-3 h-3" />
                    <span>{report.details_count} 항목</span>
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="px-5 py-3 bg-[#0d1016] border-t border-white/[0.06] flex items-center justify-between text-xs">
                <div className="flex items-center gap-1 text-slate-400">
                  <button
                    onClick={() => {
                      setSelectedReport(report);
                      setModalMode("edit");
                      setIsModalOpen(true);
                    }}
                    className="p-1.5 rounded-md hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
                    title="일지 정보 수정"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      setReportToDelete(report);
                      setIsDeleteModalOpen(true);
                    }}
                    className="p-1.5 rounded-md hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                    title="일지 삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <Link
                  href={`/reports/${report.id}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300 group-hover:translate-x-0.5 transition-all"
                >
                  <span>세부 일지 열기</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <ReportModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleModalSubmit}
        initialData={selectedReport}
        mode={modalMode}
      />

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="운영 일지 삭제"
        description={`"${reportToDelete?.title}" 일지와 포함된 모든 세부 항목이 영구적으로 삭제됩니다. 계속하시겠습니까?`}
        confirmLabel="일지 삭제"
        isDanger={true}
      />
    </div>
  );
}
