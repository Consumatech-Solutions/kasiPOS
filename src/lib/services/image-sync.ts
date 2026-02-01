import { imageStorageService } from './image-storage';
import { filesApi } from '@/lib/api/files';

class ImageSyncService {
  private isOnline(): boolean {
    return typeof navigator !== 'undefined' && navigator.onLine;
  }

  /**
   * Sync all unsynced images
   */
  async syncUnsyncedImages(): Promise<void> {
    if (!this.isOnline()) {
      if (process.env.NODE_ENV === 'development') {
        console.log('Offline: Image sync postponed');
      }
      return;
    }

    const unsyncedImages = await imageStorageService.getUnsyncedImages();

    if (unsyncedImages.length === 0) {
      return;
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`Syncing ${unsyncedImages.length} image(s)...`);
    }

    for (const image of unsyncedImages) {
      try {
        // Convert Blob to File
        const fileName = `product-${image.productId}-${image.id}.${imageStorageService.getFileExtension(image.mimeType)}`;
        const file = imageStorageService.blobToFile(
          image.imageData,
          fileName,
          image.mimeType
        );

        // Upload to server
        const response = await filesApi.uploadProductImage(file);

        // Mark as synced
        await imageStorageService.markAsSynced(image.id, response.url);

        if (process.env.NODE_ENV === 'development') {
          console.log(`✓ Image ${image.id} synced: ${response.url}`);
        }
      } catch (error: any) {
        // Ignore 404 and network errors to avoid console spam
        if (error?.response?.status !== 404 && error?.code !== 'ERR_NETWORK' && error?.message !== 'Network Error') {
          console.error(`✗ Error syncing image ${image.id}:`, error);
        }
        // Continue with other images on error
      }
    }
  }

  /**
   * Sync a specific product image
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
      // Do not throw so user is not blocked; image stays available locally and will retry later
      const errorStatus = error?.response?.status;
      const errorCode = error?.code;
      const errorMessage = error?.message;
      
      // Log only non-404 and non-network errors
      if (errorStatus !== 404 && errorCode !== 'ERR_NETWORK' && errorMessage !== 'Network Error') {
        if (process.env.NODE_ENV === 'development') {
          console.error(`Error syncing product image ${productId}:`, {
            status: errorStatus,
            code: errorCode,
            message: errorMessage,
            response: error?.response?.data,
          });
        }
      }
      
      // Return null instead of throwing so caller is not blocked
      return null;
    }
  }
}

export const imageSyncService = new ImageSyncService();

// Listen for connection changes
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Connection restored: Syncing images...');
    }
    imageSyncService.syncUnsyncedImages();
  });

  // Sync every 5 minutes when online
  setInterval(() => {
    if (navigator.onLine) {
      imageSyncService.syncUnsyncedImages();
    }
  }, 5 * 60 * 1000); // 5 minutes
}
