import React, { useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  MapPin, 
  AlertCircle, 
  CheckCircle,
  Download,
  ExternalLink
} from 'lucide-react';
import type { ForecastResponse, ConfigFormData } from '../types';
import { ForecastChart } from './ForecastChart';
import { downloadExcel } from '../lib/fileUtils';

interface ResultsPanelProps {
  data: ForecastResponse;
  config: ConfigFormData;
}

export function ResultsPanel({ data, config }: ResultsPanelProps) {
  const kpis = useMemo(() => {
    const baselineTotal = data.forecast_base.reduce((sum, point) => sum + (point.yhat || 0), 0);
    const adjustedTotal = data.forecast_final.reduce((sum, point) => sum + (point.yhat_final || 0), 0);
    const delta = adjustedTotal - baselineTotal;
    const deltaPercent = baselineTotal > 0 ? (delta / baselineTotal) * 100 : 0;

    const historicalTotal = data.history.slice(-data.meta.horizon).reduce((sum, point) => sum + (point.y || 0), 0);
    const vsHistorical = historicalTotal > 0 ? ((adjustedTotal - historicalTotal) / historicalTotal) * 100 : 0;

    return {
      baselineTotal,
      adjustedTotal,
      delta,
      deltaPercent,
      vsHistorical,
    };
  }, [data]);

  const formatNumber = (value: number) => {
    if (Math.abs(value) >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (Math.abs(value) >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toFixed(0);
  };

  const formatPercent = (value: number) => {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  const handleDownloadExcel = () => {
    const excelData = data.forecast_final.map((point, idx) => {
      const basePoint = data.forecast_base[idx];
      return {
        Date: point.ds,
        'Baseline Forecast': basePoint?.yhat?.toFixed(2) || '',
        'AI Adjusted Forecast': point.yhat_final?.toFixed(2) || '',
        'Adjustment %': data.ai_adjustment?.adjustment_pct?.toFixed(2) || '0',
        // 'Lower Bound': basePoint?.yhat_lower?.toFixed(2) || '',
        // 'Upper Bound': basePoint?.yhat_upper?.toFixed(2) || '',
      };
    });

    const filename = `forecast_${config.industry}_${config.freq}_${new Date().toISOString().split('T')[0]}`;
    downloadExcel(excelData, filename);
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Baseline Forecast</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(kpis.baselineTotal)}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">AI Adjusted Forecast</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(kpis.adjustedTotal)}</p>
              {data.ai_adjustment?.applied && (
                <div className="flex items-center space-x-1 mt-1">
                  {kpis.delta > 0 ? (
                    <TrendingUp className="h-3 w-3 text-green-600" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-600" />
                  )}
                  <span className={`text-xs font-medium ${kpis.delta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPercent(kpis.deltaPercent)}
                  </span>
                </div>
              )}
            </div>
            <TrendingUp className={`h-8 w-8 ${kpis.delta >= 0 ? 'text-green-600' : 'text-red-600'}`} />
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">vs. Historical</p>
              <div className="flex items-center space-x-2">
                <span className="text-2xl font-bold text-gray-900">{formatPercent(kpis.vsHistorical)}</span>
              </div>
            </div>
            {kpis.vsHistorical > 0 ? (
              <TrendingUp className="h-8 w-8 text-green-600" />
            ) : (
              <TrendingDown className="h-8 w-8 text-red-600" />
            )}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Forecast Visualization</h3>
          <button
            onClick={handleDownloadExcel}
            className="btn-secondary flex items-center space-x-2"
          >
            <Download className="h-4 w-4" />
            <span>Download Excel</span>
          </button>
        </div>
        <ForecastChart data={data} />
      </div>

      {/* AI Adjustment Info */}
      {data.ai_adjustment?.applied && (
        <div className="card p-6">
          <div className="flex items-center space-x-2 mb-4">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <h3 className="text-lg font-medium text-gray-900">AI Macro Adjustment</h3>
            <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full">
              {formatPercent(data.ai_adjustment.adjustment_pct)}
            </span>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <p className="text-sm text-gray-700">{data.ai_adjustment.rationale}</p>
          </div>

          {data.ai_adjustment.sources && data.ai_adjustment.sources.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Sources:</h4>
              <ul className="space-y-1">
                {data.ai_adjustment.sources.map((source, idx) => (
                  <li key={idx} className="flex items-center space-x-2 text-xs">
                    <ExternalLink className="h-3 w-3 text-gray-400" />
                    <a
                      href={source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:text-primary-700 truncate"
                    >
                      {source}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Metadata */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Forecast Details</h3>
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-xs">
              <Calendar className="h-3 w-3 text-gray-400" />
              <span>Frequency: {config.freq === 'D' ? 'Daily' : config.freq === 'W' ? 'Weekly' : 'Monthly'}</span>
            </div>
            <div className="flex items-center space-x-2 text-xs">
              <MapPin className="h-3 w-3 text-gray-400" />
              <span>
                {config.industry} • {config.city ? `${config.city}, ` : ''}{config.state ? `${config.state}, ` : ''}{config.country}
              </span>
            </div>
            <div className="flex items-center space-x-2 text-xs">
              <TrendingUp className="h-3 w-3 text-gray-400" />
              <span>Horizon: {data.meta.horizon} periods</span>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Data Quality</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Training Period:</span>
              <span className="font-medium">{data.meta.train_start} to {data.meta.train_end}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Data Points:</span>
              <span className="font-medium">{data.meta.processed_rows} processed / {data.meta.original_rows} original</span>
            </div>
            {data.meta.holidays_used.length > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Holidays:</span>
                <span className="font-medium">{data.meta.holidays_used.length} included</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Privacy Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h4 className="text-sm font-medium text-blue-900">Privacy Notice</h4>
            <p className="text-xs text-blue-700 mt-1">
              Your sales data was processed only on our server for modeling and was never sent to external AI models. 
              Only anonymous context was sent to AI Model for macro economics adjustment.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}