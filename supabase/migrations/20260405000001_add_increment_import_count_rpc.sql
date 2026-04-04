-- Atomic increment for share artifact import count
CREATE OR REPLACE FUNCTION increment_import_count(artifact_code TEXT)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE share_artifacts
  SET import_count = import_count + 1
  WHERE code = artifact_code;
$$;
