import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';
import { DollarSign, Calculator, TrendingUp, Download } from 'lucide-react';

interface ForecastPoint {
  ds: string;
  yhat_final?: number;
  yhat?: number;
}

interface FinancialProjectionProps {
  forecastData: ForecastPoint[];
  title?: string;
  country?: string;
}

interface FinancialInputs {
  avgSellingPrice: number;
  avgCostOfGoods: number;
}

interface FinancialMetrics {
  period: string;
  salesUnits: number;
  grossRevenue: number;
  costOfGoods: number;
  grossProfit: number;
  grossMargin: number;
}

export const FinancialProjection: React.FC<FinancialProjectionProps> = ({
  forecastData,
  title = "Financial Projection",
  country = 'USA'
}) => {
  const [inputs, setInputs] = useState<FinancialInputs>({
    avgSellingPrice: 0,
    avgCostOfGoods: 0
  });

  const [errors, setErrors] = useState<Partial<FinancialInputs>>({});

  // Determine currency based on country
  const currency = useMemo(() => {
    const currencySymbol = country === 'India' ? '₹' : '$';
    const currencyName = country === 'India' ? 'INR' : 'USD';
    return { symbol: currencySymbol, name: currencyName };
  }, [country]);

  const validateInputs = (newInputs: FinancialInputs): Partial<FinancialInputs> => {
    const newErrors: Partial<FinancialInputs> = {};

    if (!newInputs.avgSellingPrice || newInputs.avgSellingPrice <= 0) {
      newErrors.avgSellingPrice = 0;
    }

    if (!newInputs.avgCostOfGoods || newInputs.avgCostOfGoods < 0) {
      newErrors.avgCostOfGoods = 0;
    }

    if (newInputs.avgCostOfGoods >= newInputs.avgSellingPrice) {
      newErrors.avgCostOfGoods = 0;
    }

    return newErrors;
  };

  const handleInputChange = (field: keyof FinancialInputs, value: string) => {
    const numValue = parseFloat(value) || 0;
    const newInputs = { ...inputs, [field]: numValue };

    setInputs(newInputs);
    setErrors(validateInputs(newInputs));
  };

  const financialMetrics: FinancialMetrics[] = useMemo(() => {
    if (!forecastData || forecastData.length === 0 || inputs.avgSellingPrice <= 0) {
      return [];
    }

    return forecastData.map(point => {
      const salesUnits = Math.round(point.yhat_final || point.yhat || 0);
      const grossRevenue = salesUnits * inputs.avgSellingPrice;
      const costOfGoods = salesUnits * inputs.avgCostOfGoods;
      const grossProfit = grossRevenue - costOfGoods;
      const grossMargin = grossRevenue > 0 ? (grossProfit / grossRevenue) * 100 : 0;

      return {
        period: point.ds,
        salesUnits,
        grossRevenue,
        costOfGoods,
        grossProfit,
        grossMargin
      };
    });
  }, [forecastData, inputs]);

  const summaryMetrics = useMemo(() => {
    if (financialMetrics.length === 0) {
      return {
        totalRevenue: 0,
        totalProfit: 0,
        totalUnits: 0,
        avgMargin: 0
      };
    }

    const totalRevenue = financialMetrics.reduce((sum, item) => sum + item.grossRevenue, 0);
    const totalProfit = financialMetrics.reduce((sum, item) => sum + item.grossProfit, 0);
    const totalUnits = financialMetrics.reduce((sum, item) => sum + item.salesUnits, 0);
    const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    return { totalRevenue, totalProfit, totalUnits, avgMargin };
  }, [financialMetrics]);

  const downloadFinancialProjection = () => {
    if (financialMetrics.length === 0) return;

    // Prepare data for export
    const exportData = financialMetrics.map(item => ({
      'Period': item.period,
      'Sales Units': item.salesUnits,
      'Gross Revenue': item.grossRevenue.toFixed(2),
      'Cost of Goods Sold': item.costOfGoods.toFixed(2),
      'Gross Profit': item.grossProfit.toFixed(2),
      'Gross Margin %': item.grossMargin.toFixed(2)
    }));

    // Add summary row
    exportData.push({
      'Period': 'TOTAL',
      'Sales Units': summaryMetrics.totalUnits,
      'Gross Revenue': summaryMetrics.totalRevenue.toFixed(2),
      'Cost of Goods Sold': (summaryMetrics.totalRevenue - summaryMetrics.totalProfit).toFixed(2),
      'Gross Profit': summaryMetrics.totalProfit.toFixed(2),
      'Gross Margin %': summaryMetrics.avgMargin.toFixed(2)
    });

    // Convert to CSV
    const headers = Object.keys(exportData[0]);
    const csvContent = [
      headers.join(','),
      ...exportData.map(row => Object.values(row).join(','))
    ].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `financial_projection_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const isInputValid = inputs.avgSellingPrice > 0 && inputs.avgCostOfGoods >= 0 && inputs.avgCostOfGoods < inputs.avgSellingPrice;

  if (!forecastData || forecastData.length === 0) {
    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        padding: '2rem',
        textAlign: 'center',
        color: '#6b7280'
      }}>
        <DollarSign style={{ height: '3rem', width: '3rem', margin: '0 auto', marginBottom: '1rem' }} />
        <p>No forecast data available for financial projection</p>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '0.5rem',
      padding: '2rem',
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
      border: '1px solid #e5e7eb'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <DollarSign style={{ height: '1.5rem', width: '1.5rem', color: '#0284c7' }} />
          <h3 style={{ color: '#111827', fontSize: '1.5rem', margin: '0' }}>
            {title}
          </h3>
        </div>
        <p style={{ color: '#6b7280', margin: '0' }}>
          Calculate revenue and profitability based on forecast units
        </p>
      </div>

      {/* Input Form */}
      <div style={{
        backgroundColor: '#f9fafb',
        borderRadius: '0.5rem',
        padding: '1.5rem',
        marginBottom: '2rem',
        border: '1px solid #e5e7eb'
      }}>
        <h4 style={{ color: '#111827', fontSize: '1.125rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Calculator style={{ height: '1rem', width: '1rem' }} />
          Financial Parameters
        </h4>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              Average Selling Price per Unit ({currency.symbol})
            </label>
            <input
              type="number"
              value={inputs.avgSellingPrice || ''}
              onChange={(e) => handleInputChange('avgSellingPrice', e.target.value)}
              placeholder="e.g., 50.00"
              min="0"
              step="0.01"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: `1px solid ${errors.avgSellingPrice !== undefined ? '#dc2626' : '#d1d5db'}`,
                borderRadius: '0.375rem',
                fontSize: '0.875rem'
              }}
            />
            {errors.avgSellingPrice !== undefined && (
              <p style={{ fontSize: '0.75rem', color: '#dc2626', margin: '0.25rem 0 0 0' }}>
                Please enter a valid selling price greater than {currency.symbol}0
              </p>
            )}
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              Average Cost of Goods per Unit ({currency.symbol})
            </label>
            <input
              type="number"
              value={inputs.avgCostOfGoods || ''}
              onChange={(e) => handleInputChange('avgCostOfGoods', e.target.value)}
              placeholder="e.g., 30.00"
              min="0"
              step="0.01"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: `1px solid ${errors.avgCostOfGoods !== undefined ? '#dc2626' : '#d1d5db'}`,
                borderRadius: '0.375rem',
                fontSize: '0.875rem'
              }}
            />
            {errors.avgCostOfGoods !== undefined && (
              <p style={{ fontSize: '0.75rem', color: '#dc2626', margin: '0.25rem 0 0 0' }}>
                Cost must be less than selling price and ≥ {currency.symbol}0
              </p>
            )}
          </div>
        </div>

        {isInputValid && (
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem',
            backgroundColor: '#dcfce7',
            borderRadius: '0.375rem',
            border: '1px solid #bbf7d0'
          }}>
            <p style={{ fontSize: '0.875rem', color: '#16a34a', margin: '0' }}>
              <strong>Gross Margin:</strong> {((inputs.avgSellingPrice - inputs.avgCostOfGoods) / inputs.avgSellingPrice * 100).toFixed(2)}%
              ({currency.symbol}{(inputs.avgSellingPrice - inputs.avgCostOfGoods).toFixed(2)} profit per unit)
            </p>
          </div>
        )}
      </div>

      {/* Results */}
      {isInputValid && financialMetrics.length > 0 && (
        <div>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <div style={{ backgroundColor: '#eff6ff', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #bfdbfe' }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: '500', color: '#1e40af', marginBottom: '0.5rem' }}>
                Total Revenue
              </h4>
              <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e40af', margin: '0' }}>
                {currency.symbol}{summaryMetrics.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>

            <div style={{ backgroundColor: '#f0fdf4', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #bbf7d0' }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: '500', color: '#15803d', marginBottom: '0.5rem' }}>
                Total Gross Profit
              </h4>
              <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#15803d', margin: '0' }}>
                {currency.symbol}{summaryMetrics.totalProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>

            <div style={{ backgroundColor: '#fefce8', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #fde047' }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: '500', color: '#a16207', marginBottom: '0.5rem' }}>
                Total Units
              </h4>
              <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#a16207', margin: '0' }}>
                {summaryMetrics.totalUnits.toLocaleString()}
              </p>
            </div>

            <div style={{ backgroundColor: '#f5f3ff', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #c4b5fd' }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: '500', color: '#7c3aed', marginBottom: '0.5rem' }}>
                Average Margin
              </h4>
              <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#7c3aed', margin: '0' }}>
                {summaryMetrics.avgMargin.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Charts */}
          <div style={{ display: 'grid', gap: '2rem', marginBottom: '2rem' }}>
            {/* Revenue and Profit Chart */}
            <div>
              <h4 style={{ color: '#111827', fontSize: '1.125rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <TrendingUp style={{ height: '1rem', width: '1rem' }} />
                Revenue vs Profit by Period
              </h4>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={financialMetrics}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis tickFormatter={(value) => `${currency.symbol}${(value / 1000).toFixed(0)}K`} />
                  <Tooltip
                    formatter={(value) => [`${currency.symbol}${(value as number).toLocaleString()}`, '']}
                    labelStyle={{ color: '#111827' }}
                  />
                  <Legend />
                  <Bar dataKey="grossRevenue" name="Gross Revenue" fill="#0284c7" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="grossProfit" name="Gross Profit" fill="#16a34a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Data Table Preview */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ color: '#111827', fontSize: '1.125rem', margin: '0' }}>
                  Projection Preview
                </h4>
                <button
                  onClick={downloadFinancialProjection}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 1rem',
                    backgroundColor: '#0284c7',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    cursor: 'pointer'
                  }}
                >
                  <Download style={{ height: '1rem', width: '1rem' }} />
                  Export CSV
                </button>
              </div>
              <div style={{
                backgroundColor: '#f9fafb',
                borderRadius: '0.5rem',
                padding: '1rem',
                maxHeight: '250px',
                overflowY: 'auto'
              }}>
                <table style={{ width: '100%', fontSize: '0.75rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f3f4f6' }}>
                      <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '500', color: '#374151' }}>Period</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '500', color: '#374151' }}>Units</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '500', color: '#374151' }}>Revenue</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '500', color: '#374151' }}>Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {financialMetrics.slice(0, 8).map((item, idx) => (
                      <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#f9fafb' }}>
                        <td style={{ padding: '0.5rem', color: '#6b7280' }}>{item.period}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', color: '#111827' }}>
                          {item.salesUnits.toLocaleString()}
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', color: '#111827' }}>
                          {currency.symbol}{item.grossRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', color: '#16a34a', fontWeight: '500' }}>
                          {currency.symbol}{item.grossProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {financialMetrics.length > 8 && (
                  <p style={{ fontSize: '0.75rem', color: '#6b7280', textAlign: 'center', marginTop: '0.5rem', margin: '0.5rem 0 0 0' }}>
                    Showing first 8 of {financialMetrics.length} periods
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};