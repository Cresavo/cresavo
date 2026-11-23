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
GRANT SELECT, UPDATE ("key", "result") ON "tenant_idempotency" TO :"eraser_role";
-- statement
-- Server-side journals: the customer's encrypted versions are deleted, and another customer's version that named
-- them is replaced by the scrubbed copy the store encrypted (studio_erase_journal_mentions).
GRANT SELECT, INSERT, DELETE ON "journal_entry" TO :"eraser_role";

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
-- The action of a stored replay's entry, when it concerns the customer: every personal field of its type (the map below) is replaced,
-- not only text that matches an identifier. Same rule as `theirs` in erase_subject.
CREATE OR REPLACE FUNCTION studio_redact_replay_action(r jsonb, p_customer text, digit_list text[], contact_patterns text[], fields jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp AS $fn$
DECLARE
  act jsonb := r #> '{entry,action}';
  path text;
BEGIN
  IF act IS NULL OR jsonb_typeof(act) <> 'object' THEN RETURN r; END IF;
  IF NOT ((act ->> 'type' LIKE 'customer/%' AND act ->> 'id' = p_customer)
      OR jsonb_path_exists(act, 'lax $.** ? (@.customerId == $c || (@.id == $c && exists(@.firstName)))', jsonb_build_object('c', p_customer))
      OR act::text ILIKE ANY(contact_patterns)
      OR (cardinality(digit_list) > 0 AND EXISTS (
        SELECT 1 FROM jsonb_path_query(act, 'lax $.**.phone') p
        WHERE jsonb_typeof(p) = 'string' AND public.studio_phone_digits(p #>> '{}') = ANY(digit_list)))) THEN
    RETURN r;
  END IF;
  FOR path IN SELECT jsonb_array_elements_text(coalesce(fields -> (act ->> 'type'), '[]')) LOOP
    act := public.studio_redact_path(act, string_to_array(path, '.'));
  END LOOP;
  RETURN jsonb_set(r, '{entry,action}', act);
END $fn$;

-- statement
-- A stored replay result after an erasure: the customer's records, card and trash entry leave its salon snapshot and their identifiers are replaced.
CREATE OR REPLACE FUNCTION studio_redact_replay(r jsonb, p_customer text, identifiers text[], digit_list text[]) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp AS $fn$
  SELECT public.studio_scrub(
    CASE WHEN jsonb_typeof(r -> 'state') = 'object' THEN jsonb_set(r, '{state}', (
      SELECT coalesce(jsonb_object_agg(t.k, CASE
        WHEN jsonb_typeof(t.v) <> 'array' THEN t.v
        WHEN t.k = 'log' THEN (SELECT coalesce(jsonb_agg(e - 'patch' - 'before' - 'after' ORDER BY o), '[]'::jsonb) FROM jsonb_array_elements(t.v) WITH ORDINALITY AS x(e, o))
        WHEN t.k = 'customers' THEN (SELECT coalesce(jsonb_agg(e ORDER BY o), '[]'::jsonb) FROM jsonb_array_elements(t.v) WITH ORDINALITY AS x(e, o) WHERE e ->> 'id' IS DISTINCT FROM p_customer)
        WHEN t.k = 'checkoutHolds' THEN (SELECT coalesce(jsonb_agg(e ORDER BY o), '[]'::jsonb) FROM jsonb_array_elements(t.v) WITH ORDINALITY AS x(e, o) WHERE NOT (public.studio_phone_digits(e -> 'guest' ->> 'phone') = ANY(digit_list)))
        WHEN t.k = 'trash' THEN (SELECT coalesce(jsonb_agg(e ORDER BY o), '[]'::jsonb) FROM jsonb_array_elements(t.v) WITH ORDINALITY AS x(e, o) WHERE NOT (e ->> 'kind' = 'customer' AND e -> 'customer' ->> 'id' = p_customer))
        ELSE (SELECT coalesce(jsonb_agg(e ORDER BY o), '[]'::jsonb) FROM jsonb_array_elements(t.v) WITH ORDINALITY AS x(e, o) WHERE e ->> 'customerId' IS DISTINCT FROM p_customer)
      END), '{}'::jsonb)
      FROM jsonb_each(r -> 'state') AS t(k, v)))
    ELSE r END, identifiers)
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
  v_doc jsonb;
  v_customer jsonb;
  v_name text;
  v_phone text;
  v_digits text := '';
  v_digit_list text[] := '{}';
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
  v_journals integer;
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
    -- Every number the card has had, in any format.
    SELECT coalesce(array_agg(DISTINCT d), '{}') INTO v_digit_list FROM (
      SELECT v_digits AS d
      UNION SELECT public.studio_phone_digits(e) FROM jsonb_array_elements_text(coalesce(v_customer -> 'earlier', '[]'::jsonb)) e) q
    WHERE length(d) >= 7;
    SELECT coalesce(array_agg(x ORDER BY length(x) DESC, x), '{}') INTO v_contacts FROM (
      SELECT DISTINCT x FROM unnest(ARRAY[v_phone, v_digits, btrim(coalesce(v_customer ->> 'email', ''))]
        -- Names, numbers and addresses the card had before a correction (Customer.earlier), and the digits of those numbers.
        || ARRAY(SELECT btrim(e) FROM jsonb_array_elements_text(coalesce(v_customer -> 'earlier', '[]'::jsonb)) e)
        || ARRAY(SELECT d FROM (SELECT public.studio_phone_digits(e) AS d FROM jsonb_array_elements_text(coalesce(v_customer -> 'earlier', '[]'::jsonb)) e) q WHERE length(d) >= 7)) x
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
        OR (cardinality(v_digit_list) > 0 AND EXISTS (
          SELECT 1 FROM jsonb_path_query(a.action, 'lax $.**.phone') p
          WHERE jsonb_typeof(p) = 'string' AND public.studio_phone_digits(p #>> '{}') = ANY(v_digit_list)))) AS theirs
    FROM tenant_action a
    WHERE a.tenant_id = p_tenant
      AND (a.subject_ids @> ARRAY[p_customer] OR a.action::text ILIKE ANY(v_patterns) OR a.idempotency_key ILIKE ANY(v_key_patterns)
        OR (cardinality(v_digit_list) > 0 AND EXISTS (
          SELECT 1 FROM jsonb_path_query(a.action, 'lax $.**.phone') p
          WHERE jsonb_typeof(p) = 'string' AND public.studio_phone_digits(p #>> '{}') = ANY(v_digit_list))))
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
      v_next := (v_row.payload - 'delivery') || '{"body": "[redacted]"}'::jsonb;
      IF v_next ? 'to' THEN v_next := v_next || '{"to": "[redacted]"}'::jsonb; END IF;
      IF v_next ? 'subject' THEN v_next := v_next || '{"subject": "[redacted]"}'::jsonb; END IF;
      v_next := public.studio_scrub(v_next, v_identifiers);
      IF v_row.status <> 'pending' THEN
        UPDATE tenant_effect SET payload = v_next WHERE id = v_row.id;
      ELSE
        -- Pending or claimed, it is cancelled here. A deliverer that has not dispatched yet finds it cancelled
        -- under its own claim and sends nothing; one that has is reported and records its outcome.
        IF v_row.leased THEN v_in_flight := v_in_flight + 1; END IF;
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

  -- Stored results are state copies. A row is never deleted (a retry would run again): the customer is removed from its snapshot and their
  -- identifiers replaced, and a key that itself holds an identifier is replaced by its hash, which a retry under the same key still finds.
  UPDATE tenant_idempotency SET
    key = CASE WHEN key ILIKE ANY(v_key_patterns) THEN 'erased-' || encode(sha256(convert_to(key, 'UTF8')), 'hex') ELSE key END,
    result = public.studio_redact_replay(public.studio_redact_replay_action(result, p_customer, v_digit_list, v_contact_patterns, v_fields), p_customer, v_identifiers, v_digit_list)
  WHERE tenant_id = p_tenant AND (key ILIKE ANY(v_key_patterns) OR result::text LIKE ANY(v_id_patterns) OR result::text ILIKE ANY(v_patterns))
    -- A row that is already redacted (a repeated erasure) is left alone and not counted.
    AND (key ILIKE ANY(v_key_patterns) OR public.studio_redact_replay(public.studio_redact_replay_action(result, p_customer, v_digit_list, v_contact_patterns, v_fields), p_customer, v_identifiers, v_digit_list) IS DISTINCT FROM result);
  GET DIAGNOSTICS v_keys = ROW_COUNT;

  -- Server-side journals: every version of the customer's entries (studio_erase_journal_mentions replaced the
  -- versions of other customers' entries that named them before this call). Found by their columns alone.
  DELETE FROM journal_entry o WHERE o.tenant_id = p_tenant AND o.customer_id = p_customer;
  GET DIAGNOSTICS v_journals = ROW_COUNT;
  RETURN jsonb_build_object('actions', v_actions, 'effects', v_effects, 'idempotencyKeys', v_keys, 'journalEntries', v_journals,
                            'pendingPayments', v_pending_payments, 'inFlightMessages', v_in_flight);
END $fn$;

-- statement
-- Server-side journals, before erase_subject in the same transaction: each version of ANOTHER customer's entry that
-- named the customer being erased is replaced by its scrubbed copy, which the store encrypted for the next version
-- of that entry (p_copies: [{id, replaces, version, ciphertext, iv, keyVersion}], ciphertext and iv in base64). The
-- copy keeps the replaced version's customer, author and trash mark, links to it (`replaces`), and the replaced
-- version is deleted at once: a link is only ever made and used inside this erasure. Refused unless the customer is
-- still in the salon's document (the caller holds its row lock), and for a version of the customer's own entries.
CREATE OR REPLACE FUNCTION studio_erase_journal_mentions(p_tenant text, p_customer text, p_copies jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_copy jsonb;
  v_old record;
  v_count integer := 0;
BEGIN
  IF jsonb_typeof(coalesce(p_copies, '[]'::jsonb)) <> 'array' THEN RAISE EXCEPTION 'studio_erase_journal_mentions: copies must be an array'; END IF;
  IF NOT EXISTS (SELECT 1 FROM tenant_state s WHERE s.tenant_id = p_tenant AND (
      EXISTS (SELECT 1 FROM jsonb_array_elements(s.doc -> 'customers') c WHERE c ->> 'id' = p_customer)
      OR EXISTS (SELECT 1 FROM jsonb_array_elements(s.doc -> 'trash') t WHERE t ->> 'kind' = 'customer' AND t -> 'customer' ->> 'id' = p_customer))) THEN
    RAISE EXCEPTION 'studio_erase_journal_mentions: unknown customer';
  END IF;
  FOR v_copy IN SELECT jsonb_array_elements(coalesce(p_copies, '[]'::jsonb)) LOOP
    SELECT j.customer_id, j.id, j.version, j.author, j.deleted_at INTO v_old FROM journal_entry j
    WHERE j.tenant_id = p_tenant AND j.id = v_copy ->> 'id' AND j.version = (v_copy ->> 'replaces')::integer;
    IF NOT FOUND OR v_old.customer_id = p_customer THEN RAISE EXCEPTION 'studio_erase_journal_mentions: no such version'; END IF;
    IF (v_copy ->> 'version')::integer IS DISTINCT FROM
        (SELECT max(j.version) + 1 FROM journal_entry j WHERE j.tenant_id = p_tenant AND j.id = v_old.id) THEN
      RAISE EXCEPTION 'studio_erase_journal_mentions: not the next version';
    END IF;
    INSERT INTO journal_entry (tenant_id, customer_id, id, version, author, ciphertext, iv, key_version, replaces, deleted_at)
    VALUES (p_tenant, v_old.customer_id, v_old.id, (v_copy ->> 'version')::integer, v_old.author,
            decode(v_copy ->> 'ciphertext', 'base64'), decode(v_copy ->> 'iv', 'base64'), (v_copy ->> 'keyVersion')::integer,
            v_old.version, v_old.deleted_at);
    DELETE FROM journal_entry j WHERE j.tenant_id = p_tenant AND j.id = v_old.id AND j.version = v_old.version;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $fn$;

-- statement
REVOKE ALL ON FUNCTION studio_phone_digits(text), studio_redact_path(jsonb, text[]), studio_scrub_text(text, text[]),
  studio_scrub(jsonb, text[]), studio_redact_replay(jsonb, text, text[], text[]), studio_redact_replay_action(jsonb, text, text[], text[], jsonb), erase_subject(text, text), studio_erase_journal_mentions(text, text, jsonb) FROM PUBLIC;
-- statement
ALTER FUNCTION studio_phone_digits(text) OWNER TO :"eraser_role";
-- statement
ALTER FUNCTION studio_redact_path(jsonb, text[]) OWNER TO :"eraser_role";
-- statement
ALTER FUNCTION studio_scrub_text(text, text[]) OWNER TO :"eraser_role";
-- statement
ALTER FUNCTION studio_scrub(jsonb, text[]) OWNER TO :"eraser_role";
-- statement
ALTER FUNCTION studio_redact_replay(jsonb, text, text[], text[]) OWNER TO :"eraser_role";
-- statement
ALTER FUNCTION studio_redact_replay_action(jsonb, text, text[], text[], jsonb) OWNER TO :"eraser_role";
-- statement
ALTER FUNCTION erase_subject(text, text) OWNER TO :"eraser_role";
-- statement
ALTER FUNCTION studio_erase_journal_mentions(text, text, jsonb) OWNER TO :"eraser_role";
-- statement
GRANT EXECUTE ON FUNCTION erase_subject(text, text) TO :"app_role";
-- statement
GRANT EXECUTE ON FUNCTION studio_erase_journal_mentions(text, text, jsonb) TO :"app_role";

-- statement
COMMIT;

-- Check: only the eraser role (owner) and the application role may execute it.
--   SELECT has_function_privilege('public', 'erase_subject(text, text)', 'EXECUTE');  -- must be false
