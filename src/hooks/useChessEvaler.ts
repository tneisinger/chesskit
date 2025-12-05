import { useEffect, useRef, useState, useCallback } from 'react';
import { Move } from 'cm-chess/src/Chess';
import { Evaluation, GameEvals } from '@/types/chess';
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
import { getFen } from '@/utils/chess';
import useStockfish from '@/hooks/useStockfish';
import usePrevious from '@/hooks/usePrevious';
// import useStore from '../zustand/store';

interface Toolkit {
  evaluate: (fen: string, prevFen?: string) => void;
  setupEvalerForNewGame: (gameId?: string) => void;
  gameEvals: GameEvals;
  latestEvaluation: Evaluation | null;
  fenBeingEvaluated: string | null;
  evalQueue: string[];
  lines: Lines;
  numLines: number;
  evalDepth: number;
  engineName: string | undefined;
}

interface Options {
  evalDepth?: number,
  numLines?: number,
}

export default function useEvaler(
  shouldEvalAutomatically: boolean,
  currentMove: Move | undefined,
  options?: Options
): Toolkit {
  // const { puzzles } = useStore((state) => state);

  const evalDepth = (options && options.evalDepth) || 20;
  const numLines = (options && options.numLines) || 1;

  const { stockfish } = useStockfish();

  const prevShouldEvalAutomatically = usePrevious(shouldEvalAutomatically);

  const [evalQueue, setEvalQueue] = useState<string[]>([]);
  const prevEvalQueue = usePrevious(evalQueue);

  const [fenBeingEvaluated, setFenBeingEvaluated] = useState<string | null>(null);
  const [lines, setLines] = useState<Record<string, MultiPV[]>>({});
  const [gameEvals, setGameEvals] = useState<GameEvals>({});
  const [engineName, setEngineName] = useState<string | undefined>(undefined);
  const [_isStockfishReady, setIsStockfishReady] = useState(false);
  const [latestEvaluation, setLatestEvaluation] = useState<Evaluation | null>(null);

  const fenRef = useRef<string | null>(null);

  const lastDepth = useRef<number>(0);

  // If this is defined, the callback will be run after stockfish gives a `bestmove` message
  const afterBestMoveFoundCallback =
    useRef<((bestMoveInfo?: BestMoveInfo) => void) | undefined>(undefined);

  // This ref is needed because sometimes the update of gameEvals is too slow after a best
  // move is found. As soon as the best move is found, we need a reference to the most
  // recently added eval, but gameEvals doesn't always update in time to give us that. Use
  // this ref to always be able to get the most recently added eval.
  const lastAddedEval = useRef<Evaluation | null>(null);

  const prevFens = useRef<Record<string, string>>({});

  const cancelAllEvaluations = useCallback((callback?: () => void) => {
    const go = () => {
      setEvalQueue([]);
      setFenBeingEvaluated(null);
      if (callback) callback();
    }

    if (stockfish) {
      if (fenRef.current) {
        afterBestMoveFoundCallback.current = () => {
          go();
        }
        stockfish.postMessage('stop');
      } else {
        go();
      }
    }
  },
    [stockfish]
  );

  const setupEvalerForNewGame = (_gameId?: string) => {
    // const puzzlesOfGame = gameId == undefined ? [] : puzzles[gameId];
    // if (puzzlesOfGame == undefined) throw new Error('puzzlesOfGame was undefined');

    const evals: GameEvals = {};
    // puzzlesOfGame.forEach((p) => {
    //   evals[p.evalBeforeMove.fen] = p.evalBeforeMove;
    //   evals[p.evalAfterMove.fen] = p.evalAfterMove;
    // })

    cancelAllEvaluations(() => {
      setGameEvals(evals);
      setLines({});
      if (stockfish) stockfish.postMessage('ucinewgame');
    })
  }

  const evaluate = useCallback((fen: string, prevFen?: string) => {
    const newFens = [fen];
    if (prevFen) {
      prevFens.current[fen] = prevFen;
      newFens.push(prevFen);
    }
    cancelAllEvaluations(() => setEvalQueue(newFens));
  },
    [cancelAllEvaluations]
  );

  const removeFromEvalQueue = (fen: string) => {
    setEvalQueue((queue) => queue.filter((qFen) => qFen !== fen));
    if (fen in prevFens.current) delete prevFens.current[fen];
  }

  const changeFenBeingEvaluated = (fen: string | null) => {
    fenRef.current = fen;
    setFenBeingEvaluated(fen);
  }

  useEffect(() => {
    // The `onmessage` handler for stockfish messages
    const handleStockfishMessage = (event: MessageEvent) => {
      const line = typeof event === 'object' ? event.data : event;

      const name = parseName(line);
      if (name) setEngineName(name);

      if (parseIsStockfishReady(line)) setIsStockfishReady(true);

      // Pass the current fen string to `parseInfoLine` so that any parsed score values
      // will be made objective.
      const fen = fenRef.current ? fenRef.current : undefined;
      const info = parseInfoLine(line, fen);

      if (info) handleStockfishInfo(info);

      const bestMoveInfo = parseBestMoveLine(line);
      if (bestMoveInfo) handleBestMoveInfo(bestMoveInfo);
    }

    const handleBestMoveInfo = (bestMoveInfo: BestMoveInfo) => {
      // if stockfish has found the best move.
      if (bestMoveInfo.bestmove && lastDepth.current >= evalDepth) {
        const bestMove = parseLanMove(bestMoveInfo.bestmove);
        if (fenRef.current == null) throw new Error('fenRef was null');

        if (!lastAddedEval.current) {
          throw new Error('lastAddedEval should be defined');
        }

        if (fenRef.current !== lastAddedEval.current.fen) {
          throw new Error('lastAddedEval fen should match fenRef');
        }

        if (lastAddedEval.current.depth !== lastDepth.current) {
          throw new Error('lastAddedEval depth should match lastDepth');
        }

        const evaluation = {
          ...lastAddedEval.current,
          bestMove,
          depth: lastDepth.current
        };

        const prevFen = prevFens.current[fenRef.current];
        if (prevFen) evaluation.prevFen = prevFen;
        addEval(evaluation);

        setLatestEvaluation(evaluation);
        removeFromEvalQueue(fenRef.current);
      }

      // If there is no best move (probably because the game is over)
      if (bestMoveInfo.bestmove == null) {
        if (fenRef.current) removeFromEvalQueue(fenRef.current);
      }

      // If we received a bestMove message from stockfish, that means that it finished
      // evaluating the position, so we can set the fenRef to null because no fen is
      // currently being evaluated.
      changeFenBeingEvaluated(null);

      if (afterBestMoveFoundCallback.current) {
        afterBestMoveFoundCallback.current(bestMoveInfo);
        afterBestMoveFoundCallback.current = undefined;
      }
    }

    const handleStockfishInfo = (info: StockfishInfo) => {
      if (fenRef.current == null) throw new Error('fenRef was null');
      saveLine(info, fenRef.current);

      // If this is the best line, save the evaluation
      if (info.multipv === 1 && info.score && info.depth != undefined) {
        saveEvaluation(info.depth, info.score.key, info.score.value);
      }
    }

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
      }

      setLines((lines) => {
        if (fen in lines) {
          lines[fen][evalerLine.multipv - 1] = evalerLine
        } else {
          const newLines = [];
          newLines[evalerLine.multipv - 1] = evalerLine;
          lines[fen] = newLines;
        }
        return { ...lines };
      })
    }

    const saveEvaluation = (depth: number, scoreKey: string, scoreValue: number) => {
      // If lastDepth is 0, that means that the 'evaluate' function was called
      // very recently. In that case, if the new 'depth' value is not 1, then this message
      // from Stockfish must be residual from a previous run of the 'evaluate' function
      // and is no longer relevant, so return.
      if (lastDepth.current === 0 && depth !== 1) {
        return;
      }

      lastDepth.current = depth;

      if (fenRef.current == null) throw new Error('fenRef.current should not be null');

      let cp = undefined;
      let mate = undefined;
      if (scoreKey === 'cp') cp = scoreValue;
      else if (scoreKey === 'mate') mate = scoreValue;

      if (cp != undefined) {
        addEval({
          cp,
          depth,
          fen: fenRef.current
        });
      } else if (mate != undefined) {
        addEval({
          mate,
          depth,
          fen: fenRef.current,
        });
      }
    }

    const addEval = (evaluation: Evaluation) => {
      lastAddedEval.current = evaluation;

      setGameEvals((evals) => {
        const storedEval = evals[evaluation.fen];
        if (storedEval && storedEval.depth > evaluation.depth) {
          return evals;
        } else {
          return { ...evals, [evaluation.fen]: evaluation }
        }
      })
    }

    if (stockfish) {
      stockfish.onmessage = handleStockfishMessage;
      stockfish.postMessage('uci');
      stockfish.postMessage(`setoption name MultiPV value ${numLines}`)
      stockfish.postMessage('setoption name UCI_AnalyseMode value true');
      stockfish.postMessage('isready');
    }
  }, [stockfish, numLines, evalDepth]);

  useEffect(() => {
    if (shouldEvalAutomatically) {
      const fen = getFen(currentMove);
      let prevFen = undefined;
      if (currentMove && currentMove.previous) prevFen = currentMove.previous.fen;
      evaluate(fen, prevFen);
    }
  }, [shouldEvalAutomatically, currentMove, evaluate])

  useEffect(() => {
    if (shouldEvalAutomatically === prevShouldEvalAutomatically) return;

    if (!shouldEvalAutomatically && fenBeingEvaluated != null) {
      cancelAllEvaluations();
    }
  },
    [shouldEvalAutomatically, prevShouldEvalAutomatically, cancelAllEvaluations,
      fenBeingEvaluated
    ]
  )

  useEffect(() => {
    if (evalQueue === prevEvalQueue) return;

    const nextFen = evalQueue[0];
    if (nextFen in gameEvals && gameEvals[nextFen].depth >= evalDepth
      && nextFen in lines
    ) {
      setEvalQueue(evalQueue.slice(1));
      return;
    }

    if (stockfish && fenRef.current == null && evalQueue.length > 0) {
      lastDepth.current = 0;
      changeFenBeingEvaluated(evalQueue[0]);
      stockfish.postMessage(`position fen ${fenRef.current}`);
      stockfish.postMessage(`go depth ${evalDepth}`);
    }
  }, [evalQueue, prevEvalQueue, evalDepth, stockfish, gameEvals, lines])

  return {
    evaluate,
    setupEvalerForNewGame,
    gameEvals,
    latestEvaluation,
    fenBeingEvaluated,
    evalQueue,
    lines,
    numLines,
    evalDepth,
    engineName,
  }
}
