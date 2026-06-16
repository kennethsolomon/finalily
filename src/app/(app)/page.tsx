import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button-variants";
import { Progress } from "@/components/ui/progress";
import { Mascot, type MascotExpression } from "@/components/mascot";
import { Flame, BookOpen, PlusCircle, Target, Brain, AlertCircle, Zap, Shuffle } from "lucide-react";
import { cn } from "@/lib/utils";

export default async function DashboardPage() {
  const user = await getSessionUser();

  if (!user) redirect("/auth/login");

  const prefs = JSON.parse(user.preferences || "{}") as Record<string, unknown>;
  if (!prefs?.subjects) redirect("/onboarding");

  const now = new Date();
  const ws = new Date();
  ws.setDate(ws.getDate() - ws.getDay());
  ws.setHours(0, 0, 0, 0);
  const weekStart = ws;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [dueCards, recentSession, weekSessions, totalDecks, weakCards, mistakeCount] = await Promise.all([
    prisma.reviewSchedule.count({
      where: { userId: user.id, nextReviewAt: { lte: now } },
    }),
    prisma.studySession.findFirst({
      where: { userId: user.id, completedAt: { not: null } },
      orderBy: { completedAt: "desc" },
      include: { deck: { select: { id: true, title: true } } },
    }),
    prisma.studySession.count({
      where: { userId: user.id, completedAt: { not: null }, createdAt: { gte: weekStart } },
    }),
    prisma.deck.count({
      where: { ownerId: user.id },
    }),
    prisma.reviewSchedule.count({
      where: { userId: user.id, easeFactor: { lt: 2.0 } },
    }),
    prisma.sessionAnswer.count({
      where: {
        isCorrect: false,
        createdAt: { gte: sevenDaysAgo },
        session: { userId: user.id },
      },
    }),
  ]);

  const recentDeck = recentSession?.deck ?? null;

  const goalProgress = Math.min(
    100,
    Math.round((weekSessions / (user.weeklyGoal ?? 5)) * 100)
  );

  const streak = user.streakCount ?? 0;
  const due = dueCards ?? 0;
  let mascotExpression: MascotExpression = "happy";
  if (due === 0 && totalDecks === 0) mascotExpression = "sleeping";
  else if (due === 0) mascotExpression = "smug";
  else if (streak >= 7) mascotExpression = "surprised";
  else if (due > 20) mascotExpression = "sad";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Mascot expression={mascotExpression} size={56} className="shrink-0" />
          <div>
            <h1 className="text-2xl font-bold">Welcome back, {user.displayName || "Student"}</h1>
            <p className="text-muted-foreground">
              {due > 0 ? `You have ${due} cards to review` : "You're all caught up!"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-500" />
          <span className="text-lg font-bold">{streak}</span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {dueCards > 0 && (
          <Card className="border-primary/50 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Due Reviews
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{dueCards}</p>
              <p className="text-xs text-muted-foreground mb-3">cards ready for review</p>
              <div className="flex gap-2">
                <Link href="/quick-study?mode=quick" className={cn(buttonVariants({ size: "sm", variant: "outline" }), "flex-1 gap-1")}>
                  <Zap className="h-3.5 w-3.5" />
                  Quick 5
                </Link>
                <Link href="/quick-study?mode=all" className={cn(buttonVariants({ size: "sm" }), "flex-1 gap-1")}>
                  <Shuffle className="h-3.5 w-3.5" />
                  Study All
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {recentSession && recentDeck && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Continue Studying</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{recentDeck.title}</p>
              <p className="text-xs text-muted-foreground mb-3">
                Last studied{" "}
                {recentSession.completedAt
                  ? new Date(recentSession.completedAt).toLocaleDateString()
                  : "recently"}
              </p>
              <Link
                href={`/decks/${recentDeck.id}/study?mode=learn`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full")}
              >
                Continue
              </Link>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4" />
              Weekly Goal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold">{weekSessions}/{user.weeklyGoal ?? 5} sessions</p>
            <Progress value={goalProgress} className="mt-2" />
          </CardContent>
        </Card>

        {weakCards > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Brain className="h-4 w-4" />
                Weak Spots
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-bold">{weakCards} cards</p>
              <p className="text-xs text-muted-foreground mb-3">need extra practice</p>
              <Link href="/decks?focus=weak" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full")}>
                Focus Practice
              </Link>
            </CardContent>
          </Card>
        )}

        {mistakeCount > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Mistake Notebook
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-bold">{mistakeCount}</p>
              <p className="text-xs text-muted-foreground mb-3">mistakes this week</p>
              <Link href="/decks?focus=mistakes" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full")}>
                Review Mistakes
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="text-center">
          <CardContent className="pt-4 pb-3">
            <p className="text-2xl font-bold">{totalDecks}</p>
            <p className="text-xs text-muted-foreground">Decks</p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="pt-4 pb-3">
            <p className="text-2xl font-bold">{streak}</p>
            <p className="text-xs text-muted-foreground">Day Streak</p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="pt-4 pb-3">
            <p className="text-2xl font-bold">{weekSessions}</p>
            <p className="text-xs text-muted-foreground">This Week</p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="pt-4 pb-3">
            <p className="text-2xl font-bold">{due}</p>
            <p className="text-xs text-muted-foreground">Due Today</p>
          </CardContent>
        </Card>
      </div>

      {totalDecks === 0 && (
        <div className="flex flex-wrap gap-3">
          <Link href="/decks/new" className={buttonVariants()}>
            <PlusCircle className="h-4 w-4 mr-2" />
            Create Deck
          </Link>
          <p className="text-sm text-muted-foreground self-center">
            Create your first deck to get started!
          </p>
        </div>
      )}
    </div>
  );
}
