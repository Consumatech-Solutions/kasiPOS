'use client';

import { useEffect, useState } from 'react';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { getProductInitials } from '@/lib/utils/product-initials';

interface ProductImageProps {
  productId: string | number | undefined;
  imageUrl?: string | null;
  alt: string;
  productName?: string;
  width?: number;
  height?: number;
  className?: string;
}

export function ProductImage({
  productId,
  imageUrl,
  alt,
  productName,
  width = 40,
  height = 40,
  className = '',
}: ProductImageProps) {
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const { isOnline } = useNetworkStatus();
  
  const initials = getProductInitials(productName || alt);

  useEffect(() => {
    // Reset error state when imageUrl changes
    setImageError(false);
    
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

  // Render initials display component
  const renderInitials = () => (
    <div 
      className={`rounded-md bg-primary/10 flex items-center justify-center text-primary font-bold ${className}`}
      style={{ width: `${width}px`, height: `${height}px`, fontSize: `${Math.max(10, width * 0.35)}px` }}
    >
      {initials || '??'}
    </div>
  );

  if (isLoading) {
    return (
      <div className={`w-10 h-10 rounded-md bg-muted flex items-center justify-center text-xs text-muted-foreground ${className}`} style={{ width: `${width}px`, height: `${height}px` }}>
        <div className="animate-pulse">...</div>
      </div>
    );
  }

  // Show initials when offline, no image URL, or image error
  if (!isOnline || !displayUrl || imageError) {
    return renderInitials();
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
      onError={() => {
        // On image error, show initials
        setImageError(true);
      }}
    />
  );
}
