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
import { Timer, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

type StudyMode = "learn" | "quiz" | "test";
type Rating = "again" | "hard" | "good" | "easy";

interface Card {
  id: string;
  type: string;
  prompt: string;
  answer: string;
  explanation?: string | null;
  options?: unknown;
  clozeText?: string | null;
}

interface TestAnswer {
  cardId: string;
  isCorrect: boolean;
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

function CardComponent({ card, onAnswer, showResult }: { card: Card; onAnswer: (c: boolean) => void; showResult: boolean }) {
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

  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [current, setCurrent] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [testAnswers, setTestAnswers] = useState<TestAnswer[]>([]);
  const [finishing, setFinishing] = useState(false);

  const { seconds, formatted, stop } = useTimer();

  useEffect(() => {
    const modeMap: Record<StudyMode, "LEARN" | "QUIZ" | "TEST"> = {
      learn: "LEARN",
      quiz: "QUIZ",
      test: "TEST",
    };

    startSession({ deckId: params.id, mode: modeMap[mode] })
      .then(({ session, cards: c }) => {
        setSessionId(session.id);
        setCards(c as Card[]);
        setLoading(false);
      })
      .catch(() => router.push(`/decks/${params.id}`));
  }, [params.id, mode, router]);

  const handleFinish = useCallback(async (sid: string, allAnswers: TestAnswer[]) => {
    stop();
    setFinishing(true);

    if (mode === "test" && allAnswers.length > 0) {
      await Promise.all(
        allAnswers.map((a) =>
          submitAnswer({ sessionId: sid, cardId: a.cardId, isCorrect: a.isCorrect })
        )
      );
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

  const handleAnswer = useCallback(async (isCorrect: boolean) => {
    if (!sessionId || answered) return;
    setAnswered(true);
    setShowResult(true);

    if (mode === "test") {
      setTestAnswers((prev) => [...prev, { cardId: cards[current].id, isCorrect }]);
      setTimeout(advance, 800);
    } else if (mode === "quiz") {
      await submitAnswer({ sessionId, cardId: cards[current].id, isCorrect });
      setTimeout(advance, 2000);
    }
    // LEARN: wait for rating
  }, [sessionId, answered, mode, cards, current, advance]);

  const handleRating = useCallback(async (rating: Rating) => {
    if (!sessionId) return;
    const isCorrect = rating !== "again";
    await submitAnswer({
      sessionId,
      cardId: cards[current].id,
      isCorrect,
      rating,
    });
    advance();
  }, [sessionId, cards, current, advance]);

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
        <p className="text-muted-foreground">No cards available for this mode.</p>
        <Link
          href={`/decks/${params.id}`}
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Back to Deck
        </Link>
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
                className={cn(
                  "rounded-xl border py-3 text-sm font-medium transition-colors",
                  r.className
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
