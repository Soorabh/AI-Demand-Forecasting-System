type FrequencyOption = {
  value: 'D' | 'W' | 'M';
  label: string;
  description: string;
};

type IndustryOption = {
  value: string;
  label: string;
};

export const INDUSTRIES: IndustryOption[] = [
  { value: 'retail', label: 'Retail' },
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'cpg', label: 'CPG' },
  { value: 'fashion', label: 'Fashion' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'grocery', label: 'Grocery' },
  { value: 'pharma', label: 'Pharma' },
  { value: 'beauty', label: 'Beauty' },
  { value: 'other', label: 'Other' },
];

export const FREQUENCIES: FrequencyOption[] = [
  { 
    value: 'D', 
    label: 'Daily', 
    description: 'Best for short-term planning and high-volume businesses' 
  },
  { 
    value: 'W', 
    label: 'Weekly', 
    description: 'Recommended for most business forecasting needs' 
  },
  { 
    value: 'M', 
    label: 'Monthly', 
    description: 'Good for long-term strategic planning' 
  },
];

export const COMMON_DATE_PATTERNS = [
  /^date$/i,
  /^ds$/i,
  /^order_date$/i,
  /^invoice_date$/i,
  /^transaction_date$/i,
  /^day$/i,
  /^week$/i,
  /^month$/i,
  /^period$/i,
  /^timestamp$/i,
  /^created_at$/i,
  /^updated_at$/i,
];

export const COMMON_TARGET_PATTERNS = [
  /^sales$/i,
  /^revenue$/i,
  /^qty$/i,
  /^quantity$/i,
  /^y$/i,
  /^amount$/i,
  /^gmv$/i,
  /^value$/i,
  /^total$/i,
  /^price$/i,
  /^volume$/i,
];

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const PREVIEW_ROWS = 200;
export const MIN_CONFIDENCE_THRESHOLD = 0.6;