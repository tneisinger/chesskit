import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable CORS headers for SharedArrayBuffer (required for multi-threaded Stockfish)
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
        ],
      },
      // Ensure WASM files have correct MIME type
      {
        source: '/stockfish18/:path*.wasm',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/wasm',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
        ],
      },
    ];
  },

  // Note: Removed webpack WASM config - files in public/ should be served as static assets
  // and NOT processed by webpack. The webpack config was causing WASM files to be corrupted.
};

export default nextConfig;
