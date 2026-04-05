-- Bulk reorder cards in a single UPDATE using UNNEST
CREATE OR REPLACE FUNCTION bulk_reorder_cards(
  p_deck_id UUID,
  p_card_ids UUID[],
  p_positions INT[]
)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE cards
  SET position = data.new_position
  FROM (
    SELECT UNNEST(p_card_ids) AS card_id,
           UNNEST(p_positions) AS new_position
  ) AS data
  WHERE cards.id = data.card_id
    AND cards.deck_id = p_deck_id;
$$;
