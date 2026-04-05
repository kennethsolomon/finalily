"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { startSession, startRetrySession, resumeSession, submitAnswer, completeSession, updateAnswerConfidence } from "@/actions/study";
import { Progress } from "@/components/ui/progress";
import { FlashcardStudy } from "@/components/cards/study/flashcard-study";
import { MCQStudy } from "@/components/cards/study/mcq-study";
import { IdentificationStudy } from "@/components/cards/study/identification-study";
import { TrueFalseStudy } from "@/components/cards/study/true-false-study";
import { ClozeStudy } from "@/components/cards/study/cloze-study";
import { AIAssistant } from "@/components/ai-assistant";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Timer, ChevronLeft, Calendar, AlertTriangle, Layers } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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
  confidence?: number;
}

function useTimer() {
  const [seconds, setSeconds] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  const warnedRef = useRef(false);

  useEffect(() => {
    ref.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, []);

  // 30-minute study warning (one-time)
  useEffect(() => {
    if (seconds >= 1800 && !warnedRef.current) {
      warnedRef.current = true;
      toast.info("You've been studying for 30 minutes. Consider taking a break — spaced practice beats marathon sessions.", {
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

export default function StudyPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const mode = (searchParams.get("mode") ?? "learn") as StudyMode;
  const retrySessionId = searchParams.get("retry");
  const resumeSessionId = searchParams.get("resume");

  const [filter, setFilter] = useState<StudyFilter | null>(searchParams.get("filter") as StudyFilter | null);
  const [usedSavedFilter, setUsedSavedFilter] = useState(false);
  const [loading, setLoading] = useState(!!searchParams.get("filter") || !!retrySessionId || !!resumeSessionId);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [current, setCurrent] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [testAnswers, setTestAnswers] = useState<TestAnswer[]>([]);
  const [finishing, setFinishing] = useState(false);

  const { seconds, formatted, stop } = useTimer();

  // Check for saved filter in localStorage
  const savedFilterKey = `finalily-filter-${params.id}`;
  const getSavedFilter = useCallback((): StudyFilter | null => {
    if (typeof window === "undefined") return null;
    const saved = localStorage.getItem(savedFilterKey);
    if (saved === "due" || saved === "weak" || saved === "all") return saved;
    return null;
  }, [savedFilterKey]);

  const beginSession = useCallback((selectedFilter: StudyFilter) => {
    setFilter(selectedFilter);
    setLoading(true);
    // Save filter choice to localStorage for this deck
    if (typeof window !== "undefined") {
      localStorage.setItem(savedFilterKey, selectedFilter);
    }

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
  }, [params.id, mode, router, savedFilterKey]);

  // Auto-start retry, resume, or saved-filter session
  useEffect(() => {
    if (resumeSessionId) {
      resumeSession(resumeSessionId)
        .then(({ session, cards: c }) => {
          setSessionId(session.id);
          const normalized = (c as Record<string, unknown>[]).map((card) => ({
            ...card,
            clozeText: card.cloze_text ?? card.clozeText ?? null,
          })) as Card[];
          setCards(normalized);
          setFilter("all");
          setLoading(false);
        })
        .catch(() => router.push(`/decks/${params.id}`));
      return;
    }
    if (retrySessionId) {
      startRetrySession({ deckId: params.id, previousSessionId: retrySessionId })
        .then(({ session, cards: c }) => {
          setSessionId(session.id);
          const normalized = (c as Record<string, unknown>[]).map((card) => ({
            ...card,
            clozeText: card.cloze_text ?? card.clozeText ?? null,
          })) as Card[];
          setCards(normalized);
          setFilter("all");
          setLoading(false);
        })
        .catch(() => router.push(`/decks/${params.id}`));
      return;
    }
    if (filter) {
      beginSession(filter);
      return;
    }
    // Auto-start with saved filter if available
    const saved = getSavedFilter();
    if (saved) {
      setUsedSavedFilter(true);
      beginSession(saved);
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
      setSelfCheckDone(false);
      setConfidence(null);
    }
  }, [current, cards.length, sessionId, testAnswers, handleFinish]);

  // Store the card component's actual correctness for LEARN mode rating
  const cardIsCorrect = useRef(false);
  // Self-check step: only for flashcard type in Learn mode
  const [selfCheckDone, setSelfCheckDone] = useState(false);
  // Confidence self-rating (1=guessed, 2=somewhat sure, 3=confident)
  const [confidence, setConfidence] = useState<number | null>(null);

  const handleAnswer = useCallback(async (isCorrect: boolean, userResponse?: string) => {
    if (!sessionId || answered) return;
    setAnswered(true);
    setShowResult(true);
    cardIsCorrect.current = isCorrect;

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
  const [showExitDialog, setShowExitDialog] = useState(false);
  const isSessionActive = !!sessionId && !finishing;

  // Block browser refresh / close / back (hard navigation)
  useEffect(() => {
    if (!isSessionActive) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isSessionActive]);

  const confirmExit = useCallback(() => {
    setShowExitDialog(false);
    router.push(`/decks`);
  }, [router]);

  const handleConfidenceSelect = useCallback((value: number) => {
    setConfidence(value);
    // For quiz mode, update the already-submitted answer
    if (mode === "quiz" && sessionId) {
      updateAnswerConfidence({ sessionId, cardId: cards[current].id, confidence: value });
    }
  }, [mode, sessionId, cards, current]);

  const handleRating = useCallback(async (rating: Rating) => {
    if (!sessionId || submittingRating) return;
    setSubmittingRating(true);
    // Use the actual correctness from the card component, not the rating
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
      {/* Exit confirmation dialog */}
      <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exit study session?</DialogTitle>
            <DialogDescription>
              Your progress is saved. You can resume this session later from the deck page.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Continue Studying
            </DialogClose>
            <Button
              onClick={confirmExit}
            >
              Save &amp; Exit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowExitDialog(true)}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          <ChevronLeft className="size-4 mr-1" />
          Exit
        </button>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Timer className="size-4" />
          <span className="font-mono">{formatted}</span>
        </div>
      </div>

      {/* Progress */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span className="capitalize">
            {mode} mode
            {usedSavedFilter && filter && (
              <span className="ml-1 text-muted-foreground/60">
                ({filter})
              </span>
            )}
          </span>
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
          isLearnMode={mode === "learn"}
        />
      </div>

      {/* Confidence self-rating (quiz and learn modes only) */}
      {answered && !finishing && mode !== "test" && (
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

      {/* LEARN mode: self-check step for flashcards (before rating) */}
      {mode === "learn" && answered && !finishing && card.type === "FLASHCARD" && !selfCheckDone && (
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

      {/* LEARN mode rating buttons (shown after self-check for flashcards, immediately for other types) */}
      {mode === "learn" && answered && !finishing && (card.type !== "FLASHCARD" || selfCheckDone) && (
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

      {/* AI Study Assistant drawer */}
      {sessionId && !finishing && (
        <AIAssistant
          deckId={params.id}
          cardContext={card ? `Question: ${card.prompt}` : undefined}
          variant="drawer"
        />
      )}
    </div>
  );
}
