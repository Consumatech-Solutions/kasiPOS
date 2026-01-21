import { imageStorageService } from './image-storage';
import { filesApi } from '@/lib/api/files';

class ImageSyncService {
  private isOnline(): boolean {
    return typeof navigator !== 'undefined' && navigator.onLine;
  }

  /**
   * Synchroniser toutes les images non synchronisées
   */
  async syncUnsyncedImages(): Promise<void> {
    if (!this.isOnline()) {
      if (process.env.NODE_ENV === 'development') {
        console.log('Offline: Synchronisation des images reportée');
      }
      return;
    }

    const unsyncedImages = await imageStorageService.getUnsyncedImages();

    if (unsyncedImages.length === 0) {
      return;
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`Synchronisation de ${unsyncedImages.length} image(s)...`);
    }

    for (const image of unsyncedImages) {
      try {
        // Convertir le Blob en File
        const fileName = `product-${image.productId}-${image.id}.${imageStorageService.getFileExtension(image.mimeType)}`;
        const file = imageStorageService.blobToFile(
          image.imageData,
          fileName,
          image.mimeType
        );

        // Upload vers le serveur
        const response = await filesApi.uploadProductImage(file);

        // Marquer comme synchronisé
        await imageStorageService.markAsSynced(image.id, response.url);

        if (process.env.NODE_ENV === 'development') {
          console.log(`✓ Image ${image.id} synchronisée: ${response.url}`);
        }
      } catch (error: any) {
        // Ignorer les erreurs 404 et network pour ne pas spammer la console
        if (error?.response?.status !== 404 && error?.code !== 'ERR_NETWORK' && error?.message !== 'Network Error') {
          console.error(`✗ Erreur lors de la synchronisation de l'image ${image.id}:`, error);
        }
        // Continuer avec les autres images même en cas d'erreur
      }
    }
  }

  /**
   * Synchroniser l'image d'un produit spécifique
   */
  async syncProductImage(productId: string | number): Promise<string | null> {
    if (!this.isOnline()) {
      return null;
    }

    const image = await imageStorageService.getProductImage(productId);

    if (!image || image.synced) {
      return image?.serverUrl || null;
    }

    try {
      const fileName = `product-${productId}-${image.id}.${imageStorageService.getFileExtension(image.mimeType)}`;
      const file = imageStorageService.blobToFile(
        image.imageData,
        fileName,
        image.mimeType
      );

      const response = await filesApi.uploadProductImage(file);
      await imageStorageService.markAsSynced(image.id, response.url);

      return response.url;
    } catch (error: any) {
      // Ne pas throw l'erreur pour ne pas bloquer l'utilisateur
      // L'image reste disponible localement et sera réessayée plus tard
      const errorStatus = error?.response?.status;
      const errorCode = error?.code;
      const errorMessage = error?.message;
      
      // Logger seulement les erreurs non-404 et non-network
      if (errorStatus !== 404 && errorCode !== 'ERR_NETWORK' && errorMessage !== 'Network Error') {
        if (process.env.NODE_ENV === 'development') {
          console.error(`Erreur lors de la synchronisation de l'image du produit ${productId}:`, {
            status: errorStatus,
            code: errorCode,
            message: errorMessage,
            response: error?.response?.data,
          });
        }
      }
      
      // Retourner null au lieu de throw pour ne pas bloquer
      return null;
    }
  }
}

export const imageSyncService = new ImageSyncService();

// Écouter les changements de connexion
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Connexion rétablie: Synchronisation des images...');
    }
    imageSyncService.syncUnsyncedImages();
  });

  // Synchroniser toutes les 5 minutes si en ligne
  setInterval(() => {
    if (navigator.onLine) {
      imageSyncService.syncUnsyncedImages();
    }
  }, 5 * 60 * 1000); // 5 minutes
}
