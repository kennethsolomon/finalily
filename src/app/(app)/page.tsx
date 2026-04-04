import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Flame, BookOpen, PlusCircle, Target, Brain, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) redirect("/auth/login");

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
  });

  if (!user) redirect("/auth/login");

  const prefs = user.preferences as Record<string, unknown>;
  if (!prefs?.subjects) redirect("/onboarding");

  const [dueCards, recentSession, weekSessions, totalDecks, weakCards, mistakeCount] =
    await Promise.all([
      prisma.reviewSchedule.count({
        where: { userId: user.id, nextReviewAt: { lte: new Date() } },
      }),
      prisma.studySession.findFirst({
        where: { userId: user.id, completedAt: { not: null } },
        orderBy: { completedAt: "desc" },
        include: { deck: { select: { id: true, title: true } } },
      }),
      prisma.studySession.count({
        where: {
          userId: user.id,
          completedAt: { not: null },
          createdAt: {
            gte: new Date(new Date().setDate(new Date().getDate() - new Date().getDay())),
          },
        },
      }),
      prisma.deck.count({ where: { ownerId: user.id } }),
      prisma.reviewSchedule.count({
        where: { userId: user.id, easeFactor: { lt: 2.0 } },
      }),
      prisma.sessionAnswer.count({
        where: {
          isCorrect: false,
          session: { userId: user.id },
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

  const goalProgress = Math.min(100, Math.round((weekSessions / user.weeklyGoal) * 100));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="FinaLily" width={40} height={40} className="rounded-lg md:hidden" />
          <div>
            <h1 className="text-2xl font-bold">Welcome back, {user.displayName || "Student"}</h1>
            <p className="text-muted-foreground">
              {dueCards > 0 ? `You have ${dueCards} cards to review` : "You're all caught up!"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-500" />
          <span className="text-lg font-bold">{user.streakCount}</span>
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
              <Link href="/decks" className={cn(buttonVariants({ size: "sm" }), "w-full")}>
                Start Review
              </Link>
            </CardContent>
          </Card>
        )}

        {recentSession && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Continue Studying</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{recentSession.deck.title}</p>
              <p className="text-xs text-muted-foreground mb-3">
                Last studied{" "}
                {recentSession.completedAt
                  ? new Date(recentSession.completedAt).toLocaleDateString()
                  : "recently"}
              </p>
              <Link
                href={`/decks/${recentSession.deck.id}/study?mode=learn`}
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
            <p className="text-lg font-bold">{weekSessions}/{user.weeklyGoal} sessions</p>
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

      <div className="flex flex-wrap gap-3">
        <Link href="/decks/new" className={buttonVariants()}>
          <PlusCircle className="h-4 w-4 mr-2" />
          Create Deck
        </Link>
        {totalDecks === 0 && (
          <p className="text-sm text-muted-foreground self-center">
            Create your first deck to get started!
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="text-center">
          <p className="text-2xl font-bold">{totalDecks}</p>
          <p className="text-xs text-muted-foreground">Decks</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold">{user.streakCount}</p>
          <p className="text-xs text-muted-foreground">Day Streak</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold">{weekSessions}</p>
          <p className="text-xs text-muted-foreground">This Week</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold">{dueCards}</p>
          <p className="text-xs text-muted-foreground">Due Today</p>
        </div>
      </div>
    </div>
  );
}
