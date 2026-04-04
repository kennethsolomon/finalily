import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button-variants";
import { Progress } from "@/components/ui/progress";
import { Mascot, type MascotExpression } from "@/components/mascot";
import { Flame, BookOpen, PlusCircle, Target, Brain, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) redirect("/auth/login");

  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .single();

  if (!user) redirect("/auth/login");

  const prefs = user.preferences as Record<string, unknown>;
  if (!prefs?.subjects) redirect("/onboarding");

  const now = new Date().toISOString();
  const ws = new Date();
  ws.setDate(ws.getDate() - ws.getDay());
  ws.setHours(0, 0, 0, 0);
  const weekStart = ws.toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const results = await Promise.allSettled([
    supabase
      .from("review_schedules")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .lte("next_review_at", now),
    supabase
      .from("study_sessions")
      .select("id, completed_at, deck_id, decks(id, title)")
      .eq("user_id", user.id)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(1),
    supabase
      .from("study_sessions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .not("completed_at", "is", null)
      .gte("created_at", weekStart),
    supabase
      .from("decks")
      .select("*", { count: "exact", head: true })
      .eq("owner_id", user.id),
    supabase
      .from("review_schedules")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .lt("ease_factor", 2.0),
    supabase
      .from("session_answers")
      .select("id, study_sessions!inner(user_id)", { count: "exact", head: true })
      .eq("is_correct", false)
      .eq("study_sessions.user_id", user.id)
      .gte("created_at", sevenDaysAgo),
  ]);

  const dueCards = results[0].status === "fulfilled" ? results[0].value.count : 0;
  const recentSessionRows = results[1].status === "fulfilled" ? results[1].value.data : null;
  const weekSessions = results[2].status === "fulfilled" ? results[2].value.count : 0;
  const totalDecks = results[3].status === "fulfilled" ? results[3].value.count : 0;
  const weakCards = results[4].status === "fulfilled" ? results[4].value.count : 0;
  const mistakeCount = results[5].status === "fulfilled" ? results[5].value.count : 0;

  const recentSession = recentSessionRows?.[0] ?? null;
  const recentDeck = (recentSession?.decks as unknown as { id: string; title: string }) ?? null;

  const goalProgress = Math.min(
    100,
    Math.round(((weekSessions ?? 0) / (user.weekly_goal ?? 5)) * 100)
  );

  // Contextual mascot expression
  const streak = user.streak_count ?? 0;
  const due = dueCards ?? 0;
  let mascotExpression: MascotExpression = "happy";
  if (due === 0 && (totalDecks ?? 0) === 0) mascotExpression = "sleeping";
  else if (due === 0) mascotExpression = "smug";
  else if (streak >= 7) mascotExpression = "surprised";
  else if (due > 20) mascotExpression = "sad";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Mascot expression={mascotExpression} size={56} className="shrink-0" />
          <div>
            <h1 className="text-2xl font-bold">Welcome back, {user.display_name || "Student"}</h1>
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
        {(dueCards ?? 0) > 0 && (
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

        {recentSession && recentDeck && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Continue Studying</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{recentDeck.title}</p>
              <p className="text-xs text-muted-foreground mb-3">
                Last studied{" "}
                {recentSession.completed_at
                  ? new Date(recentSession.completed_at).toLocaleDateString()
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
            <p className="text-lg font-bold">{weekSessions ?? 0}/{user.weekly_goal ?? 5} sessions</p>
            <Progress value={goalProgress} className="mt-2" />
          </CardContent>
        </Card>

        {(weakCards ?? 0) > 0 && (
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

        {(mistakeCount ?? 0) > 0 && (
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
            <p className="text-2xl font-bold">{totalDecks ?? 0}</p>
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
            <p className="text-2xl font-bold">{weekSessions ?? 0}</p>
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

      {(totalDecks ?? 0) === 0 && (
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
