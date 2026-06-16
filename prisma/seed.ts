import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";
import path from "path";

const dbPath = path.join(process.cwd(), "dev.db");
const adapter = new PrismaBetterSqlite3({ url: dbPath });
const prisma = new PrismaClient({ adapter }) as unknown as PrismaClient;

async function main() {
  const hashedPassword = await bcrypt.hash("demo123", 12);

  const demo = await prisma.user.upsert({
    where: { email: "demo@finalily.app" },
    update: {},
    create: {
      email: "demo@finalily.app",
      password: hashedPassword,
      displayName: "Demo User",
      preferences: JSON.stringify({ subjects: ["General"], onboardingCompleted: true }),
    },
  });

  console.log("Seeded demo user:", demo.email);

  const existingDeck = await prisma.deck.findFirst({
    where: { ownerId: demo.id, title: "Study Basics" },
  });

  if (existingDeck) {
    console.log("Demo deck already exists, skipping card seed.");
    return;
  }

  const deck = await prisma.deck.create({
    data: {
      ownerId: demo.id,
      title: "Study Basics",
      subject: "Learning Science",
      description: "Essential concepts for effective studying",
      sourceType: "MANUAL",
      cardCount: 5,
      isShared: false,
    },
  });

  const cards = [
    {
      type: "FLASHCARD",
      prompt: "What is spaced repetition?",
      answer: "A learning technique that involves reviewing material at increasing intervals over time to improve long-term retention.",
      explanation: "Spaced repetition exploits the psychological spacing effect — we remember things better when reviews are spread out.",
      position: 0,
    },
    {
      type: "FLASHCARD",
      prompt: "What is active recall?",
      answer: "A study technique where you actively stimulate memory retrieval during learning rather than passively reviewing material.",
      explanation: "Active recall is more effective than re-reading because it strengthens the neural pathways associated with a memory.",
      position: 1,
    },
    {
      type: "TRUE_FALSE",
      prompt: "Highlighting text is one of the most effective study techniques.",
      answer: "False",
      explanation: "Research shows highlighting/underlining has low effectiveness. Active recall, spaced repetition, and practice testing are far more effective.",
      position: 2,
    },
    {
      type: "MCQ",
      prompt: "Which study technique has the highest effectiveness according to cognitive science research?",
      answer: "Practice testing with spaced repetition",
      explanation: "Practice testing (retrieval practice) combined with spaced repetition is consistently ranked as the most effective learning strategy.",
      options: JSON.stringify(["Re-reading notes multiple times", "Highlighting key passages", "Practice testing with spaced repetition", "Summarizing chapters"]),
      position: 3,
    },
    {
      type: "IDENTIFICATION",
      prompt: "Describe the learning principle where reviewing material just before you are about to forget it produces the strongest memory consolidation.",
      answer: "The spacing effect (or optimal forgetting)",
      explanation: "Reviewing material at the edge of forgetting — the spacing effect — forces stronger retrieval effort, which consolidates memory more effectively.",
      position: 4,
    },
  ];

  await prisma.card.createMany({
    data: cards.map((c) => ({
      deckId: deck.id,
      ...c,
      options: c.options ?? null,
      isDraft: false,
    })),
  });

  console.log("Seeded deck and 5 sample cards.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
