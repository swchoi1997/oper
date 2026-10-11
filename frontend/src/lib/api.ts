import {
  Report,
  ReportCreateInput,
  ReportUpdateInput,
  ReportDetail,
  ReportDetailNode,
  ReportDetailCreateInput,
  ReportDetailUpdateInput,
} from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    let errorMsg = `API Error: ${response.status} ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData.detail) {
        errorMsg = typeof errorData.detail === "string" ? errorData.detail : JSON.stringify(errorData.detail);
      }
    } catch {
      // ignore json parse error
    }
    throw new Error(errorMsg);
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json();
}

export const api = {
  // Report API
  async getReports(page: number = 1, size: number = 20, search?: string): Promise<{ items: Report[]; total: number }> {
    const params = new URLSearchParams({ page: page.toString(), size: size.toString() });
    if (search) params.append("search", search);
    return request(`/api/reports?${params.toString()}`);
  },

  async getReport(id: number): Promise<Report> {
    return request(`/api/reports/${id}`);
  },

  async createReport(data: ReportCreateInput): Promise<Report> {
    return request("/api/reports", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateReport(id: number, data: ReportUpdateInput): Promise<Report> {
    return request(`/api/reports/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async deleteReport(id: number): Promise<void> {
    return request(`/api/reports/${id}`, {
      method: "DELETE",
    });
  },

  // Report Detail API
  async getDetailsTree(reportId: number): Promise<ReportDetailNode[]> {
    return request(`/api/reports/${reportId}/details/tree`);
  },

  async getDetailsFlat(reportId: number): Promise<ReportDetail[]> {
    return request(`/api/reports/${reportId}/details/flat`);
  },

  async getDetail(reportId: number, detailId: number): Promise<ReportDetail> {
    return request(`/api/reports/${reportId}/details/${detailId}`);
  },

  async createDetail(reportId: number, data: ReportDetailCreateInput): Promise<ReportDetail> {
    return request(`/api/reports/${reportId}/details`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateDetail(reportId: number, detailId: number, data: ReportDetailUpdateInput): Promise<ReportDetail> {
    return request(`/api/reports/${reportId}/details/${detailId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async deleteDetail(reportId: number, detailId: number): Promise<void> {
    return request(`/api/reports/${reportId}/details/${detailId}`, {
      method: "DELETE",
    });
  },

  async reorderDetail(
    reportId: number,
    targetDetailId: number,
    newParentId: number | null,
    newSortOrder: number
  ): Promise<ReportDetailNode[]> {
    return request(`/api/reports/${reportId}/details/reorder`, {
      method: "POST",
      body: JSON.stringify({
        target_detail_id: targetDetailId,
        new_parent_id: newParentId,
        new_sort_order: newSortOrder,
      }),
    });
  },
};
