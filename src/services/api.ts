import type {
  PresignRequest,
  PresignResponse,
  UploadStatusResponse,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

/**
 * Request a presigned URL for file upload
 */
export async function requestPresignUrl(
  request: PresignRequest
): Promise<PresignResponse> {
  const url = `${API_BASE_URL}/v1/uploads/presign`;
  console.log('[API] Requesting presign URL:', url);
  console.log('[API] Request body:', request);
  
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
    throw new Error(
      errorData.message || `Failed to get presigned URL: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
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
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Upload failed: Network error'));
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
  const response = await fetch(`${API_BASE_URL}/v1/uploads/${fileId}`, {
    method: 'GET',
    headers: {
      // No Authorization header - internal use only
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to get upload status: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

