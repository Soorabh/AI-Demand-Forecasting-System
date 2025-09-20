import { useState } from 'react';
import { BarChart3, CheckCircle, Upload, File, X, TrendingUp } from 'lucide-react';
import { generateForecast } from './api/client';
import type { ForecastResponse } from './types';

type AppStep = 'upload' | 'configure' | 'results';

function WorkingApp() {
  const [currentStep, setCurrentStep] = useState<AppStep>('upload');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [forecastData, setForecastData] = useState<ForecastResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getStepStatus = (step: AppStep) => {
    if (step === 'upload') return currentStep === 'upload' ? 'active' : 'completed';
    if (step === 'configure') {
      if (currentStep === 'upload') return 'inactive';
      if (currentStep === 'configure') return 'active';
      return 'completed';
    }
    if (step === 'results') {
      if (currentStep === 'results') return 'active';
      return 'inactive';
    }
    return 'inactive';
  };

  const resetApp = () => {
    setCurrentStep('upload');
    setUploadedFile(null);
    setForecastData(null);
    setError(null);
    setIsGenerating(false);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setCurrentStep('configure');
    }
  };

  const clearFile = () => {
    setUploadedFile(null);
    setCurrentStep('upload');
  };

  const handleGenerateForecast = async () => {
    if (!uploadedFile) return;
    
    setIsGenerating(true);
    setError(null);

    try {
      const result = await generateForecast({
        file: uploadedFile,
        industry: 'retail',
        country: 'United States',
        state: 'California',
        city: 'San Francisco',
        freq: 'W',
        horizon: 8,
        date_col: 'date',
        target_col: 'sales',
        apply_holidays: true,
        apply_ai_adjustment: true,
      });

      setForecastData(result);
      setCurrentStep('results');
    } catch (error) {
      console.error('Forecast generation failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate forecast');
    } finally {
      setIsGenerating(false);
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
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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
          {currentStep !== 'upload' && (
            <button
              onClick={resetApp}
              className="btn-secondary"
            >
              Start Over
            </button>
          )}
        </div>

        {/* Progress Steps */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '2rem', 
          marginTop: '1.5rem',
          maxWidth: '1200px',
          margin: '1.5rem auto 0',
          padding: '0 1rem'
        }}>
          <div className={`progress-step ${getStepStatus('upload')}`}>
            1
          </div>
          <div style={{ 
            flex: 1, 
            height: '4px', 
            backgroundColor: '#e5e7eb', 
            borderRadius: '2px',
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              backgroundColor: '#0284c7',
              borderRadius: '2px',
              width: currentStep === 'upload' ? '0%' : '100%',
              transition: 'width 0.3s ease'
            }} />
          </div>
          <div className={`progress-step ${getStepStatus('configure')}`}>
            2
          </div>
          <div style={{ 
            flex: 1, 
            height: '4px', 
            backgroundColor: '#e5e7eb', 
            borderRadius: '2px',
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              backgroundColor: '#0284c7',
              borderRadius: '2px',
              width: currentStep === 'results' ? '100%' : '0%',
              transition: 'width 0.3s ease'
            }} />
          </div>
          <div className={`progress-step ${getStepStatus('results')}`}>
            3
          </div>
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '0.5rem',
          fontSize: '0.875rem',
          color: '#6b7280',
          maxWidth: '1200px',
          margin: '0.5rem auto 0',
          padding: '0 1rem'
        }}>
          <span>Upload Data</span>
          <span>Configure</span>
          <span>Results</span>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ 
        maxWidth: '1200px', 
        margin: '0 auto', 
        padding: '2rem 1rem'
      }}>
        {currentStep === 'upload' && !uploadedFile && (
          <div className="card" style={{ padding: '2rem' }}>
            <div style={{
              border: '2px dashed #d1d5db',
              borderRadius: '0.5rem',
              padding: '3rem',
              textAlign: 'center'
            }}>
              <Upload style={{ 
                height: '3rem', 
                width: '3rem', 
                color: '#9ca3af',
                margin: '0 auto 1rem'
              }} />
              <h3 style={{ color: '#111827', marginBottom: '0.5rem' }}>Upload your sales data</h3>
              <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
                Choose a CSV or Excel file with date and sales columns
              </p>
              <input
                type="file"
                id="file-upload"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
              <label htmlFor="file-upload" className="btn-primary" style={{ cursor: 'pointer' }}>
                Choose File
              </label>
              <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
                Supports CSV, XLSX, and XLS files up to 10MB
              </p>
            </div>
          </div>
        )}

        {currentStep === 'upload' && uploadedFile && (
          <div className="card" style={{ padding: '2rem' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: '1rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <File style={{ height: '1.25rem', width: '1.25rem', color: '#16a34a' }} />
                <div>
                  <p style={{ fontWeight: '500', color: '#111827', margin: '0' }}>
                    {uploadedFile.name}
                  </p>
                  <p style={{ 
                    fontSize: '0.875rem', 
                    color: '#6b7280',
                    margin: '0.25rem 0 0 0'
                  }}>
                    {(uploadedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <button
                onClick={clearFile}
                style={{ 
                  background: 'none',
                  border: 'none',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  padding: '0.25rem'
                }}
              >
                <X style={{ height: '1.25rem', width: '1.25rem' }} />
              </button>
            </div>
            <div style={{ 
              backgroundColor: '#f0f9ff',
              border: '1px solid #bae6fd',
              borderRadius: '0.375rem',
              padding: '1rem',
              marginBottom: '1rem'
            }}>
              <p style={{ 
                fontSize: '0.875rem', 
                color: '#0369a1',
                margin: '0',
                textAlign: 'center'
              }}>
                ✅ File uploaded successfully! Ready to configure forecast settings.
              </p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <button 
                className="btn-primary"
                onClick={() => setCurrentStep('configure')}
              >
                Continue to Configure
              </button>
            </div>
          </div>
        )}

        {currentStep === 'configure' && (
          <div className="card" style={{ padding: '2rem' }}>
            <h3 style={{ color: '#111827', marginBottom: '1.5rem', textAlign: 'center' }}>
              Configure Forecast Settings
            </h3>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '1.5rem',
              marginBottom: '2rem'
            }}>
              <div>
                <label style={{ 
                  display: 'block', 
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Industry
                </label>
                <div style={{ 
                  padding: '0.75rem',
                  backgroundColor: '#f9fafb',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  color: '#6b7280'
                }}>
                  Retail (auto-configured)
                </div>
              </div>

              <div>
                <label style={{ 
                  display: 'block', 
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Location
                </label>
                <div style={{ 
                  padding: '0.75rem',
                  backgroundColor: '#f9fafb',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  color: '#6b7280'
                }}>
                  San Francisco, CA, US
                </div>
              </div>

              <div>
                <label style={{ 
                  display: 'block', 
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Frequency
                </label>
                <div style={{ 
                  padding: '0.75rem',
                  backgroundColor: '#f9fafb',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  color: '#6b7280'
                }}>
                  Weekly (8 periods)
                </div>
              </div>

              <div>
                <label style={{ 
                  display: 'block', 
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Data Columns
                </label>
                <div style={{ 
                  padding: '0.75rem',
                  backgroundColor: '#f9fafb',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  color: '#6b7280'
                }}>
                  date → sales
                </div>
              </div>
            </div>

            <div style={{ 
              backgroundColor: '#f0f9ff',
              border: '1px solid #bae6fd',
              borderRadius: '0.375rem',
              padding: '1rem',
              marginBottom: '2rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <CheckCircle style={{ height: '1rem', width: '1rem', color: '#0284c7' }} />
                <span style={{ fontWeight: '500', color: '#0284c7' }}>Advanced Features Enabled</span>
              </div>
              <ul style={{ margin: '0', paddingLeft: '1.5rem', color: '#0369a1', fontSize: '0.875rem' }}>
                <li>✅ Holiday detection for US/California</li>
                <li>✅ AI macro adjustment via Perplexity Sonar</li>
                <li>✅ Prophet time series modeling</li>
                <li>✅ Confidence intervals</li>
              </ul>
            </div>

            {error && (
              <div style={{ 
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '0.375rem',
                padding: '1rem',
                marginBottom: '1rem'
              }}>
                <p style={{ color: '#dc2626', margin: '0', fontSize: '0.875rem' }}>
                  ❌ Error: {error}
                </p>
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                className="btn-secondary"
                onClick={() => setCurrentStep('upload')}
                disabled={isGenerating}
              >
                Back
              </button>
              <button 
                className="btn-primary"
                onClick={handleGenerateForecast}
                disabled={isGenerating}
                style={{ position: 'relative' }}
              >
                {isGenerating ? (
                  <>
                    <div style={{
                      width: '1rem',
                      height: '1rem',
                      border: '2px solid white',
                      borderTop: '2px solid transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      display: 'inline-block',
                      marginRight: '0.5rem'
                    }}></div>
                    Generating Forecast...
                  </>
                ) : (
                  'Generate Forecast'
                )}
              </button>
            </div>
          </div>
        )}

        {currentStep === 'results' && forecastData && (
          <div className="card" style={{ padding: '2rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <h3 style={{ color: '#111827', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <TrendingUp style={{ height: '1.5rem', width: '1.5rem', color: '#16a34a' }} />
                Forecast Generated Successfully!
              </h3>
              <p style={{ color: '#6b7280' }}>
                {forecastData.forecast_final.length} periods forecasted with AI adjustment
              </p>
            </div>

            {/* KPI Cards */}
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              marginBottom: '2rem'
            }}>
              <div style={{ 
                backgroundColor: '#f0f9ff',
                border: '1px solid #bae6fd',
                borderRadius: '0.5rem',
                padding: '1rem',
                textAlign: 'center'
              }}>
                <p style={{ fontSize: '0.875rem', color: '#0369a1', margin: '0 0 0.5rem 0', fontWeight: '500' }}>
                  Baseline Total
                </p>
                <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827', margin: '0' }}>
                  {forecastData.forecast_base.reduce((sum, point) => sum + (point.yhat || 0), 0).toFixed(0)}
                </p>
              </div>

              <div style={{ 
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '0.5rem',
                padding: '1rem',
                textAlign: 'center'
              }}>
                <p style={{ fontSize: '0.875rem', color: '#15803d', margin: '0 0 0.5rem 0', fontWeight: '500' }}>
                  AI Adjusted Total
                </p>
                <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827', margin: '0' }}>
                  {forecastData.forecast_final.reduce((sum, point) => sum + (point.yhat_final || 0), 0).toFixed(0)}
                </p>
              </div>

              <div style={{ 
                backgroundColor: '#fefbf3',
                border: '1px solid #fde68a',
                borderRadius: '0.5rem',
                padding: '1rem',
                textAlign: 'center'
              }}>
                <p style={{ fontSize: '0.875rem', color: '#92400e', margin: '0 0 0.5rem 0', fontWeight: '500' }}>
                  AI Adjustment
                </p>
                <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827', margin: '0' }}>
                  {forecastData.ai_adjustment?.adjustment_pct?.toFixed(1) || '0'}%
                </p>
              </div>
            </div>

            {/* AI Rationale */}
            {forecastData.ai_adjustment?.rationale && (
              <div style={{ 
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '0.5rem',
                padding: '1rem',
                marginBottom: '2rem'
              }}>
                <h4 style={{ color: '#374151', marginBottom: '0.5rem', fontSize: '1rem', fontWeight: '500' }}>
                  🤖 AI Analysis
                </h4>
                <p style={{ color: '#6b7280', margin: '0', fontSize: '0.875rem' }}>
                  {forecastData.ai_adjustment.rationale}
                </p>
              </div>
            )}

            {/* Data Summary */}
            <div style={{ 
              backgroundColor: '#f9fafb',
              borderRadius: '0.5rem',
              padding: '1rem',
              marginBottom: '2rem'
            }}>
              <h4 style={{ color: '#374151', marginBottom: '1rem', fontSize: '1rem', fontWeight: '500' }}>
                📊 Forecast Summary
              </h4>
              <div style={{ 
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '1rem',
                fontSize: '0.875rem'
              }}>
                <div>
                  <span style={{ fontWeight: '500', color: '#374151' }}>Frequency:</span>
                  <br />
                  <span style={{ color: '#6b7280' }}>{forecastData.meta.freq === 'W' ? 'Weekly' : 'Daily'}</span>
                </div>
                <div>
                  <span style={{ fontWeight: '500', color: '#374151' }}>Periods:</span>
                  <br />
                  <span style={{ color: '#6b7280' }}>{forecastData.meta.horizon}</span>
                </div>
                <div>
                  <span style={{ fontWeight: '500', color: '#374151' }}>Data Points:</span>
                  <br />
                  <span style={{ color: '#6b7280' }}>{forecastData.meta.processed_rows}</span>
                </div>
                <div>
                  <span style={{ fontWeight: '500', color: '#374151' }}>Holidays:</span>
                  <br />
                  <span style={{ color: '#6b7280' }}>{forecastData.meta.holidays_used.length} included</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ 
              display: 'flex', 
              gap: '1rem', 
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}>
              <button 
                className="btn-secondary"
                onClick={resetApp}
              >
                Start Over
              </button>
              <button 
                className="btn-primary"
                onClick={() => {
                  // Download CSV functionality would go here
                  alert('Download feature will be implemented next!');
                }}
              >
                Download Results
              </button>
            </div>
          </div>
        )}

        {currentStep === 'results' && !forecastData && (
          <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
            <h3 style={{ color: '#dc2626', marginBottom: '1rem' }}>No Results Available</h3>
            <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
              Something went wrong. Please try generating the forecast again.
            </p>
            <button 
              className="btn-secondary"
              onClick={resetApp}
            >
              Start Over
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ 
        backgroundColor: 'white', 
        borderTop: '1px solid #e5e7eb',
        marginTop: '4rem'
      }}>
        <div style={{ 
          maxWidth: '1200px', 
          margin: '0 auto', 
          padding: '1.5rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.875rem',
          color: '#6b7280',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <p style={{ margin: '0' }}>
            © 2024 AI Forecasting MVP. Built with React + FastAPI + Prophet.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <CheckCircle style={{ height: '0.75rem', width: '0.75rem', color: '#16a34a' }} />
              <span>Privacy Protected</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <CheckCircle style={{ height: '0.75rem', width: '0.75rem', color: '#16a34a' }} />
              <span>Data Secure</span>
            </span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

export default WorkingApp;