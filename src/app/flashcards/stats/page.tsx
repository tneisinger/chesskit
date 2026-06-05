'use client';

import { useState, useEffect } from 'react';
import { getReviewStats, ReviewStatsData } from '../actions';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Link from 'next/link';

const MIN_DAYS = 7;
const MAX_DAYS = 365;
const DEFAULT_DAYS = 30;

export default function FlashcardStatsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<number>(DEFAULT_DAYS);
  const [stats, setStats] = useState<ReviewStatsData>({
    dailyReviews: [],
    totalReviews: 0,
    averagePerDay: 0,
    daysInPeriod: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      const data = await getReviewStats(selectedPeriod);
      setStats(data);
      setIsLoading(false);
    };

    fetchStats();
  }, [selectedPeriod]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const chartData = stats.dailyReviews.map((item) => ({
    date: formatDate(item.date),
    reviews: item.count,
  }));

  return (
    <div className="max-w-6xl min-w-[800px] mx-auto p-4 mt-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Flashcard Statistics</h1>
        <Link href="/flashcards" className="text-blue-400 hover:text-blue-300 underline">
          Back to Flashcards
        </Link>
      </div>

      {/* Time Period Slider */}
      <div className="bg-background-page rounded-md p-6 mb-6">
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <label htmlFor="period-slider" className="text-lg font-semibold">
              Time Period
            </label>
            <span className="text-2xl font-bold text-blue-400">
              {selectedPeriod} {selectedPeriod === 1 ? 'Day' : 'Days'}
            </span>
          </div>
          <input
            id="period-slider"
            type="range"
            min={MIN_DAYS}
            max={MAX_DAYS}
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(Number(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <div className="flex justify-between text-sm text-gray-400">
            <span>{MIN_DAYS} days</span>
            <span>{MAX_DAYS} days</span>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-xl">Loading statistics...</p>
        </div>
      ) : stats.totalReviews === 0 ? (
        <div className="bg-background-page rounded-md p-8 text-center">
          <p className="text-xl mb-2 font-bold">No reviews yet</p>
          <p className="text-gray-300">
            Start reviewing flashcards to see your statistics here
          </p>
        </div>
      ) : (
        <>
          {/* Summary Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-background-page rounded-md p-6">
              <h2 className="text-lg font-semibold text-gray-400 mb-2">Total Reviews</h2>
              <p className="text-4xl font-bold">{stats.totalReviews}</p>
            </div>
            <div className="bg-background-page rounded-md p-6">
              <h2 className="text-lg font-semibold text-gray-400 mb-2">Average Per Day</h2>
              <p className="text-4xl font-bold">{stats.averagePerDay.toFixed(1)}</p>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-background-page rounded-md p-6">
            <h2 className="text-xl font-semibold mb-4">Reviews Over Time</h2>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="date"
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF' }}
                  interval={Math.floor(chartData.length / 10) || 0}
                />
                <YAxis
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF' }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: '0.375rem',
                    color: '#F3F4F6',
                  }}
                  labelStyle={{ color: '#F3F4F6' }}
                />
                <Bar dataKey="reviews" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
