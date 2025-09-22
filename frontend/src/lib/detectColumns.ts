import { parseISO, isValid, parse } from 'date-fns';
import { COMMON_DATE_PATTERNS, COMMON_TARGET_PATTERNS } from './constants';

export interface ColumnDetection {
  name: string;
  confidence: number;
  type: 'date' | 'numeric';
  sample_values: string[];
}

export interface ColumnInfo {
  name: string;
  values: any[];
  type: string;
}

export function detectDateColumn(columns: ColumnInfo[]): ColumnDetection | null {
  let bestColumn: ColumnDetection | null = null;
  let bestScore = 0;

  for (const col of columns) {
    const score = calculateDateScore(col);
    if (score > bestScore && score >= 0.6) {
      bestColumn = {
        name: col.name,
        confidence: score,
        type: 'date',
        sample_values: col.values.slice(0, 5).map(String),
      };
      bestScore = score;
    }
  }

  return bestColumn;
}

export function detectTargetColumn(columns: ColumnInfo[]): ColumnDetection | null {
  let bestColumn: ColumnDetection | null = null;
  let bestScore = 0;

  for (const col of columns) {
    const score = calculateTargetScore(col);
    if (score > bestScore && score >= 0.5) {
      bestColumn = {
        name: col.name,
        confidence: score,
        type: 'numeric',
        sample_values: col.values.slice(0, 5).map(String),
      };
      bestScore = score;
    }
  }

  return bestColumn;
}

function calculateDateScore(col: ColumnInfo): number {
  if (col.values.length === 0) return 0;

  // Name pattern matching
  let nameScore = 0;
  for (const pattern of COMMON_DATE_PATTERNS) {
    if (pattern.test(col.name)) {
      nameScore = 0.4;
      break;
    }
  }

  // Parse success rate
  let parseSuccessCount = 0;
  const sampleSize = Math.min(50, col.values.length);
  const sampleValues = col.values.slice(0, sampleSize);

  for (const value of sampleValues) {
    if (value == null || value === '') continue;
    
    const stringValue = String(value).trim();
    if (tryParseDate(stringValue)) {
      parseSuccessCount++;
    }
  }

  const parseSuccessRate = parseSuccessCount / sampleSize;
  
  // Uniqueness score (dates should have reasonable uniqueness)
  const uniqueValues = new Set(sampleValues.map(v => String(v))).size;
  const uniquenessScore = Math.min(uniqueValues / sampleSize, 1);

  // Combine scores
  const totalScore = nameScore + (parseSuccessRate * 0.5) + (uniquenessScore * 0.1);
  return Math.min(totalScore, 1);
}

function calculateTargetScore(col: ColumnInfo): number {
  if (col.values.length === 0) return 0;

  // Name pattern matching
  let nameScore = 0;
  for (const pattern of COMMON_TARGET_PATTERNS) {
    if (pattern.test(col.name)) {
      nameScore = 0.3;
      break;
    }
  }

  // Numeric type check
  let numericCount = 0;
  let positiveCount = 0;
  let totalSum = 0;
  const sampleSize = Math.min(50, col.values.length);
  const sampleValues = col.values.slice(0, sampleSize);

  for (const value of sampleValues) {
    if (value == null || value === '') continue;
    
    const numValue = Number(value);
    if (!isNaN(numValue) && isFinite(numValue)) {
      numericCount++;
      if (numValue >= 0) positiveCount++;
      totalSum += numValue;
    }
  }

  const numericRate = numericCount / sampleSize;
  const positivityRate = numericCount > 0 ? positiveCount / numericCount : 0;
  
  // Sparsity check (prefer columns with fewer zeros)
  const nonZeroCount = sampleValues.filter(v => Number(v) > 0).length;
  const sparsityScore = nonZeroCount / sampleSize;

  // Combine scores - prefer positive numeric columns with good names
  const totalScore = nameScore + 
                    (numericRate * 0.3) + 
                    (positivityRate * 0.2) + 
                    (sparsityScore * 0.15) +
                    (Math.log(totalSum + 1) * 0.05); // Prefer higher values

  return Math.min(totalScore, 1);
}

function tryParseDate(value: string): boolean {
  if (!value || typeof value !== 'string') return false;

  // Try ISO format first
  const isoDate = parseISO(value);
  if (isValid(isoDate)) return true;

  // Try common date formats
  const formats = [
    'yyyy-MM-dd',
    'MM/dd/yyyy',
    'dd/MM/yyyy',
    'dd-MM-yyyy',
    'MM-dd-yyyy',
    'yyyy/MM/dd',
    'dd MMM yyyy',
    'MMM dd, yyyy',
    'MMMM dd, yyyy',
  ];

  for (const format of formats) {
    try {
      const parsed = parse(value, format, new Date());
      if (isValid(parsed)) return true;
    } catch {
      continue;
    }
  }

  // Try native Date constructor as last resort
  try {
    const date = new Date(value);
    return isValid(date) && !isNaN(date.getTime());
  } catch {
    return false;
  }
}

export function analyzeColumns(data: Record<string, any>[]): ColumnInfo[] {
  if (!data || data.length === 0) return [];

  const columns = Object.keys(data[0] || {});
  
  return columns.map(colName => {
    const values = data.map(row => row[colName]).filter(v => v != null);
    
    return {
      name: colName,
      values,
      type: inferColumnType(values),
    };
  });
}

function inferColumnType(values: any[]): string {
  if (values.length === 0) return 'unknown';

  let numericCount = 0;
  let dateCount = 0;
  
  for (const value of values.slice(0, 20)) {
    if (value == null) continue;
    
    const stringValue = String(value);
    
    // Check if numeric
    if (!isNaN(Number(stringValue)) && isFinite(Number(stringValue))) {
      numericCount++;
    }
    
    // Check if date
    if (tryParseDate(stringValue)) {
      dateCount++;
    }
  }

  const total = Math.min(20, values.length);
  if (dateCount / total > 0.7) return 'date';
  if (numericCount / total > 0.7) return 'numeric';
  return 'text';
}