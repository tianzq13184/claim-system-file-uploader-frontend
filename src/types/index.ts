// File types
export type FileType = 'X12' | 'CSV';

// Transaction types
export type TransactionType = '834' | '835' | '837';

// Upload status states
export type UploadStatus =
  | 'READY'
  | 'REQUESTING_URL'
  | 'URL_READY'
  | 'UPLOADING'
  | 'UPLOADED'
  | 'PROCESSING'
  | 'DONE'
  | 'FAILED';

// Failure reasons
export type FailureReason =
  | 'REQUESTING_URL_FAILED'
  | 'UPLOAD_ERROR'
  | 'BACKEND_FAILED'
  | 'VALIDATION_ERROR';

// Upload task state
export interface UploadTask {
  id: string; // Local UUID
  file: File;
  fileName: string;
  fileType: FileType;
  fileSize: number; // bytes
  sourceSystem: string;
  transactionType: TransactionType;
  businessDate: string; // YYYY-MM-DD
  batchName?: string;
  status: UploadStatus;
  failureReason?: FailureReason;
  errorMessage?: string;
  
  // After presign
  fileId?: string;
  uploadUrl?: string;
  httpMethod?: string;
  headers?: Record<string, string>;
  
  // Upload progress
  uploadProgress?: number; // 0-100
  
  // Backend status
  backendStatus?: string;
  canonicalLocation?: {
    bucket: string;
    keys: string[];
  };
}

// Presign request
export interface PresignRequest {
  file_name: string;
  file_type: FileType;
  content_type: string;
  approx_size_bytes: number;
  transaction_type: TransactionType;
  source_system: string;
  business_date: string;
  tags?: {
    batchName?: string;
    [key: string]: string | undefined;
  };
}

// Presign response
export interface PresignResponse {
  file_id: string;
  upload_url: string;
  http_method: string;
  headers: Record<string, string>;
}

// Upload status response
export interface UploadStatusResponse {
  file_id: string;
  status: string;
  error_code?: string;
  error_message?: string;
  canonical_location?: {
    bucket: string;
    keys: string[];
  };
}

// File size limits (bytes)
export const FILE_SIZE_LIMITS = {
  X12: 200 * 1024 * 1024, // 200 MB
  CSV: 2 * 1024 * 1024 * 1024, // 2 GB
} as const;

// Supported file extensions
export const FILE_EXTENSIONS = {
  X12: ['.x12', '.edi', '.txt'],
  CSV: ['.csv'],
} as const;

// API base URL (can be configured via environment variable)
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Max concurrent uploads
export const MAX_CONCURRENT_UPLOADS = 3;



