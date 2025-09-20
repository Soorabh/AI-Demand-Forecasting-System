import axios from 'axios';

// Local type definitions to avoid import issues
interface ForecastRequest {
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

interface RecentSummary {
  last4_growth_pct: number;
  yoy_last_period_pct: number;
  volatility_index: number;
}

interface AIAdjustmentRequest {
  industry: string;
  country: string;
  state?: string;
  city?: string;
  freq: 'D' | 'W' | 'M';
  horizon: number;
  recent_summary: RecentSummary;
  holidays_window: string[];
}

interface AIAdjustmentResponse {
  adjustment_pct: number;
  rationale: string;
  sources?: string[];
}

interface DataPoint {
  ds: string;
  y?: number;
  yhat?: number;
  yhat_lower?: number;
  yhat_upper?: number;
  yhat_final?: number;
}

interface ForecastMeta {
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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000, // 2 minutes for forecast requests
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    console.log('Request config:', config);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    
    if (error.response?.status === 413) {
      throw new Error('File too large. Please use a smaller file (max 10MB).');
    }
    
    if (error.response?.status === 422) {
      throw new Error('Invalid data format. Please check your file and try again.');
    }
    
    if (error.response?.status >= 500) {
      throw new Error('Server error. Please try again later.');
    }
    
    throw new Error(error.response?.data?.detail || error.message || 'An unexpected error occurred.');
  }
);

export interface ForecastRequestData extends Omit<ForecastRequest, 'file'> {
  file: File;
}

export async function generateForecast(requestData: ForecastRequestData): Promise<ForecastResponse> {
  const formData = new FormData();
  
  // Add file
  formData.append('file', requestData.file);
  
  // Add other fields
  formData.append('industry', requestData.industry);
  formData.append('country', requestData.country);
  formData.append('freq', requestData.freq);
  formData.append('horizon', requestData.horizon.toString());
  formData.append('date_col', requestData.date_col);
  formData.append('target_col', requestData.target_col);
  
  if (requestData.state) {
    formData.append('state', requestData.state);
  }
  if (requestData.city) {
    formData.append('city', requestData.city);
  }
  
  formData.append('apply_holidays', requestData.apply_holidays.toString());
  formData.append('apply_ai_adjustment', requestData.apply_ai_adjustment.toString());

  const response = await api.post<ForecastResponse>('/forecast', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: 180000, // 3 minutes for long-running forecasts
  });

  return response.data;
}

export async function getAIAdjustment(request: AIAdjustmentRequest): Promise<AIAdjustmentResponse> {
  const response = await api.post<AIAdjustmentResponse>('/ai-adjust', request);
  return response.data;
}

export async function healthCheck(): Promise<{ status: string; version?: string }> {
  const response = await api.get('/health');
  return response.data;
}

// Utility function to format API errors
// Geo-data API functions (using main API instance)
export async function getCountries() {
  const response = await api.get('/countries');
  return response.data;
}

export async function getSubdivisions(countryCode: string) {
  const response = await api.get(`/subdivisions/${countryCode}`);
  return response.data;
}

export async function getCities(subdivisionCode: string) {
  const response = await api.get(`/cities/${subdivisionCode}`);
  return response.data;
}

export function formatApiError(error: any): string {
  if (error.response?.data?.detail) {
    return error.response.data.detail;
  }
  
  if (error.response?.data?.error) {
    return error.response.data.error;
  }
  
  if (error.message) {
    return error.message;
  }
  
  return 'An unexpected error occurred. Please try again.';
}