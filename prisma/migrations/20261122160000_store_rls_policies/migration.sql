-- The fixed functions through which the effect poller, the retention sweeps and
-- the public booking page's address lookup work on the studio store tables
-- (docs/design/STUDIO_STORE.md, "Row-level security"), and two columns of the
-- outbox they need. The code calls the functions whether or not row-level
-- security is on, so they are created here.
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
-- The outbox functions act only for the current claim of an effect, by its
-- random token; the sweeps have their retention cutoffs inside.

-- The current claim's token, and a provider confirmation that arrived after the row was settled otherwise.
ALTER TABLE "tenant_effect" ADD COLUMN "claim_token" UUID;
ALTER TABLE "tenant_effect" ADD COLUMN "late_confirmation" JSONB;

-- STORE FUNCTIONS BEGIN
-- ---------------------------------------------------------------------------
-- Who is calling. `session_user` is the login: inside a SECURITY DEFINER
-- function `current_user` is the owner. Every check is `IS TRUE`, so an unset
-- setting (NULL) never passes.
-- ---------------------------------------------------------------------------
CREATE FUNCTION store_caller_owns() RETURNS boolean
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $fn$
  SELECT pg_has_role(session_user, (SELECT c.relowner FROM pg_class c WHERE c.oid = 'tenant_effect'::regclass), 'USAGE') IS TRUE
$fn$;

CREATE FUNCTION store_caller_in(p_role text) RETURNS boolean
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $fn$
  SELECT EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = p_role AND pg_has_role(session_user, r.oid, 'USAGE') IS TRUE)
$fn$;

-- May the caller act on this tenant's effects: in the tenant's own scope (a web worker, or the poller's sink), or
-- in the outbox scope as the poller. The table owner counts as either (development, operator scripts).
CREATE FUNCTION store_outbox_caller(p_tenant text) RETURNS boolean
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $fn$
  SELECT ((p_tenant = nullif(current_setting('cresavo.tenant_id', true), '')) IS TRUE
      AND (store_caller_owns() OR store_caller_in('cresavo_app') OR store_caller_in('cresavo_outbox')))
    OR ((current_setting('cresavo.cross_tenant', true) = 'outbox') IS TRUE AND (store_caller_owns() OR store_caller_in('cresavo_outbox')))
$fn$;

-- The time a sweep or a due check judges by: what the caller passed, but never later than the database clock unless
-- the caller owns the tables (tests and operators replay a fixed clock). A worker can only ever do less.
CREATE FUNCTION store_effective_now(p_now timestamptz) RETURNS timestamptz
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $fn$
  SELECT CASE WHEN store_caller_owns() THEN coalesce(p_now, clock_timestamp()) ELSE least(coalesce(p_now, clock_timestamp()), clock_timestamp()) END
$fn$;

-- The time leases, backoff and expiry are measured from: the database clock, except for the table owner.
CREATE FUNCTION store_clock(p_now timestamptz) RETURNS timestamptz
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $fn$
  SELECT CASE WHEN store_caller_owns() THEN coalesce(p_now, clock_timestamp()) ELSE clock_timestamp() END
$fn$;

-- A lease or wait in milliseconds held to finite bounds: 1 s to 1 hour.
CREATE FUNCTION store_bounded_ms(p_ms float8) RETURNS float8
LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp AS $fn$
  SELECT greatest(1000, least(coalesce(p_ms, 60000), 3600000))
$fn$;

CREATE FUNCTION store_sweep_check(p_limit integer) RETURNS void
LANGUAGE plpgsql STABLE SET search_path = public, pg_temp AS $fn$
BEGIN
  IF ((current_setting('cresavo.cross_tenant', true) = 'sweep') AND (store_caller_owns() OR store_caller_in('cresavo_sweeper'))) IS NOT TRUE THEN
    RAISE EXCEPTION 'store sweep: not in the sweep scope of cresavo_sweeper' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF (p_limit BETWEEN 1 AND 10000) IS NOT TRUE THEN
    RAISE EXCEPTION 'store sweep: the batch must be between 1 and 10000 rows' USING ERRCODE = 'invalid_parameter_value';
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
-- A claim gets a random token (`claim_token`); every later read and write of
-- its deliverer needs that exact token and finds nothing once the claim is
-- over (settled, retried or replaced by another claim). Each write takes typed
-- values for its own delivery fields; nothing accepts arbitrary JSON.
-- ---------------------------------------------------------------------------
CREATE FUNCTION store_outbox_cancel_erased(p_now timestamptz, p_tenants text[]) RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  WITH cancelled AS (
    UPDATE tenant_effect SET status = 'cancelled', leased_until = NULL, claim_token = NULL
    WHERE status = 'pending' AND erased_at IS NOT NULL
      AND (leased_until IS NULL OR leased_until <= store_clock(p_now))
      AND (p_tenants IS NULL OR tenant_id = ANY(p_tenants))
      AND store_outbox_caller(tenant_id) IS TRUE
    RETURNING 1)
  SELECT count(*)::int FROM cancelled
$fn$;

CREATE FUNCTION store_outbox_claim(p_now timestamptz, p_lease_ms float8, p_message_lease_ms float8, p_tenants text[], p_kinds text[],
  p_paused boolean)
RETURNS TABLE (id text, tenant_id text, seq bigint, n integer, kind text, payload jsonb, attempts integer, tenant_kind text, claim_token uuid)
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  WITH clock AS (SELECT store_effective_now(p_now) AS due, store_clock(p_now) AS t),
  next AS (
    SELECT e.tenant_id, e.seq, e.n
    FROM tenant_effect e
    LEFT JOIN tenant_state s ON s.tenant_id = e.tenant_id
    WHERE e.status = 'pending' AND e.next_attempt_at <= (SELECT due FROM clock)
      AND e.erased_at IS NULL
      AND (s.expires_at IS NULL OR s.expires_at > (SELECT t FROM clock))
      AND (p_tenants IS NULL OR e.tenant_id = ANY(p_tenants))
      AND (p_kinds IS NULL OR s.kind::text = ANY(p_kinds))
      AND NOT (p_paused IS TRUE AND e.kind = 'message' AND e.payload->>'port' = 'email')
      AND store_outbox_caller(e.tenant_id) IS TRUE
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
      claim_token = gen_random_uuid(),
      next_attempt_at = (SELECT t FROM clock) + make_interval(secs => store_bounded_ms(CASE WHEN e.kind = 'message' THEN p_message_lease_ms ELSE p_lease_ms END) / 1000),
      leased_until = (SELECT t FROM clock) + make_interval(secs => store_bounded_ms(CASE WHEN e.kind = 'message' THEN p_message_lease_ms ELSE p_lease_ms END) / 1000)
  FROM next
  WHERE e.tenant_id = next.tenant_id AND e.seq = next.seq AND e.n = next.n AND e.status = 'pending'
  RETURNING e.id, e.tenant_id, e.seq, e.n, e.kind, e.payload, e.attempts,
    (SELECT s.kind::text FROM tenant_state s WHERE s.tenant_id = e.tenant_id), e.claim_token
$fn$;

-- A failed send of the current claim (effect-outbox.ts, recordFailure). The caller decides retry or failure; the
-- next attempt is held to at most two hours from now. A deferral does not count (`attemptBase` grows); the error
-- code is kept when it looks like one; a held send drops the dispatch marker this claim set. After a timeout the
-- claim stays (the send may still be running), otherwise it ends here.
CREATE FUNCTION store_outbox_fail(p_id text, p_token uuid, p_now timestamptz, p_next timestamptz, p_timeout boolean, p_fail boolean,
  p_defer boolean, p_last_error text, p_release_marker boolean, p_drop_submitted boolean) RETURNS text
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  UPDATE tenant_effect SET
    payload = CASE WHEN NOT (p_defer IS TRUE OR p_last_error IS NOT NULL OR p_release_marker IS TRUE) THEN payload
      ELSE jsonb_set(payload, '{delivery}', (coalesce(payload->'delivery', '{}'::jsonb)
        || CASE WHEN p_defer IS TRUE THEN jsonb_build_object('attemptBase',
             CASE WHEN jsonb_typeof(payload #> '{delivery,attemptBase}') = 'number' THEN (payload #>> '{delivery,attemptBase}')::int ELSE 0 END + 1)
           ELSE '{}'::jsonb END
        || CASE WHEN p_last_error IS NULL OR kind <> 'message' THEN '{}'::jsonb
             ELSE jsonb_build_object('lastError', CASE WHEN p_last_error ~ '^[A-Z][A-Z0-9_]{0,63}$' THEN p_last_error ELSE 'OTHER_ERROR' END) END)
        - CASE WHEN p_release_marker IS TRUE THEN ARRAY['dispatched', 'provider', 'account']
            || CASE WHEN p_drop_submitted IS TRUE THEN ARRAY['submittedAt'] ELSE '{}'::text[] END
          ELSE '{}'::text[] END) END,
    leased_until = CASE WHEN p_timeout IS TRUE THEN leased_until END,
    claim_token = CASE WHEN p_timeout IS TRUE THEN claim_token END,
    status = CASE WHEN erased_at IS NOT NULL THEN 'cancelled' WHEN p_fail IS TRUE THEN 'failed' ELSE status END,
    next_attempt_at = CASE WHEN p_timeout IS TRUE THEN next_attempt_at
      ELSE least(greatest(coalesce(p_next, store_clock(p_now)), store_clock(p_now)), store_clock(p_now) + interval '2 hours') END
  WHERE id = p_id AND status = 'pending' AND claim_token = p_token AND store_outbox_caller(tenant_id) IS TRUE
  RETURNING status
$fn$;

-- Nothing to send (an erased or cancelled booking): delivered only while still pending under this claim.
CREATE FUNCTION store_outbox_skip(p_id text, p_token uuid) RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  WITH done AS (
    UPDATE tenant_effect SET status = 'delivered', leased_until = NULL, claim_token = NULL, delivered_at = clock_timestamp()
    WHERE id = p_id AND status = 'pending' AND claim_token = p_token AND store_outbox_caller(tenant_id) IS TRUE
    RETURNING 1)
  SELECT count(*)::int FROM done
$fn$;

-- The send of this claim happened. A pending row becomes delivered (with p_sent, the message sink's record: sent, and
-- the frozen message, link and dispatch marker dropped). A row that was settled meanwhile under this same claim (an
-- erasure cancelled it, or its timeout failed it) keeps its status: the confirmation is kept apart in
-- late_confirmation. Returns 'delivered', 'late' or nothing.
CREATE FUNCTION store_outbox_delivered(p_id text, p_token uuid, p_sent boolean) RETURNS text
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  UPDATE tenant_effect SET
    payload = CASE WHEN status <> 'pending' OR p_sent IS NOT TRUE THEN payload
      ELSE jsonb_set(payload, '{delivery}', (coalesce(payload->'delivery', '{}'::jsonb) || '{"sent": true}'::jsonb)
        - ARRAY['dispatched', 'provider', 'account', 'submittedAt', 'mail', 'link', 'from', 'replyTo', 'lastError']) END,
    late_confirmation = CASE WHEN status = 'pending' THEN late_confirmation
      ELSE jsonb_build_object('at', clock_timestamp(), 'status', status, 'sent', p_sent IS TRUE) END,
    status = CASE WHEN status = 'pending' THEN 'delivered' ELSE status END,
    delivered_at = CASE WHEN status = 'pending' THEN clock_timestamp() ELSE delivered_at END,
    leased_until = NULL,
    claim_token = NULL
  WHERE id = p_id AND claim_token = p_token AND status IN ('pending', 'cancelled', 'failed') AND store_outbox_caller(tenant_id) IS TRUE
  RETURNING CASE WHEN status = 'delivered' THEN 'delivered' ELSE 'late' END
$fn$;

-- Settles the reason a message failed for the current claim (a person decides from here): p_settle also drops the
-- frozen message, link, sender and reply-to; the error code goes either way.
CREATE FUNCTION store_outbox_note(p_id text, p_token uuid, p_reason text, p_settle boolean, p_drop_submitted boolean) RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  WITH done AS (
    UPDATE tenant_effect SET payload = jsonb_set(payload, '{delivery}', (coalesce(payload->'delivery', '{}'::jsonb)
        || jsonb_build_object('reason', p_reason))
      - (ARRAY['lastError'] || CASE WHEN p_settle IS TRUE THEN ARRAY['mail', 'link', 'from', 'replyTo'] ELSE '{}'::text[] END
         || CASE WHEN p_drop_submitted IS TRUE THEN ARRAY['submittedAt'] ELSE '{}'::text[] END))
    WHERE id = p_id AND status = 'pending' AND claim_token = p_token AND p_reason ~ '^[a-z][a-z0-9_]{0,39}$'
      AND store_outbox_caller(tenant_id) IS TRUE
    RETURNING 1)
  SELECT count(*)::int FROM done
$fn$;

-- Drops this claim's dispatch marker (and the first-submission time it set) when no request left after all; also once
-- a timeout failed the row under this claim.
CREATE FUNCTION store_outbox_release(p_id text, p_token uuid, p_own_submission boolean) RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  WITH done AS (
    UPDATE tenant_effect SET payload = jsonb_set(payload, '{delivery}', coalesce(payload->'delivery', '{}'::jsonb)
      - (ARRAY['dispatched', 'provider', 'account'] || CASE WHEN p_own_submission IS TRUE THEN ARRAY['submittedAt'] ELSE '{}'::text[] END))
    WHERE id = p_id AND status IN ('pending', 'failed') AND claim_token = p_token
      AND NOT coalesce((payload #>> '{delivery,sent}')::boolean, false) AND store_outbox_caller(tenant_id) IS TRUE
    RETURNING 1)
  SELECT count(*)::int FROM done
$fn$;

-- Why a guarded write changed nothing: is the effect still open (pending, not erased)? Nothing else of it is shown.
CREATE FUNCTION store_outbox_open(p_id text) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  SELECT (status = 'pending' AND erased_at IS NULL) FROM tenant_effect WHERE id = p_id AND store_outbox_caller(tenant_id) IS TRUE
$fn$;

-- Freezes the first rendering for this claim unless an earlier attempt did, from typed values; returns the stored
-- delivery record. The message sink checks the link against the booking again before every send.
CREATE FUNCTION store_outbox_freeze(p_id text, p_token uuid, p_first_attempt_at float8, p_subject text, p_text text, p_html text,
  p_from text, p_reply_to text, p_link_url text, p_link_exp float8) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  UPDATE tenant_effect SET payload = jsonb_set(payload, '{delivery}',
    CASE WHEN payload->'delivery' ? 'from' THEN payload->'delivery'
      ELSE coalesce(payload->'delivery', '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
        'firstAttemptAt', p_first_attempt_at,
        'mail', jsonb_build_object('subject', p_subject, 'text', p_text, 'html', p_html),
        'from', p_from, 'replyTo', p_reply_to,
        'link', CASE WHEN p_link_url IS NULL THEN NULL ELSE jsonb_build_object('url', p_link_url, 'exp', p_link_exp) END)) END)
  WHERE id = p_id AND status = 'pending' AND erased_at IS NULL AND claim_token = p_token
    AND p_subject IS NOT NULL AND p_text IS NOT NULL AND p_html IS NOT NULL AND p_from IS NOT NULL
    AND store_outbox_caller(tenant_id) IS TRUE
  RETURNING payload->'delivery'
$fn$;

-- Commits the `dispatched` marker of this claim before a real send (message-sink.ts, dispatch).
CREATE FUNCTION store_outbox_dispatch(p_id text, p_token uuid, p_provider text, p_account text, p_submitted_at float8)
RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  WITH done AS (
    UPDATE tenant_effect SET payload = jsonb_set(payload, '{delivery}', coalesce(payload->'delivery', '{}'::jsonb)
      || jsonb_build_object('dispatched', true, 'provider', coalesce(payload->'delivery'->>'provider', p_provider))
      || CASE WHEN payload->'delivery' ? 'provider' OR p_account IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('account', p_account) END
      || CASE WHEN payload->'delivery' ? 'submittedAt' THEN '{}'::jsonb ELSE jsonb_build_object('submittedAt', p_submitted_at) END)
    WHERE id = p_id AND status = 'pending' AND erased_at IS NULL AND claim_token = p_token
      AND store_outbox_caller(tenant_id) IS TRUE
    RETURNING 1)
  SELECT count(*)::int FROM done
$fn$;

-- What the message sink may see of the salon, for the current claim of a pending message only. The booking is the
-- exact one its stored reference names (`<booking id>-<kind>-<channel>-<date>:<start>:<staff>`, as
-- parseMessageReference reads it). Only what the message renders: the salon's name, address, phone, e-mail and booking
-- address, its language settings and cancellation terms, that booking, its customer's first name and contact,
-- its service, and the first name of its staff (and of the staff of the slot the message is about). No other
-- customer, booking, journal, note, staff phone or absence. With p_lock the salon's row is share-locked to the end
-- of the caller's transaction, the lock an erasure takes exclusively.
CREATE FUNCTION store_outbox_message_view(p_id text, p_token uuid, p_lock boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_tenant text;
  v_reference text;
  v_booking_id text;
  v_slot_staff text;
  v_doc jsonb;
  v_booking jsonb;
BEGIN
  SELECT e.tenant_id, e.payload->>'reference' INTO v_tenant, v_reference FROM tenant_effect e
  WHERE e.id = p_id AND e.kind = 'message' AND e.status = 'pending' AND e.claim_token = p_token
    AND store_outbox_caller(e.tenant_id) IS TRUE;
  -- NULL: no current claim with this token. An empty object: the claim holds, but there is nothing to render.
  IF v_tenant IS NULL THEN RETURN NULL; END IF;
  IF v_reference IS NULL THEN RETURN '{}'::jsonb; END IF;
  v_booking_id := substring(v_reference from '^(.+)-(?:confirmation|reminder|cancellation|moved)-(?:sms|email)-\d{4}-\d{2}-\d{2}:\d+:');
  v_slot_staff := substring(v_reference from '^.+-(?:confirmation|reminder|cancellation|moved)-(?:sms|email)-\d{4}-\d{2}-\d{2}:\d+:(.+?)(?:#\d+)?$');
  IF v_booking_id IS NULL THEN RETURN '{}'::jsonb; END IF;
  IF p_lock IS TRUE THEN
    SELECT s.doc INTO v_doc FROM tenant_state s WHERE s.tenant_id = v_tenant FOR SHARE;
  ELSE
    SELECT s.doc INTO v_doc FROM tenant_state s WHERE s.tenant_id = v_tenant;
  END IF;
  IF v_doc IS NULL THEN RETURN '{}'::jsonb; END IF;
  SELECT b INTO v_booking FROM jsonb_array_elements(coalesce(v_doc->'bookings', '[]')) b WHERE b->>'id' = v_booking_id LIMIT 1;
  RETURN (
    SELECT jsonb_object_agg(k, v) FROM jsonb_each(v_doc) AS t(k, v) WHERE jsonb_typeof(v) NOT IN ('object', 'array')
  ) || jsonb_build_object(
    'salon', (SELECT coalesce(jsonb_object_agg(k, v), '{}') FROM jsonb_each(coalesce(v_doc->'salon', '{}')) AS t(k, v)
      WHERE k IN ('name', 'address', 'phone', 'email', 'slug')),
    'localization', coalesce(v_doc->'localization', '{}'),
    'cancellationPolicy', coalesce(v_doc->'cancellationPolicy', 'null'),
    'bookings', CASE WHEN v_booking IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(v_booking) END,
    'customers', (SELECT coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', c->'id', 'firstName', c->'firstName',
        'email', c->'email', 'phone', c->'phone'))), '[]')
      FROM jsonb_array_elements(coalesce(v_doc->'customers', '[]')) c WHERE c->>'id' = v_booking->>'customerId'),
    'services', (SELECT coalesce(jsonb_agg(s), '[]') FROM jsonb_array_elements(coalesce(v_doc->'services', '[]')) s
      WHERE s->>'id' = v_booking->>'serviceId'),
    'retiredServices', (SELECT coalesce(jsonb_agg(s), '[]') FROM jsonb_array_elements(coalesce(v_doc->'retiredServices', '[]')) s
      WHERE s->>'id' = v_booking->>'serviceId'),
    'staff', (SELECT coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', m->'id', 'firstName', m->'firstName', 'name', m->'name'))), '[]')
      FROM jsonb_array_elements(coalesce(v_doc->'staff', '[]')) m WHERE m->>'id' IN (v_booking->>'staffId', v_slot_staff)),
    'categories', '[]'::jsonb, 'resources', '[]'::jsonb, 'exceptions', '[]'::jsonb, 'checkoutHolds', '[]'::jsonb,
    'inbox', '[]'::jsonb, 'log', '[]'::jsonb, 'trash', '[]'::jsonb);
END $fn$;

-- ---------------------------------------------------------------------------
-- The public booking page's address lookup (src/lib/public-booking.ts): the
-- tenant id of the salon with this booking address, and nothing of its row.
-- The page then reads the salon in that tenant's own scope.
-- ---------------------------------------------------------------------------
CREATE FUNCTION store_salon_by_slug(p_slug text) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  SELECT s.tenant_id FROM tenant_state s WHERE s.kind = 'salon' AND (s.doc #>> '{salon,slug}') = p_slug AND p_slug IS NOT NULL
    AND (store_caller_owns() OR store_caller_in('cresavo_app'))
$fn$;

-- ---------------------------------------------------------------------------
-- Retention sweeps (src/concept/store/store-sweepers.ts). The cutoffs are fixed
-- here and match src/concept/privacy/retention.ts (tests/store-rls-files.test.ts):
-- demo log 168 hours, outbox bodies 2160 hours (90 days), activity personal data
-- 13 months, journal reads 24 months (calendar months in UTC, as monthsBefore),
-- keys and sandboxes at expiry. Each call is one batch of 1 to 10000 rows, in the
-- sweep scope of cresavo_sweeper (or the table owner) only.
-- ---------------------------------------------------------------------------
CREATE FUNCTION store_sweep_idempotency(p_now timestamptz, p_limit integer) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_count integer;
BEGIN
  PERFORM store_sweep_check(p_limit);
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
  PERFORM store_sweep_check(p_limit);
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
  PERFORM store_sweep_check(p_limit);
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
  PERFORM store_sweep_check(p_limit);
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
  PERFORM store_sweep_check(p_limit);
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
  PERFORM store_sweep_check(p_limit);
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
  PERFORM store_sweep_check(p_limit);
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

-- The shared rate-limit table (src/concept/store/store-sweepers.ts): rows that expired more than a day ago, and the
-- owner sign-in lock state and reset-mail quota (keys acct:, strike:, lock:, mbx:) only once expired. An active row
-- is never removed, so the sweeper cannot lift a lock-out.
CREATE FUNCTION store_sweep_rate_limits(p_now timestamptz, p_limit integer) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_count integer;
BEGIN
  PERFORM store_sweep_check(p_limit);
  WITH expired AS (
    SELECT "key" FROM "RateLimitBucket"
    WHERE "expiresAt" < store_effective_now(p_now) - interval '24 hours'
    ORDER BY "expiresAt", "key" LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  DELETE FROM "RateLimitBucket" r USING expired e WHERE r."key" = e."key";
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $fn$;

CREATE FUNCTION store_sweep_owner_guard(p_now timestamptz, p_limit integer) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_count integer;
BEGIN
  PERFORM store_sweep_check(p_limit);
  DELETE FROM "RateLimitBucket" WHERE "key" IN (
    SELECT "key" FROM "RateLimitBucket"
    WHERE "expiresAt" <= store_effective_now(p_now)
      AND ("key" LIKE 'acct:%' OR "key" LIKE 'strike:%' OR "key" LIKE 'lock:%' OR "key" LIKE 'mbx:%')
    ORDER BY "expiresAt", "key" LIMIT p_limit
  )
  -- Repeated in the delete itself: a row renewed since the selection survives.
  AND "expiresAt" <= store_effective_now(p_now);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $fn$;

REVOKE ALL ON FUNCTION store_caller_owns(), store_caller_in(text), store_outbox_caller(text), store_effective_now(timestamptz),
  store_clock(timestamptz), store_bounded_ms(float8), store_sweep_check(integer), store_redact_path(jsonb, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION store_outbox_cancel_erased(timestamptz, text[]),
  store_outbox_claim(timestamptz, float8, float8, text[], text[], boolean),
  store_outbox_fail(text, uuid, timestamptz, timestamptz, boolean, boolean, boolean, text, boolean, boolean),
  store_outbox_skip(text, uuid), store_outbox_delivered(text, uuid, boolean), store_outbox_note(text, uuid, text, boolean, boolean),
  store_outbox_release(text, uuid, boolean), store_outbox_open(text),
  store_outbox_freeze(text, uuid, float8, text, text, text, text, text, text, float8),
  store_outbox_dispatch(text, uuid, text, text, float8), store_outbox_message_view(text, uuid, boolean), store_salon_by_slug(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION store_sweep_idempotency(timestamptz, integer), store_sweep_demo_actions(timestamptz, integer),
  store_sweep_sandboxes(timestamptz, integer), store_sweep_outbox_bodies(timestamptz, integer),
  store_sweep_activity_keys(timestamptz, integer), store_sweep_activity_redact(timestamptz, integer),
  store_sweep_journal_views(timestamptz, integer), store_sweep_rate_limits(timestamptz, integer),
  store_sweep_owner_guard(timestamptz, integer) FROM PUBLIC;
-- STORE FUNCTIONS END
