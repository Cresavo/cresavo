-- One salon per booking address: the public booking page looks a tenant up by
-- the slug in its document. Additive only; Prisma does not model expression
-- indexes, so the schema file is unchanged. Fails if two salon rows already
-- share a slug, which must then be resolved by hand before deploying. Run this
-- first; it must return no rows:
--
--   SELECT doc #>> '{salon,slug}' AS slug, count(*) FROM tenant_state
--   WHERE kind = 'salon' GROUP BY 1 HAVING count(*) > 1;
CREATE UNIQUE INDEX "tenant_state_salon_slug_key" ON "tenant_state" ((doc #>> '{salon,slug}')) WHERE kind = 'salon';
