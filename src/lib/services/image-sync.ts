import { imageStorageService } from "./image-storage";
import { filesApi } from "@/lib/api/files";

class ImageSyncService {
  private isOnline(): boolean {
    return typeof navigator !== "undefined" && navigator.onLine;
  }

  async syncUnsyncedImages(): Promise<void> {
    if (!this.isOnline()) {
      if (process.env.NODE_ENV === "development") {
        console.log("Offline: Image sync postponed");
      }
      return;
    }

    const unsyncedImages = await imageStorageService.getUnsyncedImages();

    if (unsyncedImages.length === 0) {
      return;
    }

    if (process.env.NODE_ENV === "development") {
      console.log(`Syncing ${unsyncedImages.length} image(s)...`);
    }

    for (const image of unsyncedImages) {
      try {
        const fileName = `product-${image.productId}-${image.id}.${imageStorageService.getFileExtension(image.mimeType)}`;
        const file = imageStorageService.blobToFile(
          image.imageData,
          fileName,
          image.mimeType,
        );

        const response = await filesApi.uploadProductImage(file);

        await imageStorageService.markAsSynced(image.id, response.url);

        if (process.env.NODE_ENV === "development") {
          console.log(`✓ Image ${image.id} synced: ${response.url}`);
        }
      } catch (error: any) {
        if (
          error?.response?.status !== 404 &&
          error?.code !== "ERR_NETWORK" &&
          error?.message !== "Network Error"
        ) {
          console.error(`✗ Error syncing image ${image.id}:`, error);
        }
      }
    }
  }

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
        image.mimeType,
      );

      const response = await filesApi.uploadProductImage(file);
      await imageStorageService.markAsSynced(image.id, response.url);

      return response.url;
    } catch (error: any) {
      const errorStatus = error?.response?.status;
      const errorCode = error?.code;
      const errorMessage = error?.message;

      if (
        errorStatus !== 404 &&
        errorCode !== "ERR_NETWORK" &&
        errorMessage !== "Network Error"
      ) {
        if (process.env.NODE_ENV === "development") {
          console.error(`Error syncing product image ${productId}:`, {
            status: errorStatus,
            code: errorCode,
            message: errorMessage,
            response: error?.response?.data,
          });
        }
      }

      return null;
    }
  }
}

export const imageSyncService = new ImageSyncService();

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    imageSyncService.syncUnsyncedImages();
  });

  setInterval(
    () => {
      if (navigator.onLine) {
        imageSyncService.syncUnsyncedImages();
      }
    },
    5 * 60 * 1000,
  );
}
