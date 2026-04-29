import { db, type ProductImageRecord } from "@/lib/db";

export interface LocalImage {
  id: string;
  productId: string | number;
  imageData: Blob;
  mimeType: string;
  size: number;
  synced: boolean;
  serverUrl?: string;
  createdAt: string;
  updatedAt: string;
}

class ImageStorageService {
  private generateImageId(): string {
    return `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async storeImage(productId: string | number, file: File): Promise<string> {
    const imageId = this.generateImageId();
    const imageBlob = new Blob([file], { type: file.type });

    const imageRecord: ProductImageRecord = {
      id: imageId,
      productId: String(productId),
      imageData: imageBlob,
      mimeType: file.type,
      size: file.size,
      synced: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const existingImages = await db.productImages
        .where("productId")
        .equals(String(productId))
        .toArray();

      for (const existingImage of existingImages) {
        await db.productImages.delete(existingImage.id);
      }
    } catch (err) {
      console.error("Error deleting existing images:", err);
    }

    await db.productImages.add(imageRecord);

    return URL.createObjectURL(imageBlob);
  }

  async getProductImageUrl(productId: string | number): Promise<string | null> {
    try {
      const images = await db.productImages
        .where("productId")
        .equals(String(productId))
        .toArray();

      if (images.length === 0) {
        return null;
      }

      const image = images[0];

      if (image.synced && image.serverUrl) {
        return image.serverUrl;
      }

      try {
        return URL.createObjectURL(image.imageData);
      } catch (blobError) {
        console.error("Error creating blob URL:", blobError);
        return null;
      }
    } catch (err) {
      console.error("Error getting product image URL:", err);
      return null;
    }
  }

  async getProductImage(
    productId: string | number,
  ): Promise<ProductImageRecord | null> {
    try {
      const images = await db.productImages
        .where("productId")
        .equals(String(productId))
        .toArray();

      return images.length > 0 ? images[0] : null;
    } catch (err) {
      console.error("Error getting product image:", err);
      return null;
    }
  }

  async markAsSynced(imageId: string, serverUrl: string): Promise<void> {
    await db.productImages.update(imageId, {
      synced: true,
      serverUrl,
      updatedAt: new Date().toISOString(),
    });
  }

  async getUnsyncedImages(): Promise<ProductImageRecord[]> {
    const allImages = await db.productImages.toArray();
    return allImages.filter((img: any) => !img.synced);
  }

  async deleteImage(imageId: string): Promise<void> {
    await db.productImages.delete(imageId);
  }

  async deleteProductImages(productId: string | number): Promise<void> {
    try {
      const images = await db.productImages
        .where("productId")
        .equals(String(productId))
        .toArray();

      for (const image of images) {
        await this.deleteImage(image.id);
      }
    } catch (err) {
      console.error("Error deleting product images:", err);
    }
  }

  blobToFile(blob: Blob, fileName: string, mimeType: string): File {
    return new File([blob], fileName, { type: mimeType });
  }

  getFileExtension(mimeType: string): string {
    const extensions: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/png": "png",
      "image/gif": "gif",
      "image/webp": "webp",
    };
    return extensions[mimeType] || "jpg";
  }
}

export const imageStorageService = new ImageStorageService();
