# Photo library storage

The photo library (roadmap stage 1) keeps a business's own photos and its
logo. Each picture is one `media_asset` row: its metadata, and its bytes in
the row (the default Postgres store) or in an S3-compatible bucket. Owners
upload and manage pictures under Campaigns, Photos and Booking page, Logo,
while signed in (`OWNER_ACCOUNTS_ENABLED`). The public demo stores nothing.

## What is stored

- Only complete still JPEG, PNG and WebP images, recognised from the file's
  own bytes. SVG, HEIC (the studio turns HEIC into JPEG in the browser when it
  can) and animated PNG or WebP are refused, and so is anything over
  40 megapixels or a file whose structure does not add up.
- Each picture is rebuilt from an allowlist before it is stored: what a
  decoder needs, and a valid ICC colour profile. Everything else goes: EXIF
  (with the GPS position), XMP, IPTC, comments, thumbnails (also the one a
  JFIF header can hold), C2PA and other provenance manifests, time stamps and
  the images a phone appends. The picture data is not re-encoded. A rotated
  photo gets a new EXIF block with only its orientation, and a JPEG keeps
  only Adobe's colour transform byte when it needs it. The rebuild caps the
  number of segments and never writes more than the upload's size.
- Limits: 8 MB per file, 300 photos per business, 60 uploads per 15 minutes,
  and 500 MB of storage per business. Storage counts everything not yet
  purged, deleted pictures included, so deleting does not free space until
  the sweep has run.
- Photos are private: the app serves them to the signed-in owner after its
  own checks. A logo is published when the owner saves the booking page that
  uses it; until then only its owner sees it, in the editor's preview. Saving
  a new logo, or none, retires the published one. The public address holds
  the logo's id and the SHA-256 of its bytes, and answers only while the
  saved page uses it. Copies may be kept for five minutes
  (`max-age=300, must-revalidate`).
- A logo is also rebuilt without its ICC profile: it is published and needs
  none.
- An account salon's page can no longer take a new inline (data URL) logo;
  the demo, which stores nothing on the server, still can. No account salons
  existed when this was introduced, so there are no older inline logos to
  clean up; one would be kept as it is until the owner uploads a logo.
- The public logo also requires what the public booking page requires: an
  active owner account and a salon that has not expired. Only the demo photos
  go through Next.js's image optimiser (`images.localPatterns` in
  `next.config.ts`), so no optimised copy of a logo outlives it.
- The studio binds each batch of picked files to the session it was picked
  in and sends it in `x-cresavo-session`; the server refuses an upload for
  any other session before it reads a byte.
- A deleted photo can be restored for one day and is purged by
  `npm run store:sweep` 30 days after deletion. A logo that was uploaded and
  replaced before any page used it is purged after an hour.

## Settings

| Variable | Meaning |
| --- | --- |
| `MEDIA_STORE` | `postgres` (default) or `s3`. Each row remembers its own store, so pictures uploaded before a switch are still served and purged. |
| `MEDIA_S3_ENDPOINT` | The service's HTTPS endpoint, for example `https://s3.eu-north-1.amazonaws.com`. Requests are path-style (`<endpoint>/<bucket>/<key>`). Plain HTTP is accepted only for localhost. |
| `MEDIA_S3_REGION` | The bucket's region, for signing. |
| `MEDIA_S3_BUCKET` | The bucket. Keep it private: no public ACL, no public bucket policy, block public access on. |
| `MEDIA_S3_ACCESS_KEY_ID`, `MEDIA_S3_SECRET_ACCESS_KEY` | A key that can only `PutObject`, `GetObject` and `DeleteObject` in that bucket. Keep it in the secret store. It is never logged or put in an error message. |

The sweep job needs the `MEDIA_S3_*` settings too when `MEDIA_STORE=s3`, or
whenever any row is stored in S3. Requests are signed with AWS Signature
Version 4. The app uses no SDK.

With S3, an upload first writes its row as `pending`, then sends the bytes,
then marks the row `ready`. A failed or abandoned upload stays pending, and
the sweep removes its object and row after an hour. The sweep purges each
picture on its own: it locks the row, checks again that it is due, deletes
the object and then the row, and reports the ones the store refused
(`mediaFailed`); they are tried again on the next run. An upload whose row is
gone by the time it is confirmed fails and removes its object. Object keys are always
`media/<tenant>/<id>`: the database checks this, and the app checks it again
before every read and delete.

## Choosing EU storage

Photos may show people. Keep them in the EU/EEA and choose a provider that
signs a data processing agreement:

- With the default store, the photos are in the same database and region as
  the rest of the salon data. No new sub-processor is added.
- With `s3`, choose a bucket region in the EU (for example Stockholm or
  Frankfurt) with a provider that keeps data and support access in the EU.
  Add the provider to `docs/legal/SUBPROCESSORS.md` before real customers
  use it.
- Turn on server-side encryption at rest for the bucket.

## Backups

- **Postgres store:** the bytes are in `media_asset.bytes`, so every database
  backup and point-in-time restore includes them. Photos make the database
  grow by up to 500 MB per business. Check backup size and restore time
  ([backup drill](BACKUP_RESTORE.md)).
- **S3 store:** the database backup holds only the rows. Turn on bucket
  versioning, and keep a copy or replication in a second EU location with
  its own retention. A restore needs both, from about the same time: a row
  whose object is gone serves "not found".
- Purges: the sweep deletes the object first and then the row. With
  versioning on, deleted objects stay as old versions. Set a lifecycle rule
  that removes noncurrent versions after your backup retention, so that a
  photo the owner deleted does not stay forever.

## Roles

`prisma/grants/roles.sql` lets the app login read, insert, mark deleted and
describe pictures, but not rewrite or delete them. The sweeper login reads
only `id`, `storage`, `storage_key` and `deleted_at` and deletes rows. It
never reads the bytes or the description. Support sees sizes and counts only.
`verify-roles.sql` checks this. Run `roles.sql` again after deploying the
`20261122170000_media_library` migration.

## People in photos

The photo library is not part of a customer's data export or erasure. A
photo can still show a customer or a colleague. The studio asks owners to
get permission first and to delete a photo when the person in it asks. This
is an operational note, not legal wording; the processing agreement and the
privacy notice need a lawyer's review for this.

## Journal recordings

Journal audio exists only in the concept demo. Recordings and uploaded audio
files (m4a, mp3, wav, webm, ogg, flac, recognised from their bytes, at most
20 MB and ten minutes) stay in the browser's own `concept-journal-audio`
IndexedDB database, five per customer, and are never uploaded. Live
speech-to-text uses the browser's Speech Recognition API, as dictation
already did; some browsers may process that speech off-device. Forcing
`processLocally` is a later production decision (it can fail when the
language is not on the device).

Before real customers, the recommendation is the photo library's store with
a `journal-audio/<tenant>/<id>` prefix: private, encrypted, in the EU,
uploaded straight to storage with a short-lived, size-capped URL rather than
through a function, embedded metadata (GPS, device, time) removed before the
file is kept, and playable only by staff who may open that customer's
journal. Recorded treatments can be health data, so the Article 9 basis,
the customer information and `docs/legal/DPIA_JOURNAL.md` need a lawyer's
review first.
