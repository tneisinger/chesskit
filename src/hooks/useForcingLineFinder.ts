import { useState, useCallback } from 'react';
import { Evaluations, PositionEvaluation, MoveJudgement, PieceColor } from '@/types/chess';
import { Output as FenAnalyzerOutput } from '@/hooks/useFenAnalyzer';
import { Chess as CmChess } from 'cm-chess/src/Chess';
import { isMoveJudgementWorseThan, judgeLines, lanToShortMove } from '@/utils/chess';
import { ShortMove } from '@/types/chess';

export interface FindForcingLinesOptions {
  minDepth: number;
  maxLines: number;
  maxLineLength: number;
}

export interface Output {
  findForcingLines: (fen: string, options: FindForcingLinesOptions) => Promise<ShortMove[][]>;
  forcingMoves: ShortMove[];
  isSearching: boolean;
}

interface PathNode {
  fen: string;
  moves: ShortMove[];  // Moves taken to get here from the initial FEN
  initialColorToMove: PieceColor;  // Track the initial player's color
}

export default function useForcingLineFinder(
  fenAnalyzer: FenAnalyzerOutput,
  evaluations: Evaluations,
  setEvaluations: React.Dispatch<React.SetStateAction<Evaluations>>
): Output {
  const [forcingMoves, setForcingMoves] = useState<ShortMove[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const findForcingLines = useCallback(async (
    fen: string,
    options: FindForcingLinesOptions
  ): Promise<ShortMove[][]> => {
    const { minDepth, maxLines, maxLineLength } = options;

    if (maxLines < 1) throw new Error('maxLines must be >= 1');
    if (maxLineLength < 1) throw new Error('maxLineLength must be >= 1');

    // Make sure maxLineLength is odd
    let maximumLineLength = maxLineLength;
    if (maximumLineLength % 2 === 0) maximumLineLength--;

    // Reset state
    setForcingMoves([]);
    setIsSearching(true);

    try {
      let numLinesCreated = 0;

      // Helper to get or fetch evaluation
      const getEvaluation = async (fenToAnalyze: string): Promise<PositionEvaluation | null> => {
        const existing = evaluations[fenToAnalyze];
        if (existing && existing.depth >= minDepth) {
          return existing;
        }

        try {
          const evaluation = await fenAnalyzer.analyze(fenToAnalyze, {
            maxDepth: minDepth,
            numLines: 2,
          });
          setEvaluations((evs) => ({ ...evs, [fenToAnalyze]: evaluation }));
          return evaluation;
        } catch (error) {
          console.error('Error analyzing position:', error);
          return null;
        }
      };

      // Helper to get whose turn it is from a FEN
      const getColorToMove = (fenString: string): PieceColor => {
        const tempChess = new CmChess();
        tempChess.load(fenString);
        return tempChess.turn() === 'w' ? PieceColor.WHITE : PieceColor.BLACK;
      };

      // Helper to apply a move to a FEN and get the new FEN
      const applyMove = (fenString: string, move: ShortMove): string | null => {
        try {
          const tempChess = new CmChess();
          tempChess.load(fenString);
          const result = tempChess.move(move);
          if (!result) return null;
          return tempChess.fen();
        } catch (error) {
          console.error('Error applying move:', error);
          return null;
        }
      };

      // Helper to add a forcing move to the state
      const addForcingMove = (move: ShortMove) => {
        setForcingMoves((prev) => [...prev, move]);
      };

      // Helper that finds an "only move" (forced move) if one exists
      const findOnlyMove = async (
        nodeFen: string,
        initialColor: PieceColor
      ): Promise<ShortMove | null> => {
        const evaluation = await getEvaluation(nodeFen);
        if (!evaluation) return null;
        if (evaluation.lines.length < 2) return null;

        const nextMoveColor = getColorToMove(nodeFen);
        const lineJudgements = judgeLines(nextMoveColor, evaluation.lines);

        // If the second best move is bad, the best move is forcing
        if (isMoveJudgementWorseThan(MoveJudgement.Good, lineJudgements[1])) {
          const firstMoveLan = evaluation.lines[0].lanLine.trim().split(' ')[0];
          const shortMove = lanToShortMove(firstMoveLan);
          addForcingMove(shortMove);
          return shortMove;
        }
        return null;
      };

      // Helper that finds moves that lead to "only moves"
      const findMovesThatLeadToOnlyMoves = async (
        nodeFen: string,
        initialColor: PieceColor
      ): Promise<ShortMove[]> => {
        const evaluation = await getEvaluation(nodeFen);
        if (!evaluation) return [];

        const result: ShortMove[] = [];
        const lineMoves = evaluation.lines.map((line) => lanToShortMove(line.lanLine.trim().split(' ')[0]));

        const nextMoveColor = getColorToMove(nodeFen);
        const moveJudgements = judgeLines(nextMoveColor, evaluation.lines);

        let numMovesPlayed = 0;

        for (let i = 0; i < lineMoves.length; i++) {
          // For the opponent, skip moves that are worse than an inaccuracy
          if (isMoveJudgementWorseThan(MoveJudgement.Inaccurate, moveJudgements[i])) continue;

          // Stop if we've found enough lines
          if (numMovesPlayed > 0 && numLinesCreated >= maxLines) break;

          const lineMove = lineMoves[i];

          // Apply the move to get the new position
          const newFen = applyMove(nodeFen, lineMove);
          if (!newFen) continue;

          // Get evaluation for this new position
          const lineMoveEvaluation = await getEvaluation(newFen);
          if (!lineMoveEvaluation) continue;
          if (lineMoveEvaluation.lines.length < 2) continue;

          const newColor = getColorToMove(newFen);
          const lineJudgements = judgeLines(newColor, lineMoveEvaluation.lines);

          // If the second best line is bad, there's only one good move
          if (isMoveJudgementWorseThan(MoveJudgement.Good, lineJudgements[1])) {
            result.push(lineMove);
            addForcingMove(lineMove);
            numMovesPlayed++;

            if (numMovesPlayed > 1) {
              numLinesCreated++;
            }
          }
        }

        return result;
      };

      // Determine initial color to move
      const initialColorToMove = getColorToMove(fen);
      const isInitialColorsTurn = (nodeFen: string) => getColorToMove(nodeFen) === initialColorToMove;

      const result: ShortMove[][] = [];
      const queue: PathNode[] = [{ fen, moves: [], initialColorToMove }];

      while (queue.length > 0) {
        const node = queue.pop();
        if (!node) break;

        // If the line has exceeded the maximum length, skip it
        if (node.moves.length > maximumLineLength) {
          throw new Error(`Line too long: ${node.moves.length}`);
        }

        // If this line has reached the maximum length, add it to result
        if (node.moves.length === maximumLineLength) {
          result.push(node.moves);
          continue;
        }

        if (isInitialColorsTurn(node.fen)) {
          // Try to find an "only move" (forced move)
          const onlyMove = await findOnlyMove(node.fen, node.initialColorToMove);

          // If there's no forced move, this line ends here
          if (!onlyMove) {
            if (node.moves.length > 0) {
              result.push(node.moves);
            }
            continue;
          }

          // Apply the only move and continue the line
          const newFen = applyMove(node.fen, onlyMove);
          if (!newFen) continue;

          queue.push({
            fen: newFen,
            moves: [...node.moves, onlyMove],
            initialColorToMove: node.initialColorToMove,
          });

          if (numLinesCreated === 0) numLinesCreated++;

        } else {
          // Find opponent moves that lead to forced moves
          const movesThatLeadToOnlyMoves = await findMovesThatLeadToOnlyMoves(
            node.fen,
            node.initialColorToMove
          );

          if (movesThatLeadToOnlyMoves.length < 1) {
            if (node.moves.length > 0) {
              result.push(node.moves);
            }
            continue;
          }

          // Add each variation to the queue
          for (const move of movesThatLeadToOnlyMoves) {
            const newFen = applyMove(node.fen, move);
            if (!newFen) continue;

            queue.push({
              fen: newFen,
              moves: [...node.moves, move],
              initialColorToMove: node.initialColorToMove,
            });
          }
        }
      }

      return result;
    } finally {
      setIsSearching(false);
    }
  }, [fenAnalyzer, evaluations, setEvaluations]);

  return {
    findForcingLines,
    forcingMoves,
    isSearching,
  };
}
