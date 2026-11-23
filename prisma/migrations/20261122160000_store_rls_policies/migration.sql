-- The fixed functions through which the effect poller and the retention
-- sweeps work on the four studio store tables (docs/design/STUDIO_STORE.md,
-- "Row-level security"). The code calls them whether or not row-level security
-- is on, so they are created here; nothing else changes (no table, column,
-- data, role, policy or grant).
--
-- This migration names no role and needs none: it succeeds on a fresh cluster.
-- The functions are closed by default (EXECUTE revoked from PUBLIC); the table
-- owner, which runs migrations and owns them, may always call them.
-- prisma/grants/studio-store.sql and roles.sql grant EXECUTE to the runtime
-- roles. Row-level security itself, its policies included, is the operator step
-- prisma/grants/rls-enable.sql (undone by rls-disable.sql).
--
-- The functions are SECURITY DEFINER, owned by the table owner (whose
-- `store_owner` policy keeps every row once FORCE is on), with a fixed
-- search_path. Each checks its caller first, at call time: the login
-- (`session_user`), its membership of a runtime group role looked up by name
-- (false while the role does not exist) and the transaction's scope
-- (src/concept/store/tenant-scope.ts):
--   cresavo.tenant_id     one tenant: the outbox functions for the app and the poller's sink
--   cresavo.cross_tenant  'outbox' for the effects:drain poller, 'sweep' for store:sweep
-- The outbox functions act only on the effect a claim names; the sweeps have
-- their retention cutoffs inside.

-- STORE FUNCTIONS BEGIN
-- ---------------------------------------------------------------------------
-- Who is calling. `session_user` is the login: inside a SECURITY DEFINER
-- function `current_user` is the owner.
-- ---------------------------------------------------------------------------
CREATE FUNCTION store_caller_owns() RETURNS boolean
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $fn$
  SELECT pg_has_role(session_user, (SELECT c.relowner FROM pg_class c WHERE c.oid = 'tenant_effect'::regclass), 'USAGE')
$fn$;

CREATE FUNCTION store_caller_in(p_role text) RETURNS boolean
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $fn$
  SELECT EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = p_role AND pg_has_role(session_user, r.oid, 'USAGE'))
$fn$;

-- May the caller act on this tenant's effects: in the tenant's own scope (a web worker, or the poller's sink), or
-- in the outbox scope as the poller. The table owner counts as either (development, operator scripts).
CREATE FUNCTION store_outbox_caller(p_tenant text) RETURNS boolean
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $fn$
  SELECT (p_tenant = nullif(current_setting('cresavo.tenant_id', true), '')
      AND (store_caller_owns() OR store_caller_in('cresavo_app') OR store_caller_in('cresavo_outbox')))
    OR (current_setting('cresavo.cross_tenant', true) = 'outbox' AND (store_caller_owns() OR store_caller_in('cresavo_outbox')))
$fn$;

-- The time a function judges by: what the caller passed, but never later than the database clock unless the caller
-- owns the tables (tests and operators replay a fixed clock). A worker can only ever do less, never sweep early.
CREATE FUNCTION store_effective_now(p_now timestamptz) RETURNS timestamptz
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $fn$
  SELECT CASE WHEN store_caller_owns() THEN p_now ELSE least(p_now, clock_timestamp()) END
$fn$;

CREATE FUNCTION store_sweep_check() RETURNS void
LANGUAGE plpgsql STABLE SET search_path = public, pg_temp AS $fn$
BEGIN
  IF NOT (current_setting('cresavo.cross_tenant', true) = 'sweep' AND (store_caller_owns() OR store_caller_in('cresavo_sweeper'))) THEN
    RAISE EXCEPTION 'store sweep: not in the sweep scope of cresavo_sweeper' USING ERRCODE = 'insufficient_privilege';
  END IF;
END $fn$;

-- Same as redactPath in src/concept/store/erasure.ts (and studio_redact_path of erase-subject.sql).
CREATE FUNCTION store_redact_path(v jsonb, p text[]) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp AS $fn$
DECLARE
  out jsonb;
BEGIN
  IF v IS NULL OR jsonb_typeof(v) = 'null' THEN RETURN v; END IF;
  IF cardinality(p) = 0 THEN RETURN to_jsonb('[redacted]'::text); END IF;
  IF p[1] = '*' THEN
    IF jsonb_typeof(v) <> 'array' THEN RETURN v; END IF;
    SELECT coalesce(jsonb_agg(store_redact_path(e, p[2:]) ORDER BY o), '[]'::jsonb) INTO out
    FROM jsonb_array_elements(v) WITH ORDINALITY AS t(e, o);
    RETURN out;
  END IF;
  IF jsonb_typeof(v) <> 'object' OR NOT v ? p[1] THEN RETURN v; END IF;
  RETURN jsonb_set(v, ARRAY[p[1]], store_redact_path(v -> p[1], p[2:]));
END $fn$;

-- ---------------------------------------------------------------------------
-- The effect outbox (src/concept/store/effect-outbox.ts, src/lib/message-sink.ts).
-- Every write needs the claim that `store_outbox_claim` handed out (its id and
-- attempt): a deliverer can change only the row it holds, and only the
-- delivery fields of its payload.
-- ---------------------------------------------------------------------------
CREATE FUNCTION store_outbox_cancel_erased(p_now timestamptz, p_tenants text[]) RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  WITH cancelled AS (
    UPDATE tenant_effect SET status = 'cancelled', leased_until = NULL
    WHERE status = 'pending' AND erased_at IS NOT NULL
      AND (leased_until IS NULL OR leased_until <= store_effective_now(p_now))
      AND (p_tenants IS NULL OR tenant_id = ANY(p_tenants))
      AND store_outbox_caller(tenant_id)
    RETURNING 1)
  SELECT count(*)::int FROM cancelled
$fn$;

CREATE FUNCTION store_outbox_claim(p_now timestamptz, p_lease_ms float8, p_message_lease_ms float8, p_tenants text[], p_kinds text[],
  p_paused boolean)
RETURNS TABLE (id text, tenant_id text, seq bigint, n integer, kind text, payload jsonb, attempts integer, tenant_kind text)
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  WITH clock AS (SELECT store_effective_now(p_now) AS t),
  next AS (
    SELECT e.tenant_id, e.seq, e.n
    FROM tenant_effect e
    LEFT JOIN tenant_state s ON s.tenant_id = e.tenant_id
    WHERE e.status = 'pending' AND e.next_attempt_at <= (SELECT t FROM clock)
      AND e.erased_at IS NULL
      AND (s.expires_at IS NULL OR s.expires_at > (SELECT t FROM clock))
      AND (p_tenants IS NULL OR e.tenant_id = ANY(p_tenants))
      AND (p_kinds IS NULL OR s.kind::text = ANY(p_kinds))
      AND NOT (p_paused AND e.kind = 'message' AND e.payload->>'port' = 'email')
      AND store_outbox_caller(e.tenant_id)
      AND (e.kind <> 'payment' OR NOT EXISTS (
        SELECT 1 FROM tenant_effect p
        WHERE p.tenant_id = e.tenant_id AND p.kind = 'payment' AND p.status IN ('pending', 'failed')
          AND (p.seq, p.n) < (e.seq, e.n)))
    ORDER BY e.tenant_id, e.seq, e.n
    LIMIT 1
    FOR UPDATE OF e SKIP LOCKED
  )
  UPDATE tenant_effect e
  SET attempts = e.attempts + 1,
      next_attempt_at = (SELECT t FROM clock) + make_interval(secs => CASE WHEN e.kind = 'message' THEN p_message_lease_ms ELSE p_lease_ms END / 1000),
      leased_until = (SELECT t FROM clock) + make_interval(secs => CASE WHEN e.kind = 'message' THEN p_message_lease_ms ELSE p_lease_ms END / 1000)
  FROM next
  WHERE e.tenant_id = next.tenant_id AND e.seq = next.seq AND e.n = next.n AND e.status = 'pending'
  RETURNING e.id, e.tenant_id, e.seq, e.n, e.kind, e.payload, e.attempts,
    (SELECT s.kind::text FROM tenant_state s WHERE s.tenant_id = e.tenant_id)
$fn$;

-- A failed send of the latest claim: the caller decides the outcome (effect-outbox.ts, recordFailure).
CREATE FUNCTION store_outbox_fail(p_id text, p_attempt integer, p_patch jsonb, p_drop text[], p_timeout boolean, p_fail boolean,
  p_next timestamptz) RETURNS text
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  UPDATE tenant_effect SET
    payload = CASE WHEN p_patch = '{}'::jsonb AND cardinality(p_drop) = 0 THEN payload
      ELSE jsonb_set(payload, '{delivery}', (coalesce(payload->'delivery', '{}'::jsonb) || p_patch) - p_drop) END,
    leased_until = CASE WHEN p_timeout THEN leased_until END,
    status = CASE WHEN erased_at IS NOT NULL THEN 'cancelled' WHEN p_fail THEN 'failed' ELSE status END,
    next_attempt_at = CASE WHEN p_timeout THEN next_attempt_at ELSE p_next END
  WHERE id = p_id AND status = 'pending' AND attempts = p_attempt AND p_attempt >= 1 AND leased_until IS NOT NULL
    AND store_outbox_caller(tenant_id)
  RETURNING status
$fn$;

-- Nothing to send (an erased or cancelled booking): delivered only while still pending under this claim.
CREATE FUNCTION store_outbox_skip(p_id text, p_attempt integer, p_at timestamptz) RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  WITH done AS (
    UPDATE tenant_effect SET status = 'delivered', leased_until = NULL, delivered_at = p_at
    WHERE id = p_id AND status = 'pending' AND attempts = p_attempt AND p_attempt >= 1 AND store_outbox_caller(tenant_id)
    RETURNING 1)
  SELECT count(*)::int FROM done
$fn$;

-- The send happened: recorded whatever became of the row since this claim (a lease that ran out, an erasure), with
-- an optional patch of the delivery record (nulls remove keys).
CREATE FUNCTION store_outbox_delivered(p_id text, p_attempt integer, p_at timestamptz, p_patch jsonb) RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  WITH done AS (
    UPDATE tenant_effect SET
      payload = CASE WHEN p_patch IS NULL THEN payload
        ELSE jsonb_set(payload, '{delivery}', jsonb_strip_nulls(coalesce(payload->'delivery', '{}'::jsonb) || p_patch)) END,
      status = 'delivered', leased_until = NULL, delivered_at = coalesce(p_at, clock_timestamp())
    WHERE id = p_id AND status <> 'delivered' AND attempts >= p_attempt AND p_attempt >= 1 AND store_outbox_caller(tenant_id)
    RETURNING 1)
  SELECT count(*)::int FROM done
$fn$;

-- Merges into the delivery record for the latest claim of a pending effect (nulls remove keys).
CREATE FUNCTION store_outbox_note(p_id text, p_attempt integer, p_patch jsonb) RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  WITH done AS (
    UPDATE tenant_effect SET payload = jsonb_set(payload, '{delivery}', jsonb_strip_nulls(coalesce(payload->'delivery', '{}'::jsonb) || p_patch))
    WHERE id = p_id AND status = 'pending' AND attempts = p_attempt AND p_attempt >= 1 AND store_outbox_caller(tenant_id)
    RETURNING 1)
  SELECT count(*)::int FROM done
$fn$;

-- Drops this claim's dispatch marker when no request left after all (also once a timeout failed the row).
CREATE FUNCTION store_outbox_release(p_id text, p_attempt integer, p_keys text[]) RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  WITH done AS (
    UPDATE tenant_effect SET payload = jsonb_set(payload, '{delivery}', coalesce(payload->'delivery', '{}'::jsonb)
      - (SELECT coalesce(array_agg(k), '{}') FROM unnest(p_keys) k WHERE k IN ('dispatched', 'provider', 'account', 'submittedAt')))
    WHERE id = p_id AND status IN ('pending', 'failed') AND attempts = p_attempt AND p_attempt >= 1
      AND NOT coalesce((payload #>> '{delivery,sent}')::boolean, false) AND store_outbox_caller(tenant_id)
    RETURNING 1)
  SELECT count(*)::int FROM done
$fn$;

-- Whether an effect is still open (pending, not erased): why a guarded write changed nothing.
CREATE FUNCTION store_outbox_open(p_id text) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  SELECT (status = 'pending' AND erased_at IS NULL) FROM tenant_effect WHERE id = p_id AND store_outbox_caller(tenant_id)
$fn$;

-- Freezes the first rendering unless an earlier attempt did; returns the stored delivery record.
CREATE FUNCTION store_outbox_freeze(p_id text, p_attempt integer, p_first jsonb) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  UPDATE tenant_effect SET payload = jsonb_set(payload, '{delivery}',
    CASE WHEN payload->'delivery' ? 'from' THEN payload->'delivery' ELSE coalesce(payload->'delivery', '{}'::jsonb) || p_first END)
  WHERE id = p_id AND status = 'pending' AND erased_at IS NULL AND attempts = p_attempt AND p_attempt >= 1
    AND store_outbox_caller(tenant_id)
  RETURNING payload->'delivery'
$fn$;

-- Commits the `dispatched` marker of this claim before a real send (message-sink.ts, dispatch).
CREATE FUNCTION store_outbox_dispatch(p_id text, p_attempt integer, p_provider text, p_account text, p_submitted_at float8)
RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  WITH done AS (
    UPDATE tenant_effect SET payload = jsonb_set(payload, '{delivery}', coalesce(payload->'delivery', '{}'::jsonb)
      || jsonb_build_object('dispatched', true, 'provider', coalesce(payload->'delivery'->>'provider', p_provider))
      || CASE WHEN payload->'delivery' ? 'provider' OR p_account IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('account', p_account) END
      || CASE WHEN payload->'delivery' ? 'submittedAt' THEN '{}'::jsonb ELSE jsonb_build_object('submittedAt', p_submitted_at) END)
    WHERE id = p_id AND status = 'pending' AND erased_at IS NULL AND attempts = p_attempt AND p_attempt >= 1
      AND store_outbox_caller(tenant_id)
    RETURNING 1)
  SELECT count(*)::int FROM done
$fn$;

-- What the message sink may see of the salon a claimed message is for: the salon, its settings, services and staff,
-- the one booking the message is about and that booking's customer. Every other list is empty (customers, journals,
-- inbox, log, sales…). With p_lock the salon's row is share-locked to the end of the caller's transaction, the
-- lock an erasure takes exclusively. A claim that a later one replaced still reads, and learns at its guarded write
-- that the claim is gone.
CREATE FUNCTION store_outbox_message_view(p_id text, p_attempt integer, p_booking text, p_lock boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_tenant text;
  v_doc jsonb;
  v_customer text;
  v_out jsonb;
BEGIN
  SELECT e.tenant_id INTO v_tenant FROM tenant_effect e
  WHERE e.id = p_id AND e.kind = 'message' AND e.attempts >= p_attempt AND p_attempt >= 1
    AND starts_with(coalesce(e.payload->>'reference', ''), p_booking || '-') AND store_outbox_caller(e.tenant_id);
  IF v_tenant IS NULL THEN RETURN NULL; END IF;
  IF p_lock THEN
    SELECT s.doc INTO v_doc FROM tenant_state s WHERE s.tenant_id = v_tenant FOR SHARE;
  ELSE
    SELECT s.doc INTO v_doc FROM tenant_state s WHERE s.tenant_id = v_tenant;
  END IF;
  IF v_doc IS NULL THEN RETURN NULL; END IF;
  SELECT b->>'customerId' INTO v_customer FROM jsonb_array_elements(coalesce(v_doc->'bookings', '[]')) b WHERE b->>'id' = p_booking LIMIT 1;
  SELECT jsonb_object_agg(k, CASE
    WHEN jsonb_typeof(v) <> 'array' THEN v
    WHEN k IN ('staff', 'services', 'retiredServices', 'categories', 'resources', 'exceptions', 'blocks', 'holidays') THEN v
    WHEN k = 'bookings' THEN (SELECT coalesce(jsonb_agg(b), '[]') FROM jsonb_array_elements(v) b WHERE b->>'id' = p_booking)
    WHEN k = 'customers' THEN (SELECT coalesce(jsonb_agg(c), '[]') FROM jsonb_array_elements(v) c WHERE c->>'id' = v_customer)
    ELSE '[]'::jsonb END) INTO v_out
  FROM jsonb_each(v_doc) AS t(k, v);
  RETURN v_out;
END $fn$;

-- ---------------------------------------------------------------------------
-- Retention sweeps (src/concept/store/store-sweepers.ts). The cutoffs are fixed
-- here and match src/concept/privacy/retention.ts (tests/store-rls-files.test.ts):
-- demo log 168 hours, outbox bodies 2160 hours (90 days), activity personal data
-- 13 months, journal reads 24 months (calendar months in UTC, as monthsBefore),
-- keys and sandboxes at expiry. Each call is one batch of at most p_limit rows.
-- ---------------------------------------------------------------------------
CREATE FUNCTION store_sweep_idempotency(p_now timestamptz, p_limit integer) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_count integer;
BEGIN
  PERFORM store_sweep_check();
  WITH expired AS (
    SELECT i.tenant_id, i.key FROM tenant_idempotency i
    WHERE i.expires_at <= store_effective_now(p_now)
    ORDER BY i.expires_at, i.tenant_id, i.key LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  DELETE FROM tenant_idempotency i USING expired e WHERE i.tenant_id = e.tenant_id AND i.key = e.key;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $fn$;

CREATE FUNCTION store_sweep_demo_actions(p_now timestamptz, p_limit integer) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_count integer;
BEGIN
  PERFORM store_sweep_check();
  WITH expired AS (
    SELECT a.tenant_id, a.seq FROM tenant_action a JOIN tenant_state s USING (tenant_id)
    WHERE s.kind = 'demo' AND a.at < store_effective_now(p_now) - interval '168 hours'
    ORDER BY a.at, a.tenant_id, a.seq LIMIT p_limit
    FOR UPDATE OF a SKIP LOCKED
  )
  DELETE FROM tenant_action a USING expired e WHERE a.tenant_id = e.tenant_id AND a.seq = e.seq;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $fn$;

-- Expired sandboxes and all their rows, under the tenant locks, so an apply cannot append to one left behind.
CREATE FUNCTION store_sweep_sandboxes(p_now timestamptz, p_limit integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_ids text[];
  v_tenants integer;
  v_actions integer;
  v_effects integer;
  v_keys integer;
BEGIN
  PERFORM store_sweep_check();
  SELECT coalesce(array_agg(tenant_id), '{}') INTO v_ids FROM (
    SELECT s.tenant_id FROM tenant_state s
    WHERE s.kind = 'sandbox' AND s.expires_at <= store_effective_now(p_now)
    ORDER BY s.expires_at, s.tenant_id LIMIT p_limit
    FOR UPDATE SKIP LOCKED) locked;
  IF cardinality(v_ids) = 0 THEN
    RETURN jsonb_build_object('tenants', 0, 'actions', 0, 'effects', 0, 'idempotencyKeys', 0);
  END IF;
  DELETE FROM tenant_action WHERE tenant_id = ANY(v_ids);
  GET DIAGNOSTICS v_actions = ROW_COUNT;
  DELETE FROM tenant_effect WHERE tenant_id = ANY(v_ids);
  GET DIAGNOSTICS v_effects = ROW_COUNT;
  DELETE FROM tenant_idempotency WHERE tenant_id = ANY(v_ids);
  GET DIAGNOSTICS v_keys = ROW_COUNT;
  DELETE FROM tenant_state WHERE tenant_id = ANY(v_ids);
  GET DIAGNOSTICS v_tenants = ROW_COUNT;
  RETURN jsonb_build_object('tenants', v_tenants, 'actions', v_actions, 'effects', v_effects, 'idempotencyKeys', v_keys);
END $fn$;

-- Blanks body, subject, address and the stored mail copy of settled messages committed 90 days ago (sweepOutboxBodies).
CREATE FUNCTION store_sweep_outbox_bodies(p_now timestamptz, p_limit integer) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_count integer;
BEGIN
  PERFORM store_sweep_check();
  WITH due AS (
    SELECT e.tenant_id, e.seq, e.n FROM tenant_effect e
    LEFT JOIN tenant_action a ON a.tenant_id = e.tenant_id AND a.seq = e.seq
    WHERE e.kind = 'message' AND e.status <> 'pending'
      AND coalesce(a.at, e.delivered_at, e.next_attempt_at) < store_effective_now(p_now) - interval '2160 hours'
      AND (e.payload ->> 'body' IS DISTINCT FROM '[redacted]'
        OR (e.payload ? 'subject' AND e.payload ->> 'subject' IS DISTINCT FROM '[redacted]')
        OR (e.payload ? 'to' AND e.payload ->> 'to' IS DISTINCT FROM '[redacted]'
            AND coalesce(e.payload ->> 'to', '') !~ '^customer:[A-Za-z0-9_.:-]+(, *customer:[A-Za-z0-9_.:-]+)*$')
        OR e.payload #> '{delivery,mail}' IS NOT NULL)
    ORDER BY e.tenant_id, e.seq, e.n LIMIT p_limit
    FOR UPDATE OF e SKIP LOCKED
  )
  UPDATE tenant_effect e SET payload =
    (e.payload - 'delivery') || jsonb_build_object('body', '[redacted]')
    || CASE WHEN jsonb_typeof(e.payload -> 'delivery') = 'object' THEN jsonb_build_object('delivery', (e.payload -> 'delivery') - 'mail') ELSE '{}'::jsonb END
    || CASE WHEN e.payload ? 'subject' THEN jsonb_build_object('subject', '[redacted]') ELSE '{}'::jsonb END
    || CASE WHEN e.payload ? 'to' AND coalesce(e.payload ->> 'to', '') !~ '^customer:[A-Za-z0-9_.:-]+(, *customer:[A-Za-z0-9_.:-]+)*$'
            THEN jsonb_build_object('to', '[redacted]') ELSE '{}'::jsonb END
  FROM due d WHERE e.tenant_id = d.tenant_id AND e.seq = d.seq AND e.n = d.n;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $fn$;

-- Every audit row older than 13 months loses its informational idempotency key.
CREATE FUNCTION store_sweep_activity_keys(p_now timestamptz, p_limit integer) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_count integer;
BEGIN
  PERFORM store_sweep_check();
  WITH old AS (
    SELECT tenant_id, seq FROM tenant_action
    WHERE at < ((store_effective_now(p_now) AT TIME ZONE 'UTC') - interval '13 months') AT TIME ZONE 'UTC' AND idempotency_key IS NOT NULL
    ORDER BY at, tenant_id, seq LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE tenant_action a SET idempotency_key = NULL FROM old o WHERE a.tenant_id = o.tenant_id AND a.seq = o.seq;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $fn$;

-- Audit rows older than 13 months: the personal fields of their type replaced, marked, key cleared (sweepActivityPersonalData).
CREATE FUNCTION store_sweep_activity_redact(p_now timestamptz, p_limit integer) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
  -- PERSONAL_FIELDS BEGIN (kept identical to src/concept/store/erasure.ts by a unit test)
  v_fields constant jsonb := '{
    "online/hold": ["guest.name","guest.phone","guest.email","notice.title","notice.body","notice.draftReply","notice.fromName","notice.reply"],
    "online/book": ["guest.name","guest.phone","guest.email","notice.title","notice.body","notice.draftReply","notice.fromName","notice.reply"],
    "online/waitlist": ["guest.name","guest.phone","guest.email","notice.title","notice.body","notice.draftReply","notice.fromName","notice.reply"],
    "booking/create": ["newCustomer.name","newCustomer.phone","newCustomer.email","fictionalCustomer.name"],
    "booking/move": ["notice.title","notice.body","notice.draftReply","notice.fromName","notice.reply"],
    "booking/fee": ["reason"],
    "booking/update": ["patch.contactEmail","patch.note","patch.cancelReason"],
    "booking/cancel": ["reason","notice.title","notice.body","notice.draftReply","notice.fromName","notice.reply"],
    "customers/import": ["customers.*.firstName","customers.*.lastName","customers.*.phone","customers.*.email","customers.*.birthday","customers.*.note"],
    "customer/note": ["note"],
    "customer/update": ["patch.firstName","patch.lastName","patch.phone","patch.email","patch.birthday","patch.tags"],
    "customers/message": ["texts.*.title","texts.*.body"],
    "inbox/add": ["item.title","item.body","item.draftReply","item.fromName","item.reply"],
    "inbox/reply": ["reply"],
    "review/submit": ["text"],
    "review/reply": ["reply"],
    "journal/add": ["entry.treatment","entry.observations","entry.advice","entry.nextVisit","entry.photos","entry.versions"],
    "journal/edit": ["content.treatment","content.observations","content.advice","content.nextVisit","content.photos","content.versions"],
    "giftcard/sell": ["recipient","message"],
    "memory/add": ["item.text"],
    "memory/edit": ["text"],
    "ticket/create": ["ticket.question","ticket.screen","ticket.activity.*.summary"]
  }';
  -- PERSONAL_FIELDS END
  v_now timestamptz;
  v_row record;
  v_next jsonb;
  v_path text;
  v_count integer := 0;
BEGIN
  PERFORM store_sweep_check();
  v_now := store_effective_now(p_now);
  FOR v_row IN
    SELECT tenant_id, seq, action FROM tenant_action
    WHERE at < ((v_now AT TIME ZONE 'UTC') - interval '13 months') AT TIME ZONE 'UTC'
      AND NOT (action ? 'retentionRedacted') AND action ->> 'type' IN (SELECT jsonb_object_keys(v_fields))
    ORDER BY at, tenant_id, seq LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    v_next := v_row.action;
    FOR v_path IN SELECT jsonb_array_elements_text(v_fields -> (v_row.action ->> 'type')) LOOP
      v_next := store_redact_path(v_next, string_to_array(v_path, '.'));
    END LOOP;
    UPDATE tenant_action SET action = v_next || '{"retentionRedacted": true}'::jsonb, idempotency_key = NULL,
      redacted_at = coalesce(redacted_at, v_now)
    WHERE tenant_id = v_row.tenant_id AND seq = v_row.seq;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $fn$;

-- The audit copies of journal reads older than 24 months (sweepJournalAccessRows).
CREATE FUNCTION store_sweep_journal_views(p_now timestamptz, p_limit integer) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_count integer;
BEGIN
  PERFORM store_sweep_check();
  WITH old AS (
    SELECT tenant_id, seq FROM tenant_action
    WHERE action ->> 'type' = 'journal/view' AND at < ((store_effective_now(p_now) AT TIME ZONE 'UTC') - interval '24 months') AT TIME ZONE 'UTC'
    ORDER BY at, tenant_id, seq LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  DELETE FROM tenant_action a USING old o WHERE a.tenant_id = o.tenant_id AND a.seq = o.seq;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $fn$;

REVOKE ALL ON FUNCTION store_caller_owns(), store_caller_in(text), store_outbox_caller(text), store_effective_now(timestamptz),
  store_sweep_check(), store_redact_path(jsonb, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION store_outbox_cancel_erased(timestamptz, text[]),
  store_outbox_claim(timestamptz, float8, float8, text[], text[], boolean),
  store_outbox_fail(text, integer, jsonb, text[], boolean, boolean, timestamptz), store_outbox_skip(text, integer, timestamptz),
  store_outbox_delivered(text, integer, timestamptz, jsonb), store_outbox_note(text, integer, jsonb),
  store_outbox_release(text, integer, text[]), store_outbox_open(text), store_outbox_freeze(text, integer, jsonb),
  store_outbox_dispatch(text, integer, text, text, float8), store_outbox_message_view(text, integer, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION store_sweep_idempotency(timestamptz, integer), store_sweep_demo_actions(timestamptz, integer),
  store_sweep_sandboxes(timestamptz, integer), store_sweep_outbox_bodies(timestamptz, integer),
  store_sweep_activity_keys(timestamptz, integer), store_sweep_activity_redact(timestamptz, integer),
  store_sweep_journal_views(timestamptz, integer) FROM PUBLIC;
-- STORE FUNCTIONS END
