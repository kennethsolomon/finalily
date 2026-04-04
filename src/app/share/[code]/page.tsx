import { getSharePreview } from "@/actions/share";
import { ImportButton } from "./_components/import-button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Users, LayersIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface PageProps {
  params: Promise<{ code: string }>;
}

export default async function SharePage({ params }: PageProps) {
  const { code } = await params;

  let preview: Awaited<ReturnType<typeof getSharePreview>> | null = null;
  let notFound = false;

  try {
    preview = await getSharePreview(code);
  } catch {
    notFound = true;
  }

  if (notFound || !preview) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-sm">
          <LayersIcon className="size-12 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-xl font-semibold mb-2">Link not found</h1>
          <p className="text-sm text-muted-foreground">
            This share link is invalid or expired. Ask the creator for a new link.
          </p>
        </div>
      </div>
    );
  }

  const { deck, creator, importCount } = preview;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border bg-card shadow-sm p-6 space-y-6">
          <div>
            <Badge variant="secondary" className="mb-3">
              {deck.subject}
            </Badge>
            <h1 className="text-2xl font-semibold leading-tight">{deck.title}</h1>
            {deck.description && (
              <p className="text-sm text-muted-foreground mt-1">{deck.description}</p>
            )}
          </div>

          <Separator />

          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <BookOpen className="size-5 text-muted-foreground mx-auto mb-1" />
              <p className="text-lg font-semibold">{deck.card_count}</p>
              <p className="text-xs text-muted-foreground">cards</p>
            </div>
            <div>
              <Users className="size-5 text-muted-foreground mx-auto mb-1" />
              <p className="text-lg font-semibold">{importCount}</p>
              <p className="text-xs text-muted-foreground">imports</p>
            </div>
            <div>
              <LayersIcon className="size-5 text-muted-foreground mx-auto mb-1" />
              <p className="text-sm font-medium truncate">
                {creator.display_name ?? "Anonymous"}
              </p>
              <p className="text-xs text-muted-foreground">creator</p>
            </div>
          </div>

          <ImportButton code={code} />
        </div>
      </div>
    </div>
  );
}
