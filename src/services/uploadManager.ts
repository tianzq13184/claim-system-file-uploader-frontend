import type {
  UploadTask,
  UploadStatus,
  FailureReason,
  FileType,
  TransactionType,
} from '../types';
import { requestPresignUrl, uploadToS3, getUploadStatus } from './api';
import { MAX_CONCURRENT_UPLOADS } from '../types';

type StatusUpdateCallback = (task: UploadTask) => void;

class UploadManager {
  private tasks: Map<string, UploadTask> = new Map();
  private callbacks: Set<StatusUpdateCallback> = new Set();
  private activeUploads: Set<string> = new Set();
  private pollingIntervals: Map<string, number> = new Map();
  private pollingStartTimes: Map<string, number> = new Map();

  /**
   * Register a callback for status updates
   */
  subscribe(callback: StatusUpdateCallback): () => void {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  /**
   * Notify all subscribers of a status update
   */
  private notify(task: UploadTask): void {
    this.callbacks.forEach((callback) => callback(task));
  }

  /**
   * Create a new upload task
   */
  createTask(params: {
    file: File;
    fileType: FileType;
    sourceSystem: string;
    transactionType: TransactionType;
    businessDate: string;
    batchName?: string;
  }): UploadTask {
    const task: UploadTask = {
      id: crypto.randomUUID(),
      file: params.file,
      fileName: params.file.name,
      fileType: params.fileType,
      fileSize: params.file.size,
      sourceSystem: params.sourceSystem,
      transactionType: params.transactionType,
      businessDate: params.businessDate,
      batchName: params.batchName,
      status: 'READY',
    };

    this.tasks.set(task.id, task);
    this.notify(task);
    return task;
  }

  /**
   * Get all tasks
   */
  getTasks(): UploadTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get a task by ID
   */
  getTask(id: string): UploadTask | undefined {
    return this.tasks.get(id);
  }

  /**
   * Update task status
   */
  private updateTask(id: string, updates: Partial<UploadTask>): void {
    const task = this.tasks.get(id);
    if (task) {
      Object.assign(task, updates);
      this.tasks.set(id, task);
      this.notify(task);
    }
  }

  /**
   * Start upload for a task
   */
  async startUpload(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      console.warn('[UploadManager] Task not found for startUpload:', taskId);
      return;
    }
    
    if (task.status !== 'READY') {
      console.warn('[UploadManager] Task not in READY state:', taskId, task.status);
      return;
    }

    // Check concurrent upload limit
    if (this.activeUploads.size >= MAX_CONCURRENT_UPLOADS) {
      console.log('[UploadManager] Max concurrent uploads reached, queuing task:', taskId);
      // Queue will be processed when a slot opens
      return;
    }

    console.log('[UploadManager] Starting upload, taskId:', taskId);
    this.activeUploads.add(taskId);
    this.uploadTask(taskId).finally(() => {
      this.activeUploads.delete(taskId);
      // Process next task in queue
      this.processQueue();
    });
  }

  /**
   * Process upload queue (start next ready task)
   */
  private processQueue(): void {
    if (this.activeUploads.size >= MAX_CONCURRENT_UPLOADS) {
      return;
    }

    // Find next ready task
    const readyTask = Array.from(this.tasks.values()).find(
      (task) => task.status === 'READY'
    );

    if (readyTask) {
      this.startUpload(readyTask.id);
    }
  }

  /**
   * Execute upload for a task
   */
  private async uploadTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      console.error('[UploadManager] Task not found:', taskId);
      return;
    }

    console.log('[UploadManager] Starting upload task:', taskId, task.fileName);

    try {
      // Step 1: Request presigned URL
      console.log('[UploadManager] Step 1: Requesting presigned URL...');
      this.updateTask(taskId, { status: 'REQUESTING_URL' });

      const presignRequest = {
        file_name: task.fileName,
        file_type: task.fileType,
        content_type: task.file.type || 'application/octet-stream',
        approx_size_bytes: task.fileSize,
        transaction_type: task.transactionType,
        source_system: task.sourceSystem,
        business_date: task.businessDate,
        tags: task.batchName ? { batchName: task.batchName } : undefined,
      };

      const presignResponse = await requestPresignUrl(presignRequest);
      console.log('[UploadManager] Presign response received:', presignResponse);

      this.updateTask(taskId, {
        status: 'URL_READY',
        fileId: presignResponse.file_id,
        uploadUrl: presignResponse.upload_url,
        httpMethod: presignResponse.http_method,
        headers: presignResponse.headers,
      });

      // Step 2: Upload to S3
      this.updateTask(taskId, {
        status: 'UPLOADING',
        uploadProgress: 0,
      });

      await uploadToS3(
        task.file,
        presignResponse.upload_url,
        presignResponse.http_method,
        presignResponse.headers,
        (progress) => {
          this.updateTask(taskId, { uploadProgress: progress });
        }
      );

      this.updateTask(taskId, {
        status: 'UPLOADED',
        uploadProgress: 100,
      });

      // Step 3: Start polling for status
      this.startPolling(presignResponse.file_id, taskId);
    } catch (error) {
      console.error('[UploadManager] Upload task failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      let failureReason: FailureReason = 'UPLOAD_ERROR';

      const currentTask = this.tasks.get(taskId);
      if (currentTask?.status === 'REQUESTING_URL') {
        failureReason = 'REQUESTING_URL_FAILED';
      }

      this.updateTask(taskId, {
        status: 'FAILED',
        failureReason,
        errorMessage,
      });
    }
  }

  /**
   * Start polling for upload status
   */
  private startPolling(fileId: string, taskId: string): void {
    // Stop any existing polling for this task
    this.stopPolling(taskId);

    const startTime = Date.now();
    this.pollingStartTimes.set(taskId, startTime);

    console.log('[UploadManager] Starting polling for task:', taskId, 'fileId:', fileId);

    const poll = async () => {
      // Check if we should stop polling (task might have been removed)
      if (!this.tasks.has(taskId)) {
        console.log('[UploadManager] Task removed, stopping polling:', taskId);
        return;
      }

      try {
        console.log('[UploadManager] Polling status for fileId:', fileId);
        const statusResponse = await getUploadStatus(fileId);
        console.log('[UploadManager] Status response:', statusResponse);

        // Update task with backend status
        const updates: Partial<UploadTask> = {
          backendStatus: statusResponse.status,
        };

        if (statusResponse.canonical_location) {
          updates.canonicalLocation = statusResponse.canonical_location;
        }

        let shouldStopPolling = false;

        // Map backend status to frontend status
        if (
          statusResponse.status === 'CANONICAL_READY' ||
          statusResponse.status === 'COMPLETED'
        ) {
          updates.status = 'DONE';
          shouldStopPolling = true;
          console.log('[UploadManager] Task completed, stopping polling');
        } else if (statusResponse.status === 'FAILED') {
          updates.status = 'FAILED';
          updates.failureReason = 'BACKEND_FAILED';
          updates.errorMessage =
            statusResponse.error_message || statusResponse.error_code || 'Backend processing failed';
          shouldStopPolling = true;
          console.log('[UploadManager] Task failed, stopping polling');
        } else if (statusResponse.status === 'PROCESSING') {
          updates.status = 'PROCESSING';
        } else if (statusResponse.status === 'UPLOADED' || statusResponse.status === 'PENDING_UPLOAD') {
          updates.status = 'UPLOADED';
        }

        this.updateTask(taskId, updates);

        // Continue polling if not done
        if (!shouldStopPolling) {
          const elapsed = Date.now() - startTime;
          let interval: number;

          // First 60 seconds: poll every 5 seconds
          if (elapsed < 60 * 1000) {
            interval = 5 * 1000;
          }
          // 1-10 minutes: poll every 30 seconds
          else if (elapsed < 10 * 60 * 1000) {
            interval = 30 * 1000;
          }
          // Over 10 minutes: stop polling
          else {
            console.log('[UploadManager] Polling timeout (10 minutes), stopping');
            this.stopPolling(taskId);
            this.updateTask(taskId, {
              errorMessage:
                'Still processing in backend, please check later in History page',
            });
            return;
          }

          // Clear any existing timeout for this task before setting a new one
          // This ensures we don't have multiple timeouts running
          const existingTimeout = this.pollingIntervals.get(taskId);
          if (existingTimeout) {
            clearTimeout(existingTimeout);
          }

          console.log(`[UploadManager] Scheduling next poll in ${interval / 1000} seconds`);
          const timeoutId = setTimeout(() => {
            // Remove from intervals map before calling poll (so poll can add it back)
            this.pollingIntervals.delete(taskId);
            poll();
          }, interval);
          this.pollingIntervals.set(taskId, timeoutId);
        } else {
          this.stopPolling(taskId);
        }
      } catch (error) {
        console.error('[UploadManager] Polling error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.updateTask(taskId, {
          status: 'FAILED',
          failureReason: 'BACKEND_FAILED',
          errorMessage,
        });
        this.stopPolling(taskId);
      }
    };

    // Initial poll after 1 second
    console.log('[UploadManager] Scheduling initial poll in 1 second');
    const initialTimeout = setTimeout(() => {
      this.pollingIntervals.delete(taskId);
      poll();
    }, 1000);
    this.pollingIntervals.set(taskId, initialTimeout);
  }

  /**
   * Stop polling for a task
   */
  private stopPolling(taskId: string): void {
    const intervalId = this.pollingIntervals.get(taskId);
    if (intervalId) {
      clearTimeout(intervalId);
      this.pollingIntervals.delete(taskId);
    }
    this.pollingStartTimes.delete(taskId);
  }

  /**
   * Retry upload for a failed task
   */
  async retryUpload(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;

    // Reset task to READY state
    this.updateTask(taskId, {
      status: 'READY',
      failureReason: undefined,
      errorMessage: undefined,
      uploadProgress: undefined,
    });

    // Stop any existing polling
    this.stopPolling(taskId);

    // Start upload
    await this.startUpload(taskId);
  }

  /**
   * Remove a task
   */
  removeTask(taskId: string): void {
    this.stopPolling(taskId);
    this.activeUploads.delete(taskId);
    this.tasks.delete(taskId);
    // Notify subscribers (they should remove the task from their UI)
    this.processQueue();
  }

  /**
   * Clear all tasks
   */
  clearAll(): void {
    // Stop all polling
    this.pollingIntervals.forEach((interval) => clearTimeout(interval));
    this.pollingIntervals.clear();
    this.pollingStartTimes.clear();
    this.activeUploads.clear();
    this.tasks.clear();
  }
}

// Export singleton instance
export const uploadManager = new UploadManager();

