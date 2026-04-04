import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Mascot } from "@/components/mascot";
import { TrendingUp, TrendingDown, Brain, Calendar, BarChart3, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect("/auth/login");

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    { data: recentSessions },
    { data: weakSchedules },
    { count: dueToday },
    { count: dueTomorrow },
    { count: dueThisWeek },
    { data: decksRaw },
  ] = await Promise.all([
    // Last 30 days of completed sessions with answers
    supabase
      .from("study_sessions")
      .select("id, completed_at, correct_count, total_cards, duration_seconds, mode, deck_id, decks(title)")
      .eq("user_id", authUser.id)
      .not("completed_at", "is", null)
      .gte("completed_at", thirtyDaysAgo)
      .order("completed_at", { ascending: true }),
    // Weak cards (low ease factor)
    supabase
      .from("review_schedules")
      .select("card_id, ease_factor, repetitions, cards(prompt, answer, deck_id, decks(title))")
      .eq("user_id", authUser.id)
      .lt("ease_factor", 2.0)
      .order("ease_factor", { ascending: true })
      .limit(20),
    // Due counts
    supabase
      .from("review_schedules")
      .select("*", { count: "exact", head: true })
      .eq("user_id", authUser.id)
      .lte("next_review_at", now.toISOString()),
    supabase
      .from("review_schedules")
      .select("*", { count: "exact", head: true })
      .eq("user_id", authUser.id)
      .gt("next_review_at", now.toISOString())
      .lte("next_review_at", tomorrow.toISOString()),
    supabase
      .from("review_schedules")
      .select("*", { count: "exact", head: true })
      .eq("user_id", authUser.id)
      .lte("next_review_at", nextWeek.toISOString()),
    // All decks with card counts and session stats
    supabase
      .from("decks")
      .select("id, title, cards(id, is_draft), study_sessions(correct_count, total_cards, completed_at)")
      .eq("owner_id", authUser.id)
      .order("updated_at", { ascending: false }),
  ]);

  const sessions = (recentSessions ?? []).map((s: Record<string, unknown>) => ({
    id: s.id as string,
    completed_at: s.completed_at as string,
    correct_count: s.correct_count as number,
    total_cards: s.total_cards as number,
    duration_seconds: s.duration_seconds as number,
    mode: s.mode as string,
    deck_id: s.deck_id as string,
    deckTitle: ((s.decks as Record<string, unknown> | null)?.title as string) ?? "Unknown",
  }));

  // 30-day accuracy trend (grouped by day)
  const dailyStats = new Map<string, { correct: number; total: number; sessions: number }>();
  for (const s of sessions) {
    const day = new Date(s.completed_at).toLocaleDateString("en-CA"); // YYYY-MM-DD
    const prev = dailyStats.get(day) ?? { correct: 0, total: 0, sessions: 0 };
    dailyStats.set(day, {
      correct: prev.correct + s.correct_count,
      total: prev.total + s.total_cards,
      sessions: prev.sessions + 1,
    });
  }

  // Build 30-day array for the chart
  const trendDays: { date: string; accuracy: number | null; sessions: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toLocaleDateString("en-CA");
    const stat = dailyStats.get(key);
    trendDays.push({
      date: key,
      accuracy: stat && stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : null,
      sessions: stat?.sessions ?? 0,
    });
  }

  // Overall stats
  const totalCorrect = sessions.reduce((sum, s) => sum + s.correct_count, 0);
  const totalCards = sessions.reduce((sum, s) => sum + s.total_cards, 0);
  const overallAccuracy = totalCards > 0 ? Math.round((totalCorrect / totalCards) * 100) : 0;
  const totalStudyMinutes = Math.round(sessions.reduce((sum, s) => sum + s.duration_seconds, 0) / 60);

  // Last 7 days vs previous 7 days for trend
  const last7 = sessions.filter((s) => new Date(s.completed_at) >= new Date(now.getTime() - 7 * 86400000));
  const prev7 = sessions.filter((s) => {
    const d = new Date(s.completed_at);
    return d >= new Date(now.getTime() - 14 * 86400000) && d < new Date(now.getTime() - 7 * 86400000);
  });
  const last7Acc = last7.reduce((s, v) => s + v.total_cards, 0) > 0
    ? Math.round((last7.reduce((s, v) => s + v.correct_count, 0) / last7.reduce((s, v) => s + v.total_cards, 0)) * 100)
    : null;
  const prev7Acc = prev7.reduce((s, v) => s + v.total_cards, 0) > 0
    ? Math.round((prev7.reduce((s, v) => s + v.correct_count, 0) / prev7.reduce((s, v) => s + v.total_cards, 0)) * 100)
    : null;
  const trend = last7Acc !== null && prev7Acc !== null ? last7Acc - prev7Acc : null;

  // Deck mastery rankings
  const deckStats = (decksRaw ?? []).map((deck: {
    id: string;
    title: string;
    cards: { id: string; is_draft: boolean }[];
    study_sessions: { correct_count: number; total_cards: number; completed_at: string | null }[];
  }) => {
    const completedSessions = (deck.study_sessions ?? []).filter((s) => s.completed_at);
    const correct = completedSessions.reduce((sum, s) => sum + s.correct_count, 0);
    const total = completedSessions.reduce((sum, s) => sum + s.total_cards, 0);
    const cardCount = (deck.cards ?? []).filter((c) => !c.is_draft).length;
    return {
      id: deck.id,
      title: deck.title,
      cardCount,
      mastery: total > 0 ? Math.round((correct / total) * 100) : null,
      sessionCount: completedSessions.length,
    };
  }).sort((a: { mastery: number | null }, b: { mastery: number | null }) =>
    (b.mastery ?? -1) - (a.mastery ?? -1)
  );

  // Weak cards
  const weakCards = (weakSchedules ?? []).map((ws: Record<string, unknown>) => {
    const card = ws.cards as Record<string, unknown> | null;
    const deck = card?.decks as Record<string, unknown> | null;
    return {
      cardId: ws.card_id as string,
      prompt: (card?.prompt as string) ?? "Unknown",
      answer: (card?.answer as string) ?? "",
      deckTitle: (deck?.title as string) ?? "Unknown deck",
      easeFactor: ws.ease_factor as number,
      repetitions: ws.repetitions as number,
    };
  });

  const maxBarHeight = 48; // px
  const maxSessionsInDay = Math.max(...trendDays.map((d) => d.sessions), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">Your learning progress over the last 30 days</p>
        </div>
        <Mascot expression={trend !== null && trend >= 0 ? "smug" : "happy"} size={48} />
      </div>

      {/* Overview cards */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Accuracy</p>
            <p className="text-2xl font-bold">{overallAccuracy}%</p>
            {trend !== null && (
              <p className={cn("text-xs flex items-center gap-1 mt-1", trend >= 0 ? "text-green-600" : "text-red-500")}>
                {trend >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                {trend >= 0 ? "+" : ""}{trend}% vs last week
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Sessions</p>
            <p className="text-2xl font-bold">{sessions.length}</p>
            <p className="text-xs text-muted-foreground mt-1">{totalStudyMinutes} min studied</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Due Today</p>
            <p className="text-2xl font-bold">{dueToday ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">+{dueTomorrow ?? 0} tomorrow</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Due This Week</p>
            <p className="text-2xl font-bold">{dueThisWeek ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">cards to review</p>
          </CardContent>
        </Card>
      </div>

      {/* 30-day activity chart (CSS-only bar chart) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="size-4" />
            30-Day Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-[3px] h-16">
            {trendDays.map((day) => {
              const height = day.sessions > 0
                ? Math.max(4, Math.round((day.sessions / maxSessionsInDay) * maxBarHeight))
                : 2;
              const color = day.accuracy !== null
                ? day.accuracy >= 80 ? "bg-green-500" : day.accuracy >= 60 ? "bg-orange-400" : "bg-red-400"
                : "bg-muted";
              return (
                <div
                  key={day.date}
                  className={cn("flex-1 rounded-t-sm transition-all", color)}
                  style={{ height: `${height}px` }}
                  title={`${day.date}: ${day.sessions} sessions${day.accuracy !== null ? `, ${day.accuracy}% accuracy` : ""}`}
                />
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
            <span>{trendDays[0]?.date.slice(5)}</span>
            <span>Today</span>
          </div>
          <div className="flex gap-4 mt-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-green-500" /> 80%+</span>
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-orange-400" /> 60-79%</span>
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-red-400" /> &lt;60%</span>
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-muted" /> No study</span>
          </div>
        </CardContent>
      </Card>

      {/* Deck mastery rankings */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calendar className="size-4" />
            Deck Mastery
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {deckStats.length === 0 ? (
            <p className="text-sm text-muted-foreground">No decks yet. Create one to start tracking.</p>
          ) : (
            deckStats.map((deck: { id: string; title: string; cardCount: number; mastery: number | null; sessionCount: number }) => (
              <Link key={deck.id} href={`/decks/${deck.id}`} className="block">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{deck.title}</p>
                    <p className="text-xs text-muted-foreground">{deck.cardCount} cards &middot; {deck.sessionCount} sessions</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {deck.mastery !== null ? (
                      <>
                        <Progress value={deck.mastery} className="w-20" />
                        <span className={cn(
                          "text-sm font-medium w-10 text-right",
                          deck.mastery >= 80 ? "text-green-600" : deck.mastery >= 60 ? "text-orange-500" : "text-red-500"
                        )}>
                          {deck.mastery}%
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not studied</span>
                    )}
                  </div>
                </div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      {/* Weak cards */}
      {weakCards.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="size-4" />
              Weak Cards ({weakCards.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {weakCards.slice(0, 10).map((card: { cardId: string; prompt: string; deckTitle: string; easeFactor: number }) => (
              <div key={card.cardId} className="flex items-start justify-between gap-3 py-1.5 border-b border-border/50 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{card.prompt}</p>
                  <p className="text-xs text-muted-foreground">{card.deckTitle}</p>
                </div>
                <span className="text-xs text-red-500 shrink-0">
                  EF {card.easeFactor.toFixed(1)}
                </span>
              </div>
            ))}
            {weakCards.length > 10 && (
              <p className="text-xs text-muted-foreground text-center pt-1">
                +{weakCards.length - 10} more weak cards
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {sessions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
          <Mascot expression="sleeping" size={80} />
          <div>
            <h2 className="text-lg font-semibold">No study data yet</h2>
            <p className="text-sm text-muted-foreground">Complete a study session to see your analytics</p>
          </div>
          <Link href="/decks" className={cn(buttonVariants(), "gap-2")}>
            <Brain className="size-4" />
            Start Studying
          </Link>
        </div>
      )}
    </div>
  );
}
