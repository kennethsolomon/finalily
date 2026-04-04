"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { importSharedDeck } from "@/actions/share";
import { Download } from "lucide-react";

interface ImportButtonProps {
  code: string;
}

export function ImportButton({ code }: ImportButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleImport() {
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push(`/auth/login?next=/share/${code}`);
      return;
    }

    try {
      const newDeck = await importSharedDeck(code);
      router.push(`/decks/${newDeck.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleImport}
        disabled={loading}
        className={cn(buttonVariants({ variant: "default" }), "w-full h-10 gap-2")}
      >
        <Download className="size-4" />
        {loading ? "Importing…" : "Import to My Library"}
      </button>
      {error && <p className="text-sm text-destructive text-center">{error}</p>}
    </div>
  );
}
