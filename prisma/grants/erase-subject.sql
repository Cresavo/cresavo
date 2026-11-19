-- erase_subject(tenant, customerId): the SECURITY DEFINER form of
-- PostgresStudioStore.eraseSubject's table half (docs/design/STUDIO_STORE.md,
-- step 2 decision 3, item 7). Documentation for operators, NOT a migration:
-- the repository's migration role cannot create roles, so the store currently
-- runs the same statements itself. Run this as a role that may create roles,
-- after studio-store.sql. Role names are placeholders.
--
-- The application calls it inside the transaction that runs `customer/erase`
-- on the document, after the row lock and BEFORE the document is written (the
-- function reads the customer's name, phone and email from the document):
--
--   SELECT erase_subject($tenant, $customerId);
--
-- It only redacts: it never accepts replacement content from the caller, so
-- the application role still cannot rewrite the audit log.

-- CREATE ROLE cresavo_eraser NOLOGIN;
-- GRANT SELECT ON "tenant_state" TO cresavo_eraser;
-- GRANT SELECT, UPDATE ("action", "redacted_at") ON "tenant_action" TO cresavo_eraser;
-- GRANT SELECT, UPDATE ("payload", "status") ON "tenant_effect" TO cresavo_eraser;
-- GRANT SELECT, DELETE ON "tenant_idempotency" TO cresavo_eraser;

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
    SELECT coalesce(jsonb_agg(studio_redact_path(e, rest) ORDER BY o), '[]'::jsonb) INTO out
    FROM jsonb_array_elements(v) WITH ORDINALITY AS t(e, o);
    RETURN out;
  END IF;
  IF jsonb_typeof(v) <> 'object' OR NOT v ? head THEN RETURN v; END IF;
  RETURN jsonb_set(v, ARRAY[head], studio_redact_path(v -> head, rest));
END $fn$;

-- statement
-- Replaces each identifier (case-insensitive) inside the string values of a jsonb value.
CREATE OR REPLACE FUNCTION studio_scrub(v jsonb, identifiers text[]) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp AS $fn$
DECLARE
  i text;
  txt text := v::text;
BEGIN
  FOREACH i IN ARRAY identifiers LOOP
    txt := regexp_replace(txt, regexp_replace(substr(to_jsonb(i)::text, 2, length(to_jsonb(i)::text) - 2),
                                              '([.*+?^${}()|\[\]\\])', '\\\1', 'g'), '[redacted]', 'gi');
  END LOOP;
  RETURN txt::jsonb;
END $fn$;

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
    "booking/cancel": ["reason","notice.title","notice.body","notice.draftReply","notice.fromName","notice.reply"],
    "customers/import": ["customers.*.firstName","customers.*.lastName","customers.*.phone","customers.*.email","customers.*.birthday","customers.*.note"],
    "customer/note": ["note"],
    "customers/message": ["texts.*.title","texts.*.body"],
    "inbox/add": ["item.title","item.body","item.draftReply","item.fromName","item.reply"],
    "inbox/reply": ["reply"],
    "review/submit": ["text"],
    "review/reply": ["reply"],
    "journal/add": ["entry.treatment","entry.observations","entry.advice","entry.nextVisit","entry.photos"],
    "journal/edit": ["content.treatment","content.observations","content.advice","content.nextVisit","content.photos"],
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
  v_digits text;
  v_identifiers text[] := '{}';
  v_contacts text[] := '{}';
  v_patterns text[];
  v_contact_patterns text[];
  v_row record;
  v_next jsonb;
  v_path text;
  v_named bigint[] := '{}';
  v_actions integer := 0;
  v_effects integer := 0;
  v_pending_payments integer := 0;
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
    v_digits := regexp_replace(regexp_replace(regexp_replace(v_phone, '\D', '', 'g'), '^(00)?46', ''), '^0', '');
    SELECT coalesce(array_agg(x ORDER BY length(x) DESC), '{}') INTO v_contacts FROM (
      SELECT DISTINCT x FROM unnest(ARRAY[v_phone, CASE WHEN length(v_digits) >= 7 THEN v_digits ELSE '' END, btrim(coalesce(v_customer ->> 'email', ''))]) x
      WHERE length(x) >= 5) c;
    SELECT coalesce(array_agg(x ORDER BY length(x) DESC), '{}') INTO v_identifiers FROM (
      SELECT DISTINCT x FROM unnest(v_contacts || ARRAY[v_name]) x WHERE length(x) >= 5) i;
  END IF;
  SELECT coalesce(array_agg('%' || replace(replace(replace(substr(to_jsonb(x)::text, 2, length(to_jsonb(x)::text) - 2),
         '\', '\\'), '%', '\%'), '_', '\_') || '%'), '{}') INTO v_patterns FROM unnest(v_identifiers) x;
  SELECT coalesce(array_agg('%' || replace(replace(replace(substr(to_jsonb(x)::text, 2, length(to_jsonb(x)::text) - 2),
         '\', '\\'), '%', '\%'), '_', '\_') || '%'), '{}') INTO v_contact_patterns FROM unnest(v_contacts) x;

  FOR v_row IN
    SELECT a.seq, a.action,
      (a.subject_ids @> ARRAY[p_customer]
        OR a.action::text ILIKE ANY(v_contact_patterns)
        OR jsonb_path_exists(a.action, '$.** ? (@.customerId == $c)', jsonb_build_object('c', p_customer))) AS theirs
    FROM tenant_action a
    WHERE a.tenant_id = p_tenant AND (a.subject_ids @> ARRAY[p_customer] OR a.action::text ILIKE ANY(v_patterns))
  LOOP
    v_next := v_row.action;
    IF v_row.theirs THEN
      v_named := v_named || v_row.seq;
      FOR v_path IN SELECT jsonb_array_elements_text(coalesce(v_fields -> (v_row.action ->> 'type'), '[]')) LOOP
        v_next := studio_redact_path(v_next, string_to_array(v_path, '.'));
      END LOOP;
    END IF;
    v_next := studio_scrub(v_next, v_identifiers);
    UPDATE tenant_action SET action = v_next, redacted_at = coalesce(redacted_at, clock_timestamp())
    WHERE tenant_id = p_tenant AND seq = v_row.seq;
    v_actions := v_actions + 1;
  END LOOP;

  FOR v_row IN
    SELECT e.id, e.kind, e.status, e.payload FROM tenant_effect e
    WHERE e.tenant_id = p_tenant AND (e.seq = ANY(v_named) OR e.payload::text ILIKE ANY(v_patterns))
  LOOP
    IF v_row.status = 'pending' AND v_row.kind = 'payment' THEN
      v_pending_payments := v_pending_payments + 1;
      CONTINUE;
    END IF;
    v_next := v_row.payload;
    IF v_next ->> 'port' <> 'payments' THEN
      v_next := v_next || '{"body": "[redacted]"}'::jsonb;
      IF v_next ? 'to' THEN v_next := v_next || '{"to": "[redacted]"}'::jsonb; END IF;
      IF v_next ? 'subject' THEN v_next := v_next || '{"subject": "[redacted]"}'::jsonb; END IF;
    END IF;
    UPDATE tenant_effect
    SET payload = studio_scrub(v_next, v_identifiers), status = CASE WHEN status = 'pending' THEN 'cancelled' ELSE status END
    WHERE id = v_row.id;
    v_effects := v_effects + 1;
  END LOOP;

  DELETE FROM tenant_idempotency WHERE tenant_id = p_tenant;
  GET DIAGNOSTICS v_keys = ROW_COUNT;
  RETURN jsonb_build_object('actions', v_actions, 'effects', v_effects, 'idempotencyKeys', v_keys, 'pendingPayments', v_pending_payments);
END $fn$;

-- ALTER FUNCTION erase_subject(text, text) OWNER TO cresavo_eraser;
-- REVOKE ALL ON FUNCTION erase_subject(text, text) FROM PUBLIC;
-- GRANT EXECUTE ON FUNCTION erase_subject(text, text) TO cresavo_app;
