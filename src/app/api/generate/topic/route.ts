import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getOpenRouterClient, AI_MODEL } from "@/lib/openrouter";
type CardType = "FLASHCARD" | "MCQ" | "IDENTIFICATION" | "TRUE_FALSE" | "CLOZE";

const TYPE_DESCRIPTIONS: Record<string, string> = {
  FLASHCARD: "flashcard (question/answer pairs)",
  MCQ: "multiple choice with 4 options",
  IDENTIFICATION: "identification (identify a term from a description)",
  TRUE_FALSE: "true or false statements",
  CLOZE: "fill-in-the-blank sentences",
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    deckId: string;
    topic: string;
    difficulty: string;
    cardCount: number;
    typeMix: string[];
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { deckId, topic, difficulty, cardCount, typeMix } = body;

  if (!deckId || !topic || !cardCount || !typeMix?.length) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const deck = await prisma.deck.findUnique({ where: { id: deckId } });
  if (!deck || deck.ownerId !== user.id) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  const typeDesc = typeMix
    .map((t) => TYPE_DESCRIPTIONS[t] ?? t)
    .join(", ");

  const systemPrompt =
    `You are a study card generator. Generate exactly ${cardCount} study cards about "${topic}" at ${difficulty} difficulty. ` +
    `Generate cards in these types: ${typeDesc}. ` +
    `Return a JSON array. Each element must have: type (one of ${typeMix.join(", ")}), prompt, answer, explanation. ` +
    `MCQ cards must also have options (array of 4 strings). CLOZE cards must also have clozeText (sentence with ___ for the blank). ` +
    `Return ONLY the JSON array, no other text.`;

  try {
    const completion = await getOpenRouterClient().chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Generate ${cardCount} study cards about: ${topic}` },
      ],
      stream: true,
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let fullText = "";

        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content ?? "";
          fullText += delta;
          controller.enqueue(
            encoder.encode(JSON.stringify({ type: "delta", content: delta }) + "\n")
          );
        }

        // Parse and persist cards
        try {
          const jsonMatch = fullText.match(/\[[\s\S]*\]/);
          if (!jsonMatch) throw new Error("No JSON array found in response");

          const parsed: Array<{
            type: string;
            prompt: string;
            answer: string;
            explanation?: string;
            options?: string[];
            clozeText?: string;
          }> = JSON.parse(jsonMatch[0]);

          const lastCard = await prisma.card.findFirst({
            where: { deckId },
            orderBy: { position: "desc" },
            select: { position: true },
          });
          let position = lastCard ? lastCard.position + 1 : 0;

          const createdIds: string[] = [];
          for (const item of parsed) {
            const cardType = typeMix.includes(item.type)
              ? (item.type as CardType)
              : (typeMix[0] as CardType);

            const card = await prisma.card.create({
              data: {
                deckId,
                type: cardType,
                prompt: item.prompt,
                answer: item.answer,
                explanation: item.explanation,
                options: item.options
                  ? (item.options as unknown as object)
                  : undefined,
                clozeText: item.clozeText,
                position: position++,
                isDraft: true,
              },
            });
            createdIds.push(card.id);
          }

          controller.enqueue(
            encoder.encode(
              JSON.stringify({ type: "done", cardIds: createdIds }) + "\n"
            )
          );
        } catch (parseErr) {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: "error",
                error: "Failed to parse AI response",
              }) + "\n"
            )
          );
        }

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("429")) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again later." },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: "Failed to generate cards" },
      { status: 500 }
    );
  }
}
