'use client';

import { useEffect, useState } from 'react';

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

  useEffect(() => {
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
  }, [imageUrl]);

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

  // Utiliser une balise img native pour les URLs distantes
  return (
    <img
      src={displayUrl || undefined}
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
