# Platform vs customer brand

## Platform (Libovo)

Used in product login, main owner/staff dashboard, developer documentation, platform settings, transactional system support communication. Libovo's plum/apricot tokens apply to the app **shell**.

## Customer (tenant)

Used on its public booking pages, customer reminders and cards, customer portal, and marketing assets. Tenant logo & chosen accent color override a strictly scoped `--tenant-accent` in customer-facing components only. Tenant settings must not change the platform's destructive/error/success colors.

Default look if tenant has no brand kit: restrained, neutral ink/white; subtle Libovo attribution only if chosen product policy permits it.

Per tenant, store: logo transparent SVG/PNG, logo alt text, brand color + safe on-brand text color, cover/hero image if provided, allowed font optional, preferred language/timezone. Validate contrast automatically, provide fallback, avoid custom fonts for checkout performance.

**Never** force Libovo's warm apricot on Salong Eko's public booking flow, or assume every tenant is a spa or salon. All sample data in previews is fictional.
