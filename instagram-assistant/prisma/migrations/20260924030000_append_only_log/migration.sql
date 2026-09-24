-- The activity log is append-only: reject any UPDATE, DELETE or TRUNCATE,
-- whichever database role attempts it.
CREATE OR REPLACE FUNCTION keel_action_log_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ActionLog is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER action_log_no_update_delete
  BEFORE UPDATE OR DELETE ON "ActionLog"
  FOR EACH ROW EXECUTE FUNCTION keel_action_log_immutable();

CREATE TRIGGER action_log_no_truncate
  BEFORE TRUNCATE ON "ActionLog"
  FOR EACH STATEMENT EXECUTE FUNCTION keel_action_log_immutable();
