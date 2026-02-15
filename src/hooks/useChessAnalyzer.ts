import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Evaluations, MoveJudgement, PositionEvaluation } from '@/types/chess';
import { Move } from 'cm-chess/src/Chess';
import {
  parseBestMoveLine,
  parseInfoLine,
  parseLanMove,
  parseName,
  parseIsStockfishReady,
  BestMoveInfo,
  StockfishInfo,
  MultiPV,
  Lines,
} from '@/utils/stockfish';
import { getFen, judgeLines, lanToShortMove } from '@/utils/chess';
import useStockfish from '@/hooks/useStockfish';
import { parse as parsePGN } from 'pgn-parser';
import { Chess as CmChess } from 'cm-chess/src/Chess';
import usePrevious from '@/hooks/usePrevious';
import { colorToMove, getLineFromCmMove } from '@/utils/cmchess';

const MAX_THREADS_USAGE = 0.5;

export enum AnalysisStatus {
  NotStarted = 'Not Started',
  Analyzing = 'Analyzing',
  Complete = 'Complete',
}

export interface AnalyzeFenOptions {
  addToEvaluations?: boolean;
  depth?: number;
  numLines?: number;
  threads?: number;
  clearHash?: boolean; // Send ucinewgame before analyzing to clear hash tables
}

export interface AddForcingLinesOptions {
  minDepth: number;
  moveFoundCallback: (move: Move) => void;
  maxLines: number;
  maxLineLength: number;
}

export interface Output {
  analyzePgn: (pgn: string, analyzeVariations?: boolean) => void;
  latestEvaluation: PositionEvaluation | null;
  fenBeingAnalyzed: string | null;
  engineName: string | null;
  pgnAnalysisStatus: AnalysisStatus;
  pgnAnalysisProgress: number; // Percentage (0-100)
  currentPosition: number; // Current position being analyzed
  totalPositions: number; // Total positions to analyze
  analyzeFen: (fen: string, options?: AnalyzeFenOptions) => Promise<PositionEvaluation>
  addForcingLinesToCmChess: (cmChess: CmChess, move: Move, options: AddForcingLinesOptions) => Promise<Move[][]>
}

export default function useChessAnalyzer(
  evaluations: Evaluations,
  setEvaluations: React.Dispatch<React.SetStateAction<Evaluations>>,
  isCurrentMoveAnalysisOn: boolean,
  currentMove: Move | undefined,
  evalDepth = 20,
  numLines = 2,
): Output {
  const { stockfish, recommendation } = useStockfish();

  const prevIsCurrentMoveAnalysisOn = usePrevious(isCurrentMoveAnalysisOn);

  const [fensToAnalyze, setFensToAnalyze] = useState<string[]>([]);
  const [currentPositionIndex, setCurrentPositionIndex] = useState<number>(0);
  const [isAnalyzingGame, setIsAnalyzingGame] = useState(false);
  const [pgnAnalysisStatus, setPgnAnalysisStatus] = useState(AnalysisStatus.NotStarted);
  const [positionQueue, setPositionQueue] = useState<string[]>([]);
  const [latestEvaluation, setLatestEvaluation] = useState<PositionEvaluation | null>(null);
  const [fenBeingAnalyzed, setFenBeingAnalyzed] = useState<string | null>(null);
  const [engineName, setEngineName] = useState<string | null>(null);
  const [_isStockfishReady, setIsStockfishReady] = useState(false);

  const fenRef = useRef<string | null>(null);
  const lastDepth = useRef<number>(0);
  const lastAddedEval = useRef<PositionEvaluation | null>(null);
  const afterBestMoveFoundCallback = useRef<((bestMoveInfo?: BestMoveInfo) => void) | undefined>(undefined);
  const hasStockfishBeenSetup = useRef<boolean>(false);
  const isAnalyzingPosition = useRef<boolean>(false);
  const isAnalyzingGameRef = useRef<boolean>(false);
  const prevPositionIndex = usePrevious(currentPositionIndex);
  const prevIsAnalyzingGame = usePrevious(isAnalyzingGame);
  const prevPositionQueue = usePrevious(positionQueue);

  const linesRef = useRef<Lines>({});

  const analyzeFenStateRef = useRef<{
    addToEvaluations: boolean;
    originalThreads: number;
    originalNumLines: number;
    targetDepth: number;
    resolve: (value: PositionEvaluation) => void;
    reject: (reason: any) => void;
  } | null>(null);

  const pendingAnalyzeFenStart = useRef<{ fen: string; depth: number } | null>(null);

  const changeFenBeingAnalyzed = (fen: string | null) => {
    fenRef.current = fen;
    setFenBeingAnalyzed(fen);
  };

  const removeFromPositionQueue = (fen: string) => {
    setPositionQueue((queue) => queue.filter((qFen) => qFen !== fen));
  };

  const cancelAllAnalysis = useCallback((callback?: () => void) => {
    const go = () => {
      setPositionQueue([]);
      changeFenBeingAnalyzed(null);
      if (callback) callback();
    };

    if (stockfish) {
      if (fenRef.current) {
        afterBestMoveFoundCallback.current = () => {
          go();
        };
        stockfish.postMessage('stop');
      } else {
        go();
      }
    }
  }, [stockfish]);

  const getLinesForFen = (fen: string): PositionEvaluation['lines'] => {
    let result: PositionEvaluation['lines'] = [];
    if (fen in linesRef.current) {
      result = linesRef.current[fen].map((mpv) => {
        return {
          score: mpv.score,
          lanLine: mpv.lanLine.join(' '),
        };
      });
    }
    return result;
  };

  // Generate all FENs from the PGN
  const generateFensFromPgn = useCallback((pgn: string, analyzeVariations: boolean) => {
    try {
      const parsedPgn = parsePGN(pgn)[0];
      if (!parsedPgn) return [];

      const fens: string[] = [];

      // Helper function to recursively process moves and variations
      const processMoves = (moves: any[], cmchess: CmChess) => {
        moves.forEach((move) => {
          try {
            cmchess.move(move.move);
            fens.push(cmchess.fen());

            // Process variations (ravs) if they exist and analyzeVariations is true
            if (analyzeVariations && move.ravs && move.ravs.length > 0) {
              // Save the current position before entering variations
              const positionBeforeVariations = cmchess.fen();

              // Process each variation
              move.ravs.forEach((rav: any) => {
                // Reset to position before the variation
                cmchess.load(positionBeforeVariations);
                // Go back one move to get to the position before the current move
                cmchess.undo();

                // Process the variation recursively
                if (rav.moves && rav.moves.length > 0) {
                  processMoves(rav.moves, cmchess);
                }

                // Return to the position after the main move
                cmchess.load(positionBeforeVariations);
              });
            }
          } catch (error) {
            console.error('Invalid move:', move.move, error);
          }
        });
      };

      const cmchess = new CmChess();
      processMoves(parsedPgn.moves, cmchess);

      return fens;
    } catch (error) {
      console.error('Error parsing PGN:', error);
      return [];
    }
  }, []);

  // Start analyzing the PGN
  const analyzePgn = useCallback((pgn: string, analyzeVariations = true) => {
    const fens = generateFensFromPgn(pgn, analyzeVariations);
    if (fens.length === 0) {
      console.error('No positions to analyze');
      return;
    }

    // Cancel any ongoing position analysis
    if (isAnalyzingPosition.current) {
      cancelAllAnalysis(() => {
        isAnalyzingPosition.current = false;
      });
    }

    setFensToAnalyze(fens);
    setCurrentPositionIndex(0);
    linesRef.current = {};
    setIsAnalyzingGame(true);
    setPgnAnalysisStatus(AnalysisStatus.Analyzing);

    if (stockfish) {
      stockfish.postMessage('ucinewgame');
    }
  }, [generateFensFromPgn, stockfish, cancelAllAnalysis]);

  const doWeAlreadyHaveEvaluationForFen = useCallback((fen: string): boolean => {
    const fenEval = evaluations[fen];
    if (fenEval && fenEval.depth >= evalDepth && fen) return true;
    return false;
  }, [evaluations, evalDepth]);

  // Analyze a single position or variation
  const analyzePosition = useCallback((fen: string, prevFen?: string) => {
    if (isAnalyzingGameRef.current) {
      console.warn('Cannot analyze position while game analysis is running');
      return;
    }

    const newFens = prevFen ? [prevFen, fen] : [fen];

    cancelAllAnalysis(() => {
      setPositionQueue(newFens);
      isAnalyzingPosition.current = true;
    });
  }, [isAnalyzingGame, cancelAllAnalysis]);


  const getDefaultNumThreads = (): number => {
      return Math.max(1, Math.floor(recommendation!.threads * MAX_THREADS_USAGE));
  }


  const analyzeFen = useCallback((fen: string, options?: AnalyzeFenOptions): Promise<PositionEvaluation> => {
    const defaultOptions: AnalyzeFenOptions = {
      addToEvaluations: true,
      depth: evalDepth,
      numLines,
      threads: getDefaultNumThreads()
    };

    if (options == undefined) {
      options = defaultOptions;
    } else {
      options = { ...defaultOptions, ...options }
    }

    return new Promise((resolve, reject) => {
      // Check if analysis is ongoing
      if (fenRef.current !== null || isAnalyzingGameRef.current || isAnalyzingPosition.current) {
        console.warn('Cannot analyze FEN: another analysis is currently ongoing');
        reject(new Error('Another analysis is currently ongoing'));
        return;
      }

      // Check if we already have this evaluation at the required depth
      if (fen in evaluations && evaluations[fen].depth >= options.depth!) {
        changeFenBeingAnalyzed(null);
        resolve(evaluations[fen]);
        return;
      }

      if (!stockfish) {
        reject(new Error('Stockfish is not initialized'));
        return;
      }

      // Store original options
      const originalThreads = getDefaultNumThreads();
      const originalNumLines = numLines;
      const needsThreadsReset = options.threads !== originalThreads;
      const needsNumLinesReset = options.numLines !== originalNumLines;

      // Set up the analyzeFen state
      analyzeFenStateRef.current = {
        addToEvaluations: options.addToEvaluations!,
        originalThreads,
        originalNumLines,
        targetDepth: options.depth!,
        resolve,
        reject,
      };

      // Set custom stockfish options if provided
      if (needsThreadsReset) {
        stockfish.postMessage(`setoption name Threads value ${options.threads}`);
      }
      if (needsNumLinesReset) {
        stockfish.postMessage(`setoption name MultiPV value ${options.numLines}`);
      }

      // Clear hash tables if requested
      if (options.clearHash) {
        stockfish.postMessage('ucinewgame');
      }

      // Start analyzing - wait for stockfish to be ready
      lastDepth.current = 0;
      changeFenBeingAnalyzed(fen);
      pendingAnalyzeFenStart.current = { fen, depth: options.depth! };
      stockfish.postMessage('isready');
    });
  }, [evalDepth, numLines, stockfish, evaluations, recommendation]);


  const addForcingLinesToCmChess = useCallback(async (cmChess: CmChess, move: Move, options: AddForcingLinesOptions): Promise<Move[][]> => {
    const { minDepth, moveFoundCallback, maxLines, maxLineLength } = options;

    if (maxLines < 1) throw new Error('maxLines must be >= 1');
    if (maxLineLength < 1) throw new Error('maxLineLength must be >= 1');

    // Create a modified version of the maxLineLength variable. Make sure it is odd.
    // If it is even, decrement it by 1.
    let maximumLineLength = maxLineLength;
    if (maximumLineLength % 2 === 0) maximumLineLength--;

    let numLinesCreated = 0;

    const badJudgements = [MoveJudgement.Blunder, MoveJudgement.Mistake, MoveJudgement.Inaccurate];

    // Helper function to get or fetch evaluation
    const getEvaluation = async (fen: string): Promise<PositionEvaluation | null> => {
      const existing = evaluations[fen];
      if (existing && existing.depth >= minDepth) {
        return existing;
      }

      try {
        const evaluation = await analyzeFen(fen, { clearHash: false });
        setEvaluations((evs) => ({ ...evs, [fen]: evaluation}));
        return evaluation;
      } catch (error) {
        console.error('Error analyzing position:', error);
        return null;
      }
    };

    // Helper function that will play an only move if one is found
    const playOnlyMove = async (
      cmChess: CmChess,
      move: Move,
    ): Promise<{ move: Move, pev: PositionEvaluation } | null> => {
      const evaluation = await getEvaluation(move.fen);
      if (!evaluation) return null;
      if (evaluation.lines.length < 2) return null;

      const nextMoveColor = colorToMove(move);
      const lineJudgements = judgeLines(nextMoveColor, evaluation.lines);

      // If the second best move of an evaluation is one of these, then the best move is considered
      // a forcing move.
      if (badJudgements.includes(lineJudgements[1])) {
        const firstMoveLan = evaluation.lines[0].lanLine.trim().split(' ')[0];
        const m = cmChess.move(lanToShortMove(firstMoveLan), move);
        if (m == undefined) throw new Error('m was undefined');
        if (moveFoundCallback) moveFoundCallback(m);
        return { move: m, pev: evaluation};
      }
      return null;
    };

    // Helper function that plays a move into cmChess if the subsequent position has only one good move
    // for the color to play in the new position. The only moves that will potentially be played into
    // cmChess are the first moves from each line of PositionEvaluation.lines, where the
    // PositionEvaluation is the PositionEvaluation of the input move. If a move is too bad, don't play it.
    const playMovesThatLeadToOnlyMoves = async (
      cmChess: CmChess,
      move: Move,
    ): Promise<Move[]> => {
      const evaluation = await getEvaluation(move.fen);
      if (!evaluation) return [];

      const result: Move[] = [];
      const lineMoves = evaluation.lines.map((line) => lanToShortMove(line.lanLine.trim().split(' ')[0]));

      // Get the moveJudgements of the lines.
      const nextMoveColor = colorToMove(move);
      const moveJudgements = judgeLines(nextMoveColor, evaluation.lines);

      // If a move has one of these MoveJudgements, we won't play that move into cmChess.
      // We use a different array here than the 'badJudgements' one defined above because
      // we may want to be more or less strict about which moves the opponent can play.
      const opponentBadJudgements = [MoveJudgement.Blunder, MoveJudgement.Mistake];

      let numMovesPlayed = 0;

      // Analyze the first move of each line (the lineMove)
      for (let i = 0; i < lineMoves.length; i++) {
        // if this line is too bad, don't even consider it. Continue.
        if (opponentBadJudgements.includes(moveJudgements[i])) continue;

        // Break out of the loop if we've already added to a line (numMovesPlayed > 0) and
        // we've already created the maximum number of lines (maxLines)
        if (numMovesPlayed > 0 && numLinesCreated >= maxLines) break;

        const lineMove = lineMoves[i];

        // Create a new cmChess with all the moves
        const tempCmChess = new CmChess();
        getLineFromCmMove(move).forEach((m) => {
          const moveResult = tempCmChess.move(m.san);
          if (moveResult == undefined) throw new Error('moveResult was undefined');
        });

        // Play the lineMove into tempCmChess
        const moveResult = tempCmChess.move(lineMove);
        if (moveResult == undefined) throw new Error('moveResult was undefined');

        // Get evaluation for this position
        const lineMoveEvaluation = await getEvaluation(tempCmChess.fen());
        if (!lineMoveEvaluation) continue;
        if (lineMoveEvaluation.lines.length < 2) continue;

        // Get the lineJudgements
        const nextMoveColor = colorToMove(moveResult);
        const lineJudgements = judgeLines(nextMoveColor, lineMoveEvaluation.lines);

        // If the second best line from the evaluation is bad, then there
        // is only one good move in the new position. In that case, play the move into CmChess.
        if (badJudgements.includes(lineJudgements[1])) {
          const playedMove = cmChess.move(lineMove, move);
          if (playedMove == undefined) throw new Error('result of cmChess.move(lineMove) was undefined');
          result.push(playedMove);
          if (moveFoundCallback) moveFoundCallback(playedMove);
          numMovesPlayed++;

          if (numMovesPlayed > 1) {
            numLinesCreated++;
          }
        }
      }

      return result;
    };


    // MAIN LOOP
    const initialColorToMove = colorToMove(move);
    const isInitialColorsTurn = (m: Move) => initialColorToMove === colorToMove(m);

    const result: Move[][] = [];

    const queue: Move[][] = [[move]];

    while (queue.length > 0) {
      const moves = queue.pop();

      if (moves == undefined) throw new Error('moves was undefined');
      if (moves.length < 1) throw new Error('moves.length < 1');

      // If the line has exceeded the maximumLineLength, throw an error.
      if (moves.slice(1).length > maximumLineLength) throw new Error(`line to long: ${moves.slice(1)}`);

      // If this line has reached the maximumLineLength, add it to the result and
      // continue to the next item in the queue.
      if (moves.slice(1).length === maximumLineLength) {
        result.push(moves.slice(1));
        continue;
      }

      const lastMove = moves[moves.length - 1];

      if (isInitialColorsTurn(lastMove)) {
        // Play an only move if there is one.
        const r = await playOnlyMove(cmChess, lastMove);

        // If there was not an onlyMove to play, just continue
        if (r == null) continue;

        // Otherwise, use the new resulting move to add an entry to the queue.
        queue.push([...moves, r.move]);

        if (numLinesCreated === 0) numLinesCreated++;

      // If it is not initialColorsTurn, we want to find moves that will lead
      // to positions where there is only one good move.
      } else {
        const playedMoves = await playMovesThatLeadToOnlyMoves(cmChess, lastMove);
        if (playedMoves.length < 1) {
          result.push(moves.slice(1));
          continue;
        }
        playedMoves.forEach((playedMove) => {
          queue.push([...moves, playedMove]);
        });
      }
    }

    return result;
  }, [evaluations, setEvaluations]);

  useEffect(() => {
    isAnalyzingGameRef.current = isAnalyzingGame;
  }, [isAnalyzingGame])

  // Handle stockfish messages
  useEffect(() => {
    const handleStockfishMessage = (event: MessageEvent) => {
      const line = typeof event === 'object' ? event.data : event;
      console.log('Stockfish:', line);

      const name = parseName(line);
      if (name) {
        setEngineName(recommendation ? recommendation.title : null);
      }

      if (parseIsStockfishReady(line)) {
        setIsStockfishReady(true);

        // Check if we have a pending analyzeFen start
        if (pendingAnalyzeFenStart.current && stockfish) {
          const { fen, depth } = pendingAnalyzeFenStart.current;
          pendingAnalyzeFenStart.current = null;
          stockfish.postMessage(`position fen ${fen}`);
          stockfish.postMessage(`go depth ${depth}`);
        }
      }

      const fen = fenRef.current ? fenRef.current : undefined;
      const info = parseInfoLine(line, fen);

      if (info) {
        handleStockfishInfo(info);
      }

      const bestMoveInfo = parseBestMoveLine(line);
      if (bestMoveInfo) {
        handleBestMoveInfo(bestMoveInfo);
      }
    };

    const handleBestMoveInfo = (bestMoveInfo: BestMoveInfo) => {
      const requiredDepth = analyzeFenStateRef.current?.targetDepth ?? evalDepth;

      if (bestMoveInfo.bestmove && lastDepth.current >= requiredDepth) {
        const bestMove = parseLanMove(bestMoveInfo.bestmove);
        if (fenRef.current == null) {
          console.error('fenRef was null');
          return;
        }

        if (!lastAddedEval.current) {
          console.error('lastAddedEval should be defined');
          return;
        }

        if (fenRef.current !== lastAddedEval.current.fen) {
          console.error('lastAddedEval fen should match fenRef');
          return;
        }

        if (lastAddedEval.current.depth !== lastDepth.current) {
          console.error('lastAddedEval depth should match lastDepth');
          return;
        }

        const evaluation: PositionEvaluation = {
          ...lastAddedEval.current,
          bestMove,
          depth: lastDepth.current
        };

        addEval(evaluation);
        setLatestEvaluation(evaluation);

        // Handle analyzeFen completion
        if (analyzeFenStateRef.current) {
          const state = analyzeFenStateRef.current;

          // Reset stockfish options
          if (stockfish) {
            stockfish.postMessage(`setoption name Threads value ${state.originalThreads}`);
            stockfish.postMessage(`setoption name MultiPV value ${state.originalNumLines}`);
          }

          // Unset fenBeingAnalyzed
          changeFenBeingAnalyzed(null);

          // Resolve the promise
          state.resolve(evaluation);

          // Clear the state
          analyzeFenStateRef.current = null;
        }

        // Remove from position queue if analyzing position
        if (isAnalyzingPosition.current && fenRef.current) {
          removeFromPositionQueue(fenRef.current);
        }
      }

      // If there is no best move (probably because the game is over)
      if (bestMoveInfo.bestmove == null) {
        // Handle analyzeFen failure
        if (analyzeFenStateRef.current) {
          analyzeFenStateRef.current.reject(new Error('No best move found (game may be over)'));
          analyzeFenStateRef.current = null;
        }

        if (isAnalyzingPosition.current && fenRef.current) {
          removeFromPositionQueue(fenRef.current);
        }
      }

      // Move to next position (for game analysis) or clear fen (for position analysis)
      if (isAnalyzingGameRef.current) {
        changeFenBeingAnalyzed(null);
        setCurrentPositionIndex((prev) => prev + 1);
      } else if (isAnalyzingPosition.current) {
        changeFenBeingAnalyzed(null);
      }

      // If we were analyzing a position, we are done now so set to false.
      if (isAnalyzingPosition.current) isAnalyzingPosition.current = false;

      if (afterBestMoveFoundCallback.current) {
        afterBestMoveFoundCallback.current(bestMoveInfo);
        afterBestMoveFoundCallback.current = undefined;
      }
    };

    const handleStockfishInfo = (info: StockfishInfo) => {
      if (fenRef.current == null) return;
      saveLine(info, fenRef.current);

      // If this is the best line, save the evaluation
      if (info.multipv === 1 && info.score && info.depth != undefined) {
        saveEvaluation(info.depth, info.score.key, info.score.value);
      }
    };

    const saveLine = (info: StockfishInfo, fen: string) => {
      if (info.depth == undefined) return;
      if (info.multipv == undefined) return;
      if (info.score == undefined) return;
      if (info.pv == undefined) return;

      const evalerLine: MultiPV = {
        depth: info.depth,
        multipv: info.multipv,
        score: info.score,
        lanLine: info.pv.split(' '),
      };

      // Update linesRef
      if (fen in linesRef.current) {
        linesRef.current[fen][evalerLine.multipv - 1] = evalerLine;
      } else {
        const newLines = [];
        newLines[evalerLine.multipv - 1] = evalerLine;
        linesRef.current[fen] = newLines;
      }
    };

    const saveEvaluation = (evalDepth: number, scoreKey: "cp" | "mate", scoreValue: number) => {
      // If lastDepth is 0, that means evaluation just started
      // In that case, if the new 'depth' value is not 1, then this message
      // from Stockfish must be residual from a previous run
      if (lastDepth.current === 0 && evalDepth !== 1) {
        return;
      }

      lastDepth.current = evalDepth;

      if (fenRef.current == null) return;

      const lines = getLinesForFen(fenRef.current);
      const evaluation: PositionEvaluation = {
        depth: evalDepth,
        fen: fenRef.current,
        score: { key: scoreKey, value: scoreValue },
        lines,
      };

      addEval(evaluation);
      // Update latestEvaluation even when depth < evalDepth
      setLatestEvaluation(evaluation);
    };

    const addEval = (evaluation: PositionEvaluation) => {
      lastAddedEval.current = evaluation;

      // Check if we should skip adding to evaluations (for analyzeFen with addToEvaluations: false)
      if (analyzeFenStateRef.current && !analyzeFenStateRef.current.addToEvaluations) {
        return; // Don't add to evaluations state
      }

      const updateEvaluation = (g: Evaluations) => {
        const storedEval = g[evaluation.fen];
        if (storedEval && storedEval.depth > evaluation.depth) {
          return g;
        } else {
          // Get the most up-to-date lines for this position
          const lines = getLinesForFen(evaluation.fen);

          const p: PositionEvaluation = {
            depth: evaluation.depth,
            fen: evaluation.fen,
            score: evaluation.score,
            lines,
            bestMove: evaluation.bestMove,
          };
          return { ...g, [evaluation.fen]: p };
        }
      };

      setEvaluations(updateEvaluation);
    };

    if (stockfish && !hasStockfishBeenSetup.current) {
      stockfish.onmessage = handleStockfishMessage;
      stockfish.postMessage('uci');
      const numThreads = getDefaultNumThreads();
      stockfish.postMessage(`setoption name Threads value ${numThreads}`);
      stockfish.postMessage('setoption name Hash value 512');
      stockfish.postMessage(`setoption name MultiPV value ${numLines}`);
      stockfish.postMessage('isready');
      hasStockfishBeenSetup.current = true;
    }
  }, [stockfish, numLines, evalDepth, recommendation, isAnalyzingGame]);

  // Analyze next position when currentPositionIndex changes (for game analysis)
  useEffect(() => {
    // In general, we only want to proceed if currentPositionIndex has changed.
    // However, we also need to make sure that we proceed when currentPositionIndex
    // has not changed, but isAnalyzingGame has changed from false to true (i.e., game
    // analysis is being started or resumed).
    if (prevPositionIndex === currentPositionIndex) {
      if (prevIsAnalyzingGame === isAnalyzingGame) return;
    }

    if (!isAnalyzingGame) return;
    if (!stockfish) return;
    if (fenRef.current !== null) return; // Already analyzing a position

    if (currentPositionIndex >= fensToAnalyze.length) {
      // Analysis complete
      setIsAnalyzingGame(false);
      setPgnAnalysisStatus(AnalysisStatus.Complete);
      changeFenBeingAnalyzed(null);
      return;
    }

    const nextFen = fensToAnalyze[currentPositionIndex];

    // Check if we already have this evaluation at the required depth
    if (nextFen in evaluations && evaluations[nextFen].depth >= evalDepth && nextFen in linesRef.current) {
      // Skip this position, move to next
      setCurrentPositionIndex((prev) => prev + 1);
      return;
    }

    // Start analyzing this position
    lastDepth.current = 0;
    changeFenBeingAnalyzed(nextFen);
    stockfish.postMessage(`position fen ${nextFen}`);
    stockfish.postMessage(`go depth ${evalDepth}`);
  }, [isAnalyzingGame, currentPositionIndex, fensToAnalyze, stockfish, evalDepth, evaluations,
      prevPositionIndex, prevIsAnalyzingGame]
  );

  // Process position queue (for position analysis)
  useEffect(() => {
    if (positionQueue === prevPositionQueue) return;
    if (!isAnalyzingPosition.current) return;
    if (!stockfish) return;
    if (fenRef.current !== null) return; // Already analyzing a position

    if (positionQueue.length === 0) {
      // Position analysis complete
      isAnalyzingPosition.current = false;
      return;
    }

    const nextFen = positionQueue[0];

    // Check if we already have this evaluation at the required depth
    if (doWeAlreadyHaveEvaluationForFen(nextFen)) {
      setPositionQueue(positionQueue.slice(1));
      return;
    }

    // Start analyzing this position
    lastDepth.current = 0;
    changeFenBeingAnalyzed(nextFen);
    stockfish.postMessage(`position fen ${nextFen}`);
    stockfish.postMessage(`go depth ${evalDepth}`);
  }, [positionQueue, prevPositionQueue, stockfish, evalDepth, doWeAlreadyHaveEvaluationForFen]);

  // Automatically analyze the currentMove when isCurrentMoveAnalysisOn is true
  useEffect(() => {
    if (isCurrentMoveAnalysisOn) {
      if (isAnalyzingGameRef.current) {
        console.warn('Cannot enable position analysis while game analysis is running');
        return;
      }

      const fen = getFen(currentMove);
      if (!doWeAlreadyHaveEvaluationForFen(fen)) {
        isAnalyzingPosition.current = true;
        analyzePosition(fen);
      }
    }
  }, [isCurrentMoveAnalysisOn, currentMove, analyzePosition, isAnalyzingGame]);

  // Handle isCurrentMoveAnalysisOn changes
  useEffect(() => {
    if (isCurrentMoveAnalysisOn === prevIsCurrentMoveAnalysisOn) return;

    if (!isCurrentMoveAnalysisOn && fenBeingAnalyzed != null) {
      if (isAnalyzingGameRef.current) {
        console.warn('Cannot disable position analysis while game analysis is running');
        return;
      }
      cancelAllAnalysis();
    }
  }, [isCurrentMoveAnalysisOn, prevIsCurrentMoveAnalysisOn, cancelAllAnalysis, fenBeingAnalyzed, isAnalyzingGame]);

  useEffect(() => {
    if (stockfish != undefined && hasStockfishBeenSetup.current) {
      stockfish.postMessage(`setoption name MultiPV value ${numLines}`);
    }
  }, [numLines, stockfish])

  const pgnAnalysisProgress = fensToAnalyze.length > 0
    ? Math.round((currentPositionIndex / fensToAnalyze.length) * 100)
    : 0;

  return {
    analyzePgn,
    latestEvaluation,
    fenBeingAnalyzed,
    engineName,
    pgnAnalysisStatus,
    pgnAnalysisProgress,
    currentPosition: currentPositionIndex,
    totalPositions: fensToAnalyze.length,
    analyzeFen,
    addForcingLinesToCmChess,
  };
}
