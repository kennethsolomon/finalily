import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { generateReviewerDocx } from "@/lib/docx-export";

export async function GET(req: NextRequest) {
  const deckId = req.nextUrl.searchParams.get("deckId");
  if (!deckId) {
    return new Response(JSON.stringify({ error: "deckId is required" }), {
      status: 400,
    });
  }

  const user = await getSessionUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  const deck = await prisma.deck.findFirst({
    where: { id: deckId, ownerId: user.id },
    select: { id: true, title: true, subject: true, description: true },
  });

  if (!deck) {
    return new Response(JSON.stringify({ error: "Deck not found" }), {
      status: 404,
    });
  }

  const cards = await prisma.card.findMany({
    where: { deckId, isDraft: false },
    select: {
      type: true,
      prompt: true,
      answer: true,
      explanation: true,
      options: true,
      clozeText: true,
      position: true,
    },
    orderBy: { position: "asc" },
  });

  const cardList = cards.map((c) => ({
    type: c.type,
    prompt: c.prompt,
    answer: c.answer,
    explanation: c.explanation ?? null,
    options: c.options ? (JSON.parse(c.options) as string[]) : null,
    cloze_text: c.clozeText ?? null,
    position: c.position,
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
