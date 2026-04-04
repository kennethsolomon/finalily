import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { CheckCircle, XCircle, Clock, RotateCcw, ArrowLeft, CalendarDays } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string; sessionId: string }>;
}

export default async function StudyResultsPage({ params }: PageProps) {
  const { id: deckId, sessionId } = await params;

  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect("/auth/login");

  const { data: session } = await supabase
    .from("study_sessions")
    .select(`
      *,
      decks(id, title),
      session_answers(
        id,
        is_correct,
        cards(id, prompt, answer, type)
      )
    `)
    .eq("id", sessionId)
    .single();

  if (!session || session.user_id !== authUser.id) redirect(`/decks/${deckId}`);

  const total = session.total_cards as number;
  const correct = session.correct_count as number;
  const score = total > 0 ? Math.round((correct / total) * 100) : 0;

  const durationSeconds = session.duration_seconds as number ?? 0;
  const mins = Math.floor(durationSeconds / 60);
  const secs = durationSeconds % 60;
  const duration = `${mins}m ${secs}s`;

  const answers = (session.session_answers ?? []) as {
    id: string;
    is_correct: boolean;
    cards: { id: string; prompt: string; answer: string; type: string } | null;
  }[];
  const missedAnswers = answers.filter((a) => !a.is_correct);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStart = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
  const tomorrowEnd = new Date(tomorrowStart.getTime() + 86400000);

  // Get cards for this deck to filter review schedules
  const { data: deckCardIds } = await supabase
    .from("cards")
    .select("id")
    .eq("deck_id", deckId);

  const cardIdList = (deckCardIds ?? []).map((c: { id: string }) => c.id);

  let dueTomorrow = 0;
  if (cardIdList.length > 0) {
    const { count } = await supabase
      .from("review_schedules")
      .select("*", { count: "exact", head: true })
      .eq("user_id", authUser.id)
      .in("card_id", cardIdList)
      .gte("next_review_at", tomorrowStart.toISOString())
      .lt("next_review_at", tomorrowEnd.toISOString());
    dueTomorrow = count ?? 0;
  }

  const scoreColor =
    score >= 80
      ? "text-green-600 dark:text-green-400"
      : score >= 60
      ? "text-orange-500"
      : "text-destructive";

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      {/* Score hero */}
      <div className="rounded-2xl border bg-card p-8 text-center">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
          Session Complete
        </p>
        <p className={cn("text-6xl font-bold mb-1", scoreColor)}>{score}%</p>
        <p className="text-muted-foreground">
          {correct} / {total} correct
        </p>

        <div className="mt-6 flex justify-center gap-8 text-sm">
          <div className="flex flex-col items-center gap-1">
            <Clock className="size-4 text-muted-foreground" />
            <span className="font-medium">{duration}</span>
            <span className="text-xs text-muted-foreground">Time</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <CheckCircle className="size-4 text-green-500" />
            <span className="font-medium">{correct}</span>
            <span className="text-xs text-muted-foreground">Correct</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <XCircle className="size-4 text-destructive" />
            <span className="font-medium">{total - correct}</span>
            <span className="text-xs text-muted-foreground">Missed</span>
          </div>
          {dueTomorrow > 0 && (
            <div className="flex flex-col items-center gap-1">
              <CalendarDays className="size-4 text-blue-500" />
              <span className="font-medium">{dueTomorrow}</span>
              <span className="text-xs text-muted-foreground">Due Tomorrow</span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Link
          href={`/decks/${deckId}`}
          className={cn(buttonVariants({ variant: "outline" }), "flex-1 gap-2")}
        >
          <ArrowLeft className="size-4" />
          Back to Deck
        </Link>
        {missedAnswers.length > 0 && (
          <Link
            href={`/decks/${deckId}/study?mode=quiz&retry=${sessionId}`}
            className={cn(buttonVariants(), "flex-1 gap-2")}
          >
            <RotateCcw className="size-4" />
            Retry Misses
          </Link>
        )}
      </div>

      {/* Missed cards */}
      {missedAnswers.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
            Missed Cards ({missedAnswers.length})
          </h2>
          {missedAnswers.map((a) => (
            <div
              key={a.id}
              className="rounded-xl border border-destructive/20 bg-destructive/5 p-4"
            >
              <p className="text-sm font-medium mb-1">{a.cards?.prompt}</p>
              <p className="text-xs text-muted-foreground">
                Correct answer:{" "}
                <span className="font-semibold text-foreground">{a.cards?.answer}</span>
              </p>
            </div>
          ))}
        </div>
      )}

      {missedAnswers.length === 0 && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-6 text-center">
          <CheckCircle className="size-8 text-green-500 mx-auto mb-2" />
          <p className="font-medium text-green-700 dark:text-green-400">Perfect score!</p>
          <p className="text-sm text-muted-foreground">You answered every card correctly.</p>
        </div>
      )}
    </div>
  );
}
