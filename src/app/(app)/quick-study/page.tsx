"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { startQuickReview, startStudyAllDue, submitAnswer, completeSession, updateAnswerConfidence } from "@/actions/study";
import { Progress } from "@/components/ui/progress";
import { FlashcardStudy } from "@/components/cards/study/flashcard-study";
import { MCQStudy } from "@/components/cards/study/mcq-study";
import { IdentificationStudy } from "@/components/cards/study/identification-study";
import { TrueFalseStudy } from "@/components/cards/study/true-false-study";
import { ClozeStudy } from "@/components/cards/study/cloze-study";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Timer, ChevronLeft, Zap, Shuffle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

interface Card {
  id: string;
  type: string;
  prompt: string;
  answer: string;
  explanation?: string | null;
  options?: unknown;
  clozeText?: string | null;
  cloze_text?: string | null;
  deck_id: string;
}

type Rating = "again" | "hard" | "good" | "easy";

function useTimer() {
  const [seconds, setSeconds] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  const warnedRef = useRef(false);

  useEffect(() => {
    ref.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, []);

  useEffect(() => {
    if (seconds >= 1800 && !warnedRef.current) {
      warnedRef.current = true;
      toast.info("You've been studying for 30 minutes. Consider taking a break.", {
        duration: 8000,
      });
    }
  }, [seconds]);

  const stop = useCallback(() => {
    if (ref.current) clearInterval(ref.current);
  }, []);

  const formatted = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return { seconds, formatted, stop };
}

function CardComponent({ card, onAnswer, showResult, isLearnMode }: { card: Card; onAnswer: (c: boolean, userResponse?: string) => void; showResult: boolean; isLearnMode?: boolean }) {
  switch (card.type) {
    case "MCQ": return <MCQStudy card={card} onAnswer={onAnswer} showResult={showResult} />;
    case "IDENTIFICATION": return <IdentificationStudy card={card} onAnswer={onAnswer} showResult={showResult} />;
    case "TRUE_FALSE": return <TrueFalseStudy card={card} onAnswer={onAnswer} showResult={showResult} />;
    case "CLOZE": return <ClozeStudy card={card} onAnswer={onAnswer} showResult={showResult} />;
    default: return <FlashcardStudy card={card} onAnswer={onAnswer} showResult={showResult} hideAnswerButtons={isLearnMode} />;
  }
}

export default function QuickStudyPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const studyMode = searchParams.get("mode") ?? "quick"; // "quick" or "all"
  const isLearnMode = studyMode === "all";

  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [deckId, setDeckId] = useState<string | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [current, setCurrent] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [selfCheckDone, setSelfCheckDone] = useState(false);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [submittingRating, setSubmittingRating] = useState(false);

  const { seconds, formatted, stop } = useTimer();
  const cardIsCorrect = useRef(false);

  useEffect(() => {
    const start = async () => {
      try {
        const fn = studyMode === "all" ? startStudyAllDue : startQuickReview;
        const result = await fn();
        if (!result.session || result.cards.length === 0) {
          toast.info("No cards due for review right now!");
          router.push("/");
          return;
        }
        setSessionId(result.session.id);
        setDeckId(result.deckId);
        const normalized = (result.cards as Record<string, unknown>[]).map((card) => ({
          ...card,
          clozeText: card.cloze_text ?? card.clozeText ?? null,
        })) as Card[];
        setCards(normalized);
        setLoading(false);
      } catch {
        router.push("/");
      }
    };
    start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFinish = useCallback(async (sid: string) => {
    stop();
    setFinishing(true);
    await completeSession(sid, seconds);
    if (deckId) {
      router.push(`/decks/${deckId}/study/results/${sid}`);
    } else {
      router.push("/");
    }
  }, [seconds, stop, router, deckId]);

  const advance = useCallback(() => {
    const nextIndex = current + 1;
    if (nextIndex >= cards.length) {
      if (sessionId) handleFinish(sessionId);
    } else {
      setCurrent(nextIndex);
      setAnswered(false);
      setShowResult(false);
      setSelfCheckDone(false);
      setConfidence(null);
    }
  }, [current, cards.length, sessionId, handleFinish]);

  const handleAnswer = useCallback(async (isCorrect: boolean, userResponse?: string) => {
    if (!sessionId || answered) return;
    setAnswered(true);
    setShowResult(true);
    cardIsCorrect.current = isCorrect;

    if (!isLearnMode) {
      // Quiz-like mode for quick review
      await submitAnswer({ sessionId, cardId: cards[current].id, isCorrect, userResponse });
      setTimeout(advance, 2000);
    }
    // Learn mode: wait for rating
  }, [sessionId, answered, isLearnMode, cards, current, advance]);

  const handleConfidenceSelect = useCallback((value: number) => {
    setConfidence(value);
    if (!isLearnMode && sessionId) {
      updateAnswerConfidence({ sessionId, cardId: cards[current].id, confidence: value });
    }
  }, [isLearnMode, sessionId, cards, current]);

  const handleRating = useCallback(async (rating: Rating) => {
    if (!sessionId || submittingRating) return;
    setSubmittingRating(true);
    await submitAnswer({
      sessionId,
      cardId: cards[current].id,
      isCorrect: cardIsCorrect.current,
      rating,
      confidence: confidence ?? undefined,
    });
    setSubmittingRating(false);
    advance();
  }, [sessionId, cards, current, advance, submittingRating, confidence]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Loading {studyMode === "all" ? "due cards" : "quick review"}...</p>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-muted-foreground">No cards due for review.</p>
        <a href="/" className={cn(buttonVariants({ variant: "outline" }))}>Back to Dashboard</a>
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
        <a href="/" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          <ChevronLeft className="size-4 mr-1" />
          Exit
        </a>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {studyMode === "all" ? (
            <Shuffle className="size-4" />
          ) : (
            <Zap className="size-4" />
          )}
          <span className="font-medium">
            {studyMode === "all" ? "Study All Due" : "Quick Review"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Timer className="size-4" />
          <span className="font-mono">{formatted}</span>
        </div>
      </div>

      {/* Progress */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Mixed decks</span>
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
          showResult={showResult}
          isLearnMode={isLearnMode}
        />
      </div>

      {/* Confidence self-rating */}
      {answered && !finishing && (
        <div className="flex items-center justify-center gap-2 mt-1">
          <span className="text-xs text-muted-foreground mr-1">Confidence:</span>
          {([
            { value: 1, label: "Guessed" },
            { value: 2, label: "Somewhat Sure" },
            { value: 3, label: "Confident" },
          ] as const).map((c) => (
            <button
              key={c.value}
              onClick={() => handleConfidenceSelect(c.value)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-full border transition-colors",
                confidence === c.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {/* Learn mode: self-check step for flashcards */}
      {isLearnMode && answered && !finishing && card.type === "FLASHCARD" && !selfCheckDone && (
        <div className="flex flex-col gap-2 mt-2">
          <p className="text-xs text-center text-muted-foreground">Did you get it right?</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => { cardIsCorrect.current = false; setSelfCheckDone(true); }}
              className="rounded-xl border border-destructive/40 bg-destructive/10 py-3 text-sm font-medium text-destructive hover:bg-destructive/20 transition-colors"
            >
              I got it wrong
            </button>
            <button
              onClick={() => { cardIsCorrect.current = true; setSelfCheckDone(true); }}
              className="rounded-xl border border-green-500/40 bg-green-500/10 py-3 text-sm font-medium text-green-700 dark:text-green-400 hover:bg-green-500/20 transition-colors"
            >
              I got it right
            </button>
          </div>
        </div>
      )}

      {/* Learn mode rating buttons */}
      {isLearnMode && answered && !finishing && (card.type !== "FLASHCARD" || selfCheckDone) && (
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

      {/* Quiz mode auto-advance */}
      {!isLearnMode && answered && !finishing && (
        <p className="text-center text-sm text-muted-foreground">Advancing automatically...</p>
      )}
    </div>
  );
}
