'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { FormEvent } from 'react';
import type { NextPage } from 'next'
import useStockfish from '@/hooks/useStockfish';

const Stockfish: NextPage = () => {
  const stockfish = useStockfish();

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

  return (
    <div>
      <h1>Stockfish</h1>
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
