"use server";

import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
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

  const deck = (artifact.decks as unknown) as {
    title: string;
    subject: string;
    description: string | null;
    source_type: string;
    cards: {
      type: string;
      prompt: string;
      answer: string;
      explanation: string | null;
      options: unknown;
      cloze_text: string | null;
      position: number;
      is_draft: boolean;
    }[];
  };

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

  const deck = artifact.decks as unknown as {
    id: string;
    title: string;
    subject: string;
    description: string | null;
    card_count: number;
    source_type: string;
    created_at: string;
  } | null;
  if (!deck) throw new Error("Deck not found");

  const creator = (artifact.users as unknown as {
    display_name: string | null;
    avatar_url: string | null;
  }) ?? null;

  return {
    deck,
    creator: creator ?? { display_name: null, avatar_url: null },
    shareType: artifact.share_type,
    importCount: artifact.import_count,
    code: artifact.code,
  };
}
