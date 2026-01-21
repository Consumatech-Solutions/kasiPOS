import { db, type ProductImageRecord } from '@/lib/db';

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
  /**
   * Générer un ID unique pour l'image
   */
  private generateImageId(): string {
    return `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Stocker une image localement dans IndexedDB
   */
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

    // Supprimer l'ancienne image du produit s'il y en a une
    try {
      const existingImages = await db.productImages
        .where('productId')
        .equals(String(productId))
        .toArray();

      for (const existingImage of existingImages) {
        await db.productImages.delete(existingImage.id);
      }
    } catch (err) {
      console.error('Error deleting existing images:', err);
    }

    // Ajouter la nouvelle image
    await db.productImages.add(imageRecord);

    // Retourner une URL blob pour affichage immédiat
    return URL.createObjectURL(imageBlob);
  }

  /**
   * Obtenir l'URL d'une image locale (blob://) ou serveur
   * Note: Les URLs blob créées ici doivent être révoquées par le composant qui les utilise
   */
  async getProductImageUrl(productId: string | number): Promise<string | null> {
    try {
      const images = await db.productImages
        .where('productId')
        .equals(String(productId))
        .toArray();

      if (images.length === 0) {
        return null;
      }

      const image = images[0];

      // Si synchronisé, retourner l'URL serveur
      if (image.synced && image.serverUrl) {
        return image.serverUrl;
      }

      // Sinon, créer une nouvelle URL blob depuis les données de l'image
      // Le composant qui utilise cette URL doit la révoquer avec URL.revokeObjectURL()
      try {
        return URL.createObjectURL(image.imageData);
      } catch (blobError) {
        console.error('Error creating blob URL:', blobError);
        return null;
      }
    } catch (err) {
      console.error('Error getting product image URL:', err);
      return null;
    }
  }

  /**
   * Obtenir l'image complète d'un produit
   */
  async getProductImage(productId: string | number): Promise<ProductImageRecord | null> {
    try {
      const images = await db.productImages
        .where('productId')
        .equals(String(productId))
        .toArray();

      return images.length > 0 ? images[0] : null;
    } catch (err) {
      console.error('Error getting product image:', err);
      return null;
    }
  }

  /**
   * Marquer une image comme synchronisée avec l'URL serveur
   */
  async markAsSynced(imageId: string, serverUrl: string): Promise<void> {
    await db.productImages.update(imageId, {
      synced: true,
      serverUrl,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Obtenir toutes les images non synchronisées
   */
  async getUnsyncedImages(): Promise<ProductImageRecord[]> {
    // Récupérer toutes les images et filtrer celles qui ne sont pas synchronisées
    // car Dexie ne peut pas utiliser .where() directement sur un booléen
    const allImages = await db.productImages.toArray();
    return allImages.filter(img => !img.synced);
  }

  /**
   * Supprimer une image locale
   */
  async deleteImage(imageId: string): Promise<void> {
    await db.productImages.delete(imageId);
  }

  /**
   * Supprimer toutes les images d'un produit
   */
  async deleteProductImages(productId: string | number): Promise<void> {
    try {
      const images = await db.productImages
        .where('productId')
        .equals(String(productId))
        .toArray();

      for (const image of images) {
        await this.deleteImage(image.id);
      }
    } catch (err) {
      console.error('Error deleting product images:', err);
    }
  }

  /**
   * Convertir un Blob en File pour l'upload
   */
  blobToFile(blob: Blob, fileName: string, mimeType: string): File {
    return new File([blob], fileName, { type: mimeType });
  }

  /**
   * Obtenir l'extension de fichier depuis le type MIME
   */
  getFileExtension(mimeType: string): string {
    const extensions: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
    };
    return extensions[mimeType] || 'jpg';
  }
}

export const imageStorageService = new ImageStorageService();
