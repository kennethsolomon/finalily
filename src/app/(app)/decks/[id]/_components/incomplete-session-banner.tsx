"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, RotateCcw, Clock } from "lucide-react";
import { abandonSession } from "@/actions/study";

interface IncompleteSessionData {
  sessionId: string;
  mode: "LEARN" | "QUIZ" | "TEST";
  totalCards: number;
  answeredCards: number;
  createdAt: string;
}

const MODE_LABELS: Record<string, string> = {
  LEARN: "Learn",
  QUIZ: "Quiz",
  TEST: "Test",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function IncompleteSessionBanner({
  deckId,
  session,
}: {
  deckId: string;
  session: IncompleteSessionData;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<"continue" | "fresh" | null>(null);

  const handleContinue = () => {
    setLoading("continue");
    router.push(
      `/decks/${deckId}/study?mode=${session.mode.toLowerCase()}&filter=all&resume=${session.sessionId}`
    );
  };

  const handleStartFresh = async () => {
    setLoading("fresh");
    try {
      await abandonSession(session.sessionId);
      router.push(`/decks/${deckId}/study?mode=${session.mode.toLowerCase()}&filter=all`);
    } catch {
      setLoading(null);
    }
  };

  return (
    <Card className="border-blue-500/30 bg-blue-500/5">
      <CardContent className="pt-4">
        <div className="flex items-start gap-3">
          <Clock className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-blue-600 dark:text-blue-400">
              Unfinished study session
            </p>
            <p className="text-sm text-blue-600/80 dark:text-blue-400/80 mt-0.5">
              {MODE_LABELS[session.mode] ?? session.mode} mode — {session.answeredCards}/{session.totalCards} cards completed — started {timeAgo(session.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleStartFresh}
              disabled={loading !== null}
              className="border-blue-500/40 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              {loading === "fresh" ? "Starting..." : "Start Fresh"}
            </Button>
            <Button
              size="sm"
              onClick={handleContinue}
              disabled={loading !== null}
            >
              <Play className="h-3.5 w-3.5 mr-1" />
              {loading === "continue" ? "Resuming..." : "Continue"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
