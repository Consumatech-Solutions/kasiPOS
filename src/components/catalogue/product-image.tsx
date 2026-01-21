'use client';

import { useEffect, useState, useRef } from 'react';
import { imageStorageService } from '@/lib/services/image-storage';

interface ProductImageProps {
  productId: string | number | undefined;
  imageUrl?: string | null;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
}

export function ProductImage({
  productId,
  imageUrl,
  alt,
  width = 40,
  height = 40,
  className = '',
}: ProductImageProps) {
  const [displayUrl, setDisplayUrl] = useState<string | null>(imageUrl || null);
  const [isLoading, setIsLoading] = useState(true);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadImage = async () => {
      setIsLoading(true);
      
      // Si on a déjà une URL serveur, l'utiliser directement
      if (imageUrl && (imageUrl.startsWith('http') || imageUrl.startsWith('https'))) {
        if (!cancelled) {
          // Révoquer l'ancienne URL blob si elle existe
          if (blobUrlRef.current) {
            URL.revokeObjectURL(blobUrlRef.current);
            blobUrlRef.current = null;
          }
          setDisplayUrl(imageUrl);
          setIsLoading(false);
        }
        return;
      }

      // Si on a un productId, essayer de charger depuis le stockage local
      if (productId) {
        try {
          const localUrl = await imageStorageService.getProductImageUrl(productId);
          if (!cancelled) {
            if (localUrl) {
              // Révoquer l'ancienne URL blob si elle existe et est différente
              if (blobUrlRef.current && blobUrlRef.current !== localUrl) {
                URL.revokeObjectURL(blobUrlRef.current);
              }
              blobUrlRef.current = localUrl;
              setDisplayUrl(localUrl);
            } else if (imageUrl && imageUrl.startsWith('blob:')) {
              // Si imageUrl est une URL blob, vérifier qu'elle est toujours valide
              // Si elle n'est pas valide, essayer de la régénérer depuis IndexedDB
              try {
                // Tester si l'URL blob est toujours valide en créant une nouvelle URL
                const image = await imageStorageService.getProductImage(productId);
                if (image) {
                  const newBlobUrl = URL.createObjectURL(image.imageData);
                  if (blobUrlRef.current && blobUrlRef.current !== newBlobUrl) {
                    URL.revokeObjectURL(blobUrlRef.current);
                  }
                  blobUrlRef.current = newBlobUrl;
                  setDisplayUrl(newBlobUrl);
                } else {
                  setDisplayUrl(imageUrl);
                }
              } catch {
                // Si on ne peut pas régénérer, utiliser l'URL fournie
                if (blobUrlRef.current && blobUrlRef.current !== imageUrl) {
                  URL.revokeObjectURL(blobUrlRef.current);
                }
                blobUrlRef.current = imageUrl;
                setDisplayUrl(imageUrl);
              }
            } else if (imageUrl) {
              setDisplayUrl(imageUrl);
            } else {
              setDisplayUrl(null);
            }
            setIsLoading(false);
          }
        } catch (err) {
          // Pas d'image locale, utiliser l'URL fournie ou null
          if (!cancelled) {
            if (imageUrl && imageUrl.startsWith('blob:')) {
              // Si imageUrl est une URL blob, essayer de la régénérer
              try {
                const image = await imageStorageService.getProductImage(productId);
                if (image) {
                  const newBlobUrl = URL.createObjectURL(image.imageData);
                  if (blobUrlRef.current && blobUrlRef.current !== newBlobUrl) {
                    URL.revokeObjectURL(blobUrlRef.current);
                  }
                  blobUrlRef.current = newBlobUrl;
                  setDisplayUrl(newBlobUrl);
                } else {
                  setDisplayUrl(null);
                }
              } catch {
                setDisplayUrl(null);
              }
            } else {
              setDisplayUrl(imageUrl || null);
            }
            setIsLoading(false);
          }
        }
      } else if (imageUrl) {
        if (!cancelled) {
          // Si c'est une URL blob, la gérer correctement
          if (imageUrl.startsWith('blob:')) {
            if (blobUrlRef.current && blobUrlRef.current !== imageUrl) {
              URL.revokeObjectURL(blobUrlRef.current);
            }
            blobUrlRef.current = imageUrl;
          }
          setDisplayUrl(imageUrl);
          setIsLoading(false);
        }
      } else {
        if (!cancelled) {
          setDisplayUrl(null);
          setIsLoading(false);
        }
      }
    };

    loadImage();

    return () => {
      cancelled = true;
      // Nettoyer l'URL blob seulement si le composant est complètement démonté
      // Utiliser un délai pour éviter de révoquer pendant le chargement
      const timeoutId = setTimeout(() => {
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = null;
        }
      }, 1000); // Délai de 1 seconde pour permettre le chargement
      
      return () => clearTimeout(timeoutId);
    };
  }, [productId, imageUrl]);

  if (isLoading) {
    return (
      <div className={`w-10 h-10 rounded-md bg-muted flex items-center justify-center text-xs text-muted-foreground ${className}`}>
        <div className="animate-pulse">...</div>
      </div>
    );
  }

  if (!displayUrl) {
    return (
      <div className={`w-10 h-10 rounded-md bg-muted flex items-center justify-center text-xs text-muted-foreground ${className}`}>
        No img
      </div>
    );
  }

  // Utiliser une balise img native pour les URLs blob (Next.js Image ne supporte pas les blob URLs)
  if (displayUrl.startsWith('blob:')) {
    return (
      <img
        src={displayUrl}
        alt={alt}
        width={width}
        height={height}
        className={`rounded-md object-cover ${className}`}
        style={{ width: `${width}px`, height: `${height}px` }}
        onError={async (e) => {
          // En cas d'erreur de chargement, essayer de régénérer l'URL blob depuis IndexedDB
          if (productId) {
            try {
              const image = await imageStorageService.getProductImage(productId);
              if (image) {
                // Révoquer l'ancienne URL blob invalide
                if (blobUrlRef.current) {
                  URL.revokeObjectURL(blobUrlRef.current);
                }
                // Créer une nouvelle URL blob
                const newBlobUrl = URL.createObjectURL(image.imageData);
                blobUrlRef.current = newBlobUrl;
                setDisplayUrl(newBlobUrl);
                return;
              }
            } catch (err) {
              // Si on ne peut pas régénérer, afficher le placeholder
            }
          }
          // Afficher le placeholder si on ne peut pas régénérer
          setDisplayUrl(null);
        }}
      />
    );
  }

  // Pour les URLs HTTP/HTTPS, utiliser une balise img native
  return (
    <img
      src={displayUrl}
      alt={alt}
      width={width}
      height={height}
      className={`rounded-md object-cover ${className}`}
      style={{ width: `${width}px`, height: `${height}px` }}
      onError={(e) => {
        // En cas d'erreur de chargement, afficher le placeholder
        setDisplayUrl(null);
      }}
    />
  );
}
