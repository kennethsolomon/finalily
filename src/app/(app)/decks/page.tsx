import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { Separator } from "@/components/ui/separator";
import { Mascot } from "@/components/mascot";
import { PlusCircle } from "lucide-react";
import { DecksClientWrapper } from "./_components/decks-client-wrapper";

export default async function DecksPage({
  searchParams,
}: {
  searchParams: Promise<{ focus?: string }>;
}) {
  const { focus } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) redirect("/auth/login");

  const { data: decks } = await supabase
    .from("decks")
    .select(`
      id,
      title,
      subject,
      updated_at,
      cards(id, is_draft),
      study_sessions(completed_at, correct_count, total_cards)
    `)
    .eq("owner_id", authUser.id)
    .order("updated_at", { ascending: false });

  const deckList = decks ?? [];

  // Fetch review schedules with card deck_id for mastery calculation
  const allCardIds = deckList.flatMap(
    (d: { cards: { id: string }[] }) => (d.cards ?? []).map((c) => c.id)
  );
  let reviewScheduleMap: Map<string, { ease_factor: number; card_id: string }[]> = new Map();
  let dueCountMap: Map<string, number> = new Map();

  if (allCardIds.length > 0) {
    const now = new Date().toISOString();
    // Fetch review schedules for all user's cards
    const { data: schedules } = await supabase
      .from("review_schedules")
      .select("card_id, ease_factor, next_review_at")
      .eq("user_id", authUser.id)
      .in("card_id", allCardIds);

    // Build a card_id -> deck_id lookup
    const cardToDeck: Record<string, string> = {};
    for (const deck of deckList as { id: string; cards: { id: string }[] }[]) {
      for (const card of deck.cards ?? []) {
        cardToDeck[card.id] = deck.id;
      }
    }

    // Group schedules by deck and count due cards
    for (const s of (schedules ?? []) as { card_id: string; ease_factor: number; next_review_at: string }[]) {
      const deckId = cardToDeck[s.card_id];
      if (!deckId) continue;

      if (!reviewScheduleMap.has(deckId)) reviewScheduleMap.set(deckId, []);
      reviewScheduleMap.get(deckId)!.push({ ease_factor: s.ease_factor, card_id: s.card_id });

      if (s.next_review_at <= now) {
        dueCountMap.set(deckId, (dueCountMap.get(deckId) ?? 0) + 1);
      }
    }
  }

  // Compute focus-filtered deck IDs
  let focusDeckIds: Set<string> | null = null;

  if (focus === "weak") {
    // Get cards with low ease factor
    const { data: weakSchedules } = await supabase
      .from("review_schedules")
      .select("card_id")
      .eq("user_id", authUser.id)
      .lt("ease_factor", 2.0);
    if (weakSchedules && weakSchedules.length > 0) {
      const weakCardIds = weakSchedules.map((r: { card_id: string }) => r.card_id);
      const { data: weakCards } = await supabase
        .from("cards")
        .select("deck_id")
        .in("id", weakCardIds);
      focusDeckIds = new Set((weakCards ?? []).map((c: { deck_id: string }) => c.deck_id));
    } else {
      focusDeckIds = new Set();
    }
  } else if (focus === "mistakes") {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: mistakeAnswers } = await supabase
      .from("session_answers")
      .select("cards!inner(deck_id), study_sessions!inner(user_id)")
      .eq("is_correct", false)
      .eq("study_sessions.user_id", authUser.id)
      .gte("created_at", sevenDaysAgo);
    if (mistakeAnswers && mistakeAnswers.length > 0) {
      focusDeckIds = new Set(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mistakeAnswers as any[])
          .map((a) => {
            const cards = a.cards;
            if (Array.isArray(cards)) return cards[0]?.deck_id;
            return cards?.deck_id;
          })
          .filter(Boolean) as string[]
      );
    } else {
      focusDeckIds = new Set();
    }
  }

  const subjects: string[] = Array.from(
    new Set(deckList.map((d: { subject: string }) => d.subject))
  ).sort() as string[];

  const deckData = deckList.map(
    (deck: {
      id: string;
      title: string;
      subject: string;
      updated_at: string;
      cards: { id: string; is_draft: boolean }[];
      study_sessions: { completed_at: string | null; correct_count: number; total_cards: number }[];
    }) => {
      const publishedCount = (deck.cards ?? []).filter((c) => !c.is_draft).length;
      const draftCount = (deck.cards ?? []).filter((c) => c.is_draft).length;

      const completedSessions = (deck.study_sessions ?? [])
        .filter((s) => s.completed_at !== null)
        .sort(
          (a, b) =>
            new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime()
        );
      const lastSession = completedSessions[0] ?? null;

      // Calculate mastery from average ease factor of review schedules
      // Ease factor range: 1.3 (min) to ~3.5 (high). Map to 0-100%
      // Formula: ((avgEase - 1.3) / (3.0 - 1.3)) * 100, clamped to 0-100
      const deckSchedules = reviewScheduleMap.get(deck.id) ?? [];
      let mastery: number | null = null;
      if (deckSchedules.length > 0) {
        const avgEase = deckSchedules.reduce((sum, s) => sum + s.ease_factor, 0) / deckSchedules.length;
        mastery = Math.round(Math.min(100, Math.max(0, ((avgEase - 1.3) / (3.0 - 1.3)) * 100)));
      }

      const dueCount = dueCountMap.get(deck.id) ?? 0;

      return {
        id: deck.id,
        title: deck.title,
        subject: deck.subject,
        cardCount: publishedCount,
        draftCount,
        updatedAt: deck.updated_at,
        lastStudied: lastSession?.completed_at ?? null,
        mastery,
        dueCount,
      };
    }
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Deck Library</h1>
          <p className="text-muted-foreground">
            {deckList.length} {deckList.length === 1 ? "deck" : "decks"}
          </p>
        </div>
        <Link href="/decks/new" className={buttonVariants()}>
          <PlusCircle className="h-4 w-4 mr-2" />
          New Deck
        </Link>
      </div>

      <Separator />

      {deckList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <Mascot expression="sad" size={96} />
          <div>
            <h2 className="text-xl font-semibold">No decks yet</h2>
            <p className="text-muted-foreground mt-1">
              Lil&apos; Bit is waiting for your first deck!
            </p>
          </div>
          <Link href="/decks/new" className={buttonVariants({ size: "lg" })}>
            <PlusCircle className="h-5 w-5 mr-2" />
            Create your first deck
          </Link>
        </div>
      ) : (
        <DecksClientWrapper
          decks={deckData}
          subjects={subjects}
          focusDeckIds={focusDeckIds ? Array.from(focusDeckIds) : null}
          focusLabel={focus === "weak" ? "Weak Spots" : focus === "mistakes" ? "Recent Mistakes" : null}
        />
      )}
    </div>
  );
}
