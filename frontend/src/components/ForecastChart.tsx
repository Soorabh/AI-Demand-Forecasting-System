import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Eye, EyeOff } from 'lucide-react';
import type { ForecastResponse } from '../types';
import { format, parseISO } from 'date-fns';

interface ForecastChartProps {
  data: ForecastResponse;
}

interface ChartDataPoint {
  date: string;
  dateFormatted: string;
  historical?: number;
  baseline?: number;
  baselineLower?: number;
  baselineUpper?: number;
  adjusted?: number;
  isHistorical: boolean;
  isForecast: boolean;
}

export function ForecastChart({ data }: ForecastChartProps) {
  const [visibleSeries, setVisibleSeries] = useState({
    historical: true,
    baseline: true,
    adjusted: data.ai_adjustment?.applied || false,
    confidence: false,
  });

  const chartData = useMemo(() => {
    const points: ChartDataPoint[] = [];

    // Add historical data
    data.history.forEach((point) => {
      points.push({
        date: point.ds,
        dateFormatted: format(parseISO(point.ds), 'MMM dd, yyyy'),
        historical: point.y || 0,
        isHistorical: true,
        isForecast: false,
      });
    });

    // Add forecast data
    data.forecast_base.forEach((point, idx) => {
      const adjustedPoint = data.forecast_final[idx];
      points.push({
        date: point.ds,
        dateFormatted: format(parseISO(point.ds), 'MMM dd, yyyy'),
        baseline: point.yhat || 0,
        baselineLower: point.yhat_lower || 0,
        baselineUpper: point.yhat_upper || 0,
        adjusted: adjustedPoint?.yhat_final || point.yhat || 0,
        isHistorical: false,
        isForecast: true,
      });
    });

    return points.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [data]);

  const splitIndex = useMemo(() => {
    return chartData.findIndex(point => point.isForecast);
  }, [chartData]);

  const toggleSeries = (series: keyof typeof visibleSeries) => {
    setVisibleSeries(prev => ({ ...prev, [series]: !prev[series] }));
  };

  const formatValue = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toFixed(0);
  };

  const customTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{dataKey: string; color: string; value: number}>; label?: string }) => {
    if (!active || !payload || !payload.length) return null;

    const point = chartData.find(p => p.date === label);
    if (!point) return null;

    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-medium text-gray-900 mb-2">{point.dateFormatted}</p>
        {payload.map((entry: {dataKey: string; color: string; value: number; name?: string}, index: number) => {
          if (entry.value == null) return null;
          return (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name || entry.dataKey}: {formatValue(entry.value)}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Chart Controls */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => toggleSeries('historical')}
          className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
            visibleSeries.historical
              ? 'bg-blue-100 text-blue-800 border border-blue-200'
              : 'bg-gray-100 text-gray-600 border border-gray-200'
          }`}
        >
          {visibleSeries.historical ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          <span>Historical</span>
        </button>
        
        <button
          onClick={() => toggleSeries('baseline')}
          className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
            visibleSeries.baseline
              ? 'bg-green-100 text-green-800 border border-green-200'
              : 'bg-gray-100 text-gray-600 border border-gray-200'
          }`}
        >
          {visibleSeries.baseline ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          <span>Baseline Forecast</span>
        </button>

        {data.ai_adjustment?.applied && (
          <button
            onClick={() => toggleSeries('adjusted')}
            className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              visibleSeries.adjusted
                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                : 'bg-gray-100 text-gray-600 border border-gray-200'
            }`}
          >
            {visibleSeries.adjusted ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            <span>AI Adjusted</span>
          </button>
        )}

        <button
          onClick={() => toggleSeries('confidence')}
          className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
            visibleSeries.confidence
              ? 'bg-gray-200 text-gray-800 border border-gray-300'
              : 'bg-gray-100 text-gray-600 border border-gray-200'
          }`}
        >
          {visibleSeries.confidence ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          <span>Confidence Bands</span>
        </button>
      </div>

      {/* Chart */}
      <div className="h-96 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => format(parseISO(value), 'MMM dd')}
              tick={{ fontSize: 12 }}
            />
            <YAxis tickFormatter={formatValue} tick={{ fontSize: 12 }} />
            <Tooltip content={customTooltip} />
            <Legend />
            
            {/* Reference line to separate history from forecast */}
            {splitIndex > 0 && (
              <ReferenceLine
                x={chartData[splitIndex - 1]?.date}
                stroke="#666"
                strokeDasharray="2 2"
                opacity={0.5}
              />
            )}

            {/* Confidence bands */}
            {visibleSeries.confidence && (
              <>
                <Line
                  type="monotone"
                  dataKey="baselineLower"
                  stroke="#22c55e"
                  strokeWidth={1}
                  strokeDasharray="2 2"
                  dot={false}
                  opacity={0.5}
                  name="Lower Bound"
                />
                <Line
                  type="monotone"
                  dataKey="baselineUpper"
                  stroke="#22c55e"
                  strokeWidth={1}
                  strokeDasharray="2 2"
                  dot={false}
                  opacity={0.5}
                  name="Upper Bound"
                />
              </>
            )}

            {/* Historical data */}
            {visibleSeries.historical && (
              <Line
                type="monotone"
                dataKey="historical"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 3 }}
                name="Historical"
                connectNulls={false}
              />
            )}

            {/* Baseline forecast */}
            {visibleSeries.baseline && (
              <Line
                type="monotone"
                dataKey="baseline"
                stroke="#22c55e"
                strokeWidth={2}
                dot={{ fill: '#22c55e', r: 3 }}
                name="Baseline Forecast"
                connectNulls={false}
              />
            )}

            {/* AI adjusted forecast */}
            {visibleSeries.adjusted && data.ai_adjustment?.applied && (
              <Line
                type="monotone"
                dataKey="adjusted"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={{ fill: '#8b5cf6', r: 3 }}
                name="AI Adjusted"
                connectNulls={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart Legend */}
      <div className="text-xs text-gray-500 text-center">
        Historical data ends at the vertical dashed line. Forecast period begins after the line.
      </div>
    </div>
  );
}