import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Mascot } from "@/components/mascot";
import { TrendingUp, TrendingDown, Brain, Calendar, BarChart3, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export default async function AnalyticsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    recentSessionsRaw,
    weakSchedulesRaw,
    dueToday,
    dueTomorrow,
    dueThisWeek,
    decksRaw,
  ] = await Promise.all([
    prisma.studySession.findMany({
      where: { userId: user.id, completedAt: { not: null, gte: thirtyDaysAgo } },
      include: { deck: { select: { title: true } } },
      orderBy: { completedAt: "asc" },
    }),
    prisma.reviewSchedule.findMany({
      where: { userId: user.id, easeFactor: { lt: 2.0 } },
      include: { card: { include: { deck: { select: { title: true } } } } },
      orderBy: { easeFactor: "asc" },
      take: 20,
    }),
    prisma.reviewSchedule.count({
      where: { userId: user.id, nextReviewAt: { lte: now } },
    }),
    prisma.reviewSchedule.count({
      where: { userId: user.id, nextReviewAt: { gt: now, lte: tomorrow } },
    }),
    prisma.reviewSchedule.count({
      where: { userId: user.id, nextReviewAt: { lte: nextWeek } },
    }),
    prisma.deck.findMany({
      where: { ownerId: user.id },
      include: {
        cards: { select: { isDraft: true } },
        studySessions: { select: { correctCount: true, totalCards: true, completedAt: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const sessions = recentSessionsRaw.map((s) => ({
    id: s.id,
    completedAt: s.completedAt!.toISOString(),
    correctCount: s.correctCount,
    totalCards: s.totalCards,
    durationSeconds: s.durationSeconds,
    mode: s.mode,
    deckId: s.deckId,
    deckTitle: s.deck?.title ?? "Unknown",
  }));

  const dailyStats = new Map<string, { correct: number; total: number; sessions: number }>();
  for (const s of sessions) {
    const day = new Date(s.completedAt).toLocaleDateString("en-CA");
    const prev = dailyStats.get(day) ?? { correct: 0, total: 0, sessions: 0 };
    dailyStats.set(day, {
      correct: prev.correct + s.correctCount,
      total: prev.total + s.totalCards,
      sessions: prev.sessions + 1,
    });
  }

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

  const totalCorrect = sessions.reduce((sum, s) => sum + s.correctCount, 0);
  const totalCards = sessions.reduce((sum, s) => sum + s.totalCards, 0);
  const overallAccuracy = totalCards > 0 ? Math.round((totalCorrect / totalCards) * 100) : 0;
  const totalStudyMinutes = Math.round(sessions.reduce((sum, s) => sum + s.durationSeconds, 0) / 60);

  const last7 = sessions.filter((s) => new Date(s.completedAt) >= new Date(now.getTime() - 7 * 86400000));
  const prev7 = sessions.filter((s) => {
    const d = new Date(s.completedAt);
    return d >= new Date(now.getTime() - 14 * 86400000) && d < new Date(now.getTime() - 7 * 86400000);
  });
  const last7Acc = last7.reduce((s, v) => s + v.totalCards, 0) > 0
    ? Math.round((last7.reduce((s, v) => s + v.correctCount, 0) / last7.reduce((s, v) => s + v.totalCards, 0)) * 100)
    : null;
  const prev7Acc = prev7.reduce((s, v) => s + v.totalCards, 0) > 0
    ? Math.round((prev7.reduce((s, v) => s + v.correctCount, 0) / prev7.reduce((s, v) => s + v.totalCards, 0)) * 100)
    : null;
  const trend = last7Acc !== null && prev7Acc !== null ? last7Acc - prev7Acc : null;

  const deckStats = decksRaw.map((deck) => {
    const completedSessions = deck.studySessions.filter((s) => s.completedAt !== null);
    const correct = completedSessions.reduce((sum, s) => sum + s.correctCount, 0);
    const total = completedSessions.reduce((sum, s) => sum + s.totalCards, 0);
    const cardCount = deck.cards.filter((c) => !c.isDraft).length;
    return {
      id: deck.id,
      title: deck.title,
      cardCount,
      mastery: total > 0 ? Math.round((correct / total) * 100) : null,
      sessionCount: completedSessions.length,
    };
  }).sort((a, b) => (b.mastery ?? -1) - (a.mastery ?? -1));

  const weakCards = weakSchedulesRaw.map((ws) => ({
    cardId: ws.cardId,
    prompt: ws.card?.prompt ?? "Unknown",
    answer: ws.card?.answer ?? "",
    deckTitle: ws.card?.deck?.title ?? "Unknown deck",
    easeFactor: ws.easeFactor,
    repetitions: ws.repetitions,
  }));

  const maxBarHeight = 48;
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
            <p className="text-2xl font-bold">{dueToday}</p>
            <p className="text-xs text-muted-foreground mt-1">+{dueTomorrow} tomorrow</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Due This Week</p>
            <p className="text-2xl font-bold">{dueThisWeek}</p>
            <p className="text-xs text-muted-foreground mt-1">cards to review</p>
          </CardContent>
        </Card>
      </div>

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
            deckStats.map((deck) => (
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

      {weakCards.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="size-4" />
              Weak Cards ({weakCards.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {weakCards.slice(0, 10).map((card) => (
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
