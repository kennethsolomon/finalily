import { createAIClient, getAIModel, fetchUserAIConfig, isAIConfigured } from "@/lib/openrouter";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json() as {
    messages: { role: "user" | "assistant"; content: string }[];
    deckId?: string;
    cardContext?: string;
  };

  const { messages, deckId, cardContext } = body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return new Response("Messages required", { status: 400 });
  }

  // Build context from deck cards if deckId is provided
  let deckContext = "";
  if (deckId) {
    const deck = await prisma.deck.findUnique({
      where: { id: deckId, ownerId: user.id },
      select: { title: true, subject: true, description: true },
    });

    if (deck) {
      deckContext += `\nDeck: "${deck.title}" (Subject: ${deck.subject})`;
      if (deck.description) deckContext += `\nDescription: ${deck.description}`;

      // Fetch card content for context (limit to first 30 cards to stay within token limits)
      const cards = await prisma.card.findMany({
        where: { deckId, isDraft: false },
        orderBy: { position: "asc" },
        take: 30,
        select: { type: true, prompt: true, answer: true, explanation: true },
      });

      if (cards.length > 0) {
        deckContext += `\n\nDeck cards (${cards.length} cards):\n`;
        deckContext += cards.map((c, i) =>
          `${i + 1}. [${c.type}] Q: ${c.prompt}\n   A: ${c.answer}${c.explanation ? `\n   Explanation: ${c.explanation}` : ""}`
        ).join("\n");
      }
    }
  }

  const systemPrompt = `You are a helpful study assistant for a flashcard learning app called FinaLily. Your job is to help students understand concepts in their study materials.

Guidelines:
- Go straight to the answer. Do NOT show your thinking process, internal reasoning, or chain-of-thought. Just give the student a clear, direct response.
- Explain concepts clearly using simple language
- Use concrete examples and analogies when possible
- Encourage understanding over memorization
- If the student asks about a specific card, reference the deck content to give accurate answers
- Keep responses concise but thorough
- When explaining wrong answers, be encouraging and constructive
- If you don't know something, say so honestly

${deckContext ? `\n--- Study Context ---${deckContext}\n--- End Context ---` : ""}
${cardContext ? `\nThe student is currently looking at: ${cardContext}` : ""}`;

  try {
    const aiConfig = await fetchUserAIConfig(user.id);
    if (!isAIConfigured(aiConfig)) {
      return new Response("AI service not configured", { status: 503 });
    }
    const client = createAIClient(aiConfig);
    const model = getAIModel(aiConfig);

    const stream = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      ],
      stream: true,
      temperature: 0.7,
      max_tokens: 1000,
    });

    // Convert OpenAI stream to ReadableStream, stripping <think> blocks
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          let insideThink = false;
          for await (const chunk of stream) {
            let content = chunk.choices[0]?.delta?.content;
            if (!content) continue;

            // Strip <think>...</think> blocks streamed token-by-token
            if (insideThink) {
              const endIdx = content.indexOf("</think>");
              if (endIdx === -1) continue; // still inside thinking, skip entirely
              content = content.slice(endIdx + 8);
              insideThink = false;
              if (!content) continue;
            }
            const startIdx = content.indexOf("<think>");
            if (startIdx !== -1) {
              const before = content.slice(0, startIdx);
              const afterTag = content.slice(startIdx + 7);
              const endIdx = afterTag.indexOf("</think>");
              if (endIdx !== -1) {
                content = before + afterTag.slice(endIdx + 8);
              } else {
                content = before;
                insideThink = true;
              }
              if (!content) continue;
            }

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Stream error" })}\n\n`));
          controller.close();
          console.error("AI chat stream error:", err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("AI chat error:", err);
    return new Response("AI service unavailable", { status: 503 });
  }
}
