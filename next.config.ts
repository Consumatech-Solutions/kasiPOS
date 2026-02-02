import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  outputFileTracingRoot: require('path').join(__dirname),
  // Avoid ChunkLoadError with double /_next/ in chunk URLs (basePath/assetPrefix must be consistent)
  basePath: '',
  assetPrefix: '',
  // Increase chunk load timeout; in dev use memory cache to avoid Windows file-lock and corrupt pack errors
  webpack: (config, { isServer, dev }) => {
    if (!isServer && config.output) {
      config.output.chunkLoadTimeout = 60000; // 60 seconds (default 12s)
    }
    if (dev) {
      // Avoid UNKNOWN/open webpack.js and "incorrect header check" on .pack.gz (Windows)
      config.cache = { type: 'memory' };
    }
    return config;
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'ai-mobile.sfo3.digitaloceanspaces.com',
        port: '',
        pathname: '/**',
      },
    ],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  // PWA configuration
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
  // Ensure service worker is served from root; serve favicon from stable asset to avoid 500
  async rewrites() {
    return [
      {
        source: '/sw.js',
        destination: '/sw.js',
      },
      {
        source: '/favicon.ico',
        destination: '/icons/icon-192x192.svg',
      },
    ];
  },
};

export default nextConfig;
