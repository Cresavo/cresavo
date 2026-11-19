-- erase_subject(tenant, customerId): the SECURITY DEFINER form of
-- PostgresStudioStore.eraseSubject's table half (docs/design/STUDIO_STORE.md,
-- step 2 decision 3, item 7). Documentation for operators, NOT a migration:
-- the repository's migration role cannot create roles. Run it once per
-- environment, after studio-store.sql, as a role that may grant on the tables:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v eraser_role=cresavo_eraser -v app_role=cresavo_app \
--        -f prisma/grants/erase-subject.sql
--
-- Prerequisite, out of band: CREATE ROLE cresavo_eraser NOLOGIN; (no password,
-- it never logs in). Everything below runs in one transaction, so the
-- function never exists with the default EXECUTE grant to PUBLIC.
--
-- The application (PostgresStudioStore with `erasure: "function"`) calls it
-- inside the transaction that runs `customer/erase` on the document, after the
-- row lock and BEFORE the document is written (the function reads the
-- customer's name, phone and email from the document):
--
--   SELECT erase_subject($tenant, $customerId);
--
-- It only redacts: it never accepts replacement content from the caller, so
-- the application role still cannot rewrite the audit log.

-- statement
BEGIN;

-- statement
GRANT SELECT ON "tenant_state" TO :"eraser_role";
-- statement
GRANT SELECT, UPDATE ("action", "idempotency_key", "redacted_at") ON "tenant_action" TO :"eraser_role";
-- statement
GRANT SELECT, UPDATE ("payload", "status", "erased_at") ON "tenant_effect" TO :"eraser_role";
-- statement
GRANT SELECT, DELETE ON "tenant_idempotency" TO :"eraser_role";

-- statement
CREATE OR REPLACE FUNCTION studio_phone_digits(p text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp AS $fn$
  -- Same as normalizePhone in src/concept/booking/lookup.ts.
  SELECT regexp_replace(regexp_replace(regexp_replace(coalesce(p, ''), '\D', '', 'g'), '^(00)?46', ''), '^0', '')
$fn$;

-- statement
CREATE OR REPLACE FUNCTION studio_redact_path(v jsonb, p text[]) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp AS $fn$
DECLARE
  head text;
  rest text[];
  out jsonb;
BEGIN
  IF v IS NULL OR jsonb_typeof(v) = 'null' THEN RETURN v; END IF;
  IF cardinality(p) = 0 THEN RETURN to_jsonb('[redacted]'::text); END IF;
  head := p[1];
  rest := p[2:];
  IF head = '*' THEN
    IF jsonb_typeof(v) <> 'array' THEN RETURN v; END IF;
    SELECT coalesce(jsonb_agg(public.studio_redact_path(e, rest) ORDER BY o), '[]'::jsonb) INTO out
    FROM jsonb_array_elements(v) WITH ORDINALITY AS t(e, o);
    RETURN out;
  END IF;
  IF jsonb_typeof(v) <> 'object' OR NOT v ? head THEN RETURN v; END IF;
  RETURN jsonb_set(v, ARRAY[head], public.studio_redact_path(v -> head, rest));
END $fn$;

-- statement
-- Replaces each identifier (case-insensitive, longest first) in a text.
CREATE OR REPLACE FUNCTION studio_scrub_text(txt text, identifiers text[]) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp AS $fn$
DECLARE
  i text;
BEGIN
  IF txt IS NULL THEN RETURN NULL; END IF;
  FOREACH i IN ARRAY identifiers LOOP
    txt := regexp_replace(txt, regexp_replace(i, '([.*+?^${}()|\[\]\\])', '\\\1', 'g'), '[redacted]', 'gi');
  END LOOP;
  RETURN txt;
END $fn$;

-- statement
-- The same in every string value of a jsonb value; keys, numbers and structure are never touched.
CREATE OR REPLACE FUNCTION studio_scrub(v jsonb, identifiers text[]) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp AS $fn$
  SELECT CASE jsonb_typeof(v)
    WHEN 'string' THEN to_jsonb(public.studio_scrub_text(v #>> '{}', identifiers))
    WHEN 'array' THEN (SELECT coalesce(jsonb_agg(public.studio_scrub(e, identifiers) ORDER BY o), '[]'::jsonb)
                       FROM jsonb_array_elements(v) WITH ORDINALITY AS t(e, o))
    WHEN 'object' THEN (SELECT coalesce(jsonb_object_agg(k, public.studio_scrub(e, identifiers)), '{}'::jsonb)
                        FROM jsonb_each(v) AS t(k, e))
    ELSE v END
$fn$;

-- statement
CREATE OR REPLACE FUNCTION erase_subject(p_tenant text, p_customer text) RETURNS jsonb
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
    "booking/cancel": ["reason","notice.title","notice.body","notice.draftReply","notice.fromName","notice.reply"],
    "customers/import": ["customers.*.firstName","customers.*.lastName","customers.*.phone","customers.*.email","customers.*.birthday","customers.*.note"],
    "customer/note": ["note"],
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
  v_doc jsonb;
  v_customer jsonb;
  v_name text;
  v_phone text;
  v_digits text := '';
  v_identifiers text[] := '{}';
  v_contacts text[] := '{}';
  v_patterns text[];
  v_key_patterns text[];
  v_contact_patterns text[];
  v_id_patterns text[];
  v_recipient text := 'customer:' || p_customer;
  v_row record;
  v_next jsonb;
  v_path text;
  v_named bigint[] := '{}';
  v_actions integer := 0;
  v_effects integer := 0;
  v_pending_payments integer := 0;
  v_in_flight integer := 0;
  v_keys integer;
BEGIN
  -- The caller holds the row lock (SELECT ... FOR UPDATE in the same transaction).
  SELECT s.doc INTO v_doc FROM tenant_state s WHERE s.tenant_id = p_tenant;
  IF NOT FOUND THEN RAISE EXCEPTION 'erase_subject: unknown tenant'; END IF;
  SELECT c INTO v_customer FROM jsonb_array_elements(v_doc -> 'customers') c WHERE c ->> 'id' = p_customer LIMIT 1;
  IF v_customer IS NULL THEN
    SELECT t -> 'customer' INTO v_customer FROM jsonb_array_elements(v_doc -> 'trash') t
    WHERE t ->> 'kind' = 'customer' AND t -> 'customer' ->> 'id' = p_customer LIMIT 1;
  END IF;
  IF v_customer IS NOT NULL THEN
    v_name := regexp_replace(btrim(coalesce(v_customer ->> 'firstName', '') || ' ' || coalesce(v_customer ->> 'lastName', '')), '\s+', ' ', 'g');
    v_phone := btrim(coalesce(v_customer ->> 'phone', ''));
    v_digits := public.studio_phone_digits(v_phone);
    IF length(v_digits) < 7 THEN v_digits := ''; END IF;
    SELECT coalesce(array_agg(x ORDER BY length(x) DESC, x), '{}') INTO v_contacts FROM (
      SELECT DISTINCT x FROM unnest(ARRAY[v_phone, v_digits, btrim(coalesce(v_customer ->> 'email', ''))]) x
      WHERE length(x) >= 5) c;
    SELECT coalesce(array_agg(x ORDER BY length(x) DESC, x), '{}') INTO v_identifiers FROM (
      SELECT DISTINCT x FROM unnest(v_contacts || ARRAY[v_name]) x WHERE length(x) >= 5) i;
  END IF;
  -- LIKE patterns: in jsonb text (JSON-escaped), in plain text, and the customer's id in a stored result.
  SELECT coalesce(array_agg('%' || replace(replace(replace(substr(to_jsonb(x)::text, 2, length(to_jsonb(x)::text) - 2),
         '\', '\\'), '%', '\%'), '_', '\_') || '%'), '{}') INTO v_patterns FROM unnest(v_identifiers) x;
  SELECT coalesce(array_agg('%' || replace(replace(replace(substr(to_jsonb(x)::text, 2, length(to_jsonb(x)::text) - 2),
         '\', '\\'), '%', '\%'), '_', '\_') || '%'), '{}') INTO v_contact_patterns FROM unnest(v_contacts) x;
  SELECT coalesce(array_agg('%' || replace(replace(replace(x, '\', '\\'), '%', '\%'), '_', '\_') || '%'), '{}')
    INTO v_key_patterns FROM unnest(v_identifiers) x;
  SELECT array_agg('%"' || k || '": ' || replace(replace(replace(to_jsonb(p_customer)::text, '\', '\\'), '%', '\%'), '_', '\_') || '%')
    INTO v_id_patterns FROM unnest(ARRAY['customerId', 'id']) k;

  FOR v_row IN
    SELECT a.seq, a.action, a.idempotency_key,
      (a.subject_ids @> ARRAY[p_customer]
        OR a.action::text ILIKE ANY(v_contact_patterns)
        OR jsonb_path_exists(a.action, 'lax $.** ? (@.customerId == $c || (@.id == $c && exists(@.firstName)))', jsonb_build_object('c', p_customer))
        OR (v_digits <> '' AND EXISTS (
          SELECT 1 FROM jsonb_path_query(a.action, 'lax $.**.phone') p
          WHERE jsonb_typeof(p) = 'string' AND public.studio_phone_digits(p #>> '{}') = v_digits))) AS theirs
    FROM tenant_action a
    WHERE a.tenant_id = p_tenant
      AND (a.subject_ids @> ARRAY[p_customer] OR a.action::text ILIKE ANY(v_patterns) OR a.idempotency_key ILIKE ANY(v_key_patterns)
        OR (v_digits <> '' AND EXISTS (
          SELECT 1 FROM jsonb_path_query(a.action, 'lax $.**.phone') p
          WHERE jsonb_typeof(p) = 'string' AND public.studio_phone_digits(p #>> '{}') = v_digits)))
    ORDER BY a.seq
  LOOP
    v_next := v_row.action;
    IF v_row.theirs THEN
      v_named := v_named || v_row.seq;
      FOR v_path IN SELECT jsonb_array_elements_text(coalesce(v_fields -> (v_row.action ->> 'type'), '[]')) LOOP
        v_next := public.studio_redact_path(v_next, string_to_array(v_path, '.'));
      END LOOP;
    END IF;
    UPDATE tenant_action
    SET action = public.studio_scrub(v_next, v_identifiers),
        idempotency_key = public.studio_scrub_text(v_row.idempotency_key, v_identifiers),
        redacted_at = coalesce(redacted_at, clock_timestamp())
    WHERE tenant_id = p_tenant AND seq = v_row.seq;
    v_actions := v_actions + 1;
  END LOOP;

  -- Locked, so an acknowledgement waits for this transaction and a claim skips these rows.
  FOR v_row IN
    SELECT e.id, e.kind, e.status, e.payload, coalesce(e.leased_until > clock_timestamp(), false) AS leased,
      (e.kind = 'message' AND v_recipient = ANY(SELECT btrim(x) FROM unnest(string_to_array(coalesce(e.payload ->> 'to', ''), ',')) x)) AS addressed
    FROM tenant_effect e
    WHERE e.tenant_id = p_tenant
      AND ((e.kind = 'payment' AND e.seq = ANY(v_named)) OR e.payload::text ILIKE ANY(v_patterns)
        OR (e.kind = 'message' AND strpos(coalesce(e.payload ->> 'to', ''), v_recipient) > 0))
    ORDER BY e.seq, e.n
    FOR UPDATE OF e
  LOOP
    IF v_row.kind = 'payment' AND v_row.status = 'pending' THEN
      v_pending_payments := v_pending_payments + 1;
      CONTINUE;
    END IF;
    IF v_row.addressed THEN
      v_next := v_row.payload || '{"body": "[redacted]"}'::jsonb;
      IF v_next ? 'to' THEN v_next := v_next || '{"to": "[redacted]"}'::jsonb; END IF;
      IF v_next ? 'subject' THEN v_next := v_next || '{"subject": "[redacted]"}'::jsonb; END IF;
      v_next := public.studio_scrub(v_next, v_identifiers);
      IF v_row.status <> 'pending' THEN
        UPDATE tenant_effect SET payload = v_next WHERE id = v_row.id;
      ELSIF v_row.leased THEN
        -- A deliverer is sending it right now: stopped for any retry, and reported.
        v_in_flight := v_in_flight + 1;
        UPDATE tenant_effect SET payload = v_next, erased_at = clock_timestamp() WHERE id = v_row.id;
      ELSE
        UPDATE tenant_effect SET payload = v_next, status = 'cancelled', erased_at = clock_timestamp() WHERE id = v_row.id;
      END IF;
      v_effects := v_effects + 1;
      CONTINUE;
    END IF;
    -- A payment, or a message to someone else that mentions them: only the identifiers go.
    v_next := public.studio_scrub(v_row.payload, v_identifiers);
    IF v_next IS DISTINCT FROM v_row.payload THEN
      UPDATE tenant_effect SET payload = v_next WHERE id = v_row.id;
      v_effects := v_effects + 1;
    END IF;
  END LOOP;

  -- Stored results are state copies: forget those that hold the customer, keep the rest.
  DELETE FROM tenant_idempotency
  WHERE tenant_id = p_tenant AND (result::text LIKE ANY(v_id_patterns) OR result::text ILIKE ANY(v_patterns));
  GET DIAGNOSTICS v_keys = ROW_COUNT;
  RETURN jsonb_build_object('actions', v_actions, 'effects', v_effects, 'idempotencyKeys', v_keys,
                            'pendingPayments', v_pending_payments, 'inFlightMessages', v_in_flight);
END $fn$;

-- statement
REVOKE ALL ON FUNCTION studio_phone_digits(text), studio_redact_path(jsonb, text[]), studio_scrub_text(text, text[]),
  studio_scrub(jsonb, text[]), erase_subject(text, text) FROM PUBLIC;
-- statement
ALTER FUNCTION studio_phone_digits(text) OWNER TO :"eraser_role";
-- statement
ALTER FUNCTION studio_redact_path(jsonb, text[]) OWNER TO :"eraser_role";
-- statement
ALTER FUNCTION studio_scrub_text(text, text[]) OWNER TO :"eraser_role";
-- statement
ALTER FUNCTION studio_scrub(jsonb, text[]) OWNER TO :"eraser_role";
-- statement
ALTER FUNCTION erase_subject(text, text) OWNER TO :"eraser_role";
-- statement
GRANT EXECUTE ON FUNCTION erase_subject(text, text) TO :"app_role";

-- statement
COMMIT;

-- Check: only the eraser role (owner) and the application role may execute it.
--   SELECT has_function_privilege('public', 'erase_subject(text, text)', 'EXECUTE');  -- must be false
