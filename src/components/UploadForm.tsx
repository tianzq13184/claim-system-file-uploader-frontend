import { useState, useRef } from 'react';
import type { FileType, TransactionType } from '../types';
import { FILE_EXTENSIONS, FILE_SIZE_LIMITS } from '../types';
import { uploadManager } from '../services/uploadManager';

interface UploadFormData {
  file: File | null;
  fileType: FileType | '';
  sourceSystem: string;
  transactionType: TransactionType | '';
  businessDate: string;
  batchName: string;
}

interface ValidationErrors {
  file?: string;
  fileType?: string;
  sourceSystem?: string;
  transactionType?: string;
  businessDate?: string;
}

const SOURCE_SYSTEMS = ['Hospital_A', 'Hospital_B', 'Hospital_C'];

export function UploadForm() {
  const [formData, setFormData] = useState<UploadFormData>({
    file: null,
    fileType: '',
    sourceSystem: '',
    transactionType: '',
    businessDate: new Date().toISOString().split('T')[0],
    batchName: '',
  });

  const [errors, setErrors] = useState<ValidationErrors>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Infer file type from file extension
   */
  const inferFileType = (fileName: string): FileType | '' => {
    const extension = fileName.substring(fileName.lastIndexOf('.')).toLowerCase() as string;

    if (FILE_EXTENSIONS.X12.includes(extension as '.x12' | '.edi' | '.txt')) {
      return 'X12';
    } else if (FILE_EXTENSIONS.CSV.includes(extension as '.csv')) {
      return 'CSV';
    }

    return '';
  };

  /**
   * Validate file
   */
  const validateFile = (file: File): string | undefined => {
    if (!file) {
      return 'Please select a file';
    }

    const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    const allExtensions: string[] = [
      ...FILE_EXTENSIONS.X12,
      ...FILE_EXTENSIONS.CSV,
    ];

    if (!allExtensions.includes(extension)) {
      return `Only X12 (${FILE_EXTENSIONS.X12.join('/')}) or CSV (.csv) files are supported.`;
    }

    const inferredType = inferFileType(file.name);
    if (inferredType === 'X12' && file.size > FILE_SIZE_LIMITS.X12) {
      return `File size exceeds X12 limit of ${FILE_SIZE_LIMITS.X12 / (1024 * 1024)} MB`;
    } else if (inferredType === 'CSV' && file.size > FILE_SIZE_LIMITS.CSV) {
      return `File size exceeds CSV limit of ${FILE_SIZE_LIMITS.CSV / (1024 * 1024 * 1024)} GB`;
    }

    return undefined;
  };

  /**
   * Validate entire form
   */
  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};

    if (!formData.file) {
      newErrors.file = 'Please select a file';
    } else {
      const fileError = validateFile(formData.file);
      if (fileError) {
        newErrors.file = fileError;
      }
    }

    if (!formData.fileType) {
      newErrors.fileType = 'Please select file type';
    }

    if (!formData.sourceSystem) {
      newErrors.sourceSystem = 'Please select source system';
    }

    if (!formData.transactionType) {
      newErrors.transactionType = 'Please select transaction type';
    }

    if (!formData.businessDate) {
      newErrors.businessDate = 'Please select business date';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle file selection
   */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setFormData((prev) => ({ ...prev, file: null, fileType: '' }));
      setErrors((prev) => ({ ...prev, file: undefined }));
      return;
    }

    // Validate file
    const fileError = validateFile(file);
    if (fileError) {
      setErrors((prev) => ({ ...prev, file: fileError }));
      return;
    }

    // Infer file type
    const inferredType = inferFileType(file.name);
    setFormData((prev) => ({
      ...prev,
      file,
      fileType: inferredType || prev.fileType,
    }));
    setErrors((prev) => ({ ...prev, file: undefined }));
  };

  /**
   * Format file size for display
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  /**
   * Get file size limit info
   */
  const getFileSizeLimitInfo = (): string | null => {
    if (!formData.file || !formData.fileType) return null;

    const limit = FILE_SIZE_LIMITS[formData.fileType];
    const limitStr =
      formData.fileType === 'X12'
        ? `${limit / (1024 * 1024)} MB`
        : `${limit / (1024 * 1024 * 1024)} GB`;

    return `${limitStr} limit`;
  };

  /**
   * Handle form submission
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[UploadForm] Form submitted, formData:', formData);

    if (!validateForm() || !formData.file || !formData.fileType || !formData.transactionType) {
      console.warn('[UploadForm] Form validation failed');
      return;
    }

    console.log('[UploadForm] Creating upload task...');
    // Create upload task
    const task = uploadManager.createTask({
      file: formData.file,
      fileType: formData.fileType,
      sourceSystem: formData.sourceSystem,
      transactionType: formData.transactionType,
      businessDate: formData.businessDate,
      batchName: formData.batchName || undefined,
    });

    console.log('[UploadForm] Task created:', task.id);

    // Start upload immediately
    console.log('[UploadForm] Starting upload for task:', task.id);
    uploadManager.startUpload(task.id).catch((error) => {
      console.error('[UploadForm] Failed to start upload:', error);
    });

    // Reset form
    setFormData({
      file: null,
      fileType: '',
      sourceSystem: '',
      transactionType: '',
      businessDate: new Date().toISOString().split('T')[0],
      batchName: '',
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    setErrors({});
  };

  return (
    <div className="upload-form">
      <h2>Upload Configuration</h2>
      <form onSubmit={handleSubmit}>
        {/* File Selection */}
        <div className="form-group">
          <label htmlFor="file">
            File <span className="required">*</span>
          </label>
          <input
            id="file"
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".x12,.edi,.txt,.csv"
          />
          {errors.file && <span className="error">{errors.file}</span>}
          {formData.file && (
            <div className="file-info">
              <p>
                <strong>Selected:</strong> {formData.file.name}
              </p>
              <p>
                <strong>Size:</strong> {formatFileSize(formData.file.size)}
                {getFileSizeLimitInfo() && (
                  <span className="info"> ({getFileSizeLimitInfo()})</span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* File Type */}
        <div className="form-group">
          <label htmlFor="fileType">
            File Type <span className="required">*</span>
          </label>
          <select
            id="fileType"
            value={formData.fileType}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, fileType: e.target.value as FileType | '' }))
            }
            disabled={!formData.file}
          >
            <option value="">Select file type</option>
            <option value="X12">X12</option>
            <option value="CSV">CSV</option>
          </select>
          {errors.fileType && <span className="error">{errors.fileType}</span>}
        </div>

        {/* Source System */}
        <div className="form-group">
          <label htmlFor="sourceSystem">
            Source System / Hospital <span className="required">*</span>
          </label>
          <select
            id="sourceSystem"
            value={formData.sourceSystem}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, sourceSystem: e.target.value }))
            }
          >
            <option value="">Select source system</option>
            {SOURCE_SYSTEMS.map((sys) => (
              <option key={sys} value={sys}>
                {sys}
              </option>
            ))}
          </select>
          {errors.sourceSystem && <span className="error">{errors.sourceSystem}</span>}
        </div>

        {/* Transaction Type */}
        <div className="form-group">
          <label htmlFor="transactionType">
            Transaction Type <span className="required">*</span>
          </label>
          <select
            id="transactionType"
            value={formData.transactionType}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                transactionType: e.target.value as TransactionType | '',
              }))
            }
          >
            <option value="">Select transaction type</option>
            <option value="834">834</option>
            <option value="835">835</option>
            <option value="837">837</option>
          </select>
          {errors.transactionType && (
            <span className="error">{errors.transactionType}</span>
          )}
        </div>

        {/* Business Date */}
        <div className="form-group">
          <label htmlFor="businessDate">
            Business Date <span className="required">*</span>
          </label>
          <input
            id="businessDate"
            type="date"
            value={formData.businessDate}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, businessDate: e.target.value }))
            }
          />
          {errors.businessDate && <span className="error">{errors.businessDate}</span>}
        </div>

        {/* Batch Name */}
        <div className="form-group">
          <label htmlFor="batchName">Remark / Batch Name (Optional)</label>
          <input
            id="batchName"
            type="text"
            value={formData.batchName}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, batchName: e.target.value }))
            }
            placeholder="e.g., Nov-25 nightly job"
          />
        </div>

        {/* Submit Button */}
        <button type="submit" className="btn btn-primary">
          Start Upload
        </button>
      </form>
    </div>
  );
}

