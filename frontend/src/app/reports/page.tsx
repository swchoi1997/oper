"use client";

import { useState, useEffect, useCallback } from "react";
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
  Clock,
  Layers,
} from "lucide-react";

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
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
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Fetch reports
  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getReports(page, 12, debouncedSearch);
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
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            완료
          </span>
        );
      case "ARCHIVED":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
            보관
          </span>
        );
      case "DRAFT":
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            작성 중
          </span>
        );
    }
  };

  return (
    <div className="min-h-full py-6 px-6 lg:px-8 max-w-7xl mx-auto w-full">
      {/* Top Banner / Stats */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <span>운영 일지 목록</span>
              <span className="text-xs px-2 py-0.5 rounded font-mono bg-white/[0.06] text-slate-400 border border-white/[0.08]">
                {total}
              </span>
            </h1>
            <p className="mt-0.5 text-xs text-slate-400">
              계층형 작업 내역과 시스템 모니터링 기록을 관리합니다.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchReports()}
              className="p-2 text-slate-400 hover:text-white bg-[#0d121f] hover:bg-[#141a2c] border border-white/[0.08] rounded-md transition-colors"
              title="새로고침"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => {
                setSelectedReport(null);
                setModalMode("create");
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-medium transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>새 일지 작성</span>
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="mt-4 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="일지 제목 또는 작성자로 검색..."
              className="w-full pl-9 pr-3 py-1.5 bg-[#0d121f] border border-white/[0.08] rounded-md text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          {error}
        </div>
      )}

      {/* Reports Grid */}
      {isLoading && reports.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-36 rounded-lg bg-[#0d121f] border border-white/[0.04] animate-pulse"
            />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-xl bg-[#0d121f] border border-dashed border-white/[0.08]">
          <FileSpreadsheet className="mx-auto w-10 h-10 text-slate-600 mb-2" />
          <h3 className="text-sm font-medium text-white">등록된 운영 일지가 없습니다</h3>
          <p className="mt-1 text-xs text-slate-400">새로운 운영 일지를 작성해보세요.</p>
          <button
            onClick={() => {
              setSelectedReport(null);
              setModalMode("create");
              setIsModalOpen(true);
            }}
            className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>첫 일지 생성</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map((report) => (
            <div
              key={report.id}
              className="group relative flex flex-col justify-between rounded-lg bg-[#0d121f] border border-white/[0.08] hover:border-white/[0.18] transition-all overflow-hidden"
            >
              <div className="p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    <span>{report.report_date}</span>
                  </div>
                  {getStatusBadge(report.status)}
                </div>

                <Link
                  href={`/reports/${report.id}`}
                  className="block hover:text-blue-400 transition-colors"
                >
                  <h2 className="text-sm font-semibold text-white line-clamp-2 leading-snug">
                    {report.title}
                  </h2>
                </Link>

                <div className="mt-3 flex items-center gap-4 text-xs text-slate-400 border-t border-white/[0.04] pt-2.5">
                  <div className="flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-500" />
                    <span>{report.author || "미지정"}</span>
                  </div>
                  <div className="flex items-center gap-1 text-blue-400">
                    <ListTree className="w-3 h-3" />
                    <span className="font-mono text-[11px]">{report.details_count} 항목</span>
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="px-4 py-2.5 bg-[#0a0e18] border-t border-white/[0.06] flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setSelectedReport(report);
                      setModalMode("edit");
                      setIsModalOpen(true);
                    }}
                    className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/[0.06] transition-colors"
                    title="수정"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => {
                      setReportToDelete(report);
                      setIsDeleteModalOpen(true);
                    }}
                    className="p-1 text-slate-400 hover:text-red-400 rounded hover:bg-red-500/10 transition-colors"
                    title="삭제"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>

                <Link
                  href={`/reports/${report.id}`}
                  className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium"
                >
                  <span>세부 일지 보기</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
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
        description={`"${reportToDelete?.title}" 일지와 포함된 모든 세부 항목이 완전히 삭제됩니다. 계속하시겠습니까?`}
        confirmLabel="일지 삭제"
        isDanger={true}
      />
    </div>
  );
}
