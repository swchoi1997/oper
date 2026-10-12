"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Report, ReportCreateInput } from "@/types";
import { api } from "@/lib/api";
import { ReportModal } from "@/components/ReportModal";
import { ConfirmModal } from "@/components/ConfirmModal";
import {
  Plus,
  Search,
  Calendar,
  Edit2,
  Trash2,
  FileSpreadsheet,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from "lucide-react";

export default function ReportsPage() {
  const router = useRouter();

  const [reports, setReports] = useState<Report[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Search & Filter state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [activeDatePreset, setActiveDatePreset] = useState<"ALL" | "TODAY" | "7DAYS" | "MONTH" | "CUSTOM">("ALL");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Hidden native date pickers refs for popup
  const startPickerRef = useRef<HTMLInputElement>(null);
  const endPickerRef = useRef<HTMLInputElement>(null);

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

  // Quick Date Presets
  const applyDatePreset = (preset: "ALL" | "TODAY" | "7DAYS" | "MONTH") => {
    setActiveDatePreset(preset);
    setPage(1);

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === "ALL") {
      setStartDate("");
      setEndDate("");
    } else if (preset === "TODAY") {
      const todayStr = toYMD(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === "7DAYS") {
      const past = new Date();
      past.setDate(past.getDate() - 7);
      setStartDate(toYMD(past));
      setEndDate(toYMD(now));
    } else if (preset === "MONTH") {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(toYMD(monthStart));
      setEndDate(toYMD(now));
    }
  };

  const handleCustomDateChange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
    setActiveDatePreset("CUSTOM");
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setStatusFilter("ALL");
    setStartDate("");
    setEndDate("");
    setActiveDatePreset("ALL");
    setPage(1);
  };

  // Fetch reports from Backend
  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getReports(
        page,
        pageSize,
        debouncedSearch || undefined,
        startDate || undefined,
        endDate || undefined
      );
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
  }, [page, pageSize, debouncedSearch, startDate, endDate]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Filtered reports by status tab
  const filteredReports = useMemo(() => {
    if (statusFilter === "ALL") return reports;
    return reports.filter((r) => r.status === statusFilter);
  }, [reports, statusFilter]);

  // Clean title parser: extracts slot [오전] / [오후] and removes leading date tags
  const parseReportSlotAndTitle = (rawTitle: string) => {
    if (!rawTitle) return { slot: null, displayTitle: "" };

    const slotMatch = rawTitle.match(/\[(오전|오후)\]/);
    const slot = slotMatch ? slotMatch[1] : null;

    const displayTitle = rawTitle
      .replace(/^\[\d{4}-\d{2}-\d{2}\]\s*/, "")
      .replace(/^\d{4}-\d{2}-\d{2}\s*/, "")
      .replace(/^\[(오전|오후)\]\s*/, "")
      .trim();

    return {
      slot,
      displayTitle: displayTitle || rawTitle,
    };
  };

  // Format date-time for table
  const formatDateTime = (isoStr: string) => {
    if (!isoStr) return "-";
    try {
      const d = new Date(isoStr);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const h = String(d.getHours()).padStart(2, "0");
      const min = String(d.getMinutes()).padStart(2, "0");
      return `${y}.${m}.${day} ${h}:${min}`;
    } catch {
      return isoStr;
    }
  };

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

  const getStatusIndicator = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            완료
          </span>
        );
      case "ARCHIVED":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            보관
          </span>
        );
      case "DRAFT":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-amber-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            작성 중
          </span>
        );
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const isFiltered = Boolean(search || startDate || endDate || statusFilter !== "ALL");

  return (
    <div className="min-h-full py-8 px-6 lg:px-10 max-w-6xl mx-auto w-full">
      {/* Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            운영 일지
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            시스템 정기 점검 및 인프라 변경 작업 내역을 목록으로 조회합니다.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchReports()}
            className="p-2 text-slate-400 hover:text-white bg-[#141720] hover:bg-[#1a1f2b] border border-white/[0.08] rounded-lg transition-colors cursor-pointer"
            title="목록 새로고침"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => {
              setSelectedReport(null);
              setModalMode("create");
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>새 운영 일지 작성</span>
          </button>
        </div>
      </div>

      {/* Unified Filter Toolbar */}
      <div className="my-6 space-y-3">
        {/* Top Filter Controls Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center p-1 rounded-lg bg-[#12151b] border border-white/[0.08] self-start sm:self-auto">
            {[
              { id: "ALL", label: "전체" },
              { id: "DRAFT", label: "작성 중" },
              { id: "COMPLETED", label: "완료" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  statusFilter === tab.id
                    ? "bg-white/[0.1] text-white shadow-sm font-semibold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Date Presets & Custom Date Range */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Presets */}
            <div className="flex items-center p-1 rounded-lg bg-[#12151b] border border-white/[0.08]">
              {[
                { id: "ALL", label: "전체 기간" },
                { id: "TODAY", label: "오늘" },
                { id: "7DAYS", label: "최근 7일" },
                { id: "MONTH", label: "이번 달" },
              ].map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => applyDatePreset(preset.id as "ALL" | "TODAY" | "7DAYS" | "MONTH")}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    activeDatePreset === preset.id
                      ? "bg-blue-600/25 text-blue-300 font-semibold border border-blue-500/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Custom Date Range Box */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#12151b] border border-white/[0.08] rounded-lg text-xs">
              <button
                type="button"
                onClick={() => startPickerRef.current?.showPicker?.()}
                title="시작일 달력 열기"
                className="text-slate-400 hover:text-blue-400 transition-colors cursor-pointer flex items-center"
              >
                <Calendar className="w-3.5 h-3.5" />
              </button>
              <input
                type="text"
                value={startDate}
                onChange={(e) => handleCustomDateChange(e.target.value, endDate)}
                placeholder="YYYY-MM-DD"
                maxLength={10}
                className="w-21 bg-transparent text-slate-200 placeholder-slate-600 focus:outline-none font-mono text-xs text-center"
              />
              <span className="text-slate-600 font-mono">~</span>
              <input
                type="text"
                value={endDate}
                onChange={(e) => handleCustomDateChange(startDate, e.target.value)}
                placeholder="YYYY-MM-DD"
                maxLength={10}
                className="w-21 bg-transparent text-slate-200 placeholder-slate-600 focus:outline-none font-mono text-xs text-center"
              />
              <button
                type="button"
                onClick={() => endPickerRef.current?.showPicker?.()}
                title="종료일 달력 열기"
                className="text-slate-400 hover:text-blue-400 transition-colors cursor-pointer flex items-center"
              >
                <Calendar className="w-3.5 h-3.5" />
              </button>

              {/* Hidden native pickers to support showPicker() without native layout glitches */}
              <input
                ref={startPickerRef}
                type="date"
                value={startDate}
                onChange={(e) => handleCustomDateChange(e.target.value, endDate)}
                className="sr-only"
                tabIndex={-1}
              />
              <input
                ref={endPickerRef}
                type="date"
                value={endDate}
                onChange={(e) => handleCustomDateChange(startDate, e.target.value)}
                className="sr-only"
                tabIndex={-1}
              />
            </div>

            {/* Keyword Search */}
            <div className="relative w-48 sm:w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="일지 제목 검색..."
                className="w-full pl-8 pr-6 py-1.5 bg-[#12151b] border border-white/[0.08] rounded-lg text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500/60 transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs cursor-pointer"
                >
                  ×
                </button>
              )}
            </div>

            {/* Filter Reset Button */}
            {isFiltered && (
              <button
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] border border-white/[0.08] transition-colors cursor-pointer"
                title="필터 전체 초기화"
              >
                <RotateCcw className="w-3 h-3" />
                <span>초기화</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          {error}
        </div>
      )}

      {/* Bulletin Board Table (게시판 형태) */}
      <div className="rounded-xl border border-white/[0.08] bg-[#12151b] overflow-hidden shadow-sm">
        <table className="w-full border-collapse table-fixed">
          <thead>
            <tr className="bg-[#0e1117] border-b border-white/[0.08] text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <th className="py-3 px-3 text-center w-14">번호</th>
              <th className="py-3 px-3 text-center w-28">운영 일자</th>
              <th className="py-3 px-2 text-center w-20">구분</th>
              <th className="py-3 px-4 text-left">일지 제목</th>
              <th className="py-3 px-3 text-center w-24">점검 항목</th>
              <th className="py-3 px-3 text-center w-24">진행 상태</th>
              <th className="py-3 px-3 text-center w-36">등록 일시</th>
              <th className="py-3 px-3 text-center w-20">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05] text-xs">
            {isLoading && reports.length === 0 ? (
              // Skeleton loading rows
              [1, 2, 3, 4, 5].map((i) => (
                <tr key={i} className="animate-pulse">
                  <td className="py-3.5 px-3 text-center">
                    <div className="w-6 h-4 bg-white/[0.04] rounded mx-auto" />
                  </td>
                  <td className="py-3.5 px-3 text-center">
                    <div className="w-20 h-4 bg-white/[0.04] rounded mx-auto" />
                  </td>
                  <td className="py-3.5 px-2 text-center">
                    <div className="w-10 h-4 bg-white/[0.04] rounded mx-auto" />
                  </td>
                  <td className="py-3.5 px-4 text-left">
                    <div className="w-48 h-4 bg-white/[0.04] rounded" />
                  </td>
                  <td className="py-3.5 px-3 text-center">
                    <div className="w-10 h-4 bg-white/[0.04] rounded mx-auto" />
                  </td>
                  <td className="py-3.5 px-3 text-center">
                    <div className="w-12 h-4 bg-white/[0.04] rounded mx-auto" />
                  </td>
                  <td className="py-3.5 px-3 text-center">
                    <div className="w-24 h-4 bg-white/[0.04] rounded mx-auto" />
                  </td>
                  <td className="py-3.5 px-3 text-center">
                    <div className="w-12 h-4 bg-white/[0.04] rounded mx-auto" />
                  </td>
                </tr>
              ))
            ) : filteredReports.length === 0 ? (
              // Empty state row
              <tr>
                <td colSpan={8} className="py-16 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <FileSpreadsheet className="w-10 h-10 text-slate-600 mb-3" />
                    <p className="text-sm font-semibold text-white">조건에 일치하는 운영 일지가 없습니다</p>
                    <p className="mt-1 text-xs text-slate-400 max-w-sm">
                      {isFiltered
                        ? "설정된 날짜 범위 또는 검색 조건에 해당하는 일지가 없습니다."
                        : "새 운영 일지를 작성하여 시스템 운영 점검 내역을 기록해보세요."}
                    </p>
                    <div className="mt-4 flex items-center gap-2">
                      {isFiltered && (
                        <button
                          onClick={handleResetFilters}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1f2b] hover:bg-[#222938] border border-white/[0.08] text-slate-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>필터 초기화</span>
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setSelectedReport(null);
                          setModalMode("create");
                          setIsModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>새 일지 작성</span>
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              filteredReports.map((report, idx) => {
                const { slot, displayTitle } = parseReportSlotAndTitle(report.title);
                const rowNumber = (page - 1) * pageSize + idx + 1;

                return (
                  <tr
                    key={report.id}
                    onClick={() => router.push(`/reports/${report.id}`)}
                    className="hover:bg-blue-500/[0.04] transition-colors cursor-pointer group"
                  >
                    {/* 번호 */}
                    <td className="py-3 px-3 text-center font-mono text-slate-500 text-xs">
                      {rowNumber}
                    </td>

                    {/* 운영 일자 */}
                    <td className="py-3 px-3 text-center font-mono text-slate-300 text-xs">
                      {report.report_date}
                    </td>

                    {/* 구분 (오전/오후) */}
                    <td className="py-3 px-2 text-center">
                      {slot === "오전" ? (
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
                          오전
                        </span>
                      ) : slot === "오후" ? (
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          오후
                        </span>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>

                    {/* 일지 제목 */}
                    <td className="py-3 px-4 text-left">
                      <Link
                        href={`/reports/${report.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-medium text-slate-200 group-hover:text-blue-400 transition-colors truncate block"
                        title={displayTitle}
                      >
                        {displayTitle}
                      </Link>
                    </td>

                    {/* 점검 항목 수 */}
                    <td className="py-3 px-3 text-center font-mono text-slate-400 text-xs">
                      {report.details_count || 0}건
                    </td>

                    {/* 진행 상태 */}
                    <td className="py-3 px-3 text-center">
                      {getStatusIndicator(report.status)}
                    </td>

                    {/* 등록 일시 */}
                    <td className="py-3 px-3 text-center font-mono text-slate-500 text-xs">
                      {formatDateTime(report.created_at)}
                    </td>

                    {/* 관리 액션 */}
                    <td
                      className="py-3 px-3 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedReport(report);
                            setModalMode("edit");
                            setIsModalOpen(true);
                          }}
                          className="p-1 rounded hover:text-white hover:bg-white/[0.08] text-slate-400 transition-colors cursor-pointer"
                          title="일지 수정"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setReportToDelete(report);
                            setIsDeleteModalOpen(true);
                          }}
                          className="p-1 rounded hover:text-red-400 hover:bg-red-500/10 text-slate-400 transition-colors cursor-pointer"
                          title="일지 삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Board Footer & Pagination */}
        <div className="p-3.5 bg-[#0e1117] border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div>
            총 <span className="font-semibold text-white">{total}</span>개의 운영 일지
            {total > 0 && (
              <span className="text-slate-500 ml-1">
                ({(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)}건 표시)
              </span>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-white/[0.08] bg-[#141720] hover:bg-[#1a1f2b] disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 transition-colors cursor-pointer"
                title="이전 페이지"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1 font-mono text-xs">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pNum) => (
                  <button
                    key={pNum}
                    onClick={() => setPage(pNum)}
                    className={`min-w-7 h-7 px-2 rounded-md font-medium transition-colors cursor-pointer ${
                      page === pNum
                        ? "bg-blue-600 text-white"
                        : "bg-transparent text-slate-400 hover:text-white hover:bg-white/[0.06]"
                    }`}
                  >
                    {pNum}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg border border-white/[0.08] bg-[#141720] hover:bg-[#1a1f2b] disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 transition-colors cursor-pointer"
                title="다음 페이지"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

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
