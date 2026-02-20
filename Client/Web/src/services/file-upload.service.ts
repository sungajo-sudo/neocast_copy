/**
 * File Upload Service
 * 채팅 파일 첨부 및 일반 파일 업로드를 위한 클라이언트 서비스
 */

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '');

// localStorage key for persisted auth state (must match auth-store.ts)
const STORAGE_KEY = 'penstream-auth';

// ============================================
// Types
// ============================================

export interface UploadResult {
  success: boolean;
  fileId: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
}

export interface FileMetadata {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  url: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

export type ProgressCallback = (progress: UploadProgress) => void;

// ============================================
// FileUploadService Class
// ============================================

class FileUploadService {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Get access token from persisted auth state
   */
  private getAccessToken(): string | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      return parsed?.state?.tokens?.accessToken || null;
    } catch {
      return null;
    }
  }

  /**
   * Get authorization header
   */
  private getAuthHeader(): string {
    const token = this.getAccessToken();
    if (!token) {
      throw new Error('Authentication required');
    }
    return `Bearer ${token}`;
  }

  /**
   * Upload a file with progress tracking
   * Uses XMLHttpRequest for progress events
   */
  uploadFile(
    file: File,
    sessionId?: string,
    onProgress?: ProgressCallback
  ): Promise<UploadResult> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();

      formData.append('file', file);
      if (sessionId) {
        formData.append('sessionId', sessionId);
      }

      // Progress tracking
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          onProgress({
            loaded: event.loaded,
            total: event.total,
            percent: Math.round((event.loaded / event.total) * 100),
          });
        }
      });

      // Complete
      xhr.addEventListener('load', () => {
        try {
          const response = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(response as UploadResult);
          } else {
            reject(new Error(response.message || 'Upload failed'));
          }
        } catch {
          reject(new Error('Invalid server response'));
        }
      });

      // Error
      xhr.addEventListener('error', () => {
        reject(new Error('Network error during upload'));
      });

      // Abort
      xhr.addEventListener('abort', () => {
        reject(new Error('Upload cancelled'));
      });

      // Send request
      try {
        xhr.open('POST', `${this.baseUrl}/files/upload`);
        xhr.setRequestHeader('Authorization', this.getAuthHeader());
        xhr.send(formData);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Upload a Blob/Buffer with progress tracking
   */
  uploadBlob(
    blob: Blob,
    filename: string,
    mimeType: string,
    sessionId?: string,
    onProgress?: ProgressCallback
  ): Promise<UploadResult> {
    const file = new File([blob], filename, { type: mimeType });
    return this.uploadFile(file, sessionId, onProgress);
  }

  /**
   * Get file metadata
   */
  async getFileInfo(fileId: string): Promise<FileMetadata> {
    const response = await fetch(`${this.baseUrl}/files/${fileId}/info`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to get file info');
    }

    return data.file as FileMetadata;
  }

  /**
   * Get file download URL
   */
  getFileUrl(fileId: string): string {
    return `${this.baseUrl}/files/${fileId}`;
  }

  /**
   * Download file as Blob
   */
  async downloadFile(fileId: string): Promise<{ blob: Blob; filename: string }> {
    const response = await fetch(`${this.baseUrl}/files/${fileId}`);

    if (!response.ok) {
      const data = await response.json().catch(() => ({ message: 'Download failed' }));
      throw new Error(data.message || 'Download failed');
    }

    // Get filename from Content-Disposition header
    const disposition = response.headers.get('Content-Disposition');
    let filename = 'download';
    if (disposition) {
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
      if (filenameMatch) {
        filename = decodeURIComponent(filenameMatch[1]);
      }
    }

    const blob = await response.blob();
    return { blob, filename };
  }

  /**
   * Delete a file (only owner can delete)
   */
  async deleteFile(fileId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        Authorization: this.getAuthHeader(),
      },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({ message: 'Delete failed' }));
      throw new Error(data.message || 'Delete failed');
    }
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Validate file before upload
   * 모든 파일 타입 허용 (제한 없음)
   */
  validateFile(_file: File): { valid: boolean; error?: string } {
    // 모든 파일 타입 허용
    return { valid: true };
  }
}

// 싱글톤 인스턴스
export const fileUploadService = new FileUploadService();
