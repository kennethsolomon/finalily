"use server";

import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { ShareType } from "@/generated/prisma/client";

async function getAuthUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) throw new Error("User not found");

  return dbUser;
}

export async function createShareArtifact(data: {
  deckId: string;
  shareType: "LINK" | "CODE";
}) {
  const user = await getAuthUser();

  const deck = await prisma.deck.findUnique({ where: { id: data.deckId } });
  if (!deck || deck.ownerId !== user.id) throw new Error("Deck not found or unauthorized");

  const code = nanoid(6);

  const artifact = await prisma.shareArtifact.create({
    data: {
      deckId: data.deckId,
      creatorId: user.id,
      shareType: data.shareType as ShareType,
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
  const user = await getAuthUser();

  const artifact = await prisma.shareArtifact.findUnique({
    where: { code },
    include: {
      deck: {
        include: {
          cards: {
            where: { isDraft: false },
            orderBy: { position: "asc" },
          },
        },
      },
    },
  });

  if (!artifact) throw new Error("Share code not found");

  // Deep clone the deck
  const newDeck = await prisma.deck.create({
    data: {
      ownerId: user.id,
      title: artifact.deck.title,
      subject: artifact.deck.subject,
      description: artifact.deck.description,
      sourceType: artifact.deck.sourceType,
      cardCount: artifact.deck.cards.length,
    },
  });

  // Clone non-draft cards
  if (artifact.deck.cards.length > 0) {
    await prisma.card.createMany({
      data: artifact.deck.cards.map((card: typeof artifact.deck.cards[number]) => ({
        deckId: newDeck.id,
        type: card.type,
        prompt: card.prompt,
        answer: card.answer,
        explanation: card.explanation,
        options: card.options ?? undefined,
        clozeText: card.clozeText,
        position: card.position,
        isDraft: false,
      })),
    });
  }

  // Increment import count
  await prisma.shareArtifact.update({
    where: { code },
    data: { importCount: { increment: 1 } },
  });

  revalidatePath("/dashboard");
  return newDeck;
}

export async function getSharePreview(code: string) {
  const artifact = await prisma.shareArtifact.findUnique({
    where: { code },
    include: {
      deck: {
        select: {
          id: true,
          title: true,
          subject: true,
          description: true,
          cardCount: true,
          sourceType: true,
          createdAt: true,
        },
      },
      creator: {
        select: {
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  });

  if (!artifact) throw new Error("Share code not found");

  return {
    deck: artifact.deck,
    creator: artifact.creator,
    shareType: artifact.shareType,
    importCount: artifact.importCount,
    code: artifact.code,
  };
}
