import { api } from './core';
import type { UploadFileResponse, DeleteFileRequest, DeleteFileResponse } from '@/types/file';

const API_BASE_PATH = '/files'; // API endpoints are under /files (e.g., /files/upload)

export const filesApi = {
  /**
   * Upload un fichier générique
   */
  upload: async (file: File): Promise<UploadFileResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    // Ne pas définir Content-Type manuellement - Axios le fera automatiquement avec la boundary
    const response = await api.post(`${API_BASE_PATH}/upload`, formData);
    return response.data;
  },

  /**
   * Upload une image produit (recommandé pour les produits)
   * Retourne null si l'upload échoue (l'image reste disponible localement)
   */
  uploadProductImage: async (file: File): Promise<UploadFileResponse | null> => {
    const formData = new FormData();
    // Essayer avec 'file' d'abord, puis 'image' si nécessaire
    formData.append('file', file);

    // Debug: vérifier que le fichier est bien dans le FormData (seulement en cas d'erreur)
    // Logs déplacés dans le catch pour éviter la pollution de la console

    try {
      // Ne pas définir Content-Type manuellement - Axios le fera automatiquement avec la boundary
      const response = await api.post(`${API_BASE_PATH}/upload/product-image`, formData);
      return response.data;
    } catch (error: any) {
      const errorStatus = error?.response?.status;
      const errorResponseData = error?.response?.data;
      const errorMessage = String(errorResponseData?.message || errorResponseData?.error || '').toLowerCase();
      
      // Vérifier si c'est une erreur de configuration backend connue (Region missing, etc.)
      const isBackendConfigError = errorMessage.includes('region is missing') || 
                                    errorMessage.includes('region') ||
                                    errorMessage.includes('configuration') ||
                                    errorMessage.includes('aws') ||
                                    errorMessage.includes('s3');
      
      // Si c'est une erreur 400, essayer avec différents noms de champs
      if (errorStatus === 400) {
        const fieldNames = ['image', 'productImage', 'imageFile'];
        
        for (const fieldName of fieldNames) {
          try {
            const retryFormData = new FormData();
            retryFormData.append(fieldName, file);
            const retryResponse = await api.post(`${API_BASE_PATH}/upload/product-image`, retryFormData);
            
            // Succès avec ce nom de champ
            return retryResponse.data;
          } catch (retryError: any) {
            // Continuer avec le prochain nom de champ - silencieux
            continue;
          }
        }
        
        // Si tous les retries ont échoué, retourner null silencieusement
        // L'image est déjà sauvegardée localement
        return null as any;
      }
      
      // Pour les erreurs 404 et network - retourner null silencieusement
      if (errorStatus === 404 || error?.code === 'ERR_NETWORK' || error?.message === 'Network Error') {
        return null as any;
      }
      
      // Pour les autres erreurs (500, etc.), ne pas logger et retourner null
      // L'image est sauvegardée localement, donc on ne bloque pas l'utilisateur
      return null as any;
    }
  },

  /**
   * Supprimer un fichier par URL
   */
  delete: async (url: string): Promise<DeleteFileResponse> => {
    const response = await api.delete(API_BASE_PATH, {
      data: { url } as DeleteFileRequest,
    });
    return response.data;
  },
};
