'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/button';
import Spinner from '@/components/spinner';
import { getDailyFlashcardLimit, setDailyFlashcardLimit } from '../actions';

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [limitType, setLimitType] = useState<'unlimited' | 'custom'>('unlimited');
  const [customLimit, setCustomLimit] = useState<string>('20');
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadCurrentLimit();
  }, []);

  const loadCurrentLimit = async () => {
    setIsLoading(true);
    const result = await getDailyFlashcardLimit();

    if (result.success) {
      if (result.limit === null || result.limit === undefined) {
        setLimitType('unlimited');
      } else {
        setLimitType('custom');
        setCustomLimit(String(result.limit));
      }
    }

    setIsLoading(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    const limitValue = limitType === 'unlimited' ? null : parseInt(customLimit, 10);

    // Validate custom limit
    if (limitType === 'custom' && (isNaN(limitValue!) || limitValue! < 1)) {
      setSaveMessage({ type: 'error', text: 'Limit must be a positive number (minimum 1)' });
      setIsSaving(false);
      return;
    }

    const result = await setDailyFlashcardLimit(limitValue);

    if (result.success) {
      setSaveMessage({ type: 'success', text: 'Settings saved successfully' });
    } else {
      setSaveMessage({ type: 'error', text: result.error || 'Failed to save settings' });
    }

    setIsSaving(false);

    // Clear success message after 3 seconds
    if (result.success) {
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-xl">Loading settings</p>
        <Spinner scale={1.5} white />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Flashcard Settings</h1>

      <div className="bg-background-page rounded-lg p-6 space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-4">Daily Flashcard Limit</h2>
          <p className="text-gray-300 text-sm mb-4">
            Control how many flashcards you review each day. When a limit is set,
            cards are intelligently prioritized based on urgency, difficulty, and learning stage.
          </p>

          <div className="space-y-3">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name="limitType"
                value="unlimited"
                checked={limitType === 'unlimited'}
                onChange={(e) => setLimitType(e.target.value as 'unlimited' | 'custom')}
                className="w-4 h-4"
              />
              <span className="text-white">Unlimited (show all due cards)</span>
            </label>

            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name="limitType"
                value="custom"
                checked={limitType === 'custom'}
                onChange={(e) => setLimitType(e.target.value as 'unlimited' | 'custom')}
                className="w-4 h-4"
              />
              <span className="text-white">Custom daily limit</span>
            </label>

            {limitType === 'custom' && (
              <div className="ml-7 mt-2">
                <input
                  type="number"
                  min="1"
                  value={customLimit}
                  onChange={(e) => setCustomLimit(e.target.value)}
                  className="w-32 px-3 py-2 bg-background-tertiary border border-gray-600 rounded text-white"
                  placeholder="20"
                />
                <span className="ml-2 text-gray-400">cards per day</span>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-gray-700 pt-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">How prioritization works</h3>
          <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
            <li>Overdue cards are shown first (most urgent)</li>
            <li>Difficult cards (lower easiness) get priority</li>
            <li>Cards with fewer repetitions are prioritized for cementing</li>
          </ul>
        </div>

        <div className="flex items-center gap-4">
          <Button
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>

          {saveMessage && (
            <span
              className={`text-sm ${
                saveMessage.type === 'success' ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {saveMessage.text}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
