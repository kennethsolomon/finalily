/**
 * SM-2 Spaced Repetition Algorithm
 *
 * Quality ratings:
 * 0 - Complete blackout
 * 1 - Incorrect, but recognized answer
 * 2 - Incorrect, but easy to recall
 * 3 - Correct with difficulty
 * 4 - Correct with hesitation
 * 5 - Perfect response
 */

interface SM2Input {
  quality: number; // 0-5
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
}

interface SM2Result {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  nextReviewAt: Date;
}

export function sm2(input: SM2Input): SM2Result {
  const { quality, easeFactor: prevEase, intervalDays: prevInterval, repetitions: prevReps } = input;

  let newEase: number;
  let newInterval: number;
  let newReps: number;

  if (quality < 3) {
    // Failed — reset repetitions and interval
    newReps = 0;
    newInterval = 1;
    newEase = Math.max(1.3, prevEase - 0.2);
  } else {
    // Passed — advance
    newReps = prevReps + 1;
    newEase = Math.max(
      1.3,
      prevEase + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    );

    if (newReps === 1) {
      newInterval = 1;
    } else if (newReps === 2) {
      newInterval = 6;
    } else {
      newInterval = Math.round(prevInterval * newEase);
    }
  }

  const nextReviewAt = new Date();
  nextReviewAt.setDate(nextReviewAt.getDate() + newInterval);

  return {
    easeFactor: Math.round(newEase * 100) / 100,
    intervalDays: newInterval,
    repetitions: newReps,
    nextReviewAt,
  };
}

/**
 * Map user-friendly ratings to SM-2 quality scores
 */
export function ratingToQuality(rating: "again" | "hard" | "good" | "easy"): number {
  switch (rating) {
    case "again": return 1;
    case "hard": return 2;
    case "good": return 3;
    case "easy": return 5;
  }
}
