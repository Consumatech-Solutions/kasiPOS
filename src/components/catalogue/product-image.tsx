'use client';

import { useEffect, useState } from 'react';
import { useNetworkStatus } from '@/hooks/use-network-status';

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
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { isOnline } = useNetworkStatus();

  useEffect(() => {
    // Don't load images when offline
    if (!isOnline) {
      setDisplayUrl(null);
      setIsLoading(false);
      return;
    }

    // Utiliser uniquement l'URL fournie (doit être une URL distante)
    if (imageUrl) {
      // S'assurer que l'URL utilise https://sfo3.digitaloceanspaces.com si elle est relative
      let url = imageUrl;
      if (!url.startsWith('http')) {
        url = url.startsWith('/') 
          ? `https://sfo3.digitaloceanspaces.com${url}`
          : `https://sfo3.digitaloceanspaces.com/${url}`;
      }
      setDisplayUrl(url);
    } else {
      setDisplayUrl(null);
    }
    setIsLoading(false);
  }, [imageUrl, isOnline]);

  if (isLoading) {
    return (
      <div className={`w-10 h-10 rounded-md bg-muted flex items-center justify-center text-xs text-muted-foreground ${className}`} style={{ width: `${width}px`, height: `${height}px` }}>
        <div className="animate-pulse">...</div>
      </div>
    );
  }

  // Show placeholder when offline or no image URL
  // Never render img tag when offline to prevent any network requests
  if (!isOnline) {
    return (
      <div className={`w-10 h-10 rounded-md bg-muted flex items-center justify-center text-xs text-muted-foreground ${className}`} style={{ width: `${width}px`, height: `${height}px` }}>
        Offline
      </div>
    );
  }

  if (!displayUrl) {
    return (
      <div className={`w-10 h-10 rounded-md bg-muted flex items-center justify-center text-xs text-muted-foreground ${className}`} style={{ width: `${width}px`, height: `${height}px` }}>
        No img
      </div>
    );
  }

  // Only render img tag when online and we have a URL
  // Use loading="lazy" to prevent eager loading
  return (
    <img
      src={displayUrl}
      alt={alt}
      width={width}
      height={height}
      className={`rounded-md object-cover ${className}`}
      style={{ width: `${width}px`, height: `${height}px` }}
      loading="lazy"
      decoding="async"
      onError={(e) => {
        // En cas d'erreur de chargement, afficher le placeholder
        setDisplayUrl(null);
      }}
    />
  );
}
