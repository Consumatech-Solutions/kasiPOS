'use client';

import { useEffect, useRef, useState, useMemo } from 'react';

interface BarcodeDisplayProps {
  value: string;
  format?: 'CODE128' | 'EAN13' | 'EAN8' | 'CODE39' | 'ITF14' | 'MSI' | 'pharmacode' | 'codabar' | 'upc' | 'upce';
  width?: number;
  height?: number;
  displayValue?: boolean;
  className?: string;
}

// Global cache to avoid regenerating barcodes
const barcodeCache = new Map<string, string>();

export function BarcodeDisplay({ 
  value, 
  format = 'CODE128',
  width = 2,
  height = 100,
  displayValue = true,
  className = ''
}: BarcodeDisplayProps) {
  const barcodeRef = useRef<SVGSVGElement>(null);
  const [svgContent, setSvgContent] = useState<string>('');
  const currentValueRef = useRef<string>('');
  
  // Memoize cache key
  const cacheKey = useMemo(() => {
    const barcodeValue = String(value || '').trim();
    return barcodeValue ? `${barcodeValue}-${format}-${width}-${height}` : '';
  }, [value, format, width, height]);

  // Load from cache if available
  useEffect(() => {
    const barcodeValue = String(value || '').trim();
    
    if (!barcodeValue || !cacheKey) {
      setSvgContent('');
      currentValueRef.current = '';
      return;
    }

    // If value unchanged and we already have content, skip
    if (currentValueRef.current === barcodeValue && svgContent) {
      return;
    }

    currentValueRef.current = barcodeValue;

    // If barcode is in cache, use it
    if (barcodeCache.has(cacheKey)) {
      setSvgContent(barcodeCache.get(cacheKey)!);
      return;
    }

    // Generate barcode
    (async () => {
      try {
        const jsbarcodeModule = await import('jsbarcode');
        const JsBarcode = (jsbarcodeModule as any).default || jsbarcodeModule;
        
        // Re-check cache (another component may have generated it meanwhile)
        if (barcodeCache.has(cacheKey)) {
          setSvgContent(barcodeCache.get(cacheKey)!);
          return;
        }

        // Create temporary SVG for generation
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        
        // Determine format based on length
        let actualFormat = format;
        if (format === 'EAN13' && barcodeValue.length !== 13) {
          actualFormat = 'CODE128';
        } else if (!format || format === 'CODE128') {
          if (barcodeValue.length === 13 && /^\d+$/.test(barcodeValue)) {
            actualFormat = 'EAN13';
          } else if (barcodeValue.length === 8 && /^\d+$/.test(barcodeValue)) {
            actualFormat = 'EAN8';
          } else {
            actualFormat = 'CODE128';
          }
        }
        
        // Generate barcode
        JsBarcode(tempSvg, barcodeValue, {
          format: actualFormat,
          width: width,
          height: height,
          displayValue: displayValue,
          margin: 10,
          background: '#ffffff',
          lineColor: '#000000',
          fontSize: 12,
          textAlign: 'center',
          textPosition: 'bottom',
          textMargin: 5,
        });
        
        // Save to cache and state
        const content = tempSvg.innerHTML;
        if (content && currentValueRef.current === barcodeValue) {
          barcodeCache.set(cacheKey, content);
          setSvgContent(content);
        }
      } catch (err: any) {
        console.error('❌ Error generating barcode:', err, { value: barcodeValue, format });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, format, width, height, displayValue, value]);

  // Apply SVG content to DOM
  useEffect(() => {
    if (!barcodeRef.current || !svgContent) return;

    // Update only if content changed
    if (barcodeRef.current.innerHTML !== svgContent) {
      barcodeRef.current.innerHTML = svgContent;
      
      // Set SVG attributes
      requestAnimationFrame(() => {
        if (!barcodeRef.current) return;
        try {
          const bbox = barcodeRef.current.getBBox();
          if (bbox.width > 0 && bbox.height > 0) {
            barcodeRef.current.setAttribute('width', String(bbox.width));
            barcodeRef.current.setAttribute('height', String(bbox.height));
            barcodeRef.current.setAttribute('viewBox', `0 0 ${bbox.width} ${bbox.height}`);
          } else {
            barcodeRef.current.setAttribute('width', '200');
            barcodeRef.current.setAttribute('height', String(height));
            barcodeRef.current.setAttribute('viewBox', `0 0 200 ${height}`);
          }
        } catch {
          barcodeRef.current.setAttribute('width', '200');
          barcodeRef.current.setAttribute('height', String(height));
          barcodeRef.current.setAttribute('viewBox', `0 0 200 ${height}`);
        }
        barcodeRef.current.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        barcodeRef.current.style.display = 'block';
        barcodeRef.current.style.visibility = 'visible';
        barcodeRef.current.style.width = '100%';
        barcodeRef.current.style.height = 'auto';
        barcodeRef.current.style.maxWidth = '100%';
        barcodeRef.current.style.minHeight = `${height}px`;
      });
    }
  }, [svgContent, height]);

  const barcodeValue = String(value || '').trim();
  
  if (!barcodeValue) {
    return (
      <div className={`flex items-center justify-center text-muted-foreground text-sm ${className}`} style={{ minHeight: `${height}px` }}>
        No barcode
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center w-full ${className}`} style={{ minHeight: `${height}px` }}>
      <svg 
        ref={barcodeRef} 
        className="block"
        style={{ 
          width: '100%',
          height: 'auto',
          maxWidth: '100%',
          display: 'block',
          minHeight: `${height}px`
        }}
      />
    </div>
  );
}
