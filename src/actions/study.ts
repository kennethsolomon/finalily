"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth";
import { sm2, ratingToQuality } from "@/lib/sm2";
import { prisma } from "@/lib/prisma";

function fisherYatesShuffle<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export async function startSession(data: {
  deckId: string;
  mode: "LEARN" | "QUIZ" | "TEST";
  filter?: "due" | "weak" | "all";
}) {
  const { user } = await getAuthUser();

  const deck = await prisma.deck.findUnique({
    where: { id: data.deckId },
    select: { ownerId: true },
  });
  if (!deck) throw new Error("Deck not found");
  if (deck.ownerId !== user.id) throw new Error("Unauthorized");

  let cards: unknown[];
  const now = new Date();
  const filter = data.filter ?? "due";

  if (filter === "weak") {
    const weakSchedules = await prisma.reviewSchedule.findMany({
      where: { userId: user.id, easeFactor: { lt: 2.0 } },
      orderBy: { easeFactor: "asc" },
      take: 20,
      select: { cardId: true },
    });

    const weakIds = weakSchedules.map((r) => r.cardId);

    if (weakIds.length > 0) {
      cards = await prisma.card.findMany({
        where: { deckId: data.deckId, isDraft: false, id: { in: weakIds } },
        take: 20,
      });
    } else {
      cards = [];
    }
  } else if (filter === "all") {
    const allCards = await prisma.card.findMany({
      where: { deckId: data.deckId, isDraft: false },
      orderBy: { position: "asc" },
      take: 20,
    });
    cards = fisherYatesShuffle(allCards);
  } else if (data.mode === "LEARN") {
    const dueSchedules = await prisma.reviewSchedule.findMany({
      where: { userId: user.id, nextReviewAt: { lte: now } },
      orderBy: { nextReviewAt: "asc" },
      take: 20,
      select: { cardId: true },
    });

    const scheduledIds = dueSchedules.map((r) => r.cardId);

    let scheduled: unknown[] = [];
    if (scheduledIds.length > 0) {
      scheduled = await prisma.card.findMany({
        where: { deckId: data.deckId, isDraft: false, id: { in: scheduledIds } },
        take: 20,
      });
    }

    // Cards never reviewed (no review_schedule entry)
    const allCardIds = await prisma.card.findMany({
      where: { deckId: data.deckId, isDraft: false },
      select: { id: true },
    });

    const deckCardIds = allCardIds.map((c) => c.id);

    const reviewedSchedules = deckCardIds.length > 0
      ? await prisma.reviewSchedule.findMany({
          where: { userId: user.id, cardId: { in: deckCardIds } },
          select: { cardId: true },
        })
      : [];

    const reviewedSet = new Set(reviewedSchedules.map((r) => r.cardId));
    const unscheduledIds = deckCardIds.filter((id) => !reviewedSet.has(id));

    let unscheduled: unknown[] = [];
    const needed = 20 - scheduled.length;
    if (needed > 0 && unscheduledIds.length > 0) {
      unscheduled = await prisma.card.findMany({
        where: { deckId: data.deckId, isDraft: false, id: { in: unscheduledIds } },
        take: needed,
      });
    }

    cards = [...scheduled, ...unscheduled].slice(0, 20);
  } else if (data.mode === "QUIZ") {
    const quizCards = await prisma.card.findMany({
      where: { deckId: data.deckId, isDraft: false },
      orderBy: { position: "asc" },
      take: 20,
    });
    cards = fisherYatesShuffle(quizCards);
  } else {
    cards = await prisma.card.findMany({
      where: { deckId: data.deckId, isDraft: false },
      orderBy: { position: "asc" },
    });
  }

  // Abandon any previous incomplete sessions for this deck
  await prisma.studySession.updateMany({
    where: { userId: user.id, deckId: data.deckId, completedAt: null },
    data: { completedAt: new Date() },
  });

  const session = await prisma.studySession.create({
    data: {
      userId: user.id,
      deckId: data.deckId,
      mode: data.mode,
      totalCards: cards.length,
    },
  });

  return { session, cards };
}

export async function startQuickReview() {
  const { user } = await getAuthUser();

  const now = new Date();

  const dueSchedules = await prisma.reviewSchedule.findMany({
    where: { userId: user.id, nextReviewAt: { lte: now } },
    orderBy: { nextReviewAt: "asc" },
    take: 5,
    select: { cardId: true },
  });

  const dueCardIds = dueSchedules.map((r) => r.cardId);

  if (dueCardIds.length === 0) {
    return { session: null, cards: [], deckId: null };
  }

  const cards = await prisma.card.findMany({
    where: { id: { in: dueCardIds }, isDraft: false, deck: { ownerId: user.id } },
  });

  const cardList = fisherYatesShuffle(cards);
  if (cardList.length === 0) {
    return { session: null, cards: [], deckId: null };
  }

  const anchorDeckId = cardList[0].deckId;

  await prisma.studySession.updateMany({
    where: { userId: user.id, deckId: anchorDeckId, completedAt: null },
    data: { completedAt: new Date() },
  });

  const session = await prisma.studySession.create({
    data: {
      userId: user.id,
      deckId: anchorDeckId,
      mode: "QUIZ",
      totalCards: cardList.length,
    },
  });

  return { session, cards: cardList, deckId: anchorDeckId };
}

export async function startStudyAllDue() {
  const { user } = await getAuthUser();

  const now = new Date();

  const dueSchedules = await prisma.reviewSchedule.findMany({
    where: { userId: user.id, nextReviewAt: { lte: now } },
    orderBy: { nextReviewAt: "asc" },
    take: 50,
    select: { cardId: true },
  });

  const dueCardIds = dueSchedules.map((r) => r.cardId);

  if (dueCardIds.length === 0) {
    return { session: null, cards: [], deckId: null };
  }

  const cards = await prisma.card.findMany({
    where: { id: { in: dueCardIds }, isDraft: false, deck: { ownerId: user.id } },
  });

  const cardList = fisherYatesShuffle(cards);
  if (cardList.length === 0) {
    return { session: null, cards: [], deckId: null };
  }

  const anchorDeckId = cardList[0].deckId;

  await prisma.studySession.updateMany({
    where: { userId: user.id, deckId: anchorDeckId, completedAt: null },
    data: { completedAt: new Date() },
  });

  const session = await prisma.studySession.create({
    data: {
      userId: user.id,
      deckId: anchorDeckId,
      mode: "LEARN",
      totalCards: cardList.length,
    },
  });

  return { session, cards: cardList, deckId: anchorDeckId };
}

export async function startRetrySession(data: {
  deckId: string;
  previousSessionId: string;
}) {
  const { user } = await getAuthUser();

  const deck = await prisma.deck.findUnique({
    where: { id: data.deckId },
    select: { ownerId: true },
  });
  if (!deck) throw new Error("Deck not found");
  if (deck.ownerId !== user.id) throw new Error("Unauthorized");

  const prevSession = await prisma.studySession.findUnique({
    where: { id: data.previousSessionId },
    select: { id: true, userId: true, deckId: true },
  });
  if (!prevSession || prevSession.userId !== user.id)
    throw new Error("Previous session not found");
  if (prevSession.deckId !== data.deckId)
    throw new Error("Session does not belong to this deck");

  const missedAnswers = await prisma.sessionAnswer.findMany({
    where: { sessionId: data.previousSessionId, isCorrect: false },
    select: { cardId: true },
  });

  const missedIds = missedAnswers.map((a) => a.cardId);
  if (missedIds.length === 0) throw new Error("No missed cards in that session");

  const cards = await prisma.card.findMany({
    where: { id: { in: missedIds } },
  });

  const cardList = cards;

  const session = await prisma.studySession.create({
    data: {
      userId: user.id,
      deckId: data.deckId,
      mode: "QUIZ",
      totalCards: cardList.length,
    },
  });

  return { session, cards: cardList };
}

async function validateAnswer(
  cardType: string,
  cardAnswer: string,
  clozeText: string | null,
  cardPrompt: string,
  userResponse?: string
): Promise<boolean | null> {
  if (userResponse === undefined) return null;

  switch (cardType) {
    case "MCQ":
      return userResponse === cardAnswer;
    case "TRUE_FALSE":
      return userResponse.toLowerCase() === cardAnswer.toLowerCase();
    case "IDENTIFICATION": {
      // Exact match fast path
      if (userResponse.trim().toLowerCase() === cardAnswer.trim().toLowerCase()) {
        return true;
      }
      // AI validation for semantic matching
      try {
        const { validateIdentificationAnswer } = await import("@/actions/validate-answer");
        const result = await validateIdentificationAnswer({
          userAnswer: userResponse,
          correctAnswer: cardAnswer,
          prompt: cardPrompt,
        });
        return result.isCorrect;
      } catch {
        // Fallback to exact match if AI is unavailable
        return userResponse.trim().toLowerCase() === cardAnswer.trim().toLowerCase();
      }
    }
    case "CLOZE": {
      const source = clozeText ?? "";
      const regex = /\{\{([^}]+)\}\}/g;
      const blanks: string[] = [];
      let match;
      while ((match = regex.exec(source)) !== null) {
        blanks.push(match[1].trim().toLowerCase());
      }
      const userBlanks = userResponse.split("|||").map((s) => s.trim().toLowerCase());
      return blanks.length > 0 && blanks.length === userBlanks.length && blanks.every((b, i) => userBlanks[i] === b);
    }
    default:
      return null;
  }
}

export async function submitAnswer(data: {
  sessionId: string;
  cardId: string;
  isCorrect: boolean;
  userResponse?: string;
  confidence?: number;
  responseTimeMs?: number;
  rating?: "again" | "hard" | "good" | "easy";
}) {
  const { user } = await getAuthUser();

  const session = await prisma.studySession.findUnique({
    where: { id: data.sessionId },
  });
  if (!session || session.userId !== user.id)
    throw new Error("Session not found or unauthorized");

  const card = await prisma.card.findUnique({
    where: { id: data.cardId },
    select: { deckId: true, type: true, answer: true, prompt: true, clozeText: true },
  });
  if (!card || card.deckId !== session.deckId)
    throw new Error("Card does not belong to this session's deck");

  const serverValidated = await validateAnswer(card.type, card.answer, card.clozeText, card.prompt, data.userResponse);
  const isCorrect = serverValidated !== null ? serverValidated : data.isCorrect;

  const answer = await prisma.sessionAnswer.create({
    data: {
      sessionId: data.sessionId,
      cardId: data.cardId,
      isCorrect,
      confidence: data.confidence ?? null,
      responseTimeMs: data.responseTimeMs ?? null,
    },
  });

  if (isCorrect) {
    await prisma.studySession.update({
      where: { id: data.sessionId },
      data: { correctCount: { increment: 1 } },
    });
  }

  // Update spaced repetition for LEARN (uses explicit rating) and QUIZ (derives quality from correctness)
  const shouldUpdateSchedule =
    (session.mode === "LEARN" && data.rating) ||
    session.mode === "QUIZ";

  if (shouldUpdateSchedule) {
    const quality = data.rating
      ? ratingToQuality(data.rating)
      : isCorrect ? 4 : 1;

    const existing = await prisma.reviewSchedule.findUnique({
      where: { userId_cardId: { userId: user.id, cardId: data.cardId } },
    });

    const sm2Result = sm2({
      quality,
      easeFactor: existing?.easeFactor ?? 2.5,
      intervalDays: existing?.intervalDays ?? 0,
      repetitions: existing?.repetitions ?? 0,
    });

    await prisma.reviewSchedule.upsert({
      where: { userId_cardId: { userId: user.id, cardId: data.cardId } },
      update: {
        easeFactor: sm2Result.easeFactor,
        intervalDays: sm2Result.intervalDays,
        repetitions: sm2Result.repetitions,
        nextReviewAt: sm2Result.nextReviewAt,
        lastReviewedAt: new Date(),
      },
      create: {
        userId: user.id,
        cardId: data.cardId,
        easeFactor: sm2Result.easeFactor,
        intervalDays: sm2Result.intervalDays,
        repetitions: sm2Result.repetitions,
        nextReviewAt: sm2Result.nextReviewAt,
        lastReviewedAt: new Date(),
      },
    });
  }

  return answer;
}

export async function completeSession(sessionId: string, durationSeconds: number) {
  const { user } = await getAuthUser();

  const session = await prisma.studySession.findUnique({
    where: { id: sessionId },
    select: { userId: true, deckId: true },
  });
  if (!session || session.userId !== user.id)
    throw new Error("Session not found or unauthorized");

  const now = new Date();

  const completed = await prisma.studySession.update({
    where: { id: sessionId },
    data: {
      completedAt: now,
      durationSeconds,
    },
  });

  // Clean up any other orphaned incomplete sessions for this deck
  await prisma.studySession.updateMany({
    where: { userId: user.id, deckId: session.deckId, completedAt: null },
    data: { completedAt: now },
  });

  // Fetch fresh user data for streak (user from auth may be stale)
  const freshUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!freshUser) throw new Error("User not found");

  const lastUpdated = freshUser.streakUpdatedAt ? new Date(freshUser.streakUpdatedAt) : null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lastDay = lastUpdated
    ? new Date(lastUpdated.getFullYear(), lastUpdated.getMonth(), lastUpdated.getDate())
    : null;

  const diffDays = lastDay
    ? Math.floor((today.getTime() - lastDay.getTime()) / 86400000)
    : null;

  // Reset streak freeze availability every Monday
  const freezeUsedAt = freshUser.streakFreezeUsedAt ? new Date(freshUser.streakFreezeUsedAt) : null;
  let freezeAvailable = freshUser.streakFreezeAvailable ?? true;
  if (freezeUsedAt) {
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const thisMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
    if (freezeUsedAt < thisMonday) {
      freezeAvailable = true;
    }
  }

  let streakCount = freshUser.streakCount ?? 0;
  let usedFreeze = false;

  if (diffDays === null || diffDays > 2) {
    streakCount = 1;
  } else if (diffDays === 2 && freezeAvailable) {
    streakCount = (freshUser.streakCount ?? 0) + 1;
    usedFreeze = true;
  } else if (diffDays === 2 && !freezeAvailable) {
    streakCount = 1;
  } else if (diffDays === 1) {
    streakCount = (freshUser.streakCount ?? 0) + 1;
  }
  // diffDays === 0: same day, keep current streak

  const updateData: Record<string, unknown> = {
    streakCount,
    streakUpdatedAt: now,
  };

  if (usedFreeze) {
    updateData.streakFreezeAvailable = false;
    updateData.streakFreezeUsedAt = now;
  } else if (freezeAvailable !== (freshUser.streakFreezeAvailable ?? true)) {
    updateData.streakFreezeAvailable = freezeAvailable;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: updateData,
  });

  revalidatePath("/");
  return completed;
}

export async function getIncompleteSession(deckId: string) {
  const { user } = await getAuthUser();

  const session = await prisma.studySession.findFirst({
    where: { userId: user.id, deckId, completedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!session) return null;

  const answers = await prisma.sessionAnswer.findMany({
    where: { sessionId: session.id },
    select: { cardId: true },
  });

  const answeredCardIds = answers.map((a) => a.cardId);

  // Auto-abandon if all cards answered (session should have been completed)
  if (answeredCardIds.length >= session.totalCards) {
    await prisma.studySession.update({
      where: { id: session.id },
      data: { completedAt: new Date() },
    });
    return null;
  }

  return {
    sessionId: session.id,
    mode: session.mode as "LEARN" | "QUIZ" | "TEST",
    totalCards: session.totalCards,
    answeredCards: answeredCardIds.length,
    answeredCardIds,
    createdAt: session.createdAt.toISOString(),
  };
}

export async function updateAnswerConfidence(data: {
  sessionId: string;
  cardId: string;
  confidence: number;
}) {
  const { user } = await getAuthUser();

  const session = await prisma.studySession.findUnique({
    where: { id: data.sessionId },
    select: { userId: true },
  });
  if (!session || session.userId !== user.id) return;

  await prisma.sessionAnswer.updateMany({
    where: { sessionId: data.sessionId, cardId: data.cardId },
    data: { confidence: data.confidence },
  });
}

export async function abandonSession(sessionId: string) {
  const { user } = await getAuthUser();

  const session = await prisma.studySession.findUnique({
    where: { id: sessionId },
    select: { userId: true, completedAt: true },
  });
  if (!session || session.userId !== user.id)
    throw new Error("Session not found or unauthorized");
  if (session.completedAt) throw new Error("Session already completed");

  await prisma.studySession.update({
    where: { id: sessionId },
    data: { completedAt: new Date() },
  });

  return { success: true };
}

export async function resumeSession(sessionId: string) {
  const { user } = await getAuthUser();

  const session = await prisma.studySession.findUnique({
    where: { id: sessionId },
  });
  if (!session || session.userId !== user.id)
    throw new Error("Session not found or unauthorized");
  if (session.completedAt) throw new Error("Session already completed");

  const answers = await prisma.sessionAnswer.findMany({
    where: { sessionId },
    select: { cardId: true },
  });
  const answeredIds = new Set(answers.map((a) => a.cardId));

  const allCards = await prisma.card.findMany({
    where: { deckId: session.deckId, isDraft: false },
    orderBy: { position: "asc" },
    take: session.totalCards,
  });

  const remainingCards = allCards.filter((c) => !answeredIds.has(c.id));

  return { session, cards: remainingCards };
}
