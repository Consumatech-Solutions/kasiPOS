'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { filesApi } from '@/lib/api/files';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { imageStorageService } from '@/lib/services/image-storage';
import { imageSyncService } from '@/lib/services/image-sync';
import { db } from '@/lib/db';

interface ImageUploadProps {
  productId?: string | number;
  currentImageUrl?: string | null;
  onUploadSuccess: (url: string) => void;
  onUploadError?: (error: string) => void;
  onDelete?: () => void;
  maxSizeMB?: number;
  disabled?: boolean;
  className?: string;
}

export function ImageUpload({
  productId,
  currentImageUrl,
  onUploadSuccess,
  onUploadError,
  onDelete,
  maxSizeMB = 2,
  disabled = false,
  className,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentImageUrl || null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const blobUrlRef = useRef<string | null>(null);
  const { toast } = useToast();

  // Nettoyer l'URL blob quand le composant se démonte
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, []);

  // Charger l'image locale si disponible
  useEffect(() => {
    const loadImage = async () => {
      if (productId && !currentImageUrl) {
        try {
          const localUrl = await imageStorageService.getProductImageUrl(productId);
          if (localUrl) {
            blobUrlRef.current = localUrl;
            setPreview(localUrl);
          }
        } catch (err) {
          // Pas d'image locale
        }
      } else if (currentImageUrl) {
        setPreview(currentImageUrl);
      }
    };

    loadImage();
  }, [productId, currentImageUrl]);

  const validateFile = (file: File): string | null => {
    // Vérifier le type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return 'Only images (JPEG, PNG, GIF, WebP) are accepted';
    }

    // Vérifier la taille
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return `File size must not exceed ${maxSizeMB}MB (current: ${(file.size / 1024 / 1024).toFixed(2)}MB)`;
    }

    return null;
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);

    // Validation
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      onUploadError?.(validationError);
      toast({
        variant: 'destructive',
        title: 'Invalid file',
        description: validationError,
      });
      return;
    }

    // Aperçu immédiat
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Stocker localement d'abord
    setUploading(true);
    try {
      if (!productId) {
        throw new Error('Product ID is required to store the image');
      }

      // Révoquer l'ancienne URL blob
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }

      // Stocker dans IndexedDB
      const blobUrl = await imageStorageService.storeImage(productId, file);
      blobUrlRef.current = blobUrl;
      setPreview(blobUrl);

      // Appeler le callback avec l'URL locale
      onUploadSuccess(blobUrl);

      // Essayer de synchroniser immédiatement si en ligne
      if (navigator.onLine) {
        setSyncing(true);
        try {
          // Uploader directement le fichier original plutôt que depuis IndexedDB
          const response = await filesApi.uploadProductImage(file);
          
          // Si la réponse est null, c'est que l'upload a échoué mais l'image est locale
          if (!response || !response.url) {
            toast({
              title: 'Image saved locally',
              description: 'The image will be synchronized when the backend is available.',
            });
            setSyncing(false);
            return;
          }
          
          // Marquer l'image comme synchronisée
          const images = await db.productImages
            .where('productId')
            .equals(String(productId))
            .toArray();
          
          if (images.length > 0) {
            await imageStorageService.markAsSynced(images[0].id, response.url);
            setPreview(response.url);
            onUploadSuccess(response.url);
            toast({
              title: 'Image uploaded successfully',
              description: 'The product image has been uploaded and synchronized.',
            });
          } else {
            toast({
              title: 'Image saved locally',
              description: 'The image will be synchronized when online.',
            });
          }
        } catch (syncError: any) {
          // Ne pas bloquer l'utilisateur si la synchronisation échoue
          // L'image est déjà stockée localement et sera synchronisée plus tard
          const errorStatus = syncError?.response?.status;
          const errorCode = syncError?.code;
          const errorMessage = syncError?.message || syncError?.toString() || 'Unknown error';
          const errorResponseData = syncError?.response?.data;
          
          // Logger les détails de l'erreur en développement
          if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️ Synchronisation immédiate échouée (image sauvegardée localement):', {
              status: errorStatus,
              code: errorCode,
              message: errorMessage,
              responseData: errorResponseData,
              url: syncError?.config?.url,
              method: syncError?.config?.method,
            });
          }
          
          // Ignorer les erreurs 404 et network silencieusement
          if (errorStatus === 404 || errorCode === 'ERR_NETWORK' || errorMessage === 'Network Error') {
            toast({
              title: 'Image saved locally',
              description: 'The image will be synchronized when online.',
            });
          } else {
            // Pour les autres erreurs (400, 500, etc.), afficher un message informatif
            // mais rassurer l'utilisateur que l'image est sauvegardée localement
            const backendMessage = errorResponseData?.message || errorResponseData?.error;
            toast({
              title: 'Image saved locally',
              description: backendMessage 
                ? `Upload failed: ${backendMessage}. The image is saved locally and will be synchronized later.`
                : 'The image is saved locally and will be synchronized automatically when the backend is available.',
            });
          }
        } finally {
          setSyncing(false);
        }
      } else {
        toast({
          title: 'Image saved locally',
          description: 'The image will be synchronized when online.',
        });
      }

      setError(null);
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save image';
      setError(errorMessage);
      onUploadError?.(errorMessage);
      setPreview(currentImageUrl || null);
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: errorMessage,
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async () => {
    if (!productId) return;

    try {
      // Révoquer l'URL blob
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }

      // Supprimer localement
      await imageStorageService.deleteProductImages(productId);

      // Si on a une URL serveur, la supprimer aussi
      if (currentImageUrl && currentImageUrl.startsWith('http')) {
        try {
          await filesApi.delete(currentImageUrl);
        } catch (err) {
          console.warn('Erreur lors de la suppression sur le serveur:', err);
        }
      }

      setPreview(null);
      onDelete?.();
      toast({
        title: 'Image deleted',
        description: 'The product image has been removed.',
      });
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete image';
      setError(errorMessage);
      onUploadError?.(errorMessage);
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: errorMessage,
      });
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      {preview && (
        <div className="relative inline-block">
          <img
            src={preview}
            alt="Preview"
            className="w-32 h-32 object-cover rounded-lg border border-border"
          />
          {currentImageUrl && onDelete && !disabled && (
            <Button
              type="button"
              variant="destructive"
              size="icon"
              onClick={handleDelete}
              className="absolute top-1 right-1 h-6 w-6"
              title="Delete image"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
          onChange={handleFileSelect}
          disabled={uploading || disabled}
          className="hidden"
          id="image-upload"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || syncing || disabled}
          className="cursor-pointer"
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : syncing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              {preview ? 'Change image' : 'Upload image'}
            </>
          )}
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <p className="text-xs text-muted-foreground">
        Accepted formats: JPEG, PNG, GIF, WebP (max {maxSizeMB}MB)
        {!navigator.onLine && (
          <span className="block text-amber-600 mt-1">
            ⚠ Offline: Image will be synchronized automatically when connection is restored
          </span>
        )}
      </p>
    </div>
  );
}
