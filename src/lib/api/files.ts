import { api } from './core';
import type { UploadFileResponse, DeleteFileRequest, DeleteFileResponse } from '@/types/file';

const API_BASE_PATH = '/files'; // API endpoints are under /files (e.g., /files/upload)

export const filesApi = {
  /**
   * Upload a generic file
   */
  upload: async (file: File): Promise<UploadFileResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    // Do not set Content-Type manually - Axios will set it with the boundary
    const response = await api.post(`${API_BASE_PATH}/upload`, formData);
    return response.data;
  },

  /**
   * Upload a product image (recommended for products). Throws with a detailed message on failure.
   */
  uploadProductImage: async (file: File): Promise<UploadFileResponse> => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Invalid file type. Only images (JPEG, PNG, GIF, WebP) are accepted.');
    }

    const maxSizeBytes = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSizeBytes) {
      throw new Error(`File too large. Maximum: 2MB (current: ${(file.size / 1024 / 1024).toFixed(2)}MB)`);
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Do not set Content-Type manually - Axios will set it with the boundary
      const response = await api.post(`${API_BASE_PATH}/upload/product-image`, formData);
      return response.data;
    } catch (error: any) {
      const errorStatus = error?.response?.status;
      const errorResponseData = error?.response?.data;
      const errorMessage = String(errorResponseData?.message || errorResponseData?.error || error?.message || 'Unknown error');
      
      // If 400, try different field names
      if (errorStatus === 400) {
        const fieldNames = ['image', 'productImage', 'imageFile'];
        
        for (const fieldName of fieldNames) {
          try {
            const retryFormData = new FormData();
            retryFormData.append(fieldName, file);
            const retryResponse = await api.post(`${API_BASE_PATH}/upload/product-image`, retryFormData);
            
            return retryResponse.data;
          } catch (retryError: any) {
            continue;
          }
        }
        
        throw new Error(`Validation error (400): ${errorMessage}. Check backend configuration.`);
      }
      
      if (errorStatus === 401) {
        throw new Error('Unauthorized. Please log in again.');
      }
      
      if (errorStatus === 413) {
        throw new Error('File too large.');
      }
      
      if (errorStatus === 404 || error?.code === 'ERR_NETWORK' || error?.message === 'Network Error') {
        throw new Error('Cannot reach server. Ensure the backend is running and accessible.');
      }
      
      if (errorStatus) {
        throw new Error(`Server error (${errorStatus}): ${errorMessage}`);
      }
      
      throw new Error(`Upload error: ${errorMessage}`);
    }
  },

  /**
   * Delete a file by URL
   */
  delete: async (url: string): Promise<DeleteFileResponse> => {
    const response = await api.delete(API_BASE_PATH, {
      data: { url } as DeleteFileRequest,
    });
    return response.data;
  },
};
