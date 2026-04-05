-- Atomic increment for study session correct count
CREATE OR REPLACE FUNCTION increment_correct_count(session_id UUID)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE study_sessions
  SET correct_count = correct_count + 1
  WHERE id = session_id;
$$;
