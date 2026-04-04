"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { sm2, ratingToQuality } from "@/lib/sm2";
import { StudyMode } from "@/generated/prisma/client";

async function getAuthUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) throw new Error("User not found");

  return dbUser;
}

export async function startSession(data: {
  deckId: string;
  mode: "LEARN" | "QUIZ" | "TEST";
}) {
  const user = await getAuthUser();

  const deck = await prisma.deck.findUnique({ where: { id: data.deckId } });
  if (!deck) throw new Error("Deck not found");

  let cards;
  const now = new Date();

  if (data.mode === "LEARN") {
    // Cards due for review or never reviewed
    const scheduled = await prisma.card.findMany({
      where: {
        deckId: data.deckId,
        isDraft: false,
        reviewSchedules: {
          some: {
            userId: user.id,
            nextReviewAt: { lte: now },
          },
        },
      },
      take: 20,
    });

    const unscheduled = await prisma.card.findMany({
      where: {
        deckId: data.deckId,
        isDraft: false,
        reviewSchedules: {
          none: {},
        },
      },
      take: 20 - scheduled.length,
    });

    cards = [...scheduled, ...unscheduled].slice(0, 20);
  } else if (data.mode === "QUIZ") {
    const allCards = await prisma.card.findMany({
      where: { deckId: data.deckId, isDraft: false },
    });
    // Shuffle and take 20
    cards = allCards.sort(() => Math.random() - 0.5).slice(0, 20);
  } else {
    // TEST: all non-draft cards in order
    cards = await prisma.card.findMany({
      where: { deckId: data.deckId, isDraft: false },
      orderBy: { position: "asc" },
    });
  }

  const session = await prisma.studySession.create({
    data: {
      userId: user.id,
      deckId: data.deckId,
      mode: data.mode as StudyMode,
      totalCards: cards.length,
    },
  });

  return { session, cards };
}

export async function submitAnswer(data: {
  sessionId: string;
  cardId: string;
  isCorrect: boolean;
  confidence?: number;
  responseTimeMs?: number;
  rating?: "again" | "hard" | "good" | "easy";
}) {
  const user = await getAuthUser();

  const session = await prisma.studySession.findUnique({
    where: { id: data.sessionId },
  });
  if (!session || session.userId !== user.id) throw new Error("Session not found or unauthorized");

  const answer = await prisma.sessionAnswer.create({
    data: {
      sessionId: data.sessionId,
      cardId: data.cardId,
      isCorrect: data.isCorrect,
      confidence: data.confidence,
      responseTimeMs: data.responseTimeMs,
    },
  });

  // Update correct count on session
  if (data.isCorrect) {
    await prisma.studySession.update({
      where: { id: data.sessionId },
      data: { correctCount: { increment: 1 } },
    });
  }

  // Update ReviewSchedule for LEARN mode
  if (session.mode === StudyMode.LEARN && data.rating) {
    const quality = ratingToQuality(data.rating);

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
      create: {
        userId: user.id,
        cardId: data.cardId,
        easeFactor: sm2Result.easeFactor,
        intervalDays: sm2Result.intervalDays,
        repetitions: sm2Result.repetitions,
        nextReviewAt: sm2Result.nextReviewAt,
        lastReviewedAt: new Date(),
      },
      update: {
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
  const user = await getAuthUser();

  const session = await prisma.studySession.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== user.id) throw new Error("Session not found or unauthorized");

  const completed = await prisma.studySession.update({
    where: { id: sessionId },
    data: {
      completedAt: new Date(),
      durationSeconds,
    },
  });

  // Update streak
  const now = new Date();
  const lastUpdated = user.streakUpdatedAt;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lastDay = lastUpdated
    ? new Date(lastUpdated.getFullYear(), lastUpdated.getMonth(), lastUpdated.getDate())
    : null;

  const diffDays = lastDay ? Math.floor((today.getTime() - lastDay.getTime()) / 86400000) : null;

  let streakCount = user.streakCount;
  if (diffDays === null || diffDays > 1) {
    streakCount = 1;
  } else if (diffDays === 1) {
    streakCount = user.streakCount + 1;
  }
  // diffDays === 0 means already studied today, no change

  await prisma.user.update({
    where: { id: user.id },
    data: {
      streakCount,
      streakUpdatedAt: now,
    },
  });

  revalidatePath("/dashboard");
  return completed;
}
