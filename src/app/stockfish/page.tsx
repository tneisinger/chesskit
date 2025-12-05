'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { FormEvent } from 'react';
import type { NextPage } from 'next'
import useStockfish from '@/hooks/useStockfish';

const Stockfish: NextPage = () => {
  const { stockfish, isLoading, error, recommendation } = useStockfish();

  const bottomDiv = useRef<HTMLDivElement | null>(null);

  const [inputText, setInputText] = useState<string>('');

  const [log, setLog] = useState<{ fromUser: boolean, txt: string }[]>([]);

  useEffect(() => {
    if (stockfish) {
      stockfish.onmessage = (e) => {
        setLog((l) => [...l, { fromUser: false, txt: e.data }])
      }
    }
  }, [stockfish]);

  useEffect(() => {
    if (bottomDiv.current != null) {
      bottomDiv.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [log]);

  const handleTextInputSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (stockfish != undefined) stockfish.postMessage(inputText);
    setLog((l) => [...l, { fromUser: true, txt: inputText }]);
    setInputText('');
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading Stockfish engine...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Stockfish</h1>
        <div className="p-4 bg-[rgba(173,31,31,0.2)] border border-color-btn-danger rounded">
          <p className="font-bold mb-2">Error loading engine:</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1>Stockfish</h1>
      {recommendation && (
        <p className="text-sm text-[#aaa] mb-2">
          Using {recommendation.flavor} engine
        </p>
      )}
      <Link
        href="https://gist.github.com/aliostad/f4470274f39d29b788c1b09519e67372"
        target="_blank"
        rel="noreferrer"
        className="text-blue-600 dark:text-yellow-400 underline">
        Instructions
      </Link>
      <form onSubmit={handleTextInputSubmit}>
        <input
          className='border border-gray-300 rounded-md p-2 mb-4 w-5/6'
          placeholder='Enter command'
          type='text'
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
        />
      </form>
      <div className="overflow-y-scroll h-[75vh] ml-8">
        {log.map(({ fromUser, txt }, i) => {
          if (fromUser) {
            return <p key={txt + i}>{`> ${txt}`}</p>
          } else {
            return <p className="text-blue-600 dark:text-yellow-400" key={txt + i}>{txt}</p>
          }
        })}
        <div ref={(el) => { bottomDiv.current = el }}></div>
      </div>
    </div>
  )
}

export default Stockfish;
