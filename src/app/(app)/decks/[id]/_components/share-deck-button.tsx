"use client";

import { useState } from "react";
import {
  createShareArtifact,
  deleteShareArtifact,
} from "@/actions/share";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Share2,
  Copy,
  Check,
  Loader2,
  Link2Off,
  Users,
} from "lucide-react";
import { toast } from "sonner";

type ShareArtifact = {
  code: string;
  import_count: number;
  created_at: string;
};

export function ShareDeckPanel({
  deckId,
  isShared,
  artifact,
}: {
  deckId: string;
  isShared: boolean;
  artifact: ShareArtifact | null;
}) {
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [currentArtifact, setCurrentArtifact] = useState<ShareArtifact | null>(
    artifact
  );
  const [currentlyShared, setCurrentlyShared] = useState(isShared);

  const shareUrl =
    currentArtifact && typeof window !== "undefined"
      ? `${window.location.origin}/share/${currentArtifact.code}`
      : null;

  async function handleShare() {
    setSharing(true);
    try {
      const result = await createShareArtifact({
        deckId,
        shareType: "LINK",
      });
      setCurrentArtifact({
        code: result.code,
        import_count: result.import_count,
        created_at: result.created_at,
      });
      setCurrentlyShared(true);
      const url = `${window.location.origin}/share/${result.code}`;
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied to clipboard");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to share deck"
      );
    } finally {
      setSharing(false);
    }
  }

  async function handleCopy() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Link copied");
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRevoke() {
    setRevoking(true);
    try {
      await deleteShareArtifact(deckId);
      setCurrentArtifact(null);
      setCurrentlyShared(false);
      setRevokeOpen(false);
      toast.success("Share link revoked");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to revoke share"
      );
    } finally {
      setRevoking(false);
    }
  }

  if (!currentlyShared || !currentArtifact) {
    return (
      <Button
        variant="outline"
        onClick={handleShare}
        disabled={sharing}
        className="gap-2"
      >
        {sharing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Share2 className="h-4 w-4" />
        )}
        Share
      </Button>
    );
  }

  return (
    <>
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Share2 className="h-4 w-4 text-primary" />
            Shared
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            {currentArtifact.import_count}{" "}
            {currentArtifact.import_count === 1 ? "import" : "imports"}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Input
            readOnly
            value={shareUrl ?? ""}
            className="text-xs font-mono h-9"
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5 h-9"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5 h-8 text-xs"
          onClick={() => setRevokeOpen(true)}
        >
          <Link2Off className="h-3.5 w-3.5" />
          Revoke Share
        </Button>
      </div>

      <Dialog open={revokeOpen} onOpenChange={setRevokeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke share link?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Anyone with the existing link will no longer be able to preview or
            import this deck. This cannot be undone.
          </p>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setRevokeOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevoke}
              disabled={revoking}
            >
              {revoking ? "Revoking..." : "Revoke"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
