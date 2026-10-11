export interface Report {
  id: number;
  title: string;
  report_date: string;
  author: string | null;
  status: "DRAFT" | "COMPLETED" | "ARCHIVED" | string;
  created_at: string;
  updated_at: string;
  details_count: number;
}

export interface ReportCreateInput {
  title: string;
  report_date?: string;
  author?: string;
  status?: string;
}

export interface ReportUpdateInput {
  title?: string;
  report_date?: string;
  author?: string;
  status?: string;
}

export interface ReportDetail {
  id: number;
  report_id: number;
  parent_id: number | null;
  path: string;
  sort_order: number;
  depth: number;
  title: string;
  content: string | null;
  description: string | null;
  image_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportDetailNode extends ReportDetail {
  children: ReportDetailNode[];
}

export interface ReportDetailCreateInput {
  title: string;
  content?: string;
  description?: string;
  image_url?: string;
  parent_id?: number | null;
  sort_order?: number;
}

export interface ReportDetailUpdateInput {
  title?: string;
  content?: string;
  description?: string;
  image_url?: string;
  sort_order?: number;
}
