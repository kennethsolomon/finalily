"use server";

import { getAuthUser } from "@/lib/auth";

interface ExportCard {
  id: string;
  type: string;
  prompt: string;
  answer: string;
  explanation: string | null;
  options: unknown;
  cloze_text: string | null;
  position: number;
}

export async function exportDeck(deckId: string, format: "json" | "csv") {
  const { supabase, user } = await getAuthUser();

  const { data: deck, error: deckError } = await supabase
    .from("decks")
    .select("id, title, subject, description, source_type")
    .eq("id", deckId)
    .eq("owner_id", user.id)
    .single();
  if (deckError || !deck) throw new Error("Deck not found or unauthorized");

  const { data: cards, error: cardsError } = await supabase
    .from("cards")
    .select("id, type, prompt, answer, explanation, options, cloze_text, position")
    .eq("deck_id", deckId)
    .eq("is_draft", false)
    .order("position", { ascending: true });
  if (cardsError) throw new Error(cardsError.message);

  const cardList = (cards ?? []) as ExportCard[];

  if (format === "json") {
    const exportData = {
      deck: {
        title: deck.title,
        subject: deck.subject,
        description: deck.description,
      },
      cards: cardList.map((c) => ({
        type: c.type,
        prompt: c.prompt,
        answer: c.answer,
        explanation: c.explanation,
        options: c.options,
        cloze_text: c.cloze_text,
      })),
      exportedAt: new Date().toISOString(),
      cardCount: cardList.length,
    };
    return {
      content: JSON.stringify(exportData, null, 2),
      filename: `${deck.title.replace(/[^a-zA-Z0-9]/g, "_")}.json`,
      mimeType: "application/json",
    };
  }

  // CSV format
  const escapeCSV = (val: string | null) => {
    if (!val) return "";
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const header = "Type,Prompt,Answer";
  const rows = cardList.map(
    (c) => `${escapeCSV(c.type)},${escapeCSV(c.prompt)},${escapeCSV(c.answer)}`
  );

  return {
    content: [header, ...rows].join("\n"),
    filename: `${deck.title.replace(/[^a-zA-Z0-9]/g, "_")}.csv`,
    mimeType: "text/csv",
  };
}
