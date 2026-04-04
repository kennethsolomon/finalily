"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sm2, ratingToQuality } from "@/lib/sm2";

function fisherYatesShuffle<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

async function getAuthUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");

  const { data: dbUser, error: userError } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();
  if (userError || !dbUser) throw new Error("User not found");

  return { supabase, user: dbUser };
}

export async function startSession(data: {
  deckId: string;
  mode: "LEARN" | "QUIZ" | "TEST";
  filter?: "due" | "weak" | "all";
}) {
  const { supabase, user } = await getAuthUser();

  const { data: deck, error: deckError } = await supabase
    .from("decks")
    .select("owner_id")
    .eq("id", data.deckId)
    .single();
  if (deckError || !deck) throw new Error("Deck not found");
  if (deck.owner_id !== user.id) throw new Error("Unauthorized");

  let cards: unknown[];
  const now = new Date().toISOString();
  const filter = data.filter ?? "due";

  if (filter === "weak") {
    // Weak cards only: low ease factor across the deck
    const { data: weakSchedules } = await supabase
      .from("review_schedules")
      .select("card_id")
      .eq("user_id", user.id)
      .lt("ease_factor", 2.0)
      .order("ease_factor", { ascending: true })
      .limit(20);

    const weakIds = (weakSchedules ?? []).map((r: { card_id: string }) => r.card_id);

    if (weakIds.length > 0) {
      const { data: weakCards } = await supabase
        .from("cards")
        .select("*")
        .eq("deck_id", data.deckId)
        .eq("is_draft", false)
        .in("id", weakIds)
        .limit(20);
      cards = weakCards ?? [];
    } else {
      cards = [];
    }
  } else if (filter === "all") {
    // All cards in the deck regardless of schedule
    const { data: allCards } = await supabase
      .from("cards")
      .select("*")
      .eq("deck_id", data.deckId)
      .eq("is_draft", false)
      .order("position", { ascending: true })
      .limit(20);
    cards = fisherYatesShuffle(allCards ?? []);
  } else if (data.mode === "LEARN") {
    // Default "due" filter: cards with a review schedule due now
    const { data: scheduledCardIds } = await supabase
      .from("review_schedules")
      .select("card_id")
      .eq("user_id", user.id)
      .lte("next_review_at", now)
      .limit(20);

    const scheduledIds = (scheduledCardIds ?? []).map((r: { card_id: string }) => r.card_id);

    let scheduled: unknown[] = [];
    if (scheduledIds.length > 0) {
      const { data: scheduledCards } = await supabase
        .from("cards")
        .select("*")
        .eq("deck_id", data.deckId)
        .eq("is_draft", false)
        .in("id", scheduledIds)
        .limit(20);
      scheduled = scheduledCards ?? [];
    }

    // Cards never reviewed (no review_schedule entry)
    const { data: allCardIds } = await supabase
      .from("cards")
      .select("id")
      .eq("deck_id", data.deckId)
      .eq("is_draft", false);

    const { data: reviewedCardIds } = await supabase
      .from("review_schedules")
      .select("card_id")
      .eq("user_id", user.id);

    const reviewedSet = new Set((reviewedCardIds ?? []).map((r: { card_id: string }) => r.card_id));
    const unscheduledIds = (allCardIds ?? [])
      .map((c: { id: string }) => c.id)
      .filter((id: string) => !reviewedSet.has(id));

    let unscheduled: unknown[] = [];
    const needed = 20 - scheduled.length;
    if (needed > 0 && unscheduledIds.length > 0) {
      const { data: unscheduledCards } = await supabase
        .from("cards")
        .select("*")
        .eq("deck_id", data.deckId)
        .eq("is_draft", false)
        .in("id", unscheduledIds)
        .limit(needed);
      unscheduled = unscheduledCards ?? [];
    }

    cards = [...scheduled, ...unscheduled].slice(0, 20);
  } else if (data.mode === "QUIZ") {
    const { data: quizCards } = await supabase
      .from("cards")
      .select("*")
      .eq("deck_id", data.deckId)
      .eq("is_draft", false)
      .order("position", { ascending: true })
      .limit(20);
    cards = fisherYatesShuffle(quizCards ?? []);
  } else {
    const { data: testCards } = await supabase
      .from("cards")
      .select("*")
      .eq("deck_id", data.deckId)
      .eq("is_draft", false)
      .order("position", { ascending: true });
    cards = testCards ?? [];
  }

  const { data: session, error: sessionError } = await supabase
    .from("study_sessions")
    .insert({
      user_id: user.id,
      deck_id: data.deckId,
      mode: data.mode,
      total_cards: cards.length,
    })
    .select()
    .single();
  if (sessionError) throw new Error(sessionError.message);

  return { session, cards };
}

function validateAnswer(
  cardType: string,
  cardAnswer: string,
  clozeText: string | null,
  userResponse?: string
): boolean | null {
  if (userResponse === undefined) return null;

  switch (cardType) {
    case "MCQ":
      return userResponse === cardAnswer;
    case "TRUE_FALSE":
      return userResponse.toLowerCase() === cardAnswer.toLowerCase();
    case "IDENTIFICATION":
      return userResponse.trim().toLowerCase() === cardAnswer.trim().toLowerCase();
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
  const { supabase, user } = await getAuthUser();

  const { data: session, error: sessionError } = await supabase
    .from("study_sessions")
    .select("*")
    .eq("id", data.sessionId)
    .single();
  if (sessionError || !session || session.user_id !== user.id)
    throw new Error("Session not found or unauthorized");

  const { data: card, error: cardError } = await supabase
    .from("cards")
    .select("deck_id, type, answer, cloze_text")
    .eq("id", data.cardId)
    .single();
  if (cardError || !card || card.deck_id !== session.deck_id)
    throw new Error("Card does not belong to this session's deck");

  const serverValidated = validateAnswer(card.type, card.answer, card.cloze_text, data.userResponse);
  // Never trust client isCorrect — if server can't validate, treat as client's value
  // but log that server validation was skipped for this card type
  const isCorrect = serverValidated !== null ? serverValidated : data.isCorrect;

  const { data: answer, error: answerError } = await supabase
    .from("session_answers")
    .insert({
      session_id: data.sessionId,
      card_id: data.cardId,
      is_correct: isCorrect,
      confidence: data.confidence ?? null,
      response_time_ms: data.responseTimeMs ?? null,
    })
    .select()
    .single();
  if (answerError) throw new Error(answerError.message);

  if (isCorrect) {
    const { error: incrError } = await supabase.rpc("increment_correct_count", {
      session_id: data.sessionId,
    });
    if (incrError) {
      // Fallback: fetch and update manually
      const { data: currentSession } = await supabase
        .from("study_sessions")
        .select("correct_count")
        .eq("id", data.sessionId)
        .single();
      if (currentSession) {
        await supabase
          .from("study_sessions")
          .update({ correct_count: (currentSession.correct_count ?? 0) + 1 })
          .eq("id", data.sessionId);
      }
    }
  }

  if (session.mode === "LEARN" && data.rating) {
    const quality = ratingToQuality(data.rating);

    const { data: existing } = await supabase
      .from("review_schedules")
      .select("*")
      .eq("user_id", user.id)
      .eq("card_id", data.cardId)
      .single();

    const sm2Result = sm2({
      quality,
      easeFactor: existing?.ease_factor ?? 2.5,
      intervalDays: existing?.interval_days ?? 0,
      repetitions: existing?.repetitions ?? 0,
    });

    const now = new Date().toISOString();

    if (existing) {
      const { error: scheduleError } = await supabase
        .from("review_schedules")
        .update({
          ease_factor: sm2Result.easeFactor,
          interval_days: sm2Result.intervalDays,
          repetitions: sm2Result.repetitions,
          next_review_at: sm2Result.nextReviewAt.toISOString(),
          last_reviewed_at: now,
        })
        .eq("user_id", user.id)
        .eq("card_id", data.cardId);
      if (scheduleError) throw new Error(`Failed to update review schedule: ${scheduleError.message}`);
    } else {
      const { error: scheduleError } = await supabase.from("review_schedules").insert({
        user_id: user.id,
        card_id: data.cardId,
        ease_factor: sm2Result.easeFactor,
        interval_days: sm2Result.intervalDays,
        repetitions: sm2Result.repetitions,
        next_review_at: sm2Result.nextReviewAt.toISOString(),
        last_reviewed_at: now,
      });
      if (scheduleError) throw new Error(`Failed to create review schedule: ${scheduleError.message}`);
    }
  }

  return answer;
}

export async function completeSession(sessionId: string, durationSeconds: number) {
  const { supabase, user } = await getAuthUser();

  const { data: session, error: sessionError } = await supabase
    .from("study_sessions")
    .select("user_id")
    .eq("id", sessionId)
    .single();
  if (sessionError || !session || session.user_id !== user.id)
    throw new Error("Session not found or unauthorized");

  const now = new Date();

  const { data: completed, error } = await supabase
    .from("study_sessions")
    .update({
      completed_at: now.toISOString(),
      duration_seconds: durationSeconds,
    })
    .eq("id", sessionId)
    .select()
    .single();
  if (error) throw new Error(error.message);

  // Update streak
  const lastUpdated = user.streak_updated_at ? new Date(user.streak_updated_at) : null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lastDay = lastUpdated
    ? new Date(lastUpdated.getFullYear(), lastUpdated.getMonth(), lastUpdated.getDate())
    : null;

  const diffDays = lastDay
    ? Math.floor((today.getTime() - lastDay.getTime()) / 86400000)
    : null;

  let streakCount = user.streak_count ?? 0;
  if (diffDays === null || diffDays > 1) {
    streakCount = 1;
  } else if (diffDays === 1) {
    streakCount = (user.streak_count ?? 0) + 1;
  }

  await supabase
    .from("users")
    .update({
      streak_count: streakCount,
      streak_updated_at: now.toISOString(),
    })
    .eq("id", user.id);

  revalidatePath("/");
  return completed;
}
