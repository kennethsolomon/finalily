"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

export async function createCard(data: {
  deckId: string;
  type: "FLASHCARD" | "MCQ" | "IDENTIFICATION" | "TRUE_FALSE" | "CLOZE";
  prompt: string;
  answer: string;
  explanation?: string;
  options?: unknown;
  clozeText?: string;
}) {
  const validTypes = ["FLASHCARD", "MCQ", "IDENTIFICATION", "TRUE_FALSE", "CLOZE"];
  if (!validTypes.includes(data.type)) throw new Error("Invalid card type");
  if (!data.prompt?.trim()) throw new Error("Prompt is required");
  if (!data.answer?.trim()) throw new Error("Answer is required");
  if (data.type === "CLOZE" && !data.clozeText?.trim()) throw new Error("Cloze text is required");
  if (data.type === "MCQ") {
    const opts = data.options as string[] | undefined;
    if (!Array.isArray(opts) || opts.length < 2) throw new Error("MCQ cards require at least 2 options");
  }

  const { supabase, user } = await getAuthUser();

  const { data: deck, error: deckError } = await supabase
    .from("decks")
    .select("owner_id")
    .eq("id", data.deckId)
    .single();
  if (deckError || !deck || deck.owner_id !== user.id)
    throw new Error("Deck not found or unauthorized");

  const { data: lastCard } = await supabase
    .from("cards")
    .select("position")
    .eq("deck_id", data.deckId)
    .order("position", { ascending: false })
    .limit(1)
    .single();

  const position = lastCard ? lastCard.position + 1 : 0;

  const { data: card, error } = await supabase
    .from("cards")
    .insert({
      deck_id: data.deckId,
      type: data.type,
      prompt: data.prompt,
      answer: data.answer,
      explanation: data.explanation ?? null,
      options: data.options ?? null,
      cloze_text: data.clozeText ?? null,
      position,
      is_draft: true,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  revalidatePath(`/decks/${data.deckId}`);
  return card;
}

export async function updateCard(
  cardId: string,
  data: {
    type?: "FLASHCARD" | "MCQ" | "IDENTIFICATION" | "TRUE_FALSE" | "CLOZE";
    prompt?: string;
    answer?: string;
    explanation?: string;
    options?: unknown;
    clozeText?: string;
    position?: number;
  }
) {
  const { supabase, user } = await getAuthUser();

  const { data: card, error: cardError } = await supabase
    .from("cards")
    .select("*, decks(owner_id)")
    .eq("id", cardId)
    .single();
  if (cardError || !card) throw new Error("Card not found or unauthorized");

  const deck = card.decks as unknown as { owner_id: string } | null;
  if (!deck || deck.owner_id !== user.id) throw new Error("Card not found or unauthorized");

  const updatePayload: Record<string, unknown> = {};
  if (data.type !== undefined) updatePayload.type = data.type;
  if (data.prompt !== undefined) updatePayload.prompt = data.prompt;
  if (data.answer !== undefined) updatePayload.answer = data.answer;
  if (data.explanation !== undefined) updatePayload.explanation = data.explanation;
  if (data.options !== undefined) updatePayload.options = data.options;
  if (data.clozeText !== undefined) updatePayload.cloze_text = data.clozeText;
  if (data.position !== undefined) updatePayload.position = data.position;

  const { data: updated, error } = await supabase
    .from("cards")
    .update(updatePayload)
    .eq("id", cardId)
    .select()
    .single();
  if (error) throw new Error(error.message);

  revalidatePath(`/decks/${card.deck_id}`);
  return updated;
}

export async function deleteCard(cardId: string) {
  const { supabase, user } = await getAuthUser();

  const { data: card, error: cardError } = await supabase
    .from("cards")
    .select("deck_id, decks(owner_id)")
    .eq("id", cardId)
    .single();
  if (cardError || !card) throw new Error("Card not found or unauthorized");

  const deck = card.decks as unknown as { owner_id: string } | null;
  if (!deck || deck.owner_id !== user.id) throw new Error("Card not found or unauthorized");

  const { error } = await supabase.from("cards").delete().eq("id", cardId);
  if (error) throw new Error(error.message);

  revalidatePath(`/decks/${card.deck_id}`);
}

export async function reorderCards(
  deckId: string,
  cardIds: string[]
) {
  const { supabase, user } = await getAuthUser();

  const { data: deck, error: deckError } = await supabase
    .from("decks")
    .select("owner_id")
    .eq("id", deckId)
    .single();
  if (deckError || !deck || deck.owner_id !== user.id)
    throw new Error("Deck not found or unauthorized");

  const updates = cardIds.map((id, index) =>
    supabase.from("cards").update({ position: index }).eq("id", id).eq("deck_id", deckId)
  );
  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);

  revalidatePath(`/decks/${deckId}`);
}

export async function publishCard(cardId: string) {
  const { supabase, user } = await getAuthUser();

  const { data: card, error: cardError } = await supabase
    .from("cards")
    .select("deck_id, decks(owner_id)")
    .eq("id", cardId)
    .single();
  if (cardError || !card) throw new Error("Card not found or unauthorized");

  const deck = card.decks as unknown as { owner_id: string } | null;
  if (!deck || deck.owner_id !== user.id) throw new Error("Card not found or unauthorized");

  const { data: updated, error } = await supabase
    .from("cards")
    .update({ is_draft: false })
    .eq("id", cardId)
    .select()
    .single();
  if (error) throw new Error(error.message);

  revalidatePath(`/decks/${card.deck_id}`);
  return updated;
}
