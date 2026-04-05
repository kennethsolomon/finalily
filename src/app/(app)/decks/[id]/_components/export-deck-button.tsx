"use client";

import { useState } from "react";
import { exportDeck } from "@/actions/export";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export function ExportDeckButton({ deckId }: { deckId: string }) {
  const [exporting, setExporting] = useState(false);

  async function handleExport(format: "json" | "csv" | "pdf" | "docx") {
    setExporting(true);
    try {
      if (format === "pdf" || format === "docx") {
        const res = await fetch(`/api/export/${format}?deckId=${deckId}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `${format.toUpperCase()} export failed`);
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? `reviewer.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`Exported as ${format.toUpperCase()} reviewer`);
        return;
      }
      const result = await exportDeck(deckId, format);
      // Trigger browser download
      const blob = new Blob([result.content], { type: result.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to export deck";
      toast.error(msg);
    } finally {
      setExporting(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="sm" disabled={exporting} className="gap-2" />}
      >
        {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        Export
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport("json")}>
          Export as JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("csv")}>
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("pdf")}>
          Export as PDF Reviewer
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("docx")}>
          Export as Word Document
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
