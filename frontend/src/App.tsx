import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { BarChart3, CheckCircle, TrendingUp, DollarSign, LineChart } from 'lucide-react';
import { SimpleUploadArea } from './components/SimpleUploadArea';
import { ConfigForm } from './components/ConfigForm';
import { AnalysisModule } from './components/AnalysisModule';
import { FinancialProjection } from './components/FinancialProjection';
import { generateForecast, formatApiError, type ForecastResponse } from './api/client';
import type { FilePreview } from './lib/fileUtils';
import type { ColumnDetection } from './lib/detectColumns';
import type {
  UploadState,
  ConfigFormData
} from './types';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

type AppStep = 'upload' | 'configure' | 'results';
type ResultsTab = 'forecast' | 'analysis' | 'financial';

function AppContent() {
  const [currentStep, setCurrentStep] = useState<AppStep>('upload');
  const [activeTab, setActiveTab] = useState<ResultsTab>('forecast');
  const [uploadState, setUploadState] = useState<UploadState>({
    file: null,
    preview: null,
    detectedColumns: { date: null, target: null },
    isProcessing: false,
    error: null,
  });
  const [isGeneratingForecast, setIsGeneratingForecast] = useState(false);
  const [forecastResult, setForecastResult] = useState<ForecastResponse | null>(null);
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [configData, setConfigData] = useState<ConfigFormData | null>(null);

  const resetApp = () => {
    setCurrentStep('upload');
    setActiveTab('forecast');
    setUploadState({
      file: null,
      preview: null,
      detectedColumns: { date: null, target: null },
      isProcessing: false,
      error: null,
    });
    setForecastResult(null);
    setForecastError(null);
    setIsGeneratingForecast(false);
    setConfigData(null);
  };

  const handleFileProcessed = (
    file: File, 
    preview: FilePreview, 
    detectedColumns: { date: ColumnDetection | null; target: ColumnDetection | null }
  ) => {
    setUploadState(prev => ({ ...prev, file, preview, detectedColumns }));
    setCurrentStep('configure');
  };

  const handleConfigSubmit = async (formData: ConfigFormData) => {
    if (!uploadState.file) return;

    setConfigData(formData);
    setIsGeneratingForecast(true);
    setForecastError(null);
    
    try {
      const result = await generateForecast({
        file: uploadState.file,
        industry: formData.industry,
        country: formData.country,
        state: formData.state || undefined,
        city: formData.city || undefined,
        freq: formData.freq,
        horizon: formData.horizon,
        date_col: formData.date_col,
        target_col: formData.target_col,
        apply_holidays: formData.apply_holidays,
        apply_ai_adjustment: formData.apply_ai_adjustment,
      });
      
      setForecastResult(result);
      setCurrentStep('results');
    } catch (error) {
      console.error('Forecast generation failed:', error);
      setForecastError(formatApiError(error));
    } finally {
      setIsGeneratingForecast(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      {/* Header */}
      <div style={{ 
        backgroundColor: 'white', 
        borderBottom: '1px solid #e5e7eb',
        padding: '1.5rem 0'
      }}>
        <div style={{ 
          maxWidth: '1200px', 
          margin: '0 auto', 
          padding: '0 1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <BarChart3 style={{ height: '2rem', width: '2rem', color: '#0284c7' }} />
          <div>
            <h1 style={{ 
              fontSize: '1.5rem', 
              fontWeight: 'bold', 
              color: '#111827',
              margin: '0'
            }}>
              AI Forecasting
            </h1>
            <p style={{ 
              color: '#6b7280', 
              margin: '0.25rem 0 0 0',
              fontSize: '0.875rem'
            }}>
              Upload data → Configure → Generate forecast with AI adjustment
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ 
        maxWidth: '1200px', 
        margin: '0 auto', 
        padding: '2rem 1rem'
      }}>
        {currentStep === 'upload' && (
          <SimpleUploadArea
            onFileProcessed={handleFileProcessed}
            uploadState={uploadState}
            setUploadState={setUploadState}
          />
        )}

        {currentStep === 'configure' && uploadState.preview && (
          <>
            <ConfigForm
              preview={uploadState.preview}
              detectedColumns={uploadState.detectedColumns}
              onSubmit={handleConfigSubmit}
              isLoading={isGeneratingForecast}
            />
            
            {forecastError && (
              <div style={{ 
                marginTop: '1rem',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '0.375rem',
                padding: '0.75rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <CheckCircle style={{ height: '1rem', width: '1rem', color: '#dc2626', marginRight: '0.5rem' }} />
                  <span style={{ fontSize: '0.875rem', color: '#b91c1c' }}>
                    {forecastError}
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        {currentStep === 'results' && forecastResult && (
          <div>
            {/* Header */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '0.5rem 0.5rem 0 0',
              padding: '1.5rem 2rem',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
              border: '1px solid #e5e7eb',
              borderBottom: 'none'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ color: '#111827', marginBottom: '0.5rem', fontSize: '1.5rem' }}>
                    Results Dashboard
                  </h3>
                  <p style={{ color: '#6b7280', margin: '0' }}>
                    {forecastResult.meta.freq}-frequency forecast for {forecastResult.meta.horizon} periods
                  </p>
                </div>
                <button
                  className="btn-secondary"
                  onClick={resetApp}
                >
                  Start Over
                </button>
              </div>

              {/* Tab Navigation */}
              <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #e5e7eb', marginBottom: '0', paddingBottom: '0' }}>
                <button
                  onClick={() => setActiveTab('forecast')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1rem',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: activeTab === 'forecast' ? '#0284c7' : '#6b7280',
                    fontSize: '0.875rem',
                    fontWeight: activeTab === 'forecast' ? '600' : '400',
                    borderBottom: activeTab === 'forecast' ? '2px solid #0284c7' : '2px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <LineChart style={{ height: '1rem', width: '1rem' }} />
                  Forecast Details
                </button>
                <button
                  onClick={() => setActiveTab('analysis')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1rem',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: activeTab === 'analysis' ? '#0284c7' : '#6b7280',
                    fontSize: '0.875rem',
                    fontWeight: activeTab === 'analysis' ? '600' : '400',
                    borderBottom: activeTab === 'analysis' ? '2px solid #0284c7' : '2px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <TrendingUp style={{ height: '1rem', width: '1rem' }} />
                  Data Analysis
                </button>
                <button
                  onClick={() => setActiveTab('financial')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1rem',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: activeTab === 'financial' ? '#0284c7' : '#6b7280',
                    fontSize: '0.875rem',
                    fontWeight: activeTab === 'financial' ? '600' : '400',
                    borderBottom: activeTab === 'financial' ? '2px solid #0284c7' : '2px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <DollarSign style={{ height: '1rem', width: '1rem' }} />
                  Financial Projection
                </button>
              </div>
            </div>

            {/* Tab Content */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '0 0 0.5rem 0.5rem',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
              border: '1px solid #e5e7eb',
              borderTop: 'none'
            }}>
              {activeTab === 'forecast' && (
                <div style={{ padding: '2rem' }}>
                  {/* Meta Information */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                    <div style={{ backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '0.5rem' }}>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>Training Period</h4>
                      <p style={{ fontSize: '0.875rem', color: '#111827', margin: '0' }}>
                        {forecastResult.meta.train_start} to {forecastResult.meta.train_end}
                      </p>
                    </div>
                    <div style={{ backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '0.5rem' }}>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>Data Quality</h4>
                      <p style={{ fontSize: '0.875rem', color: '#111827', margin: '0' }}>
                        {forecastResult.meta.processed_rows} / {forecastResult.meta.original_rows} rows processed
                      </p>
                    </div>
                    <div style={{ backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '0.5rem' }}>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>Holidays</h4>
                      <p style={{ fontSize: '0.875rem', color: '#111827', margin: '0' }}>
                        {forecastResult.meta.holidays_used.length} holidays applied
                      </p>
                    </div>
                  </div>

                  {/* AI Adjustment */}
                  {forecastResult.ai_adjustment && (
                    <div style={{
                      backgroundColor: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      borderRadius: '0.5rem',
                      padding: '1rem',
                      marginBottom: '2rem'
                    }}>
                      <h4 style={{ fontSize: '1rem', fontWeight: '500', color: '#1e40af', marginBottom: '0.5rem' }}>
                        AI Macro Adjustment Applied
                      </h4>
                <p style={{ fontSize: '0.875rem', color: '#1d4ed8', marginBottom: '0.5rem' }}>
                  <strong>Adjustment:</strong> {forecastResult.ai_adjustment.adjustment_pct > 0 ? '+' : ''}{forecastResult.ai_adjustment.adjustment_pct}%
                </p>
                <div>
                  <p style={{ fontSize: '0.875rem', color: '#1d4ed8', fontWeight: '500', marginBottom: '0.5rem' }}>
                    Business Insights:
                  </p>
                  <div style={{ fontSize: '0.875rem', color: '#1d4ed8', lineHeight: '1.5' }}>
                    {(() => {
                      const rationale = forecastResult.ai_adjustment.rationale;

                      // Check if the rationale has numbered points (1), 2), 3), etc.)
                      if (rationale.match(/\d+\)\s+/)) {
                        // Split by numbered points and create bullet points
                        return rationale
                          .split(/\d+\)\s*/)
                          .filter(point => point.trim())
                          .map((point, idx) => (
                            <p key={idx} style={{ margin: '0.25rem 0', paddingLeft: '1rem', position: 'relative' }}>
                              <span style={{ position: 'absolute', left: '0', fontWeight: '500' }}>•</span>
                              {point.trim().replace(/[;,]\s*$/, '')}
                            </p>
                          ));
                      } else {
                        // Display as a single paragraph summary
                        return (
                          <p style={{ margin: '0.5rem 0', lineHeight: '1.6' }}>
                            {rationale.trim()}
                          </p>
                        );
                      }
                    })()}
                  </div>
                </div>
                {forecastResult.ai_adjustment.sources && forecastResult.ai_adjustment.sources.length > 0 && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <p style={{ fontSize: '0.75rem', color: '#1d4ed8', margin: '0 0 0.25rem 0' }}>
                      <strong>Sources:</strong>
                    </p>
                    {forecastResult.ai_adjustment.sources.map((source, idx) => (
                      <a 
                        key={idx}
                        href={source}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: '0.75rem', color: '#1d4ed8', display: 'block', marginBottom: '0.25rem', textDecoration: 'underline' }}
                      >
                        {source}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Forecast Summary */}
            <div style={{ marginBottom: '2rem' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: '500', color: '#111827', marginBottom: '1rem' }}>Forecast Summary</h4>
              <div style={{ backgroundColor: '#f9fafb', borderRadius: '0.5rem', padding: '1rem' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f3f4f6' }}>
                        <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '500', color: '#374151' }}>Period</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '500', color: '#374151' }}>Base Forecast</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '500', color: '#374151' }}>Lower Bound</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '500', color: '#374151' }}>Upper Bound</th>
                        {forecastResult.ai_adjustment && (
                          <th style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '500', color: '#374151' }}>AI Adjusted</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {forecastResult.forecast_base.slice(0, 10).map((point, idx) => (
                        <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#f9fafb' }}>
                          <td style={{ padding: '0.5rem', color: '#6b7280' }}>{point.ds}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', color: '#111827' }}>
                            {point.yhat?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', color: '#6b7280' }}>
                            {point.yhat_lower?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', color: '#6b7280' }}>
                            {point.yhat_upper?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                          {forecastResult.ai_adjustment && (
                            <td style={{ padding: '0.5rem', textAlign: 'right', color: '#0284c7', fontWeight: '500' }}>
                              {forecastResult.forecast_final[idx]?.yhat_final?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {forecastResult.forecast_base.length > 10 && (
                    <p style={{ fontSize: '0.75rem', color: '#6b7280', textAlign: 'center', marginTop: '0.5rem' }}>
                      Showing first 10 of {forecastResult.forecast_base.length} forecast periods
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            {/* Download Options */}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem' }}>
              <button 
                className="btn-primary"
                onClick={() => {
                  import('./lib/fileUtils').then((utils) => {
                    // Prepare forecast data
                    const forecastData = forecastResult.forecast_final.map((point, idx) => {
                      const basePoint = forecastResult.forecast_base[idx];
                      return {
                        'Period': point.ds,
                        'Baseline Forecast': Number((basePoint?.yhat || 0).toFixed(2)),
                        'Lower Bound': Number((basePoint?.yhat_lower || 0).toFixed(2)),
                        'Upper Bound': Number((basePoint?.yhat_upper || 0).toFixed(2)),
                        ...(forecastResult.ai_adjustment && {
                          'AI Adjusted Forecast': Number((point.yhat_final || 0).toFixed(2))
                        })
                      };
                    });

                    // Prepare AI insights data (if available)
                    const aiInsights = [];
                    if (forecastResult.ai_adjustment) {
                      aiInsights.push({
                        'AI Analysis': 'Adjustment Details'
                      });
                      aiInsights.push({
                        'AI Analysis': `Adjustment Applied: ${forecastResult.ai_adjustment.adjustment_pct > 0 ? '+' : ''}${forecastResult.ai_adjustment.adjustment_pct}%`
                      });
                      aiInsights.push({
                        'AI Analysis': ''
                      });
                      aiInsights.push({
                        'AI Analysis': 'Business Insights:'
                      });
                      
                      // Format business insights as separate rows
                      const insights = forecastResult.ai_adjustment.rationale
                        .split(/\d+\)\s*/)
                        .filter(point => point.trim());
                      
                      insights.forEach((insight) => {
                        aiInsights.push({
                          'AI Analysis': `• ${insight.trim()}`
                        });
                      });

                      if (forecastResult.ai_adjustment.sources && forecastResult.ai_adjustment.sources.length > 0) {
                        aiInsights.push({
                          'AI Analysis': ''
                        });
                        aiInsights.push({
                          'AI Analysis': 'Sources:'
                        });
                        forecastResult.ai_adjustment.sources.forEach(source => {
                          aiInsights.push({
                            'AI Analysis': source
                          });
                        });
                      }
                    } else {
                      aiInsights.push({
                        'AI Analysis': 'No AI adjustment was applied to this forecast'
                      });
                    }

                    // Create multi-sheet Excel file
                    const sheets = [
                      { data: forecastData, sheetName: 'Forecast Data' },
                      { data: aiInsights, sheetName: 'AI Insights' }
                    ];

                    // Use the downloadExcelMultiSheet if available, otherwise fallback to single sheet
                    try {
                      if (utils.downloadExcelMultiSheet) {
                        const filename = `forecast_${new Date().toISOString().split('T')[0]}`;
                        utils.downloadExcelMultiSheet(sheets, filename);
                      } else {
                        // Fallback to single sheet
                        const filename = `forecast_${new Date().toISOString().split('T')[0]}`;
                        utils.downloadExcel(forecastData, filename, 'Forecast');
                      }
                    } catch (error) {
                      console.error('Excel download failed:', error);
                      alert('Excel download failed. Please try again.');
                    }
                  });
                }}
              >
                Download Excel
              </button>
                  </div>
                </div>
              )}

              {activeTab === 'analysis' && (
                <div style={{ padding: '0' }}>
                  <AnalysisModule
                    data={forecastResult.history?.map(point => ({
                      ds: point.ds,
                      y: point.y || 0
                    })) || []}
                    title="Historical Data Analysis"
                  />
                  {/* Debug info - remove in production */}
                  {process.env.NODE_ENV === 'development' && (
                    <div style={{ fontSize: '0.75rem', color: '#666', margin: '1rem', padding: '1rem', backgroundColor: '#f0f0f0' }}>
                      Debug Analysis Data:<br/>
                      - History available: {forecastResult.history ? 'Yes' : 'No'}<br/>
                      - History count: {forecastResult.history?.length || 0}<br/>
                      - Sample history point: {JSON.stringify(forecastResult.history?.[0] || 'no data')}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'financial' && (
                <div style={{ padding: '0' }}>
                  <FinancialProjection
                    forecastData={forecastResult.forecast_final || forecastResult.forecast_base}
                    title="Financial Projections"
                    country={configData?.country || 'USA'}
                  />
                  {/* Debug info - remove in production */}
                  {process.env.NODE_ENV === 'development' && (
                    <div style={{ fontSize: '0.75rem', color: '#666', margin: '1rem 0' }}>
                      Debug: Country = {configData?.country || 'not set'}, ConfigData = {JSON.stringify(configData)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

export default App;