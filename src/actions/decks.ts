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

export async function createDeck(data: {
  title: string;
  subject: string;
  description?: string;
  sourceType: "TOPIC" | "PDF" | "MANUAL";
}) {
  const { supabase, user } = await getAuthUser();

  const { data: deck, error } = await supabase
    .from("decks")
    .insert({
      owner_id: user.id,
      title: data.title,
      subject: data.subject,
      description: data.description ?? null,
      source_type: data.sourceType,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/");
  return deck;
}

export async function updateDeck(
  deckId: string,
  data: { title?: string; subject?: string; description?: string }
) {
  const { supabase, user } = await getAuthUser();

  const { data: existing, error: fetchError } = await supabase
    .from("decks")
    .select("owner_id")
    .eq("id", deckId)
    .single();
  if (fetchError || !existing || existing.owner_id !== user.id)
    throw new Error("Deck not found or unauthorized");

  const updatePayload: Record<string, unknown> = {};
  if (data.title !== undefined) updatePayload.title = data.title;
  if (data.subject !== undefined) updatePayload.subject = data.subject;
  if (data.description !== undefined) updatePayload.description = data.description;

  const { data: updated, error } = await supabase
    .from("decks")
    .update(updatePayload)
    .eq("id", deckId)
    .select()
    .single();
  if (error) throw new Error(error.message);

  revalidatePath(`/decks/${deckId}`);
  revalidatePath("/");
  return updated;
}

export async function deleteDeck(deckId: string) {
  const { supabase, user } = await getAuthUser();

  const { data: existing, error: fetchError } = await supabase
    .from("decks")
    .select("owner_id")
    .eq("id", deckId)
    .single();
  if (fetchError || !existing || existing.owner_id !== user.id)
    throw new Error("Deck not found or unauthorized");

  const { error } = await supabase.from("decks").delete().eq("id", deckId);
  if (error) throw new Error(error.message);

  revalidatePath("/");
  return { success: true };
}

export async function publishDeck(deckId: string) {
  const { supabase, user } = await getAuthUser();

  const { data: existing, error: fetchError } = await supabase
    .from("decks")
    .select("owner_id")
    .eq("id", deckId)
    .single();
  if (fetchError || !existing || existing.owner_id !== user.id)
    throw new Error("Deck not found or unauthorized");

  const { error: updateCardsError } = await supabase
    .from("cards")
    .update({ is_draft: false })
    .eq("deck_id", deckId);
  if (updateCardsError) throw new Error(updateCardsError.message);

  const { count, error: countError } = await supabase
    .from("cards")
    .select("*", { count: "exact", head: true })
    .eq("deck_id", deckId)
    .eq("is_draft", false);
  if (countError) throw new Error(countError.message);

  const { data: updated, error } = await supabase
    .from("decks")
    .update({ card_count: count ?? 0 })
    .eq("id", deckId)
    .select()
    .single();
  if (error) throw new Error(error.message);

  revalidatePath(`/decks/${deckId}`);
  revalidatePath("/");
  return updated;
}

export async function getDeckWithCards(deckId: string) {
  const { supabase, user } = await getAuthUser();

  const { data: deck, error } = await supabase
    .from("decks")
    .select("*, cards(*)")
    .eq("id", deckId)
    .single();
  if (error) throw new Error(error.message);
  if (!deck || deck.owner_id !== user.id) throw new Error("Deck not found or unauthorized");

  // Sort cards by position
  if (deck.cards) {
    deck.cards.sort((a: { position: number }, b: { position: number }) => a.position - b.position);
  }

  return deck;
}
