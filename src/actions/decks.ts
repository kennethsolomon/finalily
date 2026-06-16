"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function createDeck(data: {
  title: string;
  subject: string;
  description?: string;
  sourceType: "TOPIC" | "PDF" | "MANUAL";
}) {
  const { user } = await getAuthUser();

  const deck = await prisma.deck.create({
    data: {
      ownerId: user.id,
      title: data.title,
      subject: data.subject,
      description: data.description ?? null,
      sourceType: data.sourceType,
    },
  });

  revalidatePath("/");
  return deck;
}

export async function updateDeck(
  deckId: string,
  data: { title?: string; subject?: string; description?: string }
) {
  const { user } = await getAuthUser();

  const existing = await prisma.deck.findUnique({ where: { id: deckId } });
  if (!existing || existing.ownerId !== user.id)
    throw new Error("Deck not found or unauthorized");

  const updatePayload: { title?: string; subject?: string; description?: string } = {};
  if (data.title !== undefined) updatePayload.title = data.title;
  if (data.subject !== undefined) updatePayload.subject = data.subject;
  if (data.description !== undefined) updatePayload.description = data.description;

  const updated = await prisma.deck.update({
    where: { id: deckId },
    data: updatePayload,
  });

  revalidatePath(`/decks/${deckId}`);
  revalidatePath("/");
  return updated;
}

export async function deleteDeck(deckId: string) {
  const { user } = await getAuthUser();

  const existing = await prisma.deck.findUnique({ where: { id: deckId } });
  if (!existing || existing.ownerId !== user.id)
    throw new Error("Deck not found or unauthorized");

  await prisma.deck.delete({ where: { id: deckId } });

  revalidatePath("/");
  return { success: true };
}

export async function publishDeck(deckId: string) {
  const { user } = await getAuthUser();

  const existing = await prisma.deck.findUnique({ where: { id: deckId } });
  if (!existing || existing.ownerId !== user.id)
    throw new Error("Deck not found or unauthorized");

  await prisma.card.updateMany({
    where: { deckId },
    data: { isDraft: false },
  });

  const count = await prisma.card.count({
    where: { deckId, isDraft: false },
  });

  const updated = await prisma.deck.update({
    where: { id: deckId },
    data: { cardCount: count },
  });

  revalidatePath(`/decks/${deckId}`);
  revalidatePath("/");
  return updated;
}

export async function getDeckWithCards(deckId: string) {
  const { user } = await getAuthUser();

  const deck = await prisma.deck.findUnique({
    where: { id: deckId },
    include: { cards: { orderBy: { position: "asc" } } },
  });

  if (!deck || deck.ownerId !== user.id)
    throw new Error("Deck not found or unauthorized");

  return deck;
}
