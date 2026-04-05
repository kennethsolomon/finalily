import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateReviewerDocx } from "@/lib/docx-export";

export async function GET(req: NextRequest) {
  const deckId = req.nextUrl.searchParams.get("deckId");
  if (!deckId) {
    return new Response(JSON.stringify({ error: "deckId is required" }), {
      status: 400,
    });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  const { data: deck, error: deckError } = await supabase
    .from("decks")
    .select("id, title, subject, description")
    .eq("id", deckId)
    .eq("owner_id", user.id)
    .single();

  if (deckError || !deck) {
    return new Response(JSON.stringify({ error: "Deck not found" }), {
      status: 404,
    });
  }

  const { data: cards, error: cardsError } = await supabase
    .from("cards")
    .select(
      "type, prompt, answer, explanation, options, cloze_text, position"
    )
    .eq("deck_id", deckId)
    .eq("is_draft", false)
    .order("position", { ascending: true });

  if (cardsError) {
    return new Response(
      JSON.stringify({ error: cardsError.message }),
      { status: 500 }
    );
  }

  const cardList = (cards ?? []).map((c) => ({
    type: c.type as string,
    prompt: c.prompt as string,
    answer: c.answer as string,
    explanation: (c.explanation as string | null) ?? null,
    options: c.options as string[] | null,
    cloze_text: (c.cloze_text as string | null) ?? null,
    position: c.position as number,
  }));

  if (cardList.length === 0) {
    return new Response(
      JSON.stringify({ error: "No published cards to export" }),
      { status: 422 }
    );
  }

  const docxBuffer = await generateReviewerDocx(
    {
      title: deck.title,
      subject: deck.subject,
      description: deck.description,
    },
    cardList
  );

  const filename = `${deck.title.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_")}_Reviewer.docx`;

  return new Response(new Uint8Array(docxBuffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
