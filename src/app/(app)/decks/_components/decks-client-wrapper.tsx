"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Clock, BarChart2, BookOpen, Search, FileEdit } from "lucide-react";
import { cn } from "@/lib/utils";

type DeckItem = {
  id: string;
  title: string;
  subject: string;
  cardCount: number;
  draftCount: number;
  updatedAt: string;
  lastStudied: string | null;
  mastery: number | null;
  dueCount: number;
};

export function DecksClientWrapper({
  decks,
  subjects,
  focusDeckIds,
  focusLabel,
}: {
  decks: DeckItem[];
  subjects: string[];
  focusDeckIds?: string[] | null;
  focusLabel?: string | null;
}) {
  const [search, setSearch] = useState("");
  const [activeSubject, setActiveSubject] = useState<string | null>(null);

  const filtered = decks.filter((d) => {
    const matchesSearch =
      search.trim() === "" ||
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.subject.toLowerCase().includes(search.toLowerCase());
    const matchesSubject = !activeSubject || d.subject === activeSubject;
    const matchesFocus = !focusDeckIds || focusDeckIds.includes(d.id);
    return matchesSearch && matchesSubject && matchesFocus;
  });

  return (
    <div className="space-y-4">
      {focusLabel && (
        <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-2">
          <p className="text-sm font-medium">
            Showing: <span className="text-primary">{focusLabel}</span>
            {filtered.length === 0 ? " — no matching decks" : ` — ${filtered.length} deck${filtered.length === 1 ? "" : "s"}`}
          </p>
          <a href="/decks" className="text-xs text-muted-foreground hover:text-foreground underline">
            Clear filter
          </a>
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search decks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {subjects.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveSubject(null)}
            className={cn(
              "text-xs px-3 py-1 rounded-full border transition-colors",
              !activeSubject
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:bg-muted"
            )}
          >
            All
          </button>
          {subjects.map((s) => (
            <button
              key={s}
              onClick={() => setActiveSubject(s === activeSubject ? null : s)}
              className={cn(
                "text-xs px-3 py-1 rounded-full border transition-colors",
                activeSubject === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:bg-muted"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-muted-foreground text-center py-10">
          No decks match your search.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((deck) => (
            <Link key={deck.id} href={`/decks/${deck.id}`}>
              <Card className="hover:border-primary/50 transition-colors h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-snug">
                      {deck.title}
                    </CardTitle>
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {deck.subject}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <BookOpen className="h-3.5 w-3.5" />
                      {deck.cardCount} cards
                    </span>
                    {deck.draftCount > 0 && (
                      <span className="flex items-center gap-1 text-amber-600">
                        <FileEdit className="h-3.5 w-3.5" />
                        {deck.draftCount} draft
                      </span>
                    )}
                  </div>

                  {deck.lastStudied && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Last studied{" "}
                      {new Date(deck.lastStudied).toLocaleDateString()}
                    </div>
                  )}

                  {(deck.mastery !== null || deck.dueCount > 0) && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {deck.mastery !== null && (
                        <span className="flex items-center gap-1">
                          <BarChart2 className="h-3 w-3" />
                          {deck.mastery}% mastery
                        </span>
                      )}
                      {deck.dueCount > 0 && (
                        <span className="text-primary font-medium">
                          {deck.dueCount} due
                        </span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
