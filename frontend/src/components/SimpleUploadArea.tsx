import React, { useCallback, useState } from 'react';
import { Upload, File, AlertCircle, CheckCircle, X } from 'lucide-react';
import { parseFile, validateFileName, formatFileSize, type FilePreview } from '../lib/fileUtils';
import { analyzeColumns, detectDateColumn, detectTargetColumn, type ColumnDetection } from '../lib/detectColumns';
import type { UploadState } from '../types';

interface UploadAreaProps {
  onFileProcessed: (file: File, preview: FilePreview, detectedColumns: {
    date: ColumnDetection | null;
    target: ColumnDetection | null;
  }) => void;
  uploadState: UploadState;
  setUploadState: React.Dispatch<React.SetStateAction<UploadState>>;
}

export function SimpleUploadArea({ onFileProcessed, uploadState, setUploadState }: UploadAreaProps) {
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    
    if (!validateFileName(file.name)) {
      setUploadState(prev => ({
        ...prev,
        error: 'Please upload a CSV, XLSX, or XLS file.',
      }));
      return;
    }

    setUploadState(prev => ({
      ...prev,
      isProcessing: true,
      error: null,
      file,
    }));

    try {
      const preview = await parseFile(file);
      const columnInfo = analyzeColumns(preview.rows);
      
      const detectedDate = detectDateColumn(columnInfo);
      const detectedTarget = detectTargetColumn(columnInfo);

      const detectedColumns = {
        date: detectedDate,
        target: detectedTarget,
      };

      setUploadState(prev => ({
        ...prev,
        preview,
        detectedColumns,
        isProcessing: false,
      }));

      onFileProcessed(file, preview, detectedColumns);
    } catch (error) {
      setUploadState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to process file',
        isProcessing: false,
      }));
    }
  }, [onFileProcessed, setUploadState]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  }, [handleFiles]);

  const clearFile = useCallback(() => {
    setUploadState({
      file: null,
      preview: null,
      detectedColumns: { date: null, target: null },
      isProcessing: false,
      error: null,
    });
  }, [setUploadState]);

  if (uploadState.file && uploadState.preview) {
    return (
      <div className="card" style={{ padding: '1.5rem' }}>
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
                {uploadState.file.name}
              </p>
              <p style={{ 
                fontSize: '0.875rem', 
                color: '#6b7280',
                margin: '0.25rem 0 0 0'
              }}>
                {formatFileSize(uploadState.file.size)} • {uploadState.preview.columns.length} columns • {' '}
                {uploadState.preview.total_rows === -1 ? '200+' : uploadState.preview.total_rows} rows
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

        {/* Column Detection Results */}
        <div style={{ marginBottom: '1rem' }}>
          <h4 style={{ 
            fontWeight: '500', 
            color: '#111827', 
            marginBottom: '0.5rem',
            fontSize: '1rem'
          }}>
            Auto-detected Columns
          </h4>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '0.75rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {uploadState.detectedColumns.date ? (
                <CheckCircle style={{ height: '1rem', width: '1rem', color: '#16a34a' }} />
              ) : (
                <AlertCircle style={{ height: '1rem', width: '1rem', color: '#d97706' }} />
              )}
              <span style={{ fontSize: '0.875rem' }}>
                <strong>Date:</strong>{' '}
                {uploadState.detectedColumns.date ? (
                  <>
                    {uploadState.detectedColumns.date.name} 
                    <span style={{ color: '#6b7280' }}>
                      ({Math.round(uploadState.detectedColumns.date.confidence * 100)}% confidence)
                    </span>
                  </>
                ) : (
                  <span style={{ color: '#d97706' }}>Not detected - manual selection required</span>
                )}
              </span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {uploadState.detectedColumns.target ? (
                <CheckCircle style={{ height: '1rem', width: '1rem', color: '#16a34a' }} />
              ) : (
                <AlertCircle style={{ height: '1rem', width: '1rem', color: '#d97706' }} />
              )}
              <span style={{ fontSize: '0.875rem' }}>
                <strong>Sales/Target:</strong>{' '}
                {uploadState.detectedColumns.target ? (
                  <>
                    {uploadState.detectedColumns.target.name}
                    <span style={{ color: '#6b7280' }}>
                      ({Math.round(uploadState.detectedColumns.target.confidence * 100)}% confidence)
                    </span>
                  </>
                ) : (
                  <span style={{ color: '#d97706' }}>Not detected - manual selection required</span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Data Preview */}
        <div style={{ 
          backgroundColor: '#f9fafb',
          borderRadius: '0.5rem',
          padding: '1rem'
        }}>
          <h4 style={{ 
            fontWeight: '500', 
            color: '#111827', 
            marginBottom: '0.5rem',
            fontSize: '1rem'
          }}>
            Data Preview
          </h4>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ minWidth: '100%', fontSize: '0.75rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f3f4f6' }}>
                  {uploadState.preview.columns.slice(0, 8).map((col) => (
                    <th key={col} style={{
                      padding: '0.5rem',
                      textAlign: 'left',
                      fontWeight: '500',
                      color: '#374151',
                      maxWidth: '6rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {col}
                    </th>
                  ))}
                  {uploadState.preview.columns.length > 8 && (
                    <th style={{
                      padding: '0.5rem',
                      textAlign: 'left',
                      fontWeight: '500',
                      color: '#6b7280'
                    }}>
                      +{uploadState.preview.columns.length - 8} more
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {uploadState.preview!.rows.slice(0, 5).map((row, idx) => (
                  <tr key={idx} style={{ 
                    backgroundColor: idx % 2 === 0 ? 'white' : '#f9fafb'
                  }}>
                    {uploadState.preview!.columns.slice(0, 8).map((col) => (
                      <td key={col} style={{
                        padding: '0.5rem',
                        color: '#6b7280',
                        maxWidth: '6rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {String(row[col] || '').slice(0, 20)}
                        {String(row[col] || '').length > 20 && '...'}
                      </td>
                    ))}
                    {uploadState.preview!.columns.length > 8 && (
                      <td style={{
                        padding: '0.5rem',
                        color: '#9ca3af'
                      }}>...</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {uploadState.preview!.rows.length > 5 && (
            <p style={{ 
              fontSize: '0.75rem', 
              color: '#6b7280', 
              marginTop: '0.5rem',
              margin: '0.5rem 0 0 0'
            }}>
              Showing first 5 rows of {uploadState.preview.total_rows === -1 ? '200+' : uploadState.preview.total_rows} total
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: '2rem' }}>
      <div
        style={{
          border: `2px dashed ${dragActive ? '#0284c7' : '#d1d5db'}`,
          borderRadius: '0.5rem',
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: dragActive ? '#f0f9ff' : 'transparent',
          transition: 'all 0.2s ease'
        }}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="file-upload"
          style={{ display: 'none' }}
          accept=".csv,.xlsx,.xls"
          onChange={handleInputChange}
          disabled={uploadState.isProcessing}
        />
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Upload style={{ 
            height: '3rem', 
            width: '3rem', 
            marginBottom: '1rem',
            color: dragActive ? '#0284c7' : '#9ca3af'
          }} />
          
          {uploadState.isProcessing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: '1rem',
                height: '1rem',
                border: '2px solid #0284c7',
                borderTop: '2px solid transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
              <span style={{ color: '#6b7280' }}>Processing file...</span>
            </div>
          ) : (
            <>
              <h3 style={{ 
                fontSize: '1.125rem', 
                fontWeight: '500', 
                color: '#111827', 
                marginBottom: '0.5rem'
              }}>
                Upload your sales data
              </h3>
              <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
                Drag and drop your CSV or Excel file here, or click to browse
              </p>
              <label
                htmlFor="file-upload"
                className="btn-primary"
                style={{ cursor: 'pointer', display: 'inline-block' }}
              >
                Choose File
              </label>
              <p style={{ 
                fontSize: '0.75rem', 
                color: '#6b7280', 
                marginTop: '0.5rem'
              }}>
                Supports CSV, XLSX, and XLS files up to 10MB
              </p>
            </>
          )}
        </div>
      </div>

      {uploadState.error && (
        <div style={{ 
          marginTop: '1rem',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '0.375rem',
          padding: '0.75rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <AlertCircle style={{ height: '1rem', width: '1rem', color: '#dc2626', marginRight: '0.5rem' }} />
            <span style={{ fontSize: '0.875rem', color: '#b91c1c' }}>
              {uploadState.error}
            </span>
          </div>
        </div>
      )}

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