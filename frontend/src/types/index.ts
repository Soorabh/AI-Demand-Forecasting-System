// API Types
export interface RecentSummary {
  last4_growth_pct: number;
  yoy_last_period_pct: number;
  volatility_index: number;
}

export interface AIAdjustmentRequest {
  industry: string;
  country: string;
  state?: string;
  city?: string;
  freq: 'D' | 'W' | 'M';
  horizon: number;
  recent_summary: RecentSummary;
  holidays_window: string[];
}

export interface AIAdjustmentResponse {
  adjustment_pct: number;
  rationale: string;
  sources?: string[];
}

export interface ForecastRequest {
  industry: string;
  country: string;
  state?: string;
  city?: string;
  freq: 'D' | 'W' | 'M';
  horizon: number;
  date_col: string;
  target_col: string;
  apply_holidays: boolean;
  apply_ai_adjustment: boolean;
}

export interface DataPoint {
  ds: string;
  y?: number;
  yhat?: number;
  yhat_lower?: number;
  yhat_upper?: number;
  yhat_final?: number;
}

export interface ForecastMeta {
  freq: string;
  train_start: string;
  train_end: string;
  horizon: number;
  holidays_used: string[];
  original_rows: number;
  processed_rows: number;
  null_dates: number;
  null_targets: number;
}

export interface ForecastResponse {
  meta: ForecastMeta;
  ai_adjustment?: {
    applied: boolean;
    adjustment_pct: number;
    rationale: string;
    sources: string[];
  };
  history: DataPoint[];
  forecast_base: DataPoint[];
  forecast_final: DataPoint[];
}

// UI Types
export interface ColumnDetection {
  name: string;
  confidence: number;
  type: 'date' | 'numeric';
  sample_values: string[];
}

export interface FilePreview {
  columns: string[];
  rows: Record<string, any>[];
  total_rows: number;
}

export interface ConfigFormData {
  industry: string;
  country: string;
  state: string;
  city: string;
  freq: 'D' | 'W' | 'M';
  horizon: number;
  date_col: string;
  target_col: string;
  apply_holidays: boolean;
  apply_ai_adjustment: boolean;
}

export interface ProcessingStep {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  message?: string;
}

// Utility types
export type FrequencyOption = {
  value: 'D' | 'W' | 'M';
  label: string;
  description: string;
};

export type IndustryOption = {
  value: string;
  label: string;
};

export interface UploadState {
  file: File | null;
  preview: FilePreview | null;
  detectedColumns: {
    date: ColumnDetection | null;
    target: ColumnDetection | null;
  };
  isProcessing: boolean;
  error: string | null;
}

// Geo-related types
export interface Country {
  value: string;
  label: string;
  code: string;
}

export interface Subdivision {
  value: string;
  label: string;
  code: string;
  type: string;
}

export interface City {
  value: string;
  label: string;
  code: string;
}