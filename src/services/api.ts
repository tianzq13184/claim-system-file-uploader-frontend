import type {
  PresignRequest,
  PresignResponse,
  UploadStatusResponse,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

/**
 * Network error types
 */
export type NetworkErrorType = 
  | 'CORS_ERROR'
  | 'CONNECTION_ERROR'
  | 'TIMEOUT_ERROR'
  | 'SERVER_ERROR'
  | 'UNKNOWN_ERROR';

/**
 * Enhanced error with network error type
 */
export class NetworkError extends Error {
  constructor(
    message: string,
    public type: NetworkErrorType,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'NetworkError';
  }
}

/**
 * Detect network error type from fetch error
 */
function detectNetworkError(error: unknown, url: string): NetworkError {
  // Check if it's a TypeError (usually network/CORS issues)
  if (error instanceof TypeError) {
    const message = error.message.toLowerCase();
    
    // CORS errors
    if (message.includes('cors') || message.includes('cross-origin')) {
      return new NetworkError(
        `CORS error: Cannot connect to API at ${url}. Please check CORS configuration on the backend.`,
        'CORS_ERROR',
        error
      );
    }
    
    // Network connection errors
    if (message.includes('failed to fetch') || message.includes('networkerror')) {
      return new NetworkError(
        `Network error: Cannot reach API at ${url}. Please check your network connection and API endpoint configuration.`,
        'CONNECTION_ERROR',
        error
      );
    }
    
    // Other TypeErrors
    return new NetworkError(
      `Connection error: ${error.message}`,
      'CONNECTION_ERROR',
      error
    );
  }
  
  // Check if it's already a NetworkError
  if (error instanceof NetworkError) {
    return error;
  }
  
  // Generic error
  if (error instanceof Error) {
    return new NetworkError(
      error.message,
      'UNKNOWN_ERROR',
      error
    );
  }
  
  return new NetworkError(
    'Unknown network error occurred',
    'UNKNOWN_ERROR',
    error
  );
}

/**
 * Request a presigned URL for file upload
 */
export async function requestPresignUrl(
  request: PresignRequest
): Promise<PresignResponse> {
  const url = `${API_BASE_URL}/v1/uploads/presign`;
  console.log('[API] Requesting presign URL:', url);
  console.log('[API] Request body:', request);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // No Authorization header - internal use only
      },
      body: JSON.stringify(request),
    });
    
    console.log('[API] Response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      // Check for CORS issues (status 0 usually indicates CORS failure)
      if (response.status === 0) {
        throw new NetworkError(
          `CORS error: API at ${url} is not accessible. Please check CORS configuration.`,
          'CORS_ERROR'
        );
      }
      
      // Server errors
      if (response.status >= 500) {
        throw new NetworkError(
          errorData.message || `Server error: ${response.status} ${response.statusText}`,
          'SERVER_ERROR'
        );
      }
      
      // Client errors (4xx)
      throw new Error(
        errorData.message || `Failed to get presigned URL: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  } catch (error) {
    // Re-throw NetworkError as-is
    if (error instanceof NetworkError) {
      throw error;
    }
    
    // Detect and convert other errors
    throw detectNetworkError(error, url);
  }
}

/**
 * Upload file directly to S3 using presigned URL
 */
export async function uploadToS3(
  file: File,
  uploadUrl: string,
  method: string,
  headers: Record<string, string>,
  onProgress?: (progress: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Track upload progress
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress(progress);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        // Check for CORS error
        if (xhr.status === 0) {
          reject(new NetworkError(
            'CORS error: Cannot upload to S3. Please check S3 bucket CORS configuration.',
            'CORS_ERROR'
          ));
        } else {
          reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
        }
      }
    });

    xhr.addEventListener('error', () => {
      // Check if it's a CORS error (status 0)
      if (xhr.status === 0) {
        reject(new NetworkError(
          'CORS error: Cannot upload to S3. Please check S3 bucket CORS configuration.',
          'CORS_ERROR'
        ));
      } else {
        reject(new NetworkError(
          'Network error: Failed to upload file to S3. Please check your network connection.',
          'CONNECTION_ERROR'
        ));
      }
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload aborted'));
    });

    xhr.open(method, uploadUrl);

    // Set headers from presign response
    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    xhr.send(file);
  });
}

/**
 * Get upload status from backend
 */
export async function getUploadStatus(fileId: string): Promise<UploadStatusResponse> {
  const url = `${API_BASE_URL}/v1/uploads/${fileId}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        // No Authorization header - internal use only
      },
    });

    if (!response.ok) {
      // Check for CORS issues
      if (response.status === 0) {
        throw new NetworkError(
          `CORS error: Cannot access API at ${url}. Please check CORS configuration.`,
          'CORS_ERROR'
        );
      }
      
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Failed to get upload status: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  } catch (error) {
    // Re-throw NetworkError as-is
    if (error instanceof NetworkError) {
      throw error;
    }
    
    // Detect and convert other errors
    throw detectNetworkError(error, url);
  }
}

/**
 * Get current API base URL (for debugging)
 */
export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

