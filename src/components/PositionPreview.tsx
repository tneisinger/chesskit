'use client';

import { useEffect, useRef, useState } from 'react';
import { Chess as ChessJS } from 'chess.js';
import { Chessboard, BORDER_TYPE, COLOR } from 'cm-chessboard/src/Chessboard';
import { FEN } from 'cm-chess/src/Chess';
import { PieceColor } from '../types/chess';
import 'cm-chessboard/assets/chessboard.css';

interface PositionPreviewProps {
	/**
	 * Array of PGN moves in standard algebraic notation (e.g., ["e4", "e5", "Nf3"])
	 */
	line: string[];
	/**
	* The orientation of the board ('white' or 'black')
	 */
	orientation: PieceColor;
	/**
	 * Size of the board in pixels
	 */
	size?: number;
	/**
	 * Optional CSS class for styling
	 */
	className?: string;
}

/**
 * A chess board component that displays a position after a series of moves.
 */
export default function PositionPreview({
	line,
  orientation,
	size = 200,
	className = ''
}: PositionPreviewProps) {
	const boardRef = useRef<HTMLDivElement>(null);
	const [board, setBoard] = useState<Chessboard | null>(null);
	const [fen, setFen] = useState<string>('');

	// Calculate the FEN position from the line of moves
	useEffect(() => {
		const chess = new ChessJS();

		try {
			// Play each move
			for (const move of line) {
				chess.move(move);
			}

			setFen(chess.fen());
		} catch (error) {
			console.error('Error playing moves:', error, 'Line:', line);
			// If there's an error, just show the starting position
			setFen(chess.fen());
		}
	}, [line]);

	// Initialize the board
	useEffect(() => {
		if (!boardRef.current || board) return;

		const newBoard = new Chessboard(boardRef.current, {
			position: FEN.start,
      orientation: orientation === PieceColor.BLACK ? COLOR.black : COLOR.white,
			style: {
				borderType: BORDER_TYPE.none,
				cssClass: 'green',
				pieces: {
					file: '/assets/pieces/staunty.svg',
				},
			},
		});

		setBoard(newBoard);

		return () => {
			newBoard.destroy();
		};
	}, []);

	// Update board position when FEN changes
	useEffect(() => {
		if (!board || !fen) return;

		board.setPosition(fen, false);
	}, [board, fen]);

	return (
		<div
			className={className}
			style={{ width: size, height: size }}
		>
			<div
				ref={boardRef}
				style={{ width: '100%', height: '100%' }}
			/>
		</div>
	);
}
