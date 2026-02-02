'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { filesApi } from '@/lib/api/files';
import { feedback } from '@/lib/feedback';
import { ERROR_CODES } from '@/lib/error-codes';
import { cn } from '@/lib/utils';

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
  const [preview, setPreview] = useState<string | null>(currentImageUrl || null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update preview when currentImageUrl changes
  useEffect(() => {
    setPreview(currentImageUrl || null);
  }, [currentImageUrl]);

  const validateFile = (file: File): string | null => {
    // Check type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return 'Only images (JPEG, PNG, GIF, WebP) are accepted';
    }

    // Check size
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
      feedback.error('Invalid file', validationError, `Use an image under ${maxSizeMB}MB (JPEG, PNG, GIF, WebP).`, { code: ERROR_CODES.IMAGE_UPLOAD });
      return;
    }

    // Immediate preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload directly to DigitalOcean Spaces
    setUploading(true);
    try {
      const response = await filesApi.uploadProductImage(file);
      
      if (!response || !response.url) {
        throw new Error('Upload succeeded but server returned no URL');
      }

      let imageUrl = response.url;
      if (!imageUrl.startsWith('http')) {
        // If URL is relative, prefix with DigitalOcean Spaces
        imageUrl = imageUrl.startsWith('/') 
          ? `https://sfo3.digitaloceanspaces.com${imageUrl}`
          : `https://sfo3.digitaloceanspaces.com/${imageUrl}`;
      }

      setPreview(imageUrl);
      onUploadSuccess(imageUrl);
      feedback.success('Image uploaded', 'The product image has been uploaded.');
      setError(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Image upload failed';
      setError(errorMessage);
      onUploadError?.(errorMessage);
      if (!currentImageUrl) setPreview(null);
      feedback.fromError(err, 'Upload failed', 'Check file size (max 2MB) and format, then try again.', ERROR_CODES.IMAGE_UPLOAD);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async () => {
    try {
      // Delete on server if we have a URL
      if (currentImageUrl && currentImageUrl.startsWith('http')) {
        try {
          await filesApi.delete(currentImageUrl);
        } catch (err) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('Error deleting on server:', err);
          }
        }
      }

      setPreview(null);
      onDelete?.();
      feedback.success('Image deleted', 'The product image has been removed.');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete image';
      setError(errorMessage);
      onUploadError?.(errorMessage);
      feedback.fromError(err, 'Delete failed', 'Try again or check your connection.', ERROR_CODES.IMAGE_UPLOAD);
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
          disabled={uploading || disabled}
          className="cursor-pointer"
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading...
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
      </p>
    </div>
  );
}
