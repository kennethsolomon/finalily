"use server";

import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth";
import { narrowJoin, type ShareDeckJoin, type DeckFull, type ShareCreator } from "@/lib/supabase/types";

export async function createShareArtifact(data: {
  deckId: string;
  shareType: "LINK" | "CODE";
}) {
  const { supabase, user } = await getAuthUser();

  const { data: deck, error: deckError } = await supabase
    .from("decks")
    .select("owner_id")
    .eq("id", data.deckId)
    .single();
  if (deckError || !deck || deck.owner_id !== user.id)
    throw new Error("Deck not found or unauthorized");

  const code = nanoid(6);

  const { data: artifact, error } = await supabase
    .from("share_artifacts")
    .insert({
      deck_id: data.deckId,
      creator_id: user.id,
      share_type: data.shareType,
      code,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  const { error: updateError } = await supabase
    .from("decks")
    .update({ is_shared: true })
    .eq("id", data.deckId);
  if (updateError) throw new Error(updateError.message);

  revalidatePath(`/decks/${data.deckId}`);
  return artifact;
}

export async function importSharedDeck(code: string) {
  const { supabase, user } = await getAuthUser();

  const { data: artifact, error: artifactError } = await supabase
    .from("share_artifacts")
    .select("*, decks(*, cards(*))")
    .eq("code", code)
    .single();
  if (artifactError || !artifact) throw new Error("Share code not found");

  const deck = narrowJoin<ShareDeckJoin>(artifact.decks);
  if (!deck) throw new Error("Deck data not found in share artifact");

  const publishedCards = deck.cards.filter((c) => !c.is_draft);

  const { data: newDeck, error: deckInsertError } = await supabase
    .from("decks")
    .insert({
      owner_id: user.id,
      title: deck.title,
      subject: deck.subject,
      description: deck.description,
      source_type: deck.source_type,
      card_count: publishedCards.length,
    })
    .select()
    .single();
  if (deckInsertError) throw new Error(deckInsertError.message);

  if (publishedCards.length > 0) {
    const { error: cardsInsertError } = await supabase.from("cards").insert(
      publishedCards.map((card) => ({
        deck_id: newDeck.id,
        type: card.type,
        prompt: card.prompt,
        answer: card.answer,
        explanation: card.explanation,
        options: card.options ?? null,
        cloze_text: card.cloze_text,
        position: card.position,
        is_draft: false,
      }))
    );
    if (cardsInsertError) {
      // Cleanup orphaned deck
      await supabase.from("decks").delete().eq("id", newDeck.id);
      throw new Error(cardsInsertError.message);
    }
  }

  // Increment import count atomically
  const { error: incrError } = await supabase.rpc("increment_import_count", {
    artifact_code: code,
  });
  if (incrError) {
    // Fallback: non-atomic increment
    const { data: current } = await supabase
      .from("share_artifacts")
      .select("import_count")
      .eq("code", code)
      .single();
    const { error: updateError } = await supabase
      .from("share_artifacts")
      .update({ import_count: (current?.import_count ?? 0) + 1 })
      .eq("code", code);
    if (updateError) throw new Error(updateError.message);
  }

  revalidatePath("/");
  return newDeck;
}

export async function deleteShareArtifact(deckId: string) {
  const { supabase, user } = await getAuthUser();

  const { data: deck, error: deckError } = await supabase
    .from("decks")
    .select("owner_id")
    .eq("id", deckId)
    .single();
  if (deckError || !deck || deck.owner_id !== user.id)
    throw new Error("Deck not found or unauthorized");

  const { error: deleteError } = await supabase
    .from("share_artifacts")
    .delete()
    .eq("deck_id", deckId);
  if (deleteError) throw new Error(deleteError.message);

  const { error: updateError } = await supabase
    .from("decks")
    .update({ is_shared: false })
    .eq("id", deckId);
  if (updateError) throw new Error(updateError.message);

  revalidatePath(`/decks/${deckId}`);
}

export async function getShareArtifactForDeck(deckId: string) {
  const { supabase, user } = await getAuthUser();

  const { data: deck, error: deckError } = await supabase
    .from("decks")
    .select("owner_id")
    .eq("id", deckId)
    .single();
  if (deckError || !deck || deck.owner_id !== user.id)
    throw new Error("Deck not found or unauthorized");

  const { data: artifact, error } = await supabase
    .from("share_artifacts")
    .select("code, import_count, created_at")
    .eq("deck_id", deckId)
    .maybeSingle();
  if (error) throw new Error(error.message);

  return artifact;
}

export async function getSharePreview(code: string) {
  const supabase = await createClient();

  const { data: artifact, error } = await supabase
    .from("share_artifacts")
    .select(
      `
      code,
      share_type,
      import_count,
      decks(id, title, subject, description, card_count, source_type, created_at),
      users!share_artifacts_creator_id_fkey(display_name, avatar_url)
      `
    )
    .eq("code", code)
    .single();

  if (error || !artifact) throw new Error("Share code not found");

  const deck = narrowJoin<DeckFull>(artifact.decks);
  if (!deck) throw new Error("Deck not found");

  const creator = narrowJoin<ShareCreator>(artifact.users);

  return {
    deck,
    creator: creator ?? { display_name: null, avatar_url: null },
    shareType: artifact.share_type,
    importCount: artifact.import_count,
    code: artifact.code,
  };
}
