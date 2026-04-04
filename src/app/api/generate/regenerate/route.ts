import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getOpenRouterClient, AI_MODEL } from "@/lib/openrouter";
type CardType = "FLASHCARD" | "MCQ" | "IDENTIFICATION" | "TRUE_FALSE" | "CLOZE";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { cardId: string; sourceChunkId?: string; newType?: CardType };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { cardId, newType } = body;

  if (!cardId) {
    return NextResponse.json({ error: "cardId is required" }, { status: 400 });
  }

  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: { deck: { select: { ownerId: true, title: true, subject: true } } },
  });

  if (!card || card.deck.ownerId !== user.id) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  const targetType = newType ?? card.type;
  const deckContext = `${card.deck.subject}: ${card.deck.title}`;

  const prompt =
    `Regenerate a single study card of type "${targetType}" based on the same topic as this card:\n` +
    `Original prompt: ${card.prompt}\n` +
    `Deck context: ${deckContext}\n\n` +
    `Return a single JSON object with fields: type, prompt, answer, explanation` +
    (targetType === "MCQ" ? ", options (array of 4 strings)" : "") +
    (targetType === "CLOZE" ? ", clozeText (sentence with ___ blank)" : "") +
    `. Return ONLY the JSON object.`;

  try {
    const completion = await getOpenRouterClient().chat.completions.create({
      model: AI_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are a study card generator. Return only valid JSON, no extra text.",
        },
        { role: "user", content: prompt },
      ],
    });

    const rawText = completion.choices[0]?.message?.content ?? "";
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Failed to parse AI response" },
        { status: 500 }
      );
    }

    const parsed: {
      type?: string;
      prompt?: string;
      answer?: string;
      explanation?: string;
      options?: string[];
      clozeText?: string;
    } = JSON.parse(jsonMatch[0]);

    const updated = await prisma.card.update({
      where: { id: cardId },
      data: {
        type: targetType,
        prompt: parsed.prompt ?? card.prompt,
        answer: parsed.answer ?? card.answer,
        explanation: parsed.explanation ?? card.explanation,
        options: parsed.options ? (parsed.options as unknown as object) : undefined,
        clozeText: parsed.clozeText ?? card.clozeText,
        isDraft: true,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof Error && err.message.includes("429")) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again later." },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: "Failed to regenerate card" },
      { status: 500 }
    );
  }
}
