"use server";

import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function createShareArtifact(data: {
  deckId: string;
  shareType: "LINK" | "CODE";
}) {
  const { user } = await getAuthUser();

  const deck = await prisma.deck.findUnique({
    where: { id: data.deckId },
    select: { ownerId: true },
  });
  if (!deck || deck.ownerId !== user.id)
    throw new Error("Deck not found or unauthorized");

  const code = nanoid(6);

  const artifact = await prisma.shareArtifact.create({
    data: {
      deckId: data.deckId,
      creatorId: user.id,
      shareType: data.shareType,
      code,
    },
  });

  await prisma.deck.update({
    where: { id: data.deckId },
    data: { isShared: true },
  });

  revalidatePath(`/decks/${data.deckId}`);
  return artifact;
}

export async function importSharedDeck(code: string) {
  const { user } = await getAuthUser();

  const artifact = await prisma.shareArtifact.findUnique({
    where: { code },
    include: { deck: { include: { cards: true } } },
  });
  if (!artifact) throw new Error("Share code not found");

  const { deck } = artifact;
  if (!deck) throw new Error("Deck data not found in share artifact");

  const publishedCards = deck.cards.filter((c) => !c.isDraft);

  const newDeck = await prisma.deck.create({
    data: {
      ownerId: user.id,
      title: deck.title,
      subject: deck.subject,
      description: deck.description,
      sourceType: deck.sourceType,
      cardCount: publishedCards.length,
    },
  });

  if (publishedCards.length > 0) {
    try {
      await prisma.card.createMany({
        data: publishedCards.map((card) => ({
          deckId: newDeck.id,
          type: card.type,
          prompt: card.prompt,
          answer: card.answer,
          explanation: card.explanation,
          options: card.options ?? null,
          clozeText: card.clozeText,
          position: card.position,
          isDraft: false,
        })),
      });
    } catch (err) {
      await prisma.deck.delete({ where: { id: newDeck.id } });
      throw err;
    }
  }

  await prisma.shareArtifact.update({
    where: { code },
    data: { importCount: { increment: 1 } },
  });

  revalidatePath("/");
  return newDeck;
}

export async function deleteShareArtifact(deckId: string) {
  const { user } = await getAuthUser();

  const deck = await prisma.deck.findUnique({
    where: { id: deckId },
    select: { ownerId: true },
  });
  if (!deck || deck.ownerId !== user.id)
    throw new Error("Deck not found or unauthorized");

  await prisma.shareArtifact.deleteMany({ where: { deckId } });

  await prisma.deck.update({
    where: { id: deckId },
    data: { isShared: false },
  });

  revalidatePath(`/decks/${deckId}`);
}

export async function getShareArtifactForDeck(deckId: string) {
  const { user } = await getAuthUser();

  const deck = await prisma.deck.findUnique({
    where: { id: deckId },
    select: { ownerId: true },
  });
  if (!deck || deck.ownerId !== user.id)
    throw new Error("Deck not found or unauthorized");

  const artifact = await prisma.shareArtifact.findFirst({
    where: { deckId },
    select: { code: true, importCount: true, createdAt: true },
  });

  return artifact ?? null;
}

export async function getSharePreview(code: string) {
  const artifact = await prisma.shareArtifact.findUnique({
    where: { code },
    include: {
      deck: true,
      creator: { select: { displayName: true, avatarUrl: true } },
    },
  });

  if (!artifact) throw new Error("Share code not found");

  return {
    deck: artifact.deck,
    creator: artifact.creator ?? { displayName: null, avatarUrl: null },
    shareType: artifact.shareType,
    importCount: artifact.importCount,
    code: artifact.code,
  };
}
