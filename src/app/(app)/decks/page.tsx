import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { Separator } from "@/components/ui/separator";
import { Mascot } from "@/components/mascot";
import { PlusCircle } from "lucide-react";
import { DecksClientWrapper } from "./_components/decks-client-wrapper";

export default async function DecksPage() {
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

      const mastery =
        lastSession && lastSession.total_cards > 0
          ? Math.round((lastSession.correct_count / lastSession.total_cards) * 100)
          : null;

      return {
        id: deck.id,
        title: deck.title,
        subject: deck.subject,
        cardCount: publishedCount,
        draftCount,
        updatedAt: deck.updated_at,
        lastStudied: lastSession?.completed_at ?? null,
        mastery,
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
        <DecksClientWrapper decks={deckData} subjects={subjects} />
      )}
    </div>
  );
}
