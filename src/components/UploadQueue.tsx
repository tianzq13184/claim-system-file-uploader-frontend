import { useState, useEffect } from 'react';
import type { UploadTask } from '../types';
import { uploadManager } from '../services/uploadManager';

export function UploadQueue() {
  const [tasks, setTasks] = useState<UploadTask[]>([]);

  useEffect(() => {
    // Subscribe to upload manager updates
    const unsubscribe = uploadManager.subscribe(() => {
      setTasks([...uploadManager.getTasks()]);
    });

    // Initial load
    setTasks([...uploadManager.getTasks()]);

    return unsubscribe;
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  const getStatusBadgeClass = (status: UploadTask['status']): string => {
    switch (status) {
      case 'DONE':
        return 'badge-success';
      case 'FAILED':
        return 'badge-error';
      case 'UPLOADING':
      case 'PROCESSING':
      case 'REQUESTING_URL':
        return 'badge-warning';
      case 'READY':
      case 'URL_READY':
      case 'UPLOADED':
        return 'badge-info';
      default:
        return 'badge-default';
    }
  };

  const getStatusDisplay = (task: UploadTask): string => {
    switch (task.status) {
      case 'READY':
        return 'Ready';
      case 'REQUESTING_URL':
        return 'Requesting URL...';
      case 'URL_READY':
        return 'URL Ready';
      case 'UPLOADING':
        return task.uploadProgress !== undefined
          ? `Uploading ${task.uploadProgress}%`
          : 'Uploading...';
      case 'UPLOADED':
        return 'Uploaded';
      case 'PROCESSING':
        return 'Processing...';
      case 'DONE':
        return 'Done';
      case 'FAILED':
        return `Failed: ${task.failureReason || 'Unknown error'}`;
      default:
        return task.status;
    }
  };

  const handleStartUpload = (taskId: string) => {
    uploadManager.startUpload(taskId);
  };

  const handleRetry = (taskId: string) => {
    uploadManager.retryUpload(taskId);
  };

  const handleRemove = (taskId: string) => {
    uploadManager.removeTask(taskId);
  };

  if (tasks.length === 0) {
    return (
      <div className="upload-queue">
        <h2>Upload Queue</h2>
        <p className="empty-state">No upload tasks yet. Add files using the form above.</p>
      </div>
    );
  }

  return (
    <div className="upload-queue">
      <h2>Upload Queue</h2>
      <div className="queue-table">
        <table>
          <thead>
            <tr>
              <th>File Name</th>
              <th>Type</th>
              <th>Size</th>
              <th>Source System</th>
              <th>Transaction</th>
              <th>Business Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id}>
                <td>
                  <div className="file-name-cell">
                    <strong>{task.fileName}</strong>
                    {task.batchName && (
                      <span className="batch-name">({task.batchName})</span>
                    )}
                  </div>
                  {task.errorMessage && (
                    <div className="error-message">{task.errorMessage}</div>
                  )}
                  {task.canonicalLocation && (
                    <div className="canonical-info">
                      Canonical ready: {task.canonicalLocation.bucket}
                    </div>
                  )}
                </td>
                <td>{task.fileType}</td>
                <td>{formatFileSize(task.fileSize)}</td>
                <td>{task.sourceSystem}</td>
                <td>{task.transactionType}</td>
                <td>{task.businessDate}</td>
                <td>
                  <span className={`badge ${getStatusBadgeClass(task.status)}`}>
                    {getStatusDisplay(task)}
                  </span>
                  {task.status === 'UPLOADING' && task.uploadProgress !== undefined && (
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${task.uploadProgress}%` }}
                      />
                    </div>
                  )}
                </td>
                <td>
                  <div className="action-buttons">
                    {task.status === 'READY' && (
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleStartUpload(task.id)}
                      >
                        Start
                      </button>
                    )}
                    {task.status === 'FAILED' && (
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleRetry(task.id)}
                      >
                        Retry
                      </button>
                    )}
                    {task.status === 'DONE' && task.fileId && (
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => {
                          // Could navigate to details page
                          console.log('View details for file:', task.fileId);
                        }}
                      >
                        Details
                      </button>
                    )}
                    {task.status !== 'UPLOADING' &&
                      task.status !== 'PROCESSING' &&
                      task.status !== 'REQUESTING_URL' && (
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleRemove(task.id)}
                        >
                          Remove
                        </button>
                      )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}



