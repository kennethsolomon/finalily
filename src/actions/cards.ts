"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { CardType } from "@/generated/prisma/client";

async function getAuthUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) throw new Error("User not found");

  return dbUser;
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
  const user = await getAuthUser();

  const deck = await prisma.deck.findUnique({ where: { id: data.deckId } });
  if (!deck || deck.ownerId !== user.id) throw new Error("Deck not found or unauthorized");

  const lastCard = await prisma.card.findFirst({
    where: { deckId: data.deckId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const position = lastCard ? lastCard.position + 1 : 0;

  const card = await prisma.card.create({
    data: {
      deckId: data.deckId,
      type: data.type as CardType,
      prompt: data.prompt,
      answer: data.answer,
      explanation: data.explanation,
      options: data.options ? (data.options as object) : undefined,
      clozeText: data.clozeText,
      position,
      isDraft: true,
    },
  });

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
  const user = await getAuthUser();

  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: { deck: true },
  });
  if (!card || card.deck.ownerId !== user.id) throw new Error("Card not found or unauthorized");

  const updated = await prisma.card.update({
    where: { id: cardId },
    data: {
      ...(data.type && { type: data.type as CardType }),
      ...(data.prompt !== undefined && { prompt: data.prompt }),
      ...(data.answer !== undefined && { answer: data.answer }),
      ...(data.explanation !== undefined && { explanation: data.explanation }),
      ...(data.options !== undefined && { options: data.options as object }),
      ...(data.clozeText !== undefined && { clozeText: data.clozeText }),
      ...(data.position !== undefined && { position: data.position }),
    },
  });

  revalidatePath(`/decks/${card.deckId}`);
  return updated;
}

export async function deleteCard(cardId: string) {
  const user = await getAuthUser();

  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: { deck: true },
  });
  if (!card || card.deck.ownerId !== user.id) throw new Error("Card not found or unauthorized");

  await prisma.card.delete({ where: { id: cardId } });

  revalidatePath(`/decks/${card.deckId}`);
}

export async function publishCard(cardId: string) {
  const user = await getAuthUser();

  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: { deck: true },
  });
  if (!card || card.deck.ownerId !== user.id) throw new Error("Card not found or unauthorized");

  const updated = await prisma.card.update({
    where: { id: cardId },
    data: { isDraft: false },
  });

  revalidatePath(`/decks/${card.deckId}`);
  return updated;
}
