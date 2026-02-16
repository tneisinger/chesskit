"use client";

import { useEffect, useState } from "react";
import { Evaluations, type GameData } from "@/types/chess";
import { getAllGames } from "../game-review/actions";
import { extrapolatePositionEvaluation } from "@/utils/chess";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface DepthStats {
  depth: number;
  cpDiffMean: number;
  cpDiffStdDev: number;
  cpDiffSignedMean: number;
  matchingMovesMean: number;
  matchingMovesStdDev: number;
  matchingMovesMeanCp: number;
  matchingMovesStdDevCp: number;
  matchingMovesMeanMate: number;
  matchingMovesStdDevMate: number;
  dataPoints: number;
  cpDataPoints: number;
  moveDataPoints: number;
  mateDataPoints: number;
}

interface LineIndexStats {
  lineIndex: number;
  cpDiffMean: number;
  cpDiffMedian: number;
  cpDiffStdDev: number;
  cpDiffSignedMean: number;
  matchingMovesMean: number;
  matchingMovesStdDev: number;
  cpDataPoints: number;
  moveDataPoints: number;
}

interface CpDiffOutlier {
  lineIndex: number;
  fen: string;
  cpDiff: number;
  extrapolatedCp: number;
  actualCp: number;
  gameId: string;
}

interface CpRangeStats {
  rangeLabel: string;
  rangeMin: number;
  rangeMax: number;
  cpDiffMean: number;
  cpDiffMedian: number;
  cpDiffStdDev: number;
  dataPoints: number;
}

interface DepthCpRangeStats {
  depth: number;
  ranges: CpRangeStats[];
}

export default function ExtrapolationTestPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [userGames, setUserGames] = useState<GameData[]>([]);
  const [extrapolations, setExtrapolations] = useState<Record<string, Evaluations[]>>({});
  const [stats, setStats] = useState<DepthStats[]>([]);
  const [lineIndexStats, setLineIndexStats] = useState<LineIndexStats[]>([]);
  const [depthCpRangeStats, setDepthCpRangeStats] = useState<DepthCpRangeStats[]>([]);
  const [cpDiffOutliers, setCpDiffOutliers] = useState<CpDiffOutlier[]>([]);
  const [hasExtrapolationCompleted, setHasExtrapolationCompleted] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  // Form state
  const [maxGames, setMaxGames] = useState<number>(300);
  const [maxDepth, setMaxDepth] = useState<number>(3);

  const loadGames = async () => {
    const games = await getAllGames(maxGames);
    setUserGames(games);
  }

  // Check if user is admin
  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user || session.user.role !== "admin") {
      router.push("/");
    }
  }, [session, status, router]);

  const makeExtrapolationSet = (evaluations: Evaluations): Evaluations => {
    const extrapolationSet: Evaluations = {};
    Object.values(evaluations).forEach((pev) => {
      const extrapolations = extrapolatePositionEvaluation(pev);
      extrapolations.forEach((e) => extrapolationSet[e.fen] = e);
    });
    return extrapolationSet;
  }

  const makeExtrapolationSetWithLineIndex = (evaluations: Evaluations): { extrapolationSet: Evaluations, lineIndexMap: Map<string, number> } => {
    const extrapolationSet: Evaluations = {};
    const lineIndexMap = new Map<string, number>();
    Object.values(evaluations).forEach((pev) => {
      const extrapolations = extrapolatePositionEvaluation(pev);
      extrapolations.forEach((e, lineIndex) => {
        extrapolationSet[e.fen] = e;
        lineIndexMap.set(e.fen, lineIndex);
      });
    });
    return { extrapolationSet, lineIndexMap };
  }

  const makeExtrapolationSets = (evaluations: Evaluations, maxDepth: number): Evaluations[] => {
    const result: Evaluations[] = [];
    let depthCounter = 0;
    let currentEvaluations = evaluations;
    while (Object.keys(currentEvaluations).length > 0 && depthCounter < maxDepth) {
      depthCounter++;
      const extrapolationSet = makeExtrapolationSet(currentEvaluations);
      result.push(extrapolationSet);
      currentEvaluations = extrapolationSet;
    }
    return result;
  }

  // Helper functions for statistics
  const mean = (values: number[]): number => {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  };

  const median = (values: number[]): number => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
  };

  const stdDev = (values: number[]): number => {
    if (values.length === 0) return 0;
    const avg = mean(values);
    const squareDiffs = values.map(value => Math.pow(value - avg, 2));
    return Math.sqrt(mean(squareDiffs));
  };

  const countMatchingMoves = (lanLine1: string, lanLine2: string): number => {
    const moves1 = lanLine1.trim().split(' ');
    const moves2 = lanLine2.trim().split(' ');
    let count = 0;
    for (let i = 0; i < Math.min(moves1.length, moves2.length); i++) {
      if (moves1[i] === moves2[i]) {
        count++;
      } else {
        break;
      }
    }
    return count;
  };

  // Get CP range key for grouping by absolute value (e.g., 0 to 100, 100 to 200, etc.)
  const getCpRangeKey = (cp: number): string => {
    const absCp = Math.abs(cp);
    if (absCp <= 100) {
      return '0 to 100';
    }
    const rangeStart = Math.floor((absCp - 1) / 100) * 100;
    const rangeEnd = rangeStart + 100;
    return `${rangeStart} to ${rangeEnd}`;
  };

  useEffect(() => {
    if (hasStarted) {
      loadGames();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasStarted]);

  useEffect(() => {
    if (userGames.length > 0 && hasStarted) {
      const analyzedGames = userGames.filter((g) => g.engineAnalysis != undefined);
      const allExtrapolations: Record<string, Evaluations[]> = {};

      // Group data by depth
      const dataByDepth: Record<number, {
        cpDiffs: number[],
        cpDiffsSigned: number[],
        matchingMoves: number[],
        matchingMovesCp: number[],
        matchingMovesMate: number[]
      }> = {};

      // Group data by line index for depth-1 extrapolations only
      const dataByLineIndex: Record<number, {
        cpDiffs: number[],
        cpDiffsSigned: number[],
        matchingMoves: number[]
      }> = {};

      // Group data by depth and CP range for all extrapolations
      const dataByDepthAndCpRange: Record<number, Record<string, {
        cpDiffs: number[]
      }>> = {};

      // Track all CP differences with context for outlier detection
      const allCpDiffs: CpDiffOutlier[] = [];

      analyzedGames.forEach((g) => {
        if (g.engineAnalysis == undefined) return;
        const extrapolationSets = makeExtrapolationSets(g.engineAnalysis, maxDepth);
        allExtrapolations[g.gameId] = extrapolationSets;

        // Track line indices for depth-1 extrapolations
        const { extrapolationSet: depth1Set, lineIndexMap } = makeExtrapolationSetWithLineIndex(g.engineAnalysis);

        // Process each depth level
        extrapolationSets.forEach((extrapolationSet) => {
          // For each extrapolated position in this set
          Object.values(extrapolationSet).forEach((xpev) => {
            const depth = xpev.extrapolationDepth;

            // Skip if extrapolationDepth is not set (shouldn't happen)
            if (depth === undefined) return;

            // Initialize depth if needed
            if (!dataByDepth[depth]) {
              dataByDepth[depth] = {
                cpDiffs: [],
                cpDiffsSigned: [],
                matchingMoves: [],
                matchingMovesCp: [],
                matchingMovesMate: []
              };
            }

            // Initialize depth for CP range tracking
            if (!dataByDepthAndCpRange[depth]) {
              dataByDepthAndCpRange[depth] = {};
            }

            // Find the non-extrapolated version
            const pev = g.engineAnalysis![xpev.fen];

            // Only compare if we found a non-extrapolated version
            if (pev && pev.extrapolationDepth === undefined) {
              // Compare CP values (only if both are cp scores)
              if (xpev.score.key === 'cp' && pev.score.key === 'cp') {
                const cpDiff = Math.abs(xpev.score.value - pev.score.value);
                const cpDiffSigned = xpev.score.value - pev.score.value;
                dataByDepth[depth].cpDiffs.push(cpDiff);
                dataByDepth[depth].cpDiffsSigned.push(cpDiffSigned);

                // Group by CP range (using extrapolated CP value)
                const cpRangeKey = getCpRangeKey(xpev.score.value);
                if (!dataByDepthAndCpRange[depth][cpRangeKey]) {
                  dataByDepthAndCpRange[depth][cpRangeKey] = {
                    cpDiffs: []
                  };
                }
                dataByDepthAndCpRange[depth][cpRangeKey].cpDiffs.push(cpDiff);
              }

              // Compare lines
              if (xpev.lines[0] && pev.lines[0]) {
                const matches = countMatchingMoves(xpev.lines[0].lanLine, pev.lines[0].lanLine);
                dataByDepth[depth].matchingMoves.push(matches);

                // Separate by score type
                if (xpev.score.key === 'cp') {
                  dataByDepth[depth].matchingMovesCp.push(matches);
                } else if (xpev.score.key === 'mate') {
                  dataByDepth[depth].matchingMovesMate.push(matches);
                }
              }
            }
          });
        });

        // Process depth-1 extrapolations by line index
        Object.values(depth1Set).forEach((xpev) => {
          if (xpev.extrapolationDepth !== 1) return;

          const lineIndex = lineIndexMap.get(xpev.fen);
          if (lineIndex === undefined) return;

          // Initialize line index if needed
          if (!dataByLineIndex[lineIndex]) {
            dataByLineIndex[lineIndex] = {
              cpDiffs: [],
              cpDiffsSigned: [],
              matchingMoves: []
            };
          }

          // Find the non-extrapolated version
          const pev = g.engineAnalysis![xpev.fen];

          // Only compare if we found a non-extrapolated version
          if (pev && pev.extrapolationDepth === undefined) {
            // Compare CP values (only if both are cp scores)
            if (xpev.score.key === 'cp' && pev.score.key === 'cp') {
              const cpDiff = Math.abs(xpev.score.value - pev.score.value);
              const cpDiffSigned = xpev.score.value - pev.score.value;
              dataByLineIndex[lineIndex].cpDiffs.push(cpDiff);
              dataByLineIndex[lineIndex].cpDiffsSigned.push(cpDiffSigned);

              // Track for outlier detection
              allCpDiffs.push({
                lineIndex,
                fen: xpev.fen,
                cpDiff,
                extrapolatedCp: xpev.score.value,
                actualCp: pev.score.value,
                gameId: g.gameId
              });
            }

            // Compare lines
            if (xpev.lines[0] && pev.lines[0]) {
              const matches = countMatchingMoves(xpev.lines[0].lanLine, pev.lines[0].lanLine);
              dataByLineIndex[lineIndex].matchingMoves.push(matches);
            }
          }
        });
      });

      setExtrapolations(allExtrapolations);

      // Calculate statistics by depth
      const calculatedStats: DepthStats[] = Object.keys(dataByDepth)
        .map(Number)
        .sort((a, b) => a - b)
        .map(depth => ({
          depth,
          cpDiffMean: mean(dataByDepth[depth].cpDiffs),
          cpDiffStdDev: stdDev(dataByDepth[depth].cpDiffs),
          cpDiffSignedMean: mean(dataByDepth[depth].cpDiffsSigned),
          matchingMovesMean: mean(dataByDepth[depth].matchingMoves),
          matchingMovesStdDev: stdDev(dataByDepth[depth].matchingMoves),
          matchingMovesMeanCp: mean(dataByDepth[depth].matchingMovesCp),
          matchingMovesStdDevCp: stdDev(dataByDepth[depth].matchingMovesCp),
          matchingMovesMeanMate: mean(dataByDepth[depth].matchingMovesMate),
          matchingMovesStdDevMate: stdDev(dataByDepth[depth].matchingMovesMate),
          cpDataPoints: dataByDepth[depth].cpDiffs.length,
          moveDataPoints: dataByDepth[depth].matchingMoves.length,
          mateDataPoints: dataByDepth[depth].matchingMovesMate.length,
          dataPoints: Math.max(dataByDepth[depth].cpDiffs.length, dataByDepth[depth].matchingMoves.length),
        }));

      // Calculate statistics by line index (depth-1 only)
      const calculatedLineIndexStats: LineIndexStats[] = Object.keys(dataByLineIndex)
        .map(Number)
        .sort((a, b) => a - b)
        .map(lineIndex => ({
          lineIndex,
          cpDiffMean: mean(dataByLineIndex[lineIndex].cpDiffs),
          cpDiffMedian: median(dataByLineIndex[lineIndex].cpDiffs),
          cpDiffStdDev: stdDev(dataByLineIndex[lineIndex].cpDiffs),
          cpDiffSignedMean: mean(dataByLineIndex[lineIndex].cpDiffsSigned),
          matchingMovesMean: mean(dataByLineIndex[lineIndex].matchingMoves),
          matchingMovesStdDev: stdDev(dataByLineIndex[lineIndex].matchingMoves),
          cpDataPoints: dataByLineIndex[lineIndex].cpDiffs.length,
          moveDataPoints: dataByLineIndex[lineIndex].matchingMoves.length,
        }));

      // Calculate statistics by CP range for each depth
      const calculatedDepthCpRangeStats: DepthCpRangeStats[] = Object.keys(dataByDepthAndCpRange)
        .map(Number)
        .sort((a, b) => a - b)
        .map(depth => {
          const rangeStats: CpRangeStats[] = Object.keys(dataByDepthAndCpRange[depth])
            .map(rangeLabel => {
              // Parse range to get min/max for sorting
              const parts = rangeLabel.split(' to ');
              const rangeMin = parseInt(parts[0]);
              const rangeMax = parseInt(parts[1]);

              return {
                rangeLabel,
                rangeMin,
                rangeMax,
                cpDiffMean: mean(dataByDepthAndCpRange[depth][rangeLabel].cpDiffs),
                cpDiffMedian: median(dataByDepthAndCpRange[depth][rangeLabel].cpDiffs),
                cpDiffStdDev: stdDev(dataByDepthAndCpRange[depth][rangeLabel].cpDiffs),
                dataPoints: dataByDepthAndCpRange[depth][rangeLabel].cpDiffs.length,
              };
            })
            .sort((a, b) => {
              // Sort by the lower bound of the range
              return a.rangeMin - b.rangeMin;
            });

          return {
            depth,
            ranges: rangeStats
          };
        });

      // Get top outliers (highest CP differences)
      const topOutliers = allCpDiffs
        .sort((a, b) => b.cpDiff - a.cpDiff)
        .slice(0, 20);

      setStats(calculatedStats);
      setLineIndexStats(calculatedLineIndexStats);
      setDepthCpRangeStats(calculatedDepthCpRangeStats);
      setCpDiffOutliers(topOutliers);
      setHasExtrapolationCompleted(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userGames, maxDepth, hasStarted]);

  useEffect(() => {
    console.log('hasExtrapolationCompleted', hasExtrapolationCompleted);
    if (hasExtrapolationCompleted) {
      console.log('extrapolations', extrapolations);
      console.log('stats', stats);
      console.log('lineIndexStats', lineIndexStats);
      console.log('depthCpRangeStats', depthCpRangeStats);
    }
  }, [hasExtrapolationCompleted, extrapolations, stats, lineIndexStats, depthCpRangeStats]);

  // Show loading while checking auth
  if (status === "loading") {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Loading...</h1>
      </div>
    );
  }

  // Don't render anything if not admin (will redirect)
  if (!session?.user || session.user.role !== "admin") {
    return null;
  }

  const handleStartAnalysis = () => {
    setHasStarted(true);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Extrapolation Test Results</h1>
      <p className="mb-4 text-yellow-400 font-semibold">Admin Only Page</p>

      {!hasStarted ? (
        <div className="mb-8 p-6 bg-gray-800 rounded-lg">
          <h2 className="text-2xl font-bold mb-4">Analysis Configuration</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="maxGames" className="block text-sm font-medium mb-2">
                Max Games to Analyze
              </label>
              <input
                id="maxGames"
                type="number"
                min="1"
                max="10000"
                value={maxGames}
                onChange={(e) => setMaxGames(parseInt(e.target.value) || 100)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
              />
            </div>
            <div>
              <label htmlFor="maxDepth" className="block text-sm font-medium mb-2">
                Max Extrapolation Depth
              </label>
              <input
                id="maxDepth"
                type="number"
                min="1"
                max="10"
                value={maxDepth}
                onChange={(e) => setMaxDepth(parseInt(e.target.value) || 5)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
              />
            </div>
            <button
              onClick={handleStartAnalysis}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-md font-semibold transition-colors"
            >
              Start Analysis
            </button>
          </div>
        </div>
      ) : !hasExtrapolationCompleted ? (
        <div className="text-xl">Extrapolating and computing statistics...</div>
      ) : (
        <>
          <div className="mb-4 text-lg">
            Analyzed {userGames.filter(g => g.engineAnalysis != undefined).length} games
          </div>

          <div className="overflow-x-auto mb-8">
            <h2 className="text-2xl font-bold mb-4">Overall Statistics</h2>
            <table className="min-w-full border-collapse border border-gray-300">
              <thead className="bg-gray-600">
                <tr>
                  <th className="border border-gray-300 px-4 py-2">Depth</th>
                  <th className="border border-gray-300 px-4 py-2">Data Points</th>
                  <th className="border border-gray-300 px-4 py-2" colSpan={2}>
                    CP Value Difference (Absolute)
                  </th>
                  <th className="border border-gray-300 px-4 py-2">
                    CP Bias
                  </th>
                  <th className="border border-gray-300 px-4 py-2" colSpan={2}>
                    Matching Moves (All)
                  </th>
                </tr>
                <tr>
                  <th className="border border-gray-300 px-4 py-2"></th>
                  <th className="border border-gray-300 px-4 py-2 text-sm">(CP / Moves / Mate)</th>
                  <th className="border border-gray-300 px-4 py-2 text-sm">Mean</th>
                  <th className="border border-gray-300 px-4 py-2 text-sm">Std Dev</th>
                  <th className="border border-gray-300 px-4 py-2 text-sm">Mean (Signed)</th>
                  <th className="border border-gray-300 px-4 py-2 text-sm">Mean</th>
                  <th className="border border-gray-300 px-4 py-2 text-sm">Std Dev</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((stat) => (
                  <tr key={stat.depth} className="hover:bg-gray-700">
                    <td className="border border-gray-300 px-4 py-2 font-semibold text-center">
                      {stat.depth}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-center">
                      {stat.cpDataPoints} / {stat.moveDataPoints} / {stat.mateDataPoints}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-right">
                      {stat.cpDiffMean.toFixed(2)}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-right">
                      {stat.cpDiffStdDev.toFixed(2)}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-right">
                      <span className={stat.cpDiffSignedMean > 0 ? 'text-orange-400' : stat.cpDiffSignedMean < 0 ? 'text-blue-400' : ''}>
                        {stat.cpDiffSignedMean > 0 ? '+' : ''}{stat.cpDiffSignedMean.toFixed(2)}
                      </span>
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-right">
                      {stat.matchingMovesMean.toFixed(2)}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-right">
                      {stat.matchingMovesStdDev.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto mb-8">
            <h2 className="text-2xl font-bold mb-4">Matching Moves by Score Type</h2>
            <table className="min-w-full border-collapse border border-gray-300">
              <thead className="bg-gray-600">
                <tr>
                  <th className="border border-gray-300 px-4 py-2">Depth</th>
                  <th className="border border-gray-300 px-4 py-2" colSpan={3}>
                    CP Scores
                  </th>
                  <th className="border border-gray-300 px-4 py-2" colSpan={3}>
                    Mate Scores
                  </th>
                </tr>
                <tr>
                  <th className="border border-gray-300 px-4 py-2"></th>
                  <th className="border border-gray-300 px-4 py-2 text-sm">Count</th>
                  <th className="border border-gray-300 px-4 py-2 text-sm">Mean</th>
                  <th className="border border-gray-300 px-4 py-2 text-sm">Std Dev</th>
                  <th className="border border-gray-300 px-4 py-2 text-sm">Count</th>
                  <th className="border border-gray-300 px-4 py-2 text-sm">Mean</th>
                  <th className="border border-gray-300 px-4 py-2 text-sm">Std Dev</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((stat) => (
                  <tr key={stat.depth} className="hover:bg-gray-700">
                    <td className="border border-gray-300 px-4 py-2 font-semibold text-center">
                      {stat.depth}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-center">
                      {stat.cpDataPoints}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-right">
                      {stat.matchingMovesMeanCp.toFixed(2)}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-right">
                      {stat.matchingMovesStdDevCp.toFixed(2)}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-center">
                      {stat.mateDataPoints}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-right">
                      {stat.mateDataPoints > 0 ? stat.matchingMovesMeanMate.toFixed(2) : 'N/A'}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-right">
                      {stat.mateDataPoints > 0 ? stat.matchingMovesStdDevMate.toFixed(2) : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto mb-8">
            <h2 className="text-2xl font-bold mb-4">Depth-1 Extrapolation by Line Index</h2>
            <p className="mb-4 text-gray-300">
              Shows accuracy of depth-1 extrapolations grouped by which line (best=0, 2nd best=1, etc.) was used for extrapolation.
            </p>
            <table className="min-w-full border-collapse border border-gray-300">
              <thead className="bg-gray-600">
                <tr>
                  <th className="border border-gray-300 px-4 py-2">Line Index</th>
                  <th className="border border-gray-300 px-4 py-2">Data Points</th>
                  <th className="border border-gray-300 px-4 py-2" colSpan={3}>
                    CP Value Difference (Absolute)
                  </th>
                  <th className="border border-gray-300 px-4 py-2">
                    CP Bias
                  </th>
                  <th className="border border-gray-300 px-4 py-2" colSpan={2}>
                    Matching Moves
                  </th>
                </tr>
                <tr>
                  <th className="border border-gray-300 px-4 py-2"></th>
                  <th className="border border-gray-300 px-4 py-2 text-sm">(CP / Moves)</th>
                  <th className="border border-gray-300 px-4 py-2 text-sm">Mean</th>
                  <th className="border border-gray-300 px-4 py-2 text-sm">Median</th>
                  <th className="border border-gray-300 px-4 py-2 text-sm">Std Dev</th>
                  <th className="border border-gray-300 px-4 py-2 text-sm">Mean (Signed)</th>
                  <th className="border border-gray-300 px-4 py-2 text-sm">Mean</th>
                  <th className="border border-gray-300 px-4 py-2 text-sm">Std Dev</th>
                </tr>
              </thead>
              <tbody>
                {lineIndexStats.map((stat) => (
                  <tr key={stat.lineIndex} className="hover:bg-gray-700">
                    <td className="border border-gray-300 px-4 py-2 font-semibold text-center">
                      {stat.lineIndex}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-center">
                      {stat.cpDataPoints} / {stat.moveDataPoints}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-right">
                      {stat.cpDiffMean.toFixed(2)}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-right">
                      {stat.cpDiffMedian.toFixed(2)}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-right">
                      {stat.cpDiffStdDev.toFixed(2)}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-right">
                      <span className={stat.cpDiffSignedMean > 0 ? 'text-orange-400' : stat.cpDiffSignedMean < 0 ? 'text-blue-400' : ''}>
                        {stat.cpDiffSignedMean > 0 ? '+' : ''}{stat.cpDiffSignedMean.toFixed(2)}
                      </span>
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-right">
                      {stat.matchingMovesMean.toFixed(2)}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-right">
                      {stat.matchingMovesStdDev.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {depthCpRangeStats.map((depthStats) => (
            <div key={depthStats.depth} className="overflow-x-auto mb-8">
              <h2 className="text-2xl font-bold mb-4">Depth-{depthStats.depth} Extrapolation by CP Range (Absolute Value)</h2>
              <p className="mb-4 text-gray-300">
                Shows accuracy of depth-{depthStats.depth} extrapolations grouped by the absolute value of the extrapolated CP.
              </p>
              <table className="min-w-full border-collapse border border-gray-300">
                <thead className="bg-gray-600">
                  <tr>
                    <th className="border border-gray-300 px-4 py-2">CP Range (Absolute)</th>
                    <th className="border border-gray-300 px-4 py-2">Data Points</th>
                    <th className="border border-gray-300 px-4 py-2">Mean CP Diff</th>
                    <th className="border border-gray-300 px-4 py-2">Median CP Diff</th>
                    <th className="border border-gray-300 px-4 py-2">Std Dev CP Diff</th>
                  </tr>
                </thead>
                <tbody>
                  {depthStats.ranges.map((stat, idx) => (
                    <tr key={idx} className="hover:bg-gray-700">
                      <td className="border border-gray-300 px-4 py-2 font-semibold text-center">
                        {stat.rangeLabel}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center">
                        {stat.dataPoints}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-right">
                        {stat.cpDiffMean.toFixed(2)}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-right">
                        {stat.cpDiffMedian.toFixed(2)}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-right">
                        {stat.cpDiffStdDev.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          <div className="overflow-x-auto mb-8">
            <h2 className="text-2xl font-bold mb-4">Top CP Difference Outliers (Depth-1)</h2>
            <p className="mb-4 text-gray-300">
              Positions with the largest differences between extrapolated and actual engine evaluations.
            </p>
            <table className="min-w-full border-collapse border border-gray-300">
              <thead className="bg-gray-600">
                <tr>
                  <th className="border border-gray-300 px-4 py-2">Line Index</th>
                  <th className="border border-gray-300 px-4 py-2">CP Diff</th>
                  <th className="border border-gray-300 px-4 py-2">Extrapolated CP</th>
                  <th className="border border-gray-300 px-4 py-2">Actual CP</th>
                  <th className="border border-gray-300 px-4 py-2">FEN</th>
                  <th className="border border-gray-300 px-4 py-2">Game ID</th>
                </tr>
              </thead>
              <tbody>
                {cpDiffOutliers.map((outlier, idx) => (
                  <tr key={idx} className="hover:bg-gray-700">
                    <td className="border border-gray-300 px-4 py-2 text-center">
                      {outlier.lineIndex}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-right font-semibold text-red-400">
                      {outlier.cpDiff.toFixed(0)}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-right">
                      {outlier.extrapolatedCp.toFixed(0)}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-right">
                      {outlier.actualCp.toFixed(0)}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-xs font-mono">
                      {outlier.fen}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-xs">
                      {outlier.gameId}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 space-y-4">
            <h2 className="text-2xl font-bold">Interpretation</h2>
            <div className="space-y-2 text-gray-200">
              <p>
                <strong>CP Value Difference (Absolute):</strong> The absolute difference in centipawn evaluation between
                extrapolated and non-extrapolated positions. Lower is better (more accurate extrapolation).
              </p>
              <p>
                <strong>CP Bias (Signed Mean):</strong> The average signed difference (extrapolated - non-extrapolated).
                <span className="text-orange-400"> Positive values</span> indicate extrapolations tend to <em>over-estimate</em> position values.
                <span className="text-blue-400"> Negative values</span> indicate extrapolations tend to <em>under-estimate</em> position values.
              </p>
              <p>
                <strong>Matching Moves:</strong> The number of moves that match between the extrapolated
                and non-extrapolated lines before the first difference. Higher is better (more accurate
                line prediction).
              </p>
              <p>
                <strong>Matching Moves by Score Type:</strong> Comparison of line accuracy for positions with
                centipawn scores vs mate scores. This shows whether extrapolation works better for tactical
                (mate) positions or positional (cp) evaluations.
              </p>
              <p>
                <strong>Line Index Statistics:</strong> Shows whether extrapolation accuracy varies based on which
                engine line was used. Line 0 is the best move, line 1 is the second-best, etc. This reveals if
                extrapolation is more reliable for the engine's top choice vs alternative lines.
              </p>
              <p>
                <strong>CP Range Statistics:</strong> Shows whether extrapolation accuracy varies based on the
                evaluation range. Positions are grouped by the absolute value of their extrapolated CP.
                For example, both +150 and -150 fall into the "100 to 200" range. This reveals if
                extrapolation is more reliable in balanced positions (0 to 100) vs decisive positions
                (high absolute CP values). Separate tables are shown for each extrapolation depth.
              </p>
              <p>
                <strong>Data Points:</strong> Number of comparisons made. Format: (CP comparisons / Total move comparisons / Mate comparisons).
                CP count is for absolute difference calculations. Total moves includes both cp and mate scores.
                Mate count is positions with mate scores.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
