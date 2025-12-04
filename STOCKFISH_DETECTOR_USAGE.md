# Stockfish.js Flavor Detector Usage Guide

This guide shows how to use the Stockfish flavor detector to automatically select the best engine for the user's device.

## Quick Start

```typescript
import { detectStockfishFlavor } from '@/utils/stockfishDetector';

// Detect the best flavor for the current device
const recommendation = detectStockfishFlavor();

console.log(recommendation);
// Output:
// {
//   flavor: "large-multi-threaded",
//   supportsWasm: true,
//   supportsCORS: true,
//   isMobile: false,
//   reason: "Desktop with CORS support, using strongest multi-threaded engine (≈75MB)",
//   fileName: "stockfish-nnue-17.1.js"
// }
```

## Detection Logic

The detector checks three main capabilities:

1. **WebAssembly Support**: Whether the browser can run WASM modules
2. **CORS Support**: Whether SharedArrayBuffer is available (requires proper CORS headers)
3. **Device Type**: Whether the user is on a mobile device

### Decision Tree

```
Does browser support WebAssembly?
├─ No  → Use ASM-JS (slowest, most compatible)
└─ Yes → Is it a mobile device?
    ├─ Yes → Does it support CORS?
    │   ├─ Yes → Use Lite Multi-threaded (≈7MB)
    │   └─ No  → Use Lite Single-threaded (≈7MB)
    └─ No (Desktop) → Does it support CORS?
        ├─ Yes → Use Large Multi-threaded (≈75MB, strongest)
        └─ No  → Use Large Single-threaded (≈75MB)
```

## Available Flavors

| Flavor | Size | Strength | Threading | CORS Required | Best For |
|--------|------|----------|-----------|---------------|----------|
| `large-multi-threaded` | ≈75MB | Strongest | Yes | Yes | Desktop with CORS |
| `large-single-threaded` | ≈75MB | Strong | No | No | Desktop without CORS |
| `lite-multi-threaded` | ≈7MB | Moderate | Yes | Yes | Mobile with CORS |
| `lite-single-threaded` | ≈7MB | Moderate | No | No | Mobile without CORS |
| `asm-js` | ≈10MB | Weakest | No | No | Legacy browsers |

## Practical Examples

### Example 1: Basic Usage

```typescript
import { detectStockfishFlavor, logStockfishDetection } from '@/utils/stockfishDetector';

function initializeEngine() {
  const recommendation = detectStockfishFlavor();

  // Log detailed info to console
  logStockfishDetection(recommendation);

  // Load the recommended engine
  const stockfish = new Worker(`/stockfish/${recommendation.fileName}`);

  return stockfish;
}
```

### Example 2: React Component

```typescript
"use client";

import { useEffect, useState } from 'react';
import { detectStockfishFlavor, type StockfishRecommendation } from '@/utils/stockfishDetector';

export default function ChessAnalysis() {
  const [engine, setEngine] = useState<Worker | null>(null);
  const [recommendation, setRecommendation] = useState<StockfishRecommendation | null>(null);

  useEffect(() => {
    // Detect the best flavor
    const detected = detectStockfishFlavor();
    setRecommendation(detected);

    // Load the engine
    const worker = new Worker(`/stockfish/${detected.fileName}`);
    worker.postMessage('uci');

    worker.addEventListener('message', (event) => {
      console.log('Engine:', event.data);
    });

    setEngine(worker);

    // Cleanup
    return () => {
      worker.terminate();
    };
  }, []);

  return (
    <div>
      <h2>Chess Analysis</h2>
      {recommendation && (
        <p>Using {recommendation.flavor} engine</p>
      )}
    </div>
  );
}
```

### Example 3: With Error Handling and Fallback

```typescript
import { detectStockfishFlavor, StockfishFlavor } from '@/utils/stockfishDetector';

function loadEngineWithFallback(): Worker | null {
  const recommendation = detectStockfishFlavor();

  try {
    // Try recommended engine
    const worker = new Worker(`/stockfish/${recommendation.fileName}`);
    worker.postMessage('uci');
    console.log(`Loaded ${recommendation.flavor} successfully`);
    return worker;
  } catch (error) {
    console.error(`Failed to load ${recommendation.flavor}:`, error);

    // Fallback to ASM-JS if not already using it
    if (recommendation.flavor !== StockfishFlavor.ASM_JS) {
      try {
        const fallback = new Worker('/stockfish/stockfish-17.1-asm.js');
        fallback.postMessage('uci');
        console.log('Loaded ASM-JS fallback successfully');
        return fallback;
      } catch (fallbackError) {
        console.error('Failed to load fallback engine:', fallbackError);
      }
    }
  }

  return null;
}
```

### Example 4: Custom Detection Override

```typescript
import { detectStockfishFlavor, StockfishFlavor } from '@/utils/stockfishDetector';

function loadEngine(forceEngine?: StockfishFlavor): Worker {
  let fileName: string;

  if (forceEngine) {
    // User manually selected an engine
    const fileNames = {
      [StockfishFlavor.LARGE_MULTI_THREADED]: 'stockfish-nnue-17.1.js',
      [StockfishFlavor.LARGE_SINGLE_THREADED]: 'stockfish-nnue-17.1-single.js',
      [StockfishFlavor.LITE_MULTI_THREADED]: 'stockfish-nnue-17.1-lite.js',
      [StockfishFlavor.LITE_SINGLE_THREADED]: 'stockfish-nnue-17.1-lite-single.js',
      [StockfishFlavor.ASM_JS]: 'stockfish-17.1-asm.js',
    };
    fileName = fileNames[forceEngine];
    console.log(`Using manually selected engine: ${forceEngine}`);
  } else {
    // Auto-detect
    const recommendation = detectStockfishFlavor();
    fileName = recommendation.fileName;
    console.log(`Auto-detected engine: ${recommendation.flavor}`);
  }

  return new Worker(`/stockfish/${fileName}`);
}

// Usage:
// const engine = loadEngine(); // Auto-detect
// const engine = loadEngine(StockfishFlavor.LITE_MULTI_THREADED); // Force lite
```

## Checking Capabilities Individually

```typescript
import { detectStockfishFlavor } from '@/utils/stockfishDetector';

const recommendation = detectStockfishFlavor();

// Check individual capabilities
if (recommendation.supportsWasm) {
  console.log('WebAssembly is supported');
}

if (recommendation.supportsCORS) {
  console.log('Can use multi-threading');
}

if (recommendation.isMobile) {
  console.log('User is on a mobile device');
}
```

## Getting Human-Readable Descriptions

```typescript
import { detectStockfishFlavor, getEngineDescription } from '@/utils/stockfishDetector';

const recommendation = detectStockfishFlavor();
const description = getEngineDescription(recommendation);

console.log(description);
// Output: "Strongest version (≈75MB) with multi-threading support"
```

## CORS Setup for Multi-threading

To enable multi-threaded engines, your server must send these headers:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

### Next.js Configuration

Add to `next.config.js`:

```javascript
module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
        ],
      },
    ];
  },
};
```

## Testing Different Scenarios

You can test the detector by simulating different environments:

```typescript
// Test in browser console
import { detectStockfishFlavor } from '@/utils/stockfishDetector';

// Current environment
const current = detectStockfishFlavor();
console.log('Current:', current);

// Check if multi-threading is available
console.log('Multi-threading available:', typeof SharedArrayBuffer !== 'undefined');

// Check if WASM is available
console.log('WASM available:', typeof WebAssembly !== 'undefined');

// Check device type
console.log('User agent:', navigator.userAgent);
console.log('Screen width:', window.innerWidth);
console.log('Touch support:', 'ontouchstart' in window);
```

## Troubleshooting

### Engine Won't Load
- Check that the engine files are in the correct location (`/public/stockfish/`)
- Verify file names match exactly (they may have hashes appended)
- Check browser console for CORS or loading errors

### Multi-threading Not Working
- Verify CORS headers are set correctly on your server
- Check that `SharedArrayBuffer` is available: `typeof SharedArrayBuffer !== 'undefined'`
- Multi-threading requires a secure context (HTTPS or localhost)

### Performance Issues
- Mobile users should automatically get lite versions
- Desktop users without CORS will get single-threaded versions
- Consider adding a manual engine selection option for advanced users
