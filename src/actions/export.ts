"use server";

import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function exportDeck(deckId: string, format: "json" | "csv") {
  const { user } = await getAuthUser();

  const deck = await prisma.deck.findUnique({
    where: { id: deckId },
    select: { id: true, title: true, subject: true, description: true, sourceType: true, ownerId: true },
  });
  if (!deck || deck.ownerId !== user.id) throw new Error("Deck not found or unauthorized");

  const cards = await prisma.card.findMany({
    where: { deckId, isDraft: false },
    orderBy: { position: "asc" },
    select: { id: true, type: true, prompt: true, answer: true, explanation: true, options: true, clozeText: true, position: true },
  });

  if (format === "json") {
    const exportData = {
      deck: {
        title: deck.title,
        subject: deck.subject,
        description: deck.description,
      },
      cards: cards.map((c) => ({
        type: c.type,
        prompt: c.prompt,
        answer: c.answer,
        explanation: c.explanation,
        options: c.options ? JSON.parse(c.options) : null,
        clozeText: c.clozeText,
      })),
      exportedAt: new Date().toISOString(),
      cardCount: cards.length,
    };
    return {
      content: JSON.stringify(exportData, null, 2),
      filename: `${deck.title.replace(/[^a-zA-Z0-9]/g, "_")}.json`,
      mimeType: "application/json",
    };
  }

  const escapeCSV = (val: string | null) => {
    if (!val) return "";
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const header = "Type,Prompt,Answer";
  const rows = cards.map(
    (c) => `${escapeCSV(c.type)},${escapeCSV(c.prompt)},${escapeCSV(c.answer)}`
  );

  return {
    content: [header, ...rows].join("\n"),
    filename: `${deck.title.replace(/[^a-zA-Z0-9]/g, "_")}.csv`,
    mimeType: "text/csv",
  };
}
