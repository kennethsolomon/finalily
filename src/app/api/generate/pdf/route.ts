import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
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

  if (file.size > MAX_FILE_SIZE) {
    return new Response(JSON.stringify({ error: "File exceeds 20 MB limit" }), { status: 400 });
  }

  // Validate PDF magic bytes
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (buffer.length < 5 || buffer.subarray(0, 5).toString() !== "%PDF-") {
    return new Response(JSON.stringify({ error: "File must be a valid PDF" }), { status: 400 });
  }

  // Validate deck ownership
  const { data: deck, error: deckError } = await supabase
    .from("decks")
    .select("owner_id")
    .eq("id", deckId)
    .single();

  if (deckError || !deck || deck.owner_id !== user.id) {
    return new Response(JSON.stringify({ error: "Deck not found or unauthorized" }), { status: 403 });
  }

  // Extract text BEFORE uploading to storage
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

  // Upload to storage only after successful extraction
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

  // Chunk text
  const chunks = chunkText(extractedText, CHUNK_WORDS);

  // Create SourceDocument
  const { data: sourceDoc, error: sourceDocError } = await supabase
    .from("source_documents")
    .insert({
      deck_id: deckId,
      filename: file.name,
      mime_type: "application/pdf",
      storage_path: `${user.id}/${filename}`,
      extracted_text: extractedText,
      chunks,
    })
    .select("id")
    .single();

  if (sourceDocError || !sourceDoc) {
    return new Response(
      JSON.stringify({ error: `Failed to create source document: ${sourceDocError?.message}` }),
      { status: 500 }
    );
  }

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

          const validCards: { type: string; prompt: string; answer: string; explanation: string | null }[] = [];

          for (const line of rawLines) {
            try {
              const cardData = JSON.parse(line) as {
                type: string;
                prompt: string;
                answer: string;
                explanation?: string;
              };
              validCards.push({
                type: cardData.type,
                prompt: cardData.prompt,
                answer: cardData.answer,
                explanation: cardData.explanation ?? null,
              });
            } catch {
              // skip malformed card lines
            }
          }

          // Batch insert all valid cards for this chunk
          if (validCards.length > 0) {
            const { error: insertError } = await supabase.from("cards").insert(
              validCards.map((c, idx) => ({
                deck_id: deckId!,
                type: c.type as "FLASHCARD" | "MCQ" | "IDENTIFICATION" | "TRUE_FALSE" | "CLOZE",
                prompt: c.prompt,
                answer: c.answer,
                explanation: c.explanation,
                source_chunk_id: sourceDoc.id,
                position: totalCreated + idx,
                is_draft: true,
              }))
            );
            if (insertError) {
              controller.enqueue(
                encoder.encode(JSON.stringify({ error: `Card insert failed: ${insertError.message}`, chunk: i + 1 }) + "\n")
              );
              continue;
            }
            totalCreated += validCards.length;
          }

          const event = JSON.stringify({
            chunk: i + 1,
            total: chunks.length,
            cardsCreated: validCards.length,
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
