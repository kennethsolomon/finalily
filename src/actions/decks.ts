"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { SourceType } from "@/generated/prisma/client";

async function getAuthUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) throw new Error("User not found");

  return dbUser;
}

export async function createDeck(data: {
  title: string;
  subject: string;
  description?: string;
  sourceType: "TOPIC" | "PDF" | "MANUAL";
}) {
  const user = await getAuthUser();

  const deck = await prisma.deck.create({
    data: {
      ownerId: user.id,
      title: data.title,
      subject: data.subject,
      description: data.description,
      sourceType: data.sourceType as SourceType,
    },
  });

  revalidatePath("/dashboard");
  return deck;
}

export async function updateDeck(
  deckId: string,
  data: { title?: string; subject?: string; description?: string }
) {
  const user = await getAuthUser();

  const deck = await prisma.deck.findUnique({ where: { id: deckId } });
  if (!deck || deck.ownerId !== user.id) throw new Error("Deck not found or unauthorized");

  const updated = await prisma.deck.update({
    where: { id: deckId },
    data,
  });

  revalidatePath(`/decks/${deckId}`);
  revalidatePath("/dashboard");
  return updated;
}

export async function deleteDeck(deckId: string) {
  const user = await getAuthUser();

  const deck = await prisma.deck.findUnique({ where: { id: deckId } });
  if (!deck || deck.ownerId !== user.id) throw new Error("Deck not found or unauthorized");

  await prisma.deck.delete({ where: { id: deckId } });

  revalidatePath("/dashboard");
}

export async function publishDeck(deckId: string) {
  const user = await getAuthUser();

  const deck = await prisma.deck.findUnique({ where: { id: deckId } });
  if (!deck || deck.ownerId !== user.id) throw new Error("Deck not found or unauthorized");

  await prisma.card.updateMany({
    where: { deckId },
    data: { isDraft: false },
  });

  const cardCount = await prisma.card.count({ where: { deckId, isDraft: false } });

  const updated = await prisma.deck.update({
    where: { id: deckId },
    data: { cardCount },
  });

  revalidatePath(`/decks/${deckId}`);
  revalidatePath("/dashboard");
  return updated;
}

export async function getDeckWithCards(deckId: string) {
  const user = await getAuthUser();

  const deck = await prisma.deck.findUnique({
    where: { id: deckId },
    include: {
      cards: {
        orderBy: { position: "asc" },
      },
    },
  });

  if (!deck || deck.ownerId !== user.id) throw new Error("Deck not found or unauthorized");

  return deck;
}
