/**
 * Supabase join result types.
 * These define the shapes returned by Supabase JS client joins,
 * replacing unsafe `as unknown as` casts throughout the codebase.
 */

export type DeckOwner = { owner_id: string };

export type DeckFull = {
  id: string;
  title: string;
  subject: string;
  description: string | null;
  card_count: number;
  source_type: string;
  created_at: string;
};

export type CardWithDeck = {
  type: string;
  prompt: string;
  answer: string;
  explanation: string | null;
  options: unknown;
  cloze_text: string | null;
  position: number;
  is_draft: boolean;
};

export type ShareDeckJoin = {
  title: string;
  subject: string;
  description: string | null;
  source_type: string;
  cards: CardWithDeck[];
};

export type ShareCreator = {
  display_name: string | null;
  avatar_url: string | null;
};

/**
 * Safely narrow a Supabase join field to the expected type.
 * Returns null if the value is not an object (e.g., Supabase returned an error shape).
 */
export function narrowJoin<T>(value: unknown): T | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as T;
  }
  return null;
}
