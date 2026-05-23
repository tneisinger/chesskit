# New Card Scheduling Configuration

This document explains how to adjust the scheduling behavior for new flashcards using the `NEW_CARD_CONFIG` variables in `src/utils/supermemo2.ts`.

## Overview

The SuperMemo 2 algorithm has been enhanced with configurable parameters that let you control how frequently new cards appear during their initial learning phase. This allows you to experiment with different scheduling strategies without changing the core algorithm.

## Configuration Variables

All configuration is in the `NEW_CARD_CONFIG` object at the top of `src/utils/supermemo2.ts`:

### `newCardThreshold`

**What it does:** Defines how many successful reviews a card needs before it's considered "mature" and follows standard SM-2 scheduling.

**Default:** `2` (affects cards on their 1st and 2nd successful review)

**Examples:**
- `newCardThreshold: 2` - Cards are "new" for their first 2 successful reviews
- `newCardThreshold: 3` - Cards are "new" for their first 3 successful reviews
- `newCardThreshold: 5` - Cards stay "new" longer, affected by the multiplier for more reviews

### `newCardIntervalMultiplier`

**What it does:** Multiplies the interval for cards with repetitions ≤ `newCardThreshold`.

**Default:** `1.0` (no change to standard behavior)

**How to adjust:**
- **More frequent reviews:** Use values < 1.0
  - `0.5` = cards appear twice as often
  - `0.33` = cards appear three times as often
  - `0.25` = cards appear four times as often

- **Less frequent reviews:** Use values > 1.0
  - `2.0` = cards appear half as often
  - `1.5` = cards appear less frequently

**Note:** Intervals are always at least 1 day (the minimum is enforced even if the multiplier would result in less).

### `firstRepetitionInterval`

**What it does:** Sets the base interval (in days) after the first successful review.

**Default:** `1` (standard SM-2: review again tomorrow)

**Examples:**
- `firstRepetitionInterval: 1` - Review the next day
- `firstRepetitionInterval: 2` - Review in 2 days
- `firstRepetitionInterval: 0.5` - Would be rounded up to 1 day (minimum)

### `secondRepetitionInterval`

**What it does:** Sets the base interval (in days) after the second successful review.

**Default:** `6` (standard SM-2: review in 6 days)

**Examples:**
- `secondRepetitionInterval: 6` - Standard behavior
- `secondRepetitionInterval: 3` - Review sooner
- `secondRepetitionInterval: 10` - Review later

## Example Configurations

### More Frequent New Card Reviews (Recommended Starting Point)

To see new cards more often during the learning phase:

```typescript
export const NEW_CARD_CONFIG = {
  newCardThreshold: 3,           // Consider first 3 reviews as "learning"
  newCardIntervalMultiplier: 0.5, // Show cards twice as often
  firstRepetitionInterval: 1,     // Keep standard 1-day
  secondRepetitionInterval: 6,    // Keep standard 6-day
};
```

**Result:**
- 1st review: 1 day × 0.5 = 1 day (minimum enforced)
- 2nd review: 6 days × 0.5 = 3 days
- 3rd review: (calculated) × 0.5 = more frequent
- 4th+ reviews: Standard SM-2 (no multiplier)

### Aggressive Early Reinforcement

For maximum early repetition:

```typescript
export const NEW_CARD_CONFIG = {
  newCardThreshold: 4,
  newCardIntervalMultiplier: 0.33, // Three times as often
  firstRepetitionInterval: 1,
  secondRepetitionInterval: 6,
};
```

### Conservative New Card Introduction

To avoid overwhelming users with new material:

```typescript
export const NEW_CARD_CONFIG = {
  newCardThreshold: 2,
  newCardIntervalMultiplier: 1.5,  // Less frequent
  firstRepetitionInterval: 2,       // Wait 2 days
  secondRepetitionInterval: 10,     // Wait 10 days
};
```

### Standard SM-2 Behavior (Default)

No changes to the algorithm:

```typescript
export const NEW_CARD_CONFIG = {
  newCardThreshold: 2,
  newCardIntervalMultiplier: 1.0,
  firstRepetitionInterval: 1,
  secondRepetitionInterval: 6,
};
```

## How to Experiment

1. **Edit the config:** Open `src/utils/supermemo2.ts` and modify the `NEW_CARD_CONFIG` values
2. **Test with real cards:** Create new flashcards and observe their review schedule
3. **Iterate:** Adjust values based on how the scheduling feels
4. **Monitor metrics:** Track completion rates and recall quality to find optimal values

## Tips

- Start with small changes (e.g., `0.75` or `0.5` for the multiplier)
- The multiplier only affects new cards, so mature cards continue on their normal schedule
- Increasing `newCardThreshold` extends the learning phase for more reviews
- Remember that failed reviews (quality < 3) reset the card to repetition 0, restarting the learning phase

## Technical Notes

- The multiplier is applied after calculating the base interval
- Intervals are always rounded to whole days
- Minimum interval is enforced at 1 day
- The easiness factor calculation is not affected by these settings
- Failed cards (Again/Hard with quality < 3) always reset to 1-day interval regardless of config
