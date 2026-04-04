"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { startSession, submitAnswer, completeSession } from "@/actions/study";
import { Progress } from "@/components/ui/progress";
import { FlashcardStudy } from "@/components/cards/study/flashcard-study";
import { MCQStudy } from "@/components/cards/study/mcq-study";
import { IdentificationStudy } from "@/components/cards/study/identification-study";
import { TrueFalseStudy } from "@/components/cards/study/true-false-study";
import { ClozeStudy } from "@/components/cards/study/cloze-study";
import { cn } from "@/lib/utils";
import { Timer, ChevronLeft, Calendar, AlertTriangle, Layers } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

type StudyMode = "learn" | "quiz" | "test";
type StudyFilter = "due" | "weak" | "all";
type Rating = "again" | "hard" | "good" | "easy";

interface Card {
  id: string;
  type: string;
  prompt: string;
  answer: string;
  explanation?: string | null;
  options?: unknown;
  clozeText?: string | null;
  cloze_text?: string | null;
}

interface TestAnswer {
  cardId: string;
  isCorrect: boolean;
  userResponse?: string;
}

function useTimer() {
  const [seconds, setSeconds] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    ref.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, []);

  const stop = useCallback(() => {
    if (ref.current) clearInterval(ref.current);
  }, []);

  const formatted = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return { seconds, formatted, stop };
}

function CardComponent({ card, onAnswer, showResult }: { card: Card; onAnswer: (c: boolean, userResponse?: string) => void; showResult: boolean }) {
  switch (card.type) {
    case "MCQ": return <MCQStudy card={card} onAnswer={onAnswer} showResult={showResult} />;
    case "IDENTIFICATION": return <IdentificationStudy card={card} onAnswer={onAnswer} showResult={showResult} />;
    case "TRUE_FALSE": return <TrueFalseStudy card={card} onAnswer={onAnswer} showResult={showResult} />;
    case "CLOZE": return <ClozeStudy card={card} onAnswer={onAnswer} showResult={showResult} />;
    default: return <FlashcardStudy card={card} onAnswer={onAnswer} showResult={showResult} />;
  }
}

export default function StudyPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const mode = (searchParams.get("mode") ?? "learn") as StudyMode;

  const [filter, setFilter] = useState<StudyFilter | null>(searchParams.get("filter") as StudyFilter | null);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [current, setCurrent] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [testAnswers, setTestAnswers] = useState<TestAnswer[]>([]);
  const [finishing, setFinishing] = useState(false);

  const { seconds, formatted, stop } = useTimer();

  const beginSession = useCallback((selectedFilter: StudyFilter) => {
    setFilter(selectedFilter);
    setLoading(true);

    const modeMap: Record<StudyMode, "LEARN" | "QUIZ" | "TEST"> = {
      learn: "LEARN",
      quiz: "QUIZ",
      test: "TEST",
    };

    startSession({ deckId: params.id, mode: modeMap[mode], filter: selectedFilter })
      .then(({ session, cards: c }) => {
        setSessionId(session.id);
        // Normalize snake_case fields from Supabase to camelCase
        const normalized = (c as Record<string, unknown>[]).map((card) => ({
          ...card,
          clozeText: card.cloze_text ?? card.clozeText ?? null,
        })) as Card[];
        setCards(normalized);
        setLoading(false);
      })
      .catch(() => router.push(`/decks/${params.id}`));
  }, [params.id, mode, router]);

  // Auto-start if filter is provided via URL
  useEffect(() => {
    if (filter) {
      beginSession(filter);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFinish = useCallback(async (sid: string, allAnswers: TestAnswer[]) => {
    stop();
    setFinishing(true);

    if (mode === "test" && allAnswers.length > 0) {
      const results = await Promise.allSettled(
        allAnswers.map((a) =>
          submitAnswer({ sessionId: sid, cardId: a.cardId, isCorrect: a.isCorrect, userResponse: a.userResponse })
        )
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) {
        console.error(`${failed}/${allAnswers.length} answer submissions failed`);
      }
    }

    await completeSession(sid, seconds);
    router.push(`/decks/${params.id}/study/results/${sid}`);
  }, [mode, seconds, stop, params.id, router]);

  const advance = useCallback(() => {
    const nextIndex = current + 1;
    if (nextIndex >= cards.length) {
      if (sessionId) handleFinish(sessionId, testAnswers);
    } else {
      setCurrent(nextIndex);
      setAnswered(false);
      setShowResult(false);
    }
  }, [current, cards.length, sessionId, testAnswers, handleFinish]);

  const handleAnswer = useCallback(async (isCorrect: boolean, userResponse?: string) => {
    if (!sessionId || answered) return;
    setAnswered(true);
    setShowResult(true);

    if (mode === "test") {
      setTestAnswers((prev) => [...prev, { cardId: cards[current].id, isCorrect, userResponse }]);
      setTimeout(advance, 800);
    } else if (mode === "quiz") {
      await submitAnswer({ sessionId, cardId: cards[current].id, isCorrect, userResponse });
      setTimeout(advance, 2000);
    }
    // LEARN: wait for rating
  }, [sessionId, answered, mode, cards, current, advance]);

  const [submittingRating, setSubmittingRating] = useState(false);

  const handleRating = useCallback(async (rating: Rating) => {
    if (!sessionId || submittingRating) return;
    setSubmittingRating(true);
    const isCorrect = rating !== "again";
    await submitAnswer({
      sessionId,
      cardId: cards[current].id,
      isCorrect,
      rating,
    });
    setSubmittingRating(false);
    advance();
  }, [sessionId, cards, current, advance, submittingRating]);

  // Filter selection screen
  if (!filter && !loading && !sessionId) {
    const FILTERS: { value: StudyFilter; label: string; description: string; icon: typeof Calendar }[] = [
      { value: "due", label: "Due Cards", description: "Cards scheduled for review + new cards", icon: Calendar },
      { value: "weak", label: "Weak Cards", description: "Cards you struggle with (low ease factor)", icon: AlertTriangle },
      { value: "all", label: "All Cards", description: "Study every card regardless of schedule", icon: Layers },
    ];

    return (
      <div className="flex flex-col gap-6 max-w-md mx-auto mt-8">
        <div>
          <Link
            href={`/decks/${params.id}`}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-4")}
          >
            <ChevronLeft className="size-4 mr-1" />
            Back to Deck
          </Link>
          <h1 className="text-xl font-bold capitalize">{mode} Mode</h1>
          <p className="text-sm text-muted-foreground mt-1">Choose which cards to study</p>
        </div>
        <div className="flex flex-col gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => beginSession(f.value)}
              className="flex items-center gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <f.icon className="size-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-medium">{f.label}</p>
                <p className="text-xs text-muted-foreground">{f.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Loading session...</p>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-muted-foreground">No cards available for this filter.</p>
        <div className="flex gap-2">
          <button
            onClick={() => { setFilter(null); setSessionId(null); }}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Try Another Filter
          </button>
          <Link
            href={`/decks/${params.id}`}
            className={cn(buttonVariants({ variant: "ghost" }))}
          >
            Back to Deck
          </Link>
        </div>
      </div>
    );
  }

  const card = cards[current];
  const progressValue = Math.round(((current + (answered ? 1 : 0)) / cards.length) * 100);

  const RATINGS: { label: string; value: Rating; className: string }[] = [
    { label: "Again", value: "again", className: "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20" },
    { label: "Hard", value: "hard", className: "border-orange-400/40 bg-orange-400/10 text-orange-600 dark:text-orange-400 hover:bg-orange-400/20" },
    { label: "Good", value: "good", className: "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20" },
    { label: "Easy", value: "easy", className: "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-500/20" },
  ];

  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href={`/decks/${params.id}`}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          <ChevronLeft className="size-4 mr-1" />
          Exit
        </Link>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Timer className="size-4" />
          <span className="font-mono">{formatted}</span>
        </div>
      </div>

      {/* Progress */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span className="capitalize">{mode} mode</span>
          <span>{current + 1} / {cards.length}</span>
        </div>
        <Progress value={progressValue} />
      </div>

      {/* Card */}
      <div className="mt-2">
        <CardComponent
          key={card.id}
          card={card}
          onAnswer={handleAnswer}
          showResult={mode === "test" ? false : showResult}
        />
      </div>

      {/* LEARN mode rating buttons */}
      {mode === "learn" && answered && !finishing && (
        <div className="flex flex-col gap-2 mt-2">
          <p className="text-xs text-center text-muted-foreground">How well did you know this?</p>
          <div className="grid grid-cols-4 gap-2">
            {RATINGS.map((r) => (
              <button
                key={r.value}
                onClick={() => handleRating(r.value)}
                disabled={submittingRating}
                className={cn(
                  "rounded-xl border py-3 text-sm font-medium transition-colors",
                  r.className,
                  submittingRating && "opacity-50 pointer-events-none"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* QUIZ mode: next button shows while waiting */}
      {mode === "quiz" && answered && !finishing && (
        <p className="text-center text-sm text-muted-foreground">Advancing automatically...</p>
      )}
    </div>
  );
}
