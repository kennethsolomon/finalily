"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  const { user } = await getAuthUser();

  const deck = await prisma.deck.findUnique({ where: { id: data.deckId }, select: { ownerId: true } });
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
      type: data.type,
      prompt: data.prompt,
      answer: data.answer,
      explanation: data.explanation ?? null,
      options: data.options !== undefined ? JSON.stringify(data.options) : null,
      clozeText: data.clozeText ?? null,
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
  const { user } = await getAuthUser();

  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: { deck: { select: { ownerId: true } } },
  });
  if (!card || card.deck.ownerId !== user.id) throw new Error("Card not found or unauthorized");

  const updatePayload: Record<string, unknown> = {};
  if (data.type !== undefined) updatePayload.type = data.type;
  if (data.prompt !== undefined) updatePayload.prompt = data.prompt;
  if (data.answer !== undefined) updatePayload.answer = data.answer;
  if (data.explanation !== undefined) updatePayload.explanation = data.explanation;
  if (data.options !== undefined) updatePayload.options = JSON.stringify(data.options);
  if (data.clozeText !== undefined) updatePayload.clozeText = data.clozeText;
  if (data.position !== undefined) updatePayload.position = data.position;

  const updated = await prisma.card.update({ where: { id: cardId }, data: updatePayload });

  revalidatePath(`/decks/${card.deckId}`);
  return updated;
}

export async function deleteCard(cardId: string) {
  const { user } = await getAuthUser();

  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: { deck: { select: { ownerId: true } } },
  });
  if (!card || card.deck.ownerId !== user.id) throw new Error("Card not found or unauthorized");

  await prisma.card.delete({ where: { id: cardId } });

  const count = await prisma.card.count({ where: { deckId: card.deckId, isDraft: false } });
  await prisma.deck.update({ where: { id: card.deckId }, data: { cardCount: count } });

  revalidatePath(`/decks/${card.deckId}`);
}

export async function reorderCards(deckId: string, cardIds: string[]) {
  const { user } = await getAuthUser();

  const deck = await prisma.deck.findUnique({ where: { id: deckId }, select: { ownerId: true } });
  if (!deck || deck.ownerId !== user.id) throw new Error("Deck not found or unauthorized");

  for (let i = 0; i < cardIds.length; i++) {
    await prisma.card.update({ where: { id: cardIds[i], deckId }, data: { position: i } });
  }

  revalidatePath(`/decks/${deckId}`);
}

export async function publishCard(cardId: string) {
  const { user } = await getAuthUser();

  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: { deck: { select: { ownerId: true } } },
  });
  if (!card || card.deck.ownerId !== user.id) throw new Error("Card not found or unauthorized");

  const updated = await prisma.card.update({ where: { id: cardId }, data: { isDraft: false } });

  const count = await prisma.card.count({ where: { deckId: card.deckId, isDraft: false } });
  await prisma.deck.update({ where: { id: card.deckId }, data: { cardCount: count } });

  revalidatePath(`/decks/${card.deckId}`);
  return updated;
}
