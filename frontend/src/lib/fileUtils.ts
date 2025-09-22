import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { MAX_FILE_SIZE, PREVIEW_ROWS } from './constants';

export interface FilePreview {
  columns: string[];
  rows: Record<string, any>[];
  total_rows: number;
}

export async function parseCSVFile(file: File): Promise<FilePreview> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_FILE_SIZE) {
      reject(new Error(`File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`));
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      preview: PREVIEW_ROWS + 1, // +1 to check if there are more rows
      encoding: 'UTF-8',
      complete: (results) => {
        if (results.errors.length > 0) {
          const criticalErrors = results.errors.filter(
            error => error.type === 'Delimiter' || error.type === 'Quotes'
          );
          if (criticalErrors.length > 0) {
            reject(new Error(`CSV parsing error: ${criticalErrors[0].message}`));
            return;
          }
        }

        const data = results.data as Record<string, any>[];
        const hasMoreRows = data.length > PREVIEW_ROWS;
        const previewData = data.slice(0, PREVIEW_ROWS);
        
        if (previewData.length === 0) {
          reject(new Error('CSV file appears to be empty'));
          return;
        }

        const columns = Object.keys(previewData[0] || {});
        if (columns.length === 0) {
          reject(new Error('No columns detected in CSV file'));
          return;
        }

        resolve({
          columns,
          rows: previewData,
          total_rows: hasMoreRows ? -1 : previewData.length, // -1 indicates "200+"
        });
      },
      error: (error) => {
        reject(new Error(`CSV parsing failed: ${error.message}`));
      },
    });
  });
}

export async function parseExcelFile(file: File): Promise<FilePreview> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_FILE_SIZE) {
      reject(new Error(`File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`));
      return;
    }

    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject(new Error('Failed to read file'));
          return;
        }

        const workbook = XLSX.read(data, { type: 'array' });
        
        // Use the first worksheet
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          reject(new Error('Excel file has no worksheets'));
          return;
        }

        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length === 0) {
          reject(new Error('Excel worksheet appears to be empty'));
          return;
        }

        // Find header row (first non-empty row)
        let headerRowIndex = 0;
        while (headerRowIndex < jsonData.length) {
          const row = jsonData[headerRowIndex] as any[];
          if (row && row.some(cell => cell != null && String(cell).trim() !== '')) {
            break;
          }
          headerRowIndex++;
        }

        if (headerRowIndex >= jsonData.length) {
          reject(new Error('No data found in Excel file'));
          return;
        }

        const headers = (jsonData[headerRowIndex] as any[])
          .map((header, index) => {
            if (header == null || String(header).trim() === '') {
              return `Column_${index + 1}`;
            }
            return String(header).trim();
          });

        const dataRows = (jsonData.slice(headerRowIndex + 1) as any[][])
          .filter(row => row && row.some(cell => cell != null))
          .slice(0, PREVIEW_ROWS);

        if (dataRows.length === 0) {
          reject(new Error('No data rows found in Excel file'));
          return;
        }

        // Convert to object format
        const rows = dataRows.map(row => {
          const obj: Record<string, any> = {};
          headers.forEach((header, index) => {
            obj[header] = row[index] ?? null;
          });
          return obj;
        });

        const totalRows = jsonData.length - headerRowIndex - 1;
        const hasMoreRows = totalRows > PREVIEW_ROWS;

        resolve({
          columns: headers,
          rows,
          total_rows: hasMoreRows ? -1 : rows.length,
        });
      } catch (error) {
        reject(new Error(`Excel parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read Excel file'));
    };

    reader.readAsArrayBuffer(file);
  });
}

export async function parseFile(file: File): Promise<FilePreview> {
  const extension = file.name.toLowerCase().split('.').pop();
  
  switch (extension) {
    case 'csv':
      return parseCSVFile(file);
    case 'xlsx':
    case 'xls':
      return parseExcelFile(file);
    default:
      throw new Error(`Unsupported file type: ${extension}. Please use CSV, XLSX, or XLS files.`);
  }
}

export function downloadCSV(data: any[], filename: string): void {
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

export function downloadExcel(data: any[], filename: string, worksheetName: string = 'Forecast'): void {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, worksheetName);
  
  // Ensure filename has .xlsx extension
  const excelFilename = filename.toLowerCase().endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  
  XLSX.writeFile(workbook, excelFilename);
}

export function downloadExcelMultiSheet(sheets: Array<{data: any[], sheetName: string}>, filename: string): void {
  const workbook = XLSX.utils.book_new();
  
  sheets.forEach((sheet, index) => {
    const worksheet = XLSX.utils.json_to_sheet(sheet.data);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.sheetName);
  });
  
  // Ensure filename has .xlsx extension
  const excelFilename = filename.toLowerCase().endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  
  XLSX.writeFile(workbook, excelFilename);
}

export function validateFileName(filename: string): boolean {
  const allowedExtensions = ['.csv', '.xlsx', '.xls'];
  return allowedExtensions.some(ext => filename.toLowerCase().endsWith(ext));
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}