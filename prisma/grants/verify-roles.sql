-- Verifies the EFFECTIVE privileges of the real logins created for the roles of
-- roles.sql: has_*_privilege follows role membership, PUBLIC and inheritance, so
-- a grant that reached a login another way shows up here, and a second run of
-- roles.sql can be checked the same way. Run as any role that can read the
-- catalogs, after studio-store.sql and erase-subject.sql:
--
--   psql "$ADMIN_DATABASE_URL" -f prisma/grants/verify-roles.sql \
--     -v app_login=cresavo_app_login -v sweeper_login=cresavo_sweeper_login -v support_login=cresavo_support_login \
--     -v outbox_login=cresavo_outbox_login
--
-- Every row is a problem; no rows means the logins can do what they need and
-- nothing the least-privilege design forbids. verify-studio-store.sql checks
-- the audit log for the app login in more detail.
WITH logins(kind, login) AS (VALUES ('app', :'app_login'::text), ('sweeper', :'sweeper_login'::text), ('support', :'support_login'::text),
  ('outbox', :'outbox_login'::text)),
-- Every role a login is or can SET ROLE to (MEMBER, with or without INHERIT): what it can become is what it can do.
reachable AS (
  SELECT l.kind, l.login, r.oid, r.rolname, r.rolsuper, r.rolbypassrls, r.rolcreaterole
  FROM logins l JOIN pg_roles r ON pg_has_role(l.login, r.oid, 'MEMBER')
),
tables AS (
  SELECT c.relname AS tbl FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = current_schema() AND c.relkind IN ('r', 'p')
),
privs(p) AS (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER'))
-- Any login: no power attributes, no ownership, no object creation, no login that is not a plain login.
SELECT l.kind || ': ' || l.login || ' is missing or is superuser/createrole/bypassrls/replication' AS problem
FROM logins l LEFT JOIN pg_roles r ON r.rolname = l.login
WHERE r.oid IS NULL OR r.rolsuper OR r.rolcreaterole OR r.rolbypassrls OR r.rolreplication
UNION ALL
SELECT l.kind || ' owns or can become the owner of ' || c.relname
FROM logins l, pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = current_schema() AND c.relkind IN ('r', 'p') AND pg_has_role(l.login, c.relowner, 'MEMBER')
UNION ALL
SELECT r.kind || ' can become ' || r.rolname || ', which is superuser, createrole or bypasses row-level security'
FROM reachable r WHERE r.rolsuper OR r.rolbypassrls OR r.rolcreaterole
UNION ALL
-- Each login belongs to its own group role only: a second one would join two scopes (row-level security).
SELECT r.kind || ' can become ' || r.rolname || ', a group role that is not its own'
FROM reachable r
WHERE r.rolname IN ('cresavo_app', 'cresavo_eraser', 'cresavo_sweeper', 'cresavo_support', 'cresavo_outbox')
  AND r.rolname <> 'cresavo_' || r.kind
UNION ALL
-- The erase function's definer runs with its own rights: it must not bypass row-level security or own the tables.
SELECT 'erase_subject runs as ' || o.rolname || ', which is superuser, bypasses row-level security or owns ' || c.relname
FROM pg_proc f JOIN pg_namespace fn ON fn.oid = f.pronamespace JOIN pg_roles o ON o.oid = f.proowner,
  pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE fn.nspname = current_schema() AND f.proname = 'erase_subject' AND n.nspname = current_schema()
  AND c.relname IN ('tenant_state', 'tenant_action', 'tenant_idempotency', 'tenant_effect')
  AND (o.rolsuper OR o.rolbypassrls OR pg_has_role(o.oid, c.relowner, 'MEMBER')
    OR EXISTS (SELECT 1 FROM pg_roles x WHERE pg_has_role(o.oid, x.oid, 'MEMBER') AND (x.rolsuper OR x.rolbypassrls)))
UNION ALL
SELECT l.kind || ' can create objects in schema ' || current_schema()
FROM logins l WHERE has_schema_privilege(l.login, current_schema(), 'CREATE')
UNION ALL
SELECT l.kind || ' can ' || p.p || ' ' || t.tbl
FROM logins l, tables t, privs p
WHERE p.p IN ('TRUNCATE', 'REFERENCES', 'TRIGGER') AND has_table_privilege(l.login, quote_ident(t.tbl), p.p)
UNION ALL
-- App: the audit log is append-only; read-only history stays so; unused tables stay closed.
SELECT 'app can ' || p.p || ' ' || t.tbl
FROM logins l, privs p, (VALUES ('tenant_action'), ('BookingEvent'), ('CustomerDataAction'), ('WorkspaceRequest'), ('CapacityDecision'),
  ('AgentApiEvent'), ('AgentAuditEvent'), ('AgentBooking')) AS t(tbl)
WHERE l.kind = 'app' AND p.p IN ('UPDATE', 'DELETE') AND has_table_privilege(l.login, quote_ident(t.tbl), p.p)
UNION ALL
SELECT 'app can reach ' || t.tbl FROM logins l, (VALUES ('PairToken'), ('CardBookingAttempt'), ('_prisma_migrations')) AS t(tbl)
WHERE l.kind = 'app' AND (has_table_privilege(l.login, quote_ident(t.tbl), 'SELECT') OR has_any_column_privilege(l.login, quote_ident(t.tbl), 'SELECT, INSERT, UPDATE'))
UNION ALL
SELECT 'app cannot ' || t.p || ' ' || t.tbl
FROM logins l, (VALUES ('Booking', 'SELECT'), ('Booking', 'INSERT'), ('Booking', 'UPDATE'), ('tenant_state', 'SELECT'), ('tenant_state', 'UPDATE'),
  ('tenant_action', 'SELECT'), ('tenant_action', 'INSERT'), ('tenant_effect', 'UPDATE'), ('RateLimitBucket', 'DELETE'),
  ('AgentApiKey', 'INSERT'), ('owner_session', 'DELETE'), ('owner_recovery_code', 'SELECT'), ('owner_recovery_code', 'INSERT'),
  ('owner_recovery_code', 'DELETE'), ('owner_mfa_challenge', 'SELECT'), ('owner_mfa_challenge', 'INSERT'), ('owner_mfa_challenge', 'DELETE')) AS t(tbl, p)
WHERE l.kind = 'app' AND NOT has_table_privilege(l.login, quote_ident(t.tbl), t.p)
UNION ALL
-- Recovery codes: the app marks one used and changes nothing else; a challenge is never changed.
SELECT 'app cannot mark a recovery code used' FROM logins l
WHERE l.kind = 'app' AND NOT has_column_privilege(l.login, 'owner_recovery_code', 'used_at', 'UPDATE')
UNION ALL
SELECT 'app can UPDATE ' || c.relname || '.' || a.attname
FROM logins l, pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace JOIN pg_attribute a ON a.attrelid = c.oid
WHERE l.kind = 'app' AND n.nspname = current_schema() AND c.relname IN ('owner_recovery_code', 'owner_mfa_challenge')
  AND a.attnum > 0 AND NOT a.attisdropped AND NOT (c.relname = 'owner_recovery_code' AND a.attname = 'used_at')
  AND has_column_privilege(l.login, c.oid, a.attnum, 'UPDATE')
UNION ALL
SELECT 'app cannot execute erase_subject' FROM logins l
WHERE l.kind = 'app' AND to_regprocedure('erase_subject(text, text)') IS NOT NULL AND NOT has_function_privilege(l.login, 'erase_subject(text, text)', 'EXECUTE')
UNION ALL
-- Sweeper: no document, replay result or fingerprint; only the five tables it works on; no erase_subject.
SELECT 'sweeper can read ' || c.tbl || '.' || c.col
FROM logins l, (VALUES ('tenant_state', 'doc'), ('tenant_state', 'version'), ('tenant_idempotency', 'result'), ('tenant_idempotency', 'fingerprint_hmac'),
  ('tenant_effect', 'fingerprint'), ('tenant_effect', 'id'), ('tenant_action', 'actor'), ('owner_account', 'password_hash'), ('owner_account', 'email'),
  ('owner_account', 'totp_secret_enc'), ('owner_account', 'totp_pending_enc'), ('owner_session', 'id'), ('owner_recovery_code', 'code_hash')) AS c(tbl, col)
WHERE l.kind = 'sweeper' AND has_column_privilege(l.login, quote_ident(c.tbl), c.col, 'SELECT')
UNION ALL
SELECT 'sweeper can touch ' || t.tbl
FROM logins l, tables t
WHERE l.kind = 'sweeper' AND t.tbl NOT IN ('tenant_state', 'tenant_action', 'tenant_idempotency', 'tenant_effect', 'RateLimitBucket')
  AND has_any_column_privilege(l.login, quote_ident(t.tbl), 'SELECT, INSERT, UPDATE, REFERENCES')
UNION ALL
SELECT 'sweeper cannot ' || t.p || ' ' || t.tbl
FROM logins l, (VALUES ('tenant_state', 'DELETE'), ('tenant_action', 'DELETE'), ('tenant_effect', 'DELETE'), ('tenant_idempotency', 'DELETE'),
  ('RateLimitBucket', 'DELETE')) AS t(tbl, p)
WHERE l.kind = 'sweeper' AND NOT has_table_privilege(l.login, quote_ident(t.tbl), t.p)
UNION ALL
SELECT 'sweeper or support can execute erase_subject' FROM logins l
WHERE l.kind IN ('sweeper', 'support') AND to_regprocedure('erase_subject(text, text)') IS NOT NULL
  AND has_function_privilege(l.login, 'erase_subject(text, text)', 'EXECUTE')
UNION ALL
-- Outbox: claims and acknowledges effects and reads a salon's document; nothing else.
SELECT 'outbox can ' || p.p || ' ' || t.tbl
FROM logins l, privs p, (VALUES ('tenant_state'), ('tenant_effect')) AS t(tbl)
WHERE l.kind = 'outbox' AND p.p IN ('INSERT', 'DELETE') AND has_table_privilege(l.login, quote_ident(t.tbl), p.p)
UNION ALL
SELECT 'outbox can touch ' || t.tbl
FROM logins l, tables t
WHERE l.kind = 'outbox' AND t.tbl NOT IN ('tenant_state', 'tenant_effect')
  AND has_any_column_privilege(l.login, quote_ident(t.tbl), 'SELECT, INSERT, UPDATE, REFERENCES')
UNION ALL
SELECT 'outbox can ' || c.p || ' ' || c.tbl || '.' || c.col
FROM logins l, (VALUES ('tenant_effect', 'fingerprint', 'SELECT'), ('tenant_effect', 'tenant_id', 'UPDATE'), ('tenant_effect', 'id', 'UPDATE'),
  ('tenant_effect', 'kind', 'UPDATE'), ('tenant_effect', 'erased_at', 'UPDATE'), ('tenant_state', 'doc', 'UPDATE'),
  ('tenant_state', 'version', 'SELECT')) AS c(tbl, col, p)
WHERE l.kind = 'outbox' AND has_column_privilege(l.login, quote_ident(c.tbl), c.col, c.p)
UNION ALL
SELECT 'outbox cannot ' || c.p || ' ' || c.tbl || '.' || c.col
FROM logins l, (VALUES ('tenant_effect', 'payload', 'UPDATE'), ('tenant_effect', 'status', 'UPDATE'), ('tenant_effect', 'attempts', 'UPDATE'),
  ('tenant_state', 'doc', 'SELECT'), ('tenant_state', 'kind', 'SELECT')) AS c(tbl, col, p)
WHERE l.kind = 'outbox' AND NOT has_column_privilege(l.login, quote_ident(c.tbl), c.col, c.p)
UNION ALL
SELECT 'outbox can execute erase_subject' FROM logins l
WHERE l.kind = 'outbox' AND to_regprocedure('erase_subject(text, text)') IS NOT NULL
  AND has_function_privilege(l.login, 'erase_subject(text, text)', 'EXECUTE')
UNION ALL
-- Support: read only, and only the diagnostic columns.
SELECT 'support can ' || p.p || ' ' || t.tbl
FROM logins l, tables t, privs p
WHERE l.kind = 'support' AND p.p IN ('INSERT', 'UPDATE', 'DELETE') AND (has_table_privilege(l.login, quote_ident(t.tbl), p.p) OR (p.p IN ('INSERT', 'UPDATE') AND has_any_column_privilege(l.login, quote_ident(t.tbl), p.p)))
UNION ALL
SELECT 'support can read ' || c.tbl || '.' || c.col
FROM logins l, (VALUES ('tenant_state', 'doc'), ('tenant_action', 'action'), ('tenant_action', 'idempotency_key'), ('tenant_effect', 'payload'),
  ('tenant_effect', 'fingerprint'), ('tenant_idempotency', 'result'), ('tenant_idempotency', 'key'), ('owner_account', 'password_hash'),
  ('owner_account', 'email'), ('owner_account', 'totp_secret_enc'), ('owner_account', 'totp_pending_enc'), ('owner_session', 'id'),
  ('owner_recovery_code', 'code_hash'), ('_prisma_migrations', 'logs'), ('_prisma_migrations', 'checksum')) AS c(tbl, col)
WHERE l.kind = 'support' AND has_column_privilege(l.login, quote_ident(c.tbl), c.col, 'SELECT')
UNION ALL
SELECT 'support can read ' || t.tbl FROM logins l, (VALUES ('Customer'), ('Booking'), ('Service'), ('Staff'), ('AdminUser'), ('PairGrantToken'),
  ('owner_mfa_challenge')) AS t(tbl)
WHERE l.kind = 'support' AND has_any_column_privilege(l.login, quote_ident(t.tbl), 'SELECT')
UNION ALL
-- The function and its helpers: only the app executes erase_subject; PUBLIC executes none of them.
SELECT 'PUBLIC can execute ' || p.proname
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = current_schema() AND p.proname IN ('erase_subject', 'studio_phone_digits', 'studio_redact_path', 'studio_scrub_text', 'studio_scrub',
  'studio_redact_replay', 'studio_redact_replay_action') AND has_function_privilege('public', p.oid, 'EXECUTE');
