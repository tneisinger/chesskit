import { useEffect, useState } from 'react';

export default function useStockfish(): Worker | undefined {
  const [stockfish, setStockfish] = useState<Worker | undefined>(undefined);

  useEffect(() => {
    if (stockfish === undefined) {
      const wasmSupported = typeof WebAssembly === 'object'
        && WebAssembly.validate(Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00));

      // setStockfish(new Worker(
      //   wasmSupported ? '/stockfish/stockfish.wasm.js' : '/stockfish/stockfish.js'
      // ));
      setStockfish(new Worker('/stockfish/stockfish-17.1-8e4d048.js'));
    }

    return () => {
      if (stockfish != undefined) stockfish.terminate();
    }
  }, [stockfish])

  useEffect(() => {
    if (stockfish != undefined) {
      stockfish.onerror = (e) => alert(`Stockfish Error: ${e.message}`);
    }
  }, [stockfish]);

  return stockfish;
}
