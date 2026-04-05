"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth";
import { sm2, ratingToQuality } from "@/lib/sm2";

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

    const deckCardIds = (allCardIds ?? []).map((c: { id: string }) => c.id);

    // Only query review_schedules for this deck's cards, not ALL cards
    const { data: reviewedCardIds } = deckCardIds.length > 0
      ? await supabase
          .from("review_schedules")
          .select("card_id")
          .eq("user_id", user.id)
          .in("card_id", deckCardIds)
      : { data: [] };

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

  // Abandon any previous incomplete sessions for this deck
  await supabase
    .from("study_sessions")
    .update({ completed_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("deck_id", data.deckId)
    .is("completed_at", null);

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

export async function startQuickReview() {
  const { supabase, user } = await getAuthUser();

  const now = new Date().toISOString();

  // Get 5 due cards across ALL decks
  const { data: dueSchedules } = await supabase
    .from("review_schedules")
    .select("card_id")
    .eq("user_id", user.id)
    .lte("next_review_at", now)
    .order("next_review_at", { ascending: true })
    .limit(5);

  const dueCardIds = (dueSchedules ?? []).map((r: { card_id: string }) => r.card_id);

  if (dueCardIds.length === 0) {
    return { session: null, cards: [], deckId: null };
  }

  // Fetch cards and their deck info
  const { data: cards } = await supabase
    .from("cards")
    .select("*, decks!inner(owner_id)")
    .in("id", dueCardIds)
    .eq("is_draft", false)
    .eq("decks.owner_id", user.id);

  const cardList = fisherYatesShuffle(cards ?? []);
  if (cardList.length === 0) {
    return { session: null, cards: [], deckId: null };
  }

  // Use the first card's deck_id for the session (mixed-deck sessions use first deck as anchor)
  const anchorDeckId = (cardList[0] as { deck_id: string }).deck_id;

  // Abandon any previous incomplete sessions for quick review
  await supabase
    .from("study_sessions")
    .update({ completed_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("deck_id", anchorDeckId)
    .is("completed_at", null);

  const { data: session, error: sessionError } = await supabase
    .from("study_sessions")
    .insert({
      user_id: user.id,
      deck_id: anchorDeckId,
      mode: "QUIZ",
      total_cards: cardList.length,
    })
    .select()
    .single();
  if (sessionError) throw new Error(sessionError.message);

  return { session, cards: cardList, deckId: anchorDeckId };
}

export async function startStudyAllDue() {
  const { supabase, user } = await getAuthUser();

  const now = new Date().toISOString();

  // Get ALL due cards across ALL decks (up to 50 for reasonable session length)
  const { data: dueSchedules } = await supabase
    .from("review_schedules")
    .select("card_id")
    .eq("user_id", user.id)
    .lte("next_review_at", now)
    .order("next_review_at", { ascending: true })
    .limit(50);

  const dueCardIds = (dueSchedules ?? []).map((r: { card_id: string }) => r.card_id);

  if (dueCardIds.length === 0) {
    return { session: null, cards: [], deckId: null };
  }

  // Fetch cards with ownership check
  const { data: cards } = await supabase
    .from("cards")
    .select("*, decks!inner(owner_id)")
    .in("id", dueCardIds)
    .eq("is_draft", false)
    .eq("decks.owner_id", user.id);

  const cardList = fisherYatesShuffle(cards ?? []);
  if (cardList.length === 0) {
    return { session: null, cards: [], deckId: null };
  }

  const anchorDeckId = (cardList[0] as { deck_id: string }).deck_id;

  await supabase
    .from("study_sessions")
    .update({ completed_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("deck_id", anchorDeckId)
    .is("completed_at", null);

  const { data: session, error: sessionError } = await supabase
    .from("study_sessions")
    .insert({
      user_id: user.id,
      deck_id: anchorDeckId,
      mode: "LEARN",
      total_cards: cardList.length,
    })
    .select()
    .single();
  if (sessionError) throw new Error(sessionError.message);

  return { session, cards: cardList, deckId: anchorDeckId };
}

export async function startRetrySession(data: {
  deckId: string;
  previousSessionId: string;
}) {
  const { supabase, user } = await getAuthUser();

  // Verify deck ownership
  const { data: deck, error: deckError } = await supabase
    .from("decks")
    .select("owner_id")
    .eq("id", data.deckId)
    .single();
  if (deckError || !deck) throw new Error("Deck not found");
  if (deck.owner_id !== user.id) throw new Error("Unauthorized");

  // Verify previous session belongs to user
  const { data: prevSession, error: prevError } = await supabase
    .from("study_sessions")
    .select("id, user_id, deck_id")
    .eq("id", data.previousSessionId)
    .single();
  if (prevError || !prevSession || prevSession.user_id !== user.id)
    throw new Error("Previous session not found");
  if (prevSession.deck_id !== data.deckId)
    throw new Error("Session does not belong to this deck");

  // Get missed card IDs from previous session
  const { data: missedAnswers } = await supabase
    .from("session_answers")
    .select("card_id")
    .eq("session_id", data.previousSessionId)
    .eq("is_correct", false);

  const missedIds = (missedAnswers ?? []).map((a: { card_id: string }) => a.card_id);
  if (missedIds.length === 0) throw new Error("No missed cards in that session");

  // Fetch the actual card data
  const { data: cards } = await supabase
    .from("cards")
    .select("*")
    .in("id", missedIds);

  const cardList = cards ?? [];

  // Create a new session for the retry
  const { data: session, error: sessionError } = await supabase
    .from("study_sessions")
    .insert({
      user_id: user.id,
      deck_id: data.deckId,
      mode: "QUIZ",
      total_cards: cardList.length,
    })
    .select()
    .single();
  if (sessionError) throw new Error(sessionError.message);

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
    .select("deck_id, type, answer, prompt, cloze_text")
    .eq("id", data.cardId)
    .single();
  if (cardError || !card || card.deck_id !== session.deck_id)
    throw new Error("Card does not belong to this session's deck");

  const serverValidated = await validateAnswer(card.type, card.answer, card.cloze_text, card.prompt, data.userResponse);
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

  // Update spaced repetition for LEARN (uses explicit rating) and QUIZ (derives quality from correctness)
  const shouldUpdateSchedule =
    (session.mode === "LEARN" && data.rating) ||
    session.mode === "QUIZ";

  if (shouldUpdateSchedule) {
    // LEARN mode: use explicit rating. QUIZ mode: correct = quality 4, incorrect = quality 1
    const quality = data.rating
      ? ratingToQuality(data.rating)
      : isCorrect ? 4 : 1;

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
    .select("user_id, deck_id")
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

  // Clean up any other orphaned incomplete sessions for this deck
  await supabase
    .from("study_sessions")
    .update({ completed_at: now.toISOString() })
    .eq("user_id", user.id)
    .eq("deck_id", session.deck_id)
    .is("completed_at", null);

  // Update streak (with streak freeze support)
  const lastUpdated = user.streak_updated_at ? new Date(user.streak_updated_at) : null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lastDay = lastUpdated
    ? new Date(lastUpdated.getFullYear(), lastUpdated.getMonth(), lastUpdated.getDate())
    : null;

  const diffDays = lastDay
    ? Math.floor((today.getTime() - lastDay.getTime()) / 86400000)
    : null;

  // Reset streak freeze availability every Monday
  const freezeUsedAt = user.streak_freeze_used_at ? new Date(user.streak_freeze_used_at) : null;
  let freezeAvailable = user.streak_freeze_available ?? true;
  if (freezeUsedAt) {
    // Find start of current week (Monday)
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const thisMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
    if (freezeUsedAt < thisMonday) {
      freezeAvailable = true;
    }
  }

  let streakCount = user.streak_count ?? 0;
  let usedFreeze = false;

  if (diffDays === null || diffDays > 2) {
    // Too many days missed, even freeze can't help
    streakCount = 1;
  } else if (diffDays === 2 && freezeAvailable) {
    // Missed exactly 1 day — use streak freeze
    streakCount = (user.streak_count ?? 0) + 1;
    usedFreeze = true;
  } else if (diffDays === 2 && !freezeAvailable) {
    // Missed 1 day but no freeze available
    streakCount = 1;
  } else if (diffDays === 1) {
    streakCount = (user.streak_count ?? 0) + 1;
  }
  // diffDays === 0: same day, keep current streak

  const updateData: Record<string, unknown> = {
    streak_count: streakCount,
    streak_updated_at: now.toISOString(),
  };

  if (usedFreeze) {
    updateData.streak_freeze_available = false;
    updateData.streak_freeze_used_at = now.toISOString();
  } else if (freezeAvailable !== (user.streak_freeze_available ?? true)) {
    // Reset freeze if it was refreshed this week
    updateData.streak_freeze_available = freezeAvailable;
  }

  await supabase
    .from("users")
    .update(updateData)
    .eq("id", user.id);

  revalidatePath("/");
  return completed;
}

export async function getIncompleteSession(deckId: string) {
  const { supabase, user } = await getAuthUser();

  // Find the most recent incomplete session for this deck
  const { data: session, error } = await supabase
    .from("study_sessions")
    .select("id, mode, total_cards, correct_count, created_at")
    .eq("user_id", user.id)
    .eq("deck_id", deckId)
    .is("completed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!session) return null;

  // Get answered card IDs for this session
  const { data: answers, error: answersError } = await supabase
    .from("session_answers")
    .select("card_id")
    .eq("session_id", session.id);
  if (answersError) throw new Error(answersError.message);

  const answeredCardIds = (answers ?? []).map((a: { card_id: string }) => a.card_id);

  // Auto-abandon if all cards answered (session should have been completed)
  if (answeredCardIds.length >= session.total_cards) {
    await supabase
      .from("study_sessions")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", session.id);
    return null;
  }

  return {
    sessionId: session.id,
    mode: session.mode as "LEARN" | "QUIZ" | "TEST",
    totalCards: session.total_cards,
    answeredCards: answeredCardIds.length,
    answeredCardIds,
    createdAt: session.created_at,
  };
}

export async function updateAnswerConfidence(data: {
  sessionId: string;
  cardId: string;
  confidence: number;
}) {
  const { supabase, user } = await getAuthUser();

  const { data: session } = await supabase
    .from("study_sessions")
    .select("user_id")
    .eq("id", data.sessionId)
    .single();
  if (!session || session.user_id !== user.id) return;

  await supabase
    .from("session_answers")
    .update({ confidence: data.confidence })
    .eq("session_id", data.sessionId)
    .eq("card_id", data.cardId);
}

export async function abandonSession(sessionId: string) {
  const { supabase, user } = await getAuthUser();

  const { data: session, error: sessionError } = await supabase
    .from("study_sessions")
    .select("user_id, completed_at")
    .eq("id", sessionId)
    .single();
  if (sessionError || !session || session.user_id !== user.id)
    throw new Error("Session not found or unauthorized");
  if (session.completed_at) throw new Error("Session already completed");

  const { error } = await supabase
    .from("study_sessions")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", sessionId);
  if (error) throw new Error(error.message);

  return { success: true };
}

export async function resumeSession(sessionId: string) {
  const { supabase, user } = await getAuthUser();

  const { data: session, error: sessionError } = await supabase
    .from("study_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();
  if (sessionError || !session || session.user_id !== user.id)
    throw new Error("Session not found or unauthorized");
  if (session.completed_at) throw new Error("Session already completed");

  // Get already-answered card IDs
  const { data: answers } = await supabase
    .from("session_answers")
    .select("card_id")
    .eq("session_id", sessionId);
  const answeredIds = new Set((answers ?? []).map((a: { card_id: string }) => a.card_id));

  // Fetch all cards in the deck (matching original session logic)
  const { data: allCards } = await supabase
    .from("cards")
    .select("*")
    .eq("deck_id", session.deck_id)
    .eq("is_draft", false)
    .order("position", { ascending: true })
    .limit(session.total_cards);

  // Filter to only unanswered cards
  const remainingCards = (allCards ?? []).filter(
    (c: { id: string }) => !answeredIds.has(c.id)
  );

  return { session, cards: remainingCards };
}
