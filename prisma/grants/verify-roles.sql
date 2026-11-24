-- Verifies the EFFECTIVE privileges of the real logins created for the roles of
-- roles.sql: has_*_privilege and pg_has_role follow role membership, PUBLIC and
-- inheritance, so a grant that reached a login another way shows up here, and a
-- second run of roles.sql can be checked the same way. Run as any role that
-- can read the catalogs, after studio-store.sql and erase-subject.sql:
--
--   psql "$ADMIN_DATABASE_URL" -f prisma/grants/verify-roles.sql \
--     -v app_login=cresavo_app_login -v sweeper_login=cresavo_sweeper_login -v support_login=cresavo_support_login \
--     -v outbox_login=cresavo_outbox_login
--
-- Every row is a problem; no rows means each login can do exactly what the
-- allowlist below says (the grants of roles.sql and studio-store.sql, kept
-- equal by tests/ops-roles.test.ts) and execute exactly its functions, and
-- none can reach a role that sees every row. verify-studio-store.sql checks
-- the audit log for the app login in more detail; verify-rls.sql finds runtime
-- logins that are not named here.
WITH logins(kind, login) AS (VALUES ('app', :'app_login'::text), ('sweeper', :'sweeper_login'::text), ('support', :'support_login'::text),
  ('outbox', :'outbox_login'::text)),
-- Table-level grants have column '*'.
allowed(kind, tbl, col, priv) AS (VALUES
  ('app', 'AdminSession', '*', 'DELETE'),
  ('app', 'AdminSession', '*', 'INSERT'),
  ('app', 'AdminSession', '*', 'SELECT'),
  ('app', 'AdminSession', '*', 'UPDATE'),
  ('app', 'AdminUser', '*', 'SELECT'),
  ('app', 'AdminUser', 'active', 'UPDATE'),
  ('app', 'AgentApiEvent', '*', 'INSERT'),
  ('app', 'AgentApiEvent', '*', 'SELECT'),
  ('app', 'AgentApiKey', '*', 'INSERT'),
  ('app', 'AgentApiKey', '*', 'SELECT'),
  ('app', 'AgentApiKey', '*', 'UPDATE'),
  ('app', 'AgentAuditEvent', '*', 'INSERT'),
  ('app', 'AgentAuditEvent', '*', 'SELECT'),
  ('app', 'AgentBooking', '*', 'INSERT'),
  ('app', 'AgentBooking', '*', 'SELECT'),
  ('app', 'AgentClient', '*', 'INSERT'),
  ('app', 'AgentClient', '*', 'SELECT'),
  ('app', 'AgentClient', 'active', 'UPDATE'),
  ('app', 'AgentGrant', '*', 'INSERT'),
  ('app', 'AgentGrant', '*', 'SELECT'),
  ('app', 'AgentGrant', 'lastUsedAt', 'UPDATE'),
  ('app', 'AgentGrant', 'revokedAt', 'UPDATE'),
  ('app', 'AgentGrantToken', '*', 'DELETE'),
  ('app', 'AgentGrantToken', '*', 'INSERT'),
  ('app', 'AgentGrantToken', '*', 'SELECT'),
  ('app', 'AgentGrantToken', '*', 'UPDATE'),
  ('app', 'AgentMandate', '*', 'INSERT'),
  ('app', 'AgentMandate', '*', 'SELECT'),
  ('app', 'AgentMandate', 'revokedAt', 'UPDATE'),
  ('app', 'AgentOAuthClient', '*', 'INSERT'),
  ('app', 'AgentOAuthClient', '*', 'SELECT'),
  ('app', 'AgentOAuthCode', '*', 'DELETE'),
  ('app', 'AgentOAuthCode', '*', 'INSERT'),
  ('app', 'AgentOAuthCode', '*', 'SELECT'),
  ('app', 'AgentOAuthCode', '*', 'UPDATE'),
  ('app', 'AgentProposal', '*', 'INSERT'),
  ('app', 'AgentProposal', '*', 'SELECT'),
  ('app', 'AgentProposal', '*', 'UPDATE'),
  ('app', 'Booking', '*', 'INSERT'),
  ('app', 'Booking', '*', 'SELECT'),
  ('app', 'Booking', '*', 'UPDATE'),
  ('app', 'BookingEvent', '*', 'INSERT'),
  ('app', 'BookingEvent', '*', 'SELECT'),
  ('app', 'Campaign', '*', 'INSERT'),
  ('app', 'Campaign', '*', 'SELECT'),
  ('app', 'Campaign', '*', 'UPDATE'),
  ('app', 'CapacityDecision', '*', 'INSERT'),
  ('app', 'CapacityDecision', '*', 'SELECT'),
  ('app', 'Customer', '*', 'INSERT'),
  ('app', 'Customer', '*', 'SELECT'),
  ('app', 'Customer', '*', 'UPDATE'),
  ('app', 'CustomerDataAction', '*', 'INSERT'),
  ('app', 'CustomerDataAction', '*', 'SELECT'),
  ('app', 'PairBudget', '*', 'DELETE'),
  ('app', 'PairBudget', '*', 'INSERT'),
  ('app', 'PairBudget', '*', 'SELECT'),
  ('app', 'PairBudget', '*', 'UPDATE'),
  ('app', 'PairClient', '*', 'DELETE'),
  ('app', 'PairClient', '*', 'INSERT'),
  ('app', 'PairClient', '*', 'SELECT'),
  ('app', 'PairCode', '*', 'DELETE'),
  ('app', 'PairCode', '*', 'INSERT'),
  ('app', 'PairCode', '*', 'SELECT'),
  ('app', 'PairCode', '*', 'UPDATE'),
  ('app', 'PairGrant', '*', 'INSERT'),
  ('app', 'PairGrant', '*', 'SELECT'),
  ('app', 'PairGrant', '*', 'UPDATE'),
  ('app', 'PairGrantToken', '*', 'DELETE'),
  ('app', 'PairGrantToken', '*', 'INSERT'),
  ('app', 'PairGrantToken', '*', 'SELECT'),
  ('app', 'PairGrantToken', '*', 'UPDATE'),
  ('app', 'PairProposal', '*', 'INSERT'),
  ('app', 'PairProposal', '*', 'SELECT'),
  ('app', 'PairProposal', '*', 'UPDATE'),
  ('app', 'PairWorkspace', '*', 'DELETE'),
  ('app', 'PairWorkspace', '*', 'INSERT'),
  ('app', 'PairWorkspace', '*', 'SELECT'),
  ('app', 'PairWorkspace', '*', 'UPDATE'),
  ('app', 'PartnerBookingAttempt', '*', 'DELETE'),
  ('app', 'PartnerBookingAttempt', '*', 'INSERT'),
  ('app', 'PartnerBookingAttempt', '*', 'SELECT'),
  ('app', 'RateLimitBucket', '*', 'DELETE'),
  ('app', 'RateLimitBucket', '*', 'INSERT'),
  ('app', 'RateLimitBucket', '*', 'SELECT'),
  ('app', 'RateLimitBucket', '*', 'UPDATE'),
  ('app', 'Service', '*', 'INSERT'),
  ('app', 'Service', '*', 'SELECT'),
  ('app', 'Service', '*', 'UPDATE'),
  ('app', 'Staff', '*', 'INSERT'),
  ('app', 'Staff', '*', 'SELECT'),
  ('app', 'Staff', '*', 'UPDATE'),
  ('app', 'WorkspaceRequest', '*', 'INSERT'),
  ('app', 'WorkspaceRequest', '*', 'SELECT'),
  ('app', 'journal_entry', '*', 'SELECT'),
  ('app', 'journal_entry', 'author', 'INSERT'),
  ('app', 'journal_entry', 'ciphertext', 'INSERT'),
  ('app', 'journal_entry', 'created_at', 'INSERT'),
  ('app', 'journal_entry', 'customer_id', 'INSERT'),
  ('app', 'journal_entry', 'deleted_at', 'INSERT'),
  ('app', 'journal_entry', 'deleted_at', 'UPDATE'),
  ('app', 'journal_entry', 'id', 'INSERT'),
  ('app', 'journal_entry', 'iv', 'INSERT'),
  ('app', 'journal_entry', 'key_version', 'INSERT'),
  ('app', 'journal_entry', 'tenant_id', 'INSERT'),
  ('app', 'journal_entry', 'version', 'INSERT'),
  ('app', 'journal_key', '*', 'INSERT'),
  ('app', 'journal_key', '*', 'SELECT'),
  ('app', 'media_asset', '*', 'INSERT'),
  ('app', 'media_asset', '*', 'SELECT'),
  ('app', 'media_asset', 'alt_text', 'UPDATE'),
  ('app', 'media_asset', 'deleted_at', 'UPDATE'),
  ('app', 'media_asset', 'published_at', 'UPDATE'),
  ('app', 'media_asset', 'status', 'UPDATE'),
  ('app', 'owner_account', '*', 'INSERT'),
  ('app', 'owner_account', '*', 'SELECT'),
  ('app', 'owner_account', '*', 'UPDATE'),
  ('app', 'owner_mfa_challenge', '*', 'DELETE'),
  ('app', 'owner_mfa_challenge', '*', 'INSERT'),
  ('app', 'owner_mfa_challenge', '*', 'SELECT'),
  ('app', 'owner_recovery_code', '*', 'DELETE'),
  ('app', 'owner_recovery_code', '*', 'INSERT'),
  ('app', 'owner_recovery_code', '*', 'SELECT'),
  ('app', 'owner_recovery_code', 'used_at', 'UPDATE'),
  ('app', 'owner_session', '*', 'DELETE'),
  ('app', 'owner_session', '*', 'INSERT'),
  ('app', 'owner_session', '*', 'SELECT'),
  ('app', 'owner_session', '*', 'UPDATE'),
  ('app', 'tenant_action', '*', 'INSERT'),
  ('app', 'tenant_action', '*', 'SELECT'),
  ('app', 'tenant_effect', '*', 'INSERT'),
  ('app', 'tenant_effect', '*', 'SELECT'),
  ('app', 'tenant_effect', '*', 'UPDATE'),
  ('app', 'tenant_idempotency', '*', 'DELETE'),
  ('app', 'tenant_idempotency', '*', 'INSERT'),
  ('app', 'tenant_idempotency', '*', 'SELECT'),
  ('app', 'tenant_idempotency', '*', 'UPDATE'),
  ('app', 'tenant_state', '*', 'DELETE'),
  ('app', 'tenant_state', '*', 'INSERT'),
  ('app', 'tenant_state', '*', 'SELECT'),
  ('app', 'tenant_state', '*', 'UPDATE'),
  ('support', 'RateLimitBucket', 'count', 'SELECT'),
  ('support', 'RateLimitBucket', 'expiresAt', 'SELECT'),
  ('support', '_prisma_migrations', 'applied_steps_count', 'SELECT'),
  ('support', '_prisma_migrations', 'finished_at', 'SELECT'),
  ('support', '_prisma_migrations', 'id', 'SELECT'),
  ('support', '_prisma_migrations', 'migration_name', 'SELECT'),
  ('support', '_prisma_migrations', 'rolled_back_at', 'SELECT'),
  ('support', '_prisma_migrations', 'started_at', 'SELECT'),
  ('support', 'media_asset', 'byte_size', 'SELECT'),
  ('support', 'media_asset', 'content_type', 'SELECT'),
  ('support', 'media_asset', 'created_at', 'SELECT'),
  ('support', 'media_asset', 'deleted_at', 'SELECT'),
  ('support', 'media_asset', 'height', 'SELECT'),
  ('support', 'media_asset', 'id', 'SELECT'),
  ('support', 'media_asset', 'kind', 'SELECT'),
  ('support', 'media_asset', 'published_at', 'SELECT'),
  ('support', 'media_asset', 'status', 'SELECT'),
  ('support', 'media_asset', 'storage', 'SELECT'),
  ('support', 'media_asset', 'tenant_id', 'SELECT'),
  ('support', 'media_asset', 'width', 'SELECT'),
  ('support', 'owner_account', 'active', 'SELECT'),
  ('support', 'owner_account', 'created_at', 'SELECT'),
  ('support', 'owner_account', 'credential_version', 'SELECT'),
  ('support', 'owner_account', 'id', 'SELECT'),
  ('support', 'owner_account', 'tenant_id', 'SELECT'),
  ('support', 'owner_account', 'totp_enabled_at', 'SELECT'),
  ('support', 'owner_session', 'account_id', 'SELECT'),
  ('support', 'owner_session', 'created_at', 'SELECT'),
  ('support', 'owner_session', 'credential_version', 'SELECT'),
  ('support', 'owner_session', 'expires_at', 'SELECT'),
  ('support', 'owner_session', 'mfa_verified_at', 'SELECT'),
  ('support', 'owner_session', 'revoked_at', 'SELECT'),
  ('support', 'tenant_action', 'actor', 'SELECT'),
  ('support', 'tenant_action', 'at', 'SELECT'),
  ('support', 'tenant_action', 'redacted_at', 'SELECT'),
  ('support', 'tenant_action', 'resulting_version', 'SELECT'),
  ('support', 'tenant_action', 'seq', 'SELECT'),
  ('support', 'tenant_action', 'source', 'SELECT'),
  ('support', 'tenant_action', 'tenant_id', 'SELECT'),
  ('support', 'tenant_effect', 'attempts', 'SELECT'),
  ('support', 'tenant_effect', 'delivered_at', 'SELECT'),
  ('support', 'tenant_effect', 'erased_at', 'SELECT'),
  ('support', 'tenant_effect', 'id', 'SELECT'),
  ('support', 'tenant_effect', 'kind', 'SELECT'),
  ('support', 'tenant_effect', 'leased_until', 'SELECT'),
  ('support', 'tenant_effect', 'n', 'SELECT'),
  ('support', 'tenant_effect', 'next_attempt_at', 'SELECT'),
  ('support', 'tenant_effect', 'seq', 'SELECT'),
  ('support', 'tenant_effect', 'status', 'SELECT'),
  ('support', 'tenant_effect', 'tenant_id', 'SELECT'),
  ('support', 'tenant_idempotency', 'expires_at', 'SELECT'),
  ('support', 'tenant_idempotency', 'seq', 'SELECT'),
  ('support', 'tenant_idempotency', 'tenant_id', 'SELECT'),
  ('support', 'tenant_state', 'expires_at', 'SELECT'),
  ('support', 'tenant_state', 'kind', 'SELECT'),
  ('support', 'tenant_state', 'tenant_id', 'SELECT'),
  ('support', 'tenant_state', 'updated_at', 'SELECT'),
  ('support', 'tenant_state', 'version', 'SELECT'),
  ('sweeper', 'media_asset', '*', 'DELETE'),
  ('sweeper', 'media_asset', 'created_at', 'SELECT'),
  ('sweeper', 'media_asset', 'deleted_at', 'SELECT'),
  ('sweeper', 'media_asset', 'id', 'SELECT'),
  ('sweeper', 'media_asset', 'kind', 'SELECT'),
  ('sweeper', 'media_asset', 'published_at', 'SELECT'),
  ('sweeper', 'media_asset', 'status', 'SELECT'),
  ('sweeper', 'media_asset', 'status', 'UPDATE'),
  ('sweeper', 'media_asset', 'storage', 'SELECT'),
  ('sweeper', 'media_asset', 'storage_key', 'SELECT'),
  ('sweeper', 'media_asset', 'tenant_id', 'SELECT')
),
allowed_functions(kind, fn) AS (VALUES
  ('app', 'store_outbox_cancel_erased'),
  ('app', 'store_outbox_claim'),
  ('app', 'store_outbox_fail'),
  ('app', 'store_outbox_skip'),
  ('app', 'store_outbox_delivered'),
  ('app', 'store_outbox_note'),
  ('app', 'store_outbox_release'),
  ('app', 'store_outbox_open'),
  ('app', 'store_outbox_freeze'),
  ('app', 'store_outbox_dispatch'),
  ('app', 'store_outbox_message_view'),
  ('app', 'erase_subject'),
  ('app', 'store_journal_redact_audit'),
  ('app', 'store_salon_by_slug'),
  ('outbox', 'store_outbox_cancel_erased'),
  ('outbox', 'store_outbox_claim'),
  ('outbox', 'store_outbox_fail'),
  ('outbox', 'store_outbox_skip'),
  ('outbox', 'store_outbox_delivered'),
  ('outbox', 'store_outbox_note'),
  ('outbox', 'store_outbox_release'),
  ('outbox', 'store_outbox_open'),
  ('outbox', 'store_outbox_freeze'),
  ('outbox', 'store_outbox_dispatch'),
  ('outbox', 'store_outbox_message_view'),
  ('sweeper', 'store_sweep_idempotency'),
  ('sweeper', 'store_sweep_demo_actions'),
  ('sweeper', 'store_sweep_sandboxes'),
  ('sweeper', 'store_sweep_outbox_bodies'),
  ('sweeper', 'store_sweep_activity_keys'),
  ('sweeper', 'store_sweep_activity_redact'),
  ('sweeper', 'store_sweep_journal_views'),
  ('sweeper', 'store_sweep_rate_limits'),
  ('sweeper', 'store_sweep_owner_guard')
),
tables AS (
  SELECT c.oid, c.relname AS tbl FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = current_schema() AND c.relkind IN ('r', 'p')
),
table_privs(priv) AS (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')),
column_privs(priv) AS (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('REFERENCES')),
present AS (SELECT l.kind, l.login FROM logins l JOIN pg_roles r ON r.rolname = l.login),
-- What each login can act as: itself and every role it can SET ROLE to (with or without INHERIT). Each is held to
-- the login's allowlist. A superuser target is reported by the reach checks and skipped here.
subjects AS (
  SELECT p.kind, p.login, p.login AS role FROM present p
  UNION
  SELECT p.kind, p.login, r.rolname FROM present p JOIN pg_roles l ON l.rolname = p.login JOIN pg_roles r ON r.oid <> l.oid
  WHERE NOT l.rolsuper AND NOT r.rolsuper AND pg_has_role(l.oid, r.oid, 'SET')
),
runtime AS (SELECT kind || ' login ' || login AS who, login FROM present),
store AS (
  SELECT c.relname, c.relowner FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = current_schema() AND c.relname IN ('tenant_state', 'tenant_action', 'tenant_idempotency', 'tenant_effect', 'journal_entry')
),
definer AS (
  SELECT 'erase_subject definer ' || o.rolname AS who, o.rolname AS login
  FROM pg_proc f JOIN pg_namespace fn ON fn.oid = f.pronamespace JOIN pg_roles o ON o.oid = f.proowner
  WHERE fn.nspname = current_schema() AND f.proname = 'erase_subject'
),
checked AS (SELECT who, login FROM runtime UNION SELECT who, login FROM definer)
SELECT l.kind || ': ' || l.login || ' does not exist or cannot log in' AS problem
FROM logins l LEFT JOIN pg_roles r ON r.rolname = l.login
WHERE r.oid IS NULL OR NOT r.rolcanlogin
UNION ALL
SELECT x.who || ' is superuser, createrole, replication or bypasses row-level security' AS problem
FROM checked x JOIN pg_roles r ON r.rolname = x.login
WHERE r.rolsuper OR r.rolcreaterole OR r.rolreplication OR r.rolbypassrls
UNION ALL
-- SET ROLE: what a login can switch to is what it can do (with or without INHERIT).
SELECT x.who || ' can SET ROLE to ' || r.rolname || ', which is superuser, createrole or bypasses row-level security'
FROM checked x JOIN pg_roles l ON l.rolname = x.login JOIN pg_roles r ON r.oid <> l.oid AND NOT l.rolsuper
WHERE pg_has_role(l.oid, r.oid, 'SET') AND (r.rolsuper OR r.rolcreaterole OR r.rolbypassrls)
UNION ALL
SELECT x.who || ' can SET ROLE to the owner of ' || s.relname
FROM checked x JOIN pg_roles l ON l.rolname = x.login, store s
WHERE NOT l.rolsuper AND pg_has_role(l.oid, s.relowner, 'SET')
UNION ALL
-- Inherited ownership: the owner's rights without any SET ROLE.
SELECT x.who || ' inherits the owner of ' || s.relname
FROM checked x JOIN pg_roles l ON l.rolname = x.login, store s
WHERE NOT l.rolsuper AND pg_has_role(l.oid, s.relowner, 'USAGE')
UNION ALL
-- ADMIN: a login that may grant a role may grant it to itself. A creator's automatic admin-only grant is the
-- admin's, not a runtime login's, and an admin is never a runtime login here.
SELECT x.who || ' holds ADMIN OPTION on ' || g.rolname
FROM checked x JOIN pg_roles l ON l.rolname = x.login
JOIN pg_auth_members m ON m.admin_option AND (pg_has_role(l.oid, m.member, 'USAGE') OR pg_has_role(l.oid, m.member, 'SET'))
JOIN pg_roles g ON g.oid = m.roleid
WHERE NOT l.rolsuper
UNION ALL
-- Each login belongs to its own group role only: a second one would join two scopes.
SELECT p.kind || ' can become ' || g.rolname || ', a group role that is not its own'
FROM present p JOIN pg_roles g ON g.rolname IN ('cresavo_app', 'cresavo_eraser', 'cresavo_sweeper', 'cresavo_support', 'cresavo_outbox')
WHERE g.rolname <> 'cresavo_' || p.kind AND (pg_has_role(p.login, g.oid, 'USAGE') OR pg_has_role(p.login, g.oid, 'SET'))
UNION ALL
SELECT p.kind || ' is not a member of cresavo_' || p.kind
FROM present p WHERE NOT pg_has_role(p.login, 'cresavo_' || p.kind, 'USAGE')
UNION ALL
-- The store's SECURITY DEFINER functions resolve names in this schema: no runtime role may create objects in it.
SELECT p.kind || CASE WHEN p.role = p.login THEN '' ELSE ' (as ' || p.role || ')' END || ' can create objects in schema ' || current_schema()
FROM subjects p WHERE has_schema_privilege(p.role, current_schema(), 'CREATE')
UNION ALL
-- Every effective table privilege against the allowlist.
SELECT p.kind || CASE WHEN p.role = p.login THEN '' ELSE ' (as ' || p.role || ')' END || ' has ' || tp.priv || ' on ' || t.tbl || ', which the allowlist does not grant'
FROM subjects p, tables t, table_privs tp
WHERE has_table_privilege(p.role, t.oid, tp.priv)
  AND NOT EXISTS (SELECT 1 FROM allowed a WHERE a.kind = p.kind AND a.tbl = t.tbl AND a.col = '*' AND a.priv = tp.priv)
UNION ALL
-- Every effective column privilege (beyond a table-level one) against the allowlist.
SELECT p.kind || CASE WHEN p.role = p.login THEN '' ELSE ' (as ' || p.role || ')' END || ' has ' || cp.priv || ' on ' || t.tbl || '.' || att.attname || ', which the allowlist does not grant'
FROM subjects p, tables t JOIN pg_attribute att ON att.attrelid = t.oid AND att.attnum > 0 AND NOT att.attisdropped, column_privs cp
WHERE has_column_privilege(p.role, t.oid, att.attnum, cp.priv)
  AND NOT EXISTS (SELECT 1 FROM allowed a WHERE a.kind = p.kind AND a.tbl = t.tbl AND a.priv = cp.priv AND a.col IN ('*', att.attname))
UNION ALL
-- And what the allowlist grants must be there.
SELECT p.kind || ' lacks ' || a.priv || ' on ' || a.tbl || CASE WHEN a.col = '*' THEN '' ELSE '.' || a.col END
FROM present p JOIN allowed a ON a.kind = p.kind
WHERE to_regclass(quote_ident(a.tbl)) IS NULL
  OR (a.col = '*' AND NOT has_table_privilege(p.login, quote_ident(a.tbl), a.priv))
  OR (a.col <> '*' AND NOT has_column_privilege(p.login, quote_ident(a.tbl), a.col, a.priv))
UNION ALL
-- The store's functions: each login executes exactly its own; PUBLIC executes none.
SELECT p.kind || CASE WHEN p.role = p.login THEN '' ELSE ' (as ' || p.role || ')' END || ' can execute ' || f.proname || ', which the allowlist does not grant'
FROM subjects p, pg_proc f JOIN pg_namespace n ON n.oid = f.pronamespace
WHERE n.nspname = current_schema() AND (f.proname LIKE 'store\_%' OR f.proname LIKE 'studio\_%' OR f.proname = 'erase_subject')
  AND has_function_privilege(p.role, f.oid, 'EXECUTE')
  AND NOT EXISTS (SELECT 1 FROM allowed_functions a WHERE a.kind = p.kind AND a.fn = f.proname)
UNION ALL
-- A function that is not installed (erase_subject before erase-subject.sql) is that step's to report.
SELECT p.kind || ' cannot execute ' || a.fn
FROM present p JOIN allowed_functions a ON a.kind = p.kind
WHERE EXISTS (SELECT 1 FROM pg_proc f JOIN pg_namespace n ON n.oid = f.pronamespace WHERE n.nspname = current_schema() AND f.proname = a.fn)
  AND NOT EXISTS (SELECT 1 FROM pg_proc f JOIN pg_namespace n ON n.oid = f.pronamespace
  WHERE n.nspname = current_schema() AND f.proname = a.fn AND has_function_privilege(p.login, f.oid, 'EXECUTE'))
UNION ALL
SELECT 'PUBLIC can execute ' || f.proname
FROM pg_proc f JOIN pg_namespace n ON n.oid = f.pronamespace
WHERE n.nspname = current_schema() AND (f.proname LIKE 'store\_%' OR f.proname LIKE 'studio\_%' OR f.proname = 'erase_subject')
  AND has_function_privilege('public', f.oid, 'EXECUTE');
