import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getOpenRouterClient, AI_MODEL } from "@/lib/openrouter";

export const dynamic = "force-dynamic";

type PdfResult = { text: string; numpages: number };

async function parsePdf(buffer: Buffer): Promise<PdfResult> {
  // Dynamic import to avoid build-time canvas dependency issues
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<PdfResult>;
  return pdfParse(buffer);
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const MAX_PAGES = 50;
const CHUNK_WORDS = 500;

function chunkText(text: string, wordsPerChunk: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    chunks.push(words.slice(i, i + wordsPerChunk).join(" "));
  }
  return chunks;
}

function buildCardPrompt(
  chunk: string,
  difficulty: string,
  cardCount: number,
  typeMix: string
): string {
  return `You are a study card generator. Given the following text, generate exactly ${cardCount} study cards.

Difficulty: ${difficulty}
Card types to use: ${typeMix}

For each card output a JSON object on its own line with this shape:
{"type":"FLASHCARD","prompt":"...","answer":"...","explanation":"..."}

Only output JSON lines. No markdown, no explanation.

Text:
${chunk}`;
}

export async function POST(req: NextRequest) {
  // Auth
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  // Parse multipart
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid multipart form data" }), { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const deckId = formData.get("deckId") as string | null;
  const difficulty = (formData.get("difficulty") as string) || "medium";
  const cardCount = Math.max(1, Math.min(50, Number(formData.get("cardCount")) || 10));
  const typeMix = (formData.get("typeMix") as string) || "FLASHCARD";

  // Validate file
  if (!file || !deckId) {
    return new Response(JSON.stringify({ error: "file and deckId are required" }), { status: 400 });
  }

  if (file.type !== "application/pdf") {
    return new Response(JSON.stringify({ error: "File must be a PDF" }), { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return new Response(JSON.stringify({ error: "File exceeds 20 MB limit" }), { status: 400 });
  }

  // Validate deck ownership
  const deck = await prisma.deck.findUnique({ where: { id: deckId } });
  if (!deck || deck.ownerId !== user.id) {
    return new Response(JSON.stringify({ error: "Deck not found or unauthorized" }), { status: 400 });
  }

  // Upload to Supabase Storage
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  const { error: uploadError } = await supabase.storage
    .from("pdfs")
    .upload(`${user.id}/${filename}`, buffer, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    return new Response(
      JSON.stringify({ error: `Storage upload failed: ${uploadError.message}` }),
      { status: 500 }
    );
  }

  // Extract text
  let parsed: { text: string; numpages: number };
  try {
    parsed = await parsePdf(buffer);
  } catch (e) {
    return new Response(
      JSON.stringify({ error: `PDF parse failed: ${e instanceof Error ? e.message : "unknown"}` }),
      { status: 422 }
    );
  }

  if (parsed.numpages > MAX_PAGES) {
    return new Response(
      JSON.stringify({ error: `PDF exceeds ${MAX_PAGES} page limit` }),
      { status: 422 }
    );
  }

  const extractedText = parsed.text.trim();
  if (!extractedText) {
    return new Response(
      JSON.stringify({ error: "No text could be extracted from this PDF" }),
      { status: 422 }
    );
  }

  // Chunk text
  const chunks = chunkText(extractedText, CHUNK_WORDS);

  // Create SourceDocument
  const sourceDoc = await prisma.sourceDocument.create({
    data: {
      deckId,
      filename: file.name,
      mimeType: "application/pdf",
      storagePath: `${user.id}/${filename}`,
      extractedText,
      chunks,
    },
  });

  // Stream NDJSON response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let totalCreated = 0;

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const prompt = buildCardPrompt(chunk, difficulty, cardCount, typeMix);

        try {
          const completion = await getOpenRouterClient().chat.completions.create({
            model: AI_MODEL,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.4,
          });

          const rawLines = (completion.choices[0]?.message?.content ?? "")
            .split("\n")
            .map((l: string) => l.trim())
            .filter((l: string) => l.startsWith("{"));

          const createdCards: string[] = [];

          for (const line of rawLines) {
            try {
              const parsed = JSON.parse(line) as {
                type: string;
                prompt: string;
                answer: string;
                explanation?: string;
              };

              const card = await prisma.card.create({
                data: {
                  deckId,
                  type: parsed.type as "FLASHCARD" | "MCQ" | "IDENTIFICATION" | "TRUE_FALSE" | "CLOZE",
                  prompt: parsed.prompt,
                  answer: parsed.answer,
                  explanation: parsed.explanation ?? null,
                  sourceChunkId: sourceDoc.id,
                  position: totalCreated,
                  isDraft: true,
                },
              });

              totalCreated++;
              createdCards.push(card.id);
            } catch {
              // skip malformed card lines
            }
          }

          const event = JSON.stringify({
            chunk: i + 1,
            total: chunks.length,
            cardsCreated: createdCards.length,
          });
          controller.enqueue(encoder.encode(event + "\n"));
        } catch (aiError) {
          const msg = aiError instanceof Error ? aiError.message : "AI error";
          if (msg.includes("429") || msg.toLowerCase().includes("rate limit")) {
            controller.enqueue(
              encoder.encode(JSON.stringify({ error: "Rate limit reached", chunk: i + 1 }) + "\n")
            );
            controller.close();
            return;
          }
          controller.enqueue(
            encoder.encode(JSON.stringify({ error: msg, chunk: i + 1 }) + "\n")
          );
        }
      }

      controller.enqueue(
        encoder.encode(
          JSON.stringify({ done: true, totalCards: totalCreated, sourceDocId: sourceDoc.id }) + "\n"
        )
      );
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Transfer-Encoding": "chunked",
    },
  });
}
