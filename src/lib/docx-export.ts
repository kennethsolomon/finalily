import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Packer,
  ShadingType,
} from "docx";

interface ExportCard {
  type: string;
  prompt: string;
  answer: string;
  explanation: string | null;
  options: string[] | null;
  cloze_text: string | null;
  position: number;
}

interface DeckInfo {
  title: string;
  subject: string;
  description: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  FLASHCARD: "Flashcard",
  MCQ: "Multiple Choice",
  IDENTIFICATION: "Identification",
  TRUE_FALSE: "True or False",
  CLOZE: "Fill-in-the-Blank",
};

export function formatCardType(type: string): string {
  return TYPE_LABELS[type] ?? type;
}

export function formatClozeText(clozeText: string): string {
  return clozeText.replace(/\{\{[^}]+\}\}/g, "____________");
}

// Shared border + shading for card paragraphs
const SIDE_BORDER = { style: BorderStyle.SINGLE, size: 1, color: "DCDCE1" };
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const CARD_SHADING = { type: ShadingType.SOLID, color: "F5F5F7", fill: "F5F5F7" };

function cardBorders(pos: "first" | "middle" | "last" | "only") {
  return {
    top: pos === "first" || pos === "only" ? SIDE_BORDER : NO_BORDER,
    bottom: pos === "last" || pos === "only" ? SIDE_BORDER : NO_BORDER,
    left: SIDE_BORDER,
    right: SIDE_BORDER,
  };
}

// Plain options object for deferred Paragraph construction
interface ParaOpts {
  spacing?: { before?: number; after?: number };
  indent?: { left?: number; right?: number };
  children: TextRun[];
}

function buildCardParagraphs(card: ExportCard, index: number): Paragraph[] {
  // Collect paragraph options first, then create Paragraphs with borders
  const opts: ParaOpts[] = [];

  // Header
  opts.push({
    spacing: { before: 80, after: 40 },
    indent: { left: 180, right: 180 },
    children: [
      new TextRun({
        text: `#${index + 1}  ${formatCardType(card.type).toUpperCase()}`,
        bold: true,
        size: 18,
        color: "64646E",
        font: "Calibri",
      }),
    ],
  });

  // Prompt
  opts.push({
    spacing: { before: 60, after: 60 },
    indent: { left: 180, right: 180 },
    children: [
      new TextRun({
        text: card.prompt,
        bold: true,
        size: 22,
        color: "1E1E28",
        font: "Calibri",
      }),
    ],
  });

  // Cloze sentence
  if (card.type === "CLOZE" && card.cloze_text) {
    opts.push({
      spacing: { before: 40, after: 40 },
      indent: { left: 180, right: 180 },
      children: [
        new TextRun({
          text: formatClozeText(card.cloze_text),
          italics: true,
          size: 20,
          color: "50505A",
          font: "Calibri",
        }),
      ],
    });
  }

  // MCQ options
  if (card.type === "MCQ" && card.options) {
    const options = Array.isArray(card.options) ? card.options : [];
    const letters = ["A", "B", "C", "D", "E", "F"];
    for (let i = 0; i < options.length; i++) {
      const prefix = letters[i] ?? String(i + 1);
      const isCorrect = options[i] === card.answer;
      opts.push({
        spacing: { before: 20, after: 20 },
        indent: { left: 540, right: 180 },
        children: [
          new TextRun({
            text: `${isCorrect ? "[x]" : "[ ]"}  ${prefix}) ${options[i]}`,
            bold: isCorrect,
            size: 20,
            color: isCorrect ? "16A34A" : "32323C",
            font: "Calibri",
          }),
        ],
      });
    }
  }

  // Answer
  opts.push({
    spacing: { before: 80, after: 40 },
    indent: { left: 180, right: 180 },
    children: [
      new TextRun({
        text: `Answer: ${card.answer}`,
        bold: true,
        size: 20,
        color: "16A34A",
        font: "Calibri",
      }),
    ],
  });

  // Explanation
  if (card.explanation) {
    opts.push({
      spacing: { before: 40, after: 40 },
      indent: { left: 180, right: 180 },
      children: [
        new TextRun({
          text: card.explanation,
          italics: true,
          size: 18,
          color: "64646E",
          font: "Calibri",
        }),
      ],
    });
  }

  // Create Paragraphs with borders + shading applied
  const len = opts.length;
  return opts.map((o, i) => {
    const pos = len === 1 ? "only" : i === 0 ? "first" : i === len - 1 ? "last" : "middle";
    return new Paragraph({
      ...o,
      shading: CARD_SHADING,
      border: cardBorders(pos),
    });
  });
}

/** Generate a reviewer-style .docx from deck data. Returns a Buffer. */
export async function generateReviewerDocx(
  deck: DeckInfo,
  cards: ExportCard[]
): Promise<Buffer> {
  const children: Paragraph[] = [];

  // --- Cover Section ---
  children.push(
    new Paragraph({ spacing: { before: 1200 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: deck.title,
          bold: true,
          size: 56,
          color: "1E1E28",
          font: "Calibri",
        }),
      ],
    })
  );

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200 },
      children: [
        new TextRun({
          text: deck.subject,
          size: 28,
          color: "64646E",
          font: "Calibri",
        }),
      ],
    })
  );

  if (deck.description) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 160 },
        children: [
          new TextRun({
            text: deck.description,
            size: 22,
            color: "64646E",
            font: "Calibri",
          }),
        ],
      })
    );
  }

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200 },
      children: [
        new TextRun({
          text: `${cards.length} cards  |  Study Reviewer`,
          size: 20,
          color: "969696",
          font: "Calibri",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 80 },
      children: [
        new TextRun({
          text: `Exported ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
          size: 20,
          color: "969696",
          font: "Calibri",
        }),
      ],
    })
  );

  // Page break before cards
  children.push(
    new Paragraph({
      pageBreakBefore: true,
      heading: HeadingLevel.HEADING_2,
      children: [
        new TextRun({
          text: "Study Cards",
          bold: true,
          size: 32,
          color: "1E1E28",
          font: "Calibri",
        }),
      ],
    })
  );

  // --- Card Sections ---
  for (let i = 0; i < cards.length; i++) {
    if (i > 0) {
      children.push(new Paragraph({ spacing: { before: 200, after: 0 } }));
    }
    children.push(...buildCardParagraphs(cards[i], i));
  }

  // Footer
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 600 },
      children: [
        new TextRun({
          text: "Generated by FinaLily",
          size: 16,
          color: "B4B4B4",
          font: "Calibri",
        }),
      ],
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
          },
        },
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
