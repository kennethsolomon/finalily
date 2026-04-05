import jsPDF from "jspdf";

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

// Layout constants
const PAGE_WIDTH = 210; // A4 mm
const MARGIN = 20;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const LINE_HEIGHT = 5.5;
const CARD_PADDING = 6;
const CARD_GAP = 8;
const INNER_WIDTH = CONTENT_WIDTH - CARD_PADDING * 2;

/** Format a card type enum into a readable label. */
export function formatCardType(type: string): string {
  return TYPE_LABELS[type] ?? type;
}

/** Replace cloze markers like {{answer}} with underscores for review. */
export function formatClozeText(clozeText: string): string {
  return clozeText.replace(/\{\{[^}]+\}\}/g, "____________");
}

/** Split text into lines that fit within maxWidth using the current font. */
function splitLines(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth) as string[];
}

/** Render lines one-by-one starting at y, returning the new y after all lines. */
function renderLines(
  doc: jsPDF,
  lines: string[],
  x: number,
  y: number
): number {
  for (const line of lines) {
    doc.text(line, x, y);
    y += LINE_HEIGHT;
  }
  return y;
}

interface CardSection {
  font: { size: number; style: string };
  color: [number, number, number];
  lines: string[];
  indent?: number; // extra left indent in mm
  spacingAfter?: number; // mm after this section
}

/** Build the sections for a card (font, color, wrapped lines). */
function buildCardSections(doc: jsPDF, card: ExportCard): CardSection[] {
  const sections: CardSection[] = [];

  // Header: #N  TYPE
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  sections.push({
    font: { size: 9, style: "bold" },
    color: [100, 100, 110],
    lines: [`#${card.position + 1}  ${formatCardType(card.type).toUpperCase()}`],
    spacingAfter: 2,
  });

  // Prompt
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  const promptLines = splitLines(doc, card.prompt, INNER_WIDTH);
  sections.push({
    font: { size: 11, style: "bold" },
    color: [30, 30, 40],
    lines: promptLines,
    spacingAfter: 3,
  });

  // Cloze sentence
  if (card.type === "CLOZE" && card.cloze_text) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    const clozeLines = splitLines(doc, formatClozeText(card.cloze_text), INNER_WIDTH);
    sections.push({
      font: { size: 10, style: "italic" },
      color: [80, 80, 90],
      lines: clozeLines,
      spacingAfter: 3,
    });
  }

  // MCQ options
  if (card.type === "MCQ" && card.options) {
    const options = Array.isArray(card.options) ? card.options : [];
    const letters = ["A", "B", "C", "D", "E", "F"];
    for (let i = 0; i < options.length; i++) {
      const prefix = letters[i] ?? String(i + 1);
      const isCorrect = options[i] === card.answer;
      const marker = isCorrect ? "[x]" : "[ ]";
      const optFont = isCorrect ? "bold" : "normal";
      const optColor: [number, number, number] = isCorrect ? [22, 163, 74] : [50, 50, 60];
      doc.setFontSize(10);
      doc.setFont("helvetica", optFont);
      const optLines = splitLines(doc, `${marker}  ${prefix}) ${options[i]}`, INNER_WIDTH - 4);
      sections.push({
        font: { size: 10, style: optFont },
        color: optColor,
        lines: optLines,
        indent: 2,
        spacingAfter: i === options.length - 1 ? 3 : 0,
      });
    }
  }

  // Answer
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  const answerLines = splitLines(doc, `Answer: ${card.answer}`, INNER_WIDTH);
  sections.push({
    font: { size: 10, style: "bold" },
    color: [22, 163, 74],
    lines: answerLines,
    spacingAfter: card.explanation ? 3 : 0,
  });

  // Explanation
  if (card.explanation) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    const explLines = splitLines(doc, card.explanation, INNER_WIDTH);
    sections.push({
      font: { size: 9, style: "italic" },
      color: [100, 100, 110],
      lines: explLines,
    });
  }

  return sections;
}

/** Calculate total card height from sections. */
function calcSectionsHeight(sections: CardSection[]): number {
  let h = CARD_PADDING; // top
  for (const s of sections) {
    h += s.lines.length * LINE_HEIGHT;
    h += s.spacingAfter ?? 0;
  }
  h += CARD_PADDING; // bottom
  return h;
}

/** Add page header with deck title and page number. */
function addPageHeader(doc: jsPDF, title: string) {
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(150, 150, 150);
  doc.text(title, MARGIN, 12);
  const pageNum = `Page ${doc.getNumberOfPages()}`;
  doc.text(pageNum, PAGE_WIDTH - MARGIN - doc.getTextWidth(pageNum), 12);
  doc.setTextColor(0, 0, 0);
}

/** Draw a card from pre-computed sections. Returns y after the card. */
function drawCard(
  doc: jsPDF,
  sections: CardSection[],
  startY: number,
  cardHeight: number
): number {
  const x = MARGIN;
  const innerX = x + CARD_PADDING;

  // Background box
  doc.setFillColor(248, 248, 250);
  doc.setDrawColor(220, 220, 225);
  doc.roundedRect(x, startY, CONTENT_WIDTH, cardHeight, 3, 3, "FD");

  let y = startY + CARD_PADDING + LINE_HEIGHT; // first text baseline

  for (const section of sections) {
    doc.setFontSize(section.font.size);
    doc.setFont("helvetica", section.font.style);
    doc.setTextColor(section.color[0], section.color[1], section.color[2]);
    const sx = innerX + (section.indent ?? 0);
    y = renderLines(doc, section.lines, sx, y);
    y += section.spacingAfter ?? 0;
  }

  return startY + cardHeight;
}

/** Generate a reviewer-style PDF from deck data. Returns an ArrayBuffer. */
export function generateReviewerPdf(
  deck: DeckInfo,
  cards: ExportCard[]
): Uint8Array {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // --- Cover Page ---
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 40);
  const titleLines = splitLines(doc, deck.title, CONTENT_WIDTH);
  const titleStartY = 80;
  for (let i = 0; i < titleLines.length; i++) {
    doc.text(titleLines[i], PAGE_WIDTH / 2, titleStartY + i * 12, { align: "center" });
  }

  let coverY = titleStartY + titleLines.length * 12 + 8;

  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 110);
  doc.text(deck.subject, PAGE_WIDTH / 2, coverY, { align: "center" });
  coverY += 10;

  if (deck.description) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    const descLines = splitLines(doc, deck.description, CONTENT_WIDTH - 20);
    for (let i = 0; i < descLines.length; i++) {
      doc.text(descLines[i], PAGE_WIDTH / 2, coverY + i * 6, { align: "center" });
    }
    coverY += descLines.length * 6 + 6;
  }

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(150, 150, 150);
  doc.text(
    `${cards.length} cards  |  Study Reviewer`,
    PAGE_WIDTH / 2,
    coverY + 4,
    { align: "center" }
  );
  doc.text(
    `Exported ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
    PAGE_WIDTH / 2,
    coverY + 12,
    { align: "center" }
  );

  // Footer on cover
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 180);
  doc.text("Generated by FinaLily", PAGE_WIDTH / 2, 280, { align: "center" });

  // --- Card Pages ---
  doc.addPage();
  addPageHeader(doc, deck.title);
  let y = 22;
  const pageHeight = 297; // A4 height in mm
  const bottomMargin = 15;

  for (let i = 0; i < cards.length; i++) {
    const card = { ...cards[i], position: i };
    // Build sections (sets fonts for accurate measurement)
    const sections = buildCardSections(doc, card);
    const cardHeight = calcSectionsHeight(sections);

    // Page break if needed
    if (y + cardHeight + CARD_GAP > pageHeight - bottomMargin) {
      doc.addPage();
      addPageHeader(doc, deck.title);
      y = 22;
    }

    y = drawCard(doc, sections, y, cardHeight);
    y += CARD_GAP;
  }

  return doc.output("arraybuffer") as unknown as Uint8Array;
}
