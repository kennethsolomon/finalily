"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { toast } from "sonner";
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
    try {
      const newDeck = await importSharedDeck(code);
      toast.success("Deck imported!");
      router.push("/decks/" + newDeck.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Import failed";
      if (msg === "Unauthorized") {
        router.push("/auth/login?next=/share/" + code);
        return;
      }
      toast.error(msg);
      setError(msg);
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
