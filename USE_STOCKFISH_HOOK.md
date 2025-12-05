# useStockfish Hook - Usage Guide

The `useStockfish` hook automatically detects and loads the best Stockfish.js engine flavor for the user's device.

## Features

✓ **Automatic Engine Detection** - Uses device capabilities to select optimal engine
✓ **Fallback Support** - Automatically falls back to ASM-JS if primary engine fails
✓ **Loading States** - Provides loading indicators for better UX
✓ **Error Handling** - Comprehensive error messages and handling
✓ **Memory Safety** - Properly cleans up Web Workers on unmount
✓ **TypeScript Support** - Full type definitions included

## Basic Usage

```typescript
import useStockfish from '@/hooks/useStockfish';

function ChessAnalysis() {
  const { stockfish, isLoading, error, recommendation } = useStockfish();

  if (isLoading) return <div>Loading engine...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!stockfish) return null;

  // Use the stockfish worker
  stockfish.postMessage('position startpos');
  stockfish.postMessage('go depth 20');

  return <div>Engine loaded!</div>;
}
```

## Return Value

The hook returns an object with the following properties:

```typescript
interface UseStockfishResult {
  stockfish: Worker | undefined;      // The Web Worker instance
  isLoading: boolean;                  // True while engine is loading
  error: string | null;                // Error message if loading failed
  recommendation: StockfishRecommendation | null;  // Details about detected engine
}
```

## Migration from Old Hook

### Old API (before)
```typescript
const stockfish = useStockfish();  // Returns Worker | undefined
```

### New API (recommended)
```typescript
const { stockfish, isLoading, error } = useStockfish();
```

### Backward Compatibility
For quick migration, use the compatibility export:
```typescript
import { useStockfishWorker } from '@/hooks/useStockfish';

const stockfish = useStockfishWorker();  // Returns Worker | undefined (deprecated)
```

## Complete Example

```typescript
'use client';

import { useEffect, useState } from 'react';
import useStockfish from '@/hooks/useStockfish';

export default function EngineAnalysis() {
  const { stockfish, isLoading, error, recommendation } = useStockfish();
  const [engineOutput, setEngineOutput] = useState<string[]>([]);

  useEffect(() => {
    if (!stockfish) return;

    // Handle messages from Stockfish
    stockfish.onmessage = (event) => {
      setEngineOutput(prev => [...prev, event.data]);
    };

    // Initialize the engine
    stockfish.postMessage('uci');
    stockfish.postMessage('setoption name MultiPV value 3');
    stockfish.postMessage('isready');

    // Analyze a position
    stockfish.postMessage('position startpos moves e2e4');
    stockfish.postMessage('go depth 20');
  }, [stockfish]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-xl">Loading Stockfish engine...</div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="p-4">
        <h2 className="text-xl font-bold mb-2">Engine Error</h2>
        <div className="p-3 bg-red-100 border border-red-400 rounded">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Chess Analysis</h2>

      {recommendation && (
        <div className="mb-4 p-3 bg-gray-100 rounded">
          <p className="text-sm">
            <strong>Engine:</strong> {recommendation.flavor}
          </p>
          <p className="text-sm text-gray-600">
            {recommendation.reason}
          </p>
        </div>
      )}

      <div className="space-y-1">
        {engineOutput.map((line, i) => (
          <div key={i} className="font-mono text-sm">{line}</div>
        ))}
      </div>
    </div>
  );
}
```

## Engine Detection Details

The hook automatically detects:

1. **WebAssembly Support** - Falls back to ASM-JS if not available
2. **CORS Headers** - Uses single-threaded engine if SharedArrayBuffer unavailable
3. **Device Type** - Uses lite engines (≈7MB) on mobile, full engines (≈75MB) on desktop

See which engine was selected:
```typescript
const { recommendation } = useStockfish();

console.log(recommendation?.flavor);
// Possible values:
// - "large-multi-threaded"   (Desktop with CORS)
// - "large-single-threaded"  (Desktop without CORS)
// - "lite-multi-threaded"    (Mobile with CORS)
// - "lite-single-threaded"   (Mobile without CORS)
// - "asm-js"                 (Fallback)
```

## Sending Commands to Stockfish

### UCI Protocol
```typescript
// Initialize
stockfish.postMessage('uci');
stockfish.postMessage('isready');

// Set options
stockfish.postMessage('setoption name MultiPV value 3');
stockfish.postMessage('setoption name Threads value 4');

// Analyze position
stockfish.postMessage('position startpos');
stockfish.postMessage('go depth 20');

// Analyze from FEN
stockfish.postMessage('position fen rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
stockfish.postMessage('go movetime 5000');

// Stop analysis
stockfish.postMessage('stop');

// New game
stockfish.postMessage('ucinewgame');
```

### Receiving Engine Output
```typescript
stockfish.onmessage = (event) => {
  const line = event.data;

  if (line.startsWith('info')) {
    // Engine analysis information
    console.log('Analysis:', line);
  } else if (line.startsWith('bestmove')) {
    // Engine found best move
    const move = line.split(' ')[1];
    console.log('Best move:', move);
  } else if (line === 'readyok') {
    // Engine is ready
    console.log('Engine ready');
  }
};
```

## Error Handling

The hook handles several error scenarios:

### Engine Load Failure
```typescript
const { error } = useStockfish();

if (error) {
  // Possible errors:
  // - "Failed to load any Stockfish engine. Please check that the engine files are in /public/stockfish/"
  // - "Failed to detect appropriate engine"
  // - "Engine error: [worker error message]"
}
```

### Automatic Fallback
The hook automatically tries to load ASM-JS if the recommended engine fails:
```typescript
// 1. Tries recommended engine (e.g., large-multi-threaded)
// 2. If that fails, tries ASM-JS fallback
// 3. If both fail, sets error state
```

## Performance Tips

### Desktop
- **With CORS**: Gets strongest `large-multi-threaded` (≈75MB)
- **Without CORS**: Gets `large-single-threaded` (≈75MB, no multi-threading)

### Mobile
- **With CORS**: Gets `lite-multi-threaded` (≈7MB)
- **Without CORS**: Gets `lite-single-threaded` (≈7MB)

### Enabling CORS for Multi-threading

Add to `next.config.js`:
```javascript
module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
    ];
  },
};
```

## Common Patterns

### Loading Indicator
```typescript
function MyComponent() {
  const { stockfish, isLoading } = useStockfish();

  return (
    <div>
      {isLoading && <Spinner />}
      {stockfish && <ChessBoard />}
    </div>
  );
}
```

### Error Boundary
```typescript
function MyComponent() {
  const { stockfish, error } = useStockfish();

  if (error) {
    return <ErrorMessage message={error} />;
  }

  return <ChessBoard stockfish={stockfish} />;
}
```

### Showing Engine Info
```typescript
function MyComponent() {
  const { recommendation } = useStockfish();

  return (
    <div>
      {recommendation && (
        <p>Using {recommendation.flavor} engine</p>
      )}
    </div>
  );
}
```

## Troubleshooting

### Engine Won't Load
1. Check that engine files are in `/public/stockfish/`
2. Verify file names match (may have hash suffixes)
3. Check browser console for detailed error messages
4. Look for CORS errors if trying to use multi-threaded engine

### Hook Returns Undefined
The hook properly returns `undefined` for `stockfish` while loading. Check `isLoading`:
```typescript
const { stockfish, isLoading } = useStockfish();

if (isLoading) {
  // stockfish will be undefined here
  return <div>Loading...</div>;
}

// stockfish should be defined here (or error is set)
```

### Memory Leaks
The hook automatically cleans up the Web Worker when the component unmounts. No manual cleanup needed!

### Multiple Instances
Each call to `useStockfish()` creates a new Web Worker. If you need to share one instance across components, consider:
```typescript
// Create a context
const StockfishContext = createContext<UseStockfishResult | null>(null);

// Provider
function StockfishProvider({ children }) {
  const stockfishData = useStockfish();
  return (
    <StockfishContext.Provider value={stockfishData}>
      {children}
    </StockfishContext.Provider>
  );
}

// Consumer
function useSharedStockfish() {
  const context = useContext(StockfishContext);
  if (!context) throw new Error('useSharedStockfish must be used within StockfishProvider');
  return context;
}
```

## See Also

- [Stockfish Detector Documentation](./STOCKFISH_DETECTOR_USAGE.md)
- [Stockfish.js README](./STOCKFISH_README.md)
- [UCI Protocol Documentation](https://www.chessprogramming.org/UCI)
