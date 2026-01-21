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
   * Lance une erreur avec un message détaillé si l'upload échoue
   */
  uploadProductImage: async (file: File): Promise<UploadFileResponse> => {
    // Validation préalable côté client
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Type de fichier invalide. Seules les images (JPEG, PNG, GIF, WebP) sont acceptées.');
    }

    const maxSizeBytes = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSizeBytes) {
      throw new Error(`Fichier trop volumineux. Maximum: 2MB (actuel: ${(file.size / 1024 / 1024).toFixed(2)}MB)`);
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Ne pas définir Content-Type manuellement - Axios le fera automatiquement avec la boundary
      const response = await api.post(`${API_BASE_PATH}/upload/product-image`, formData);
      return response.data;
    } catch (error: any) {
      const errorStatus = error?.response?.status;
      const errorResponseData = error?.response?.data;
      const errorMessage = String(errorResponseData?.message || errorResponseData?.error || error?.message || 'Erreur inconnue');
      
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
            // Continuer avec le prochain nom de champ
            continue;
          }
        }
        
        // Si tous les retries ont échoué, lancer une erreur avec message détaillé
        throw new Error(`Erreur de validation (400): ${errorMessage}. Vérifiez la configuration du backend.`);
      }
      
      // Gestion des autres erreurs avec messages spécifiques
      if (errorStatus === 401) {
        throw new Error('Non autorisé. Veuillez vous reconnecter.');
      }
      
      if (errorStatus === 413) {
        throw new Error('Fichier trop volumineux.');
      }
      
      if (errorStatus === 404 || error?.code === 'ERR_NETWORK' || error?.message === 'Network Error') {
        throw new Error('Impossible de contacter le serveur. Vérifiez que le backend est démarré et accessible.');
      }
      
      // Pour les autres erreurs serveur
      if (errorStatus) {
        throw new Error(`Erreur serveur (${errorStatus}): ${errorMessage}`);
      }
      
      // Erreur de configuration ou autre
      throw new Error(`Erreur lors de l'upload: ${errorMessage}`);
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
