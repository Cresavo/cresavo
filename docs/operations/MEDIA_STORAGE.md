# Photo library storage

The photo library (roadmap stage 1) keeps a business's own photos and its
logo. Each picture is one `media_asset` row: its metadata, and its bytes in
the row (the default Postgres store) or in an S3-compatible bucket. Owners
upload and manage pictures under Campaigns, Photos and Booking page, Logo,
while signed in (`OWNER_ACCOUNTS_ENABLED`). The public demo stores nothing.

## What is stored

- Only JPEG, PNG and WebP, recognised from the file's own bytes. SVG is
  refused, and so is HEIC (the studio turns HEIC into JPEG in the browser
  when it can).
- Before anything is stored, EXIF (with the GPS position), XMP, IPTC,
  comments, PNG text chunks and the images a phone appends after the main one
  are removed. The picture data is not re-encoded. A rotated photo keeps an
  EXIF block that holds only its orientation.
- Limits: 8 MB per file, 300 photos and 500 MB per business, 60 uploads per
  15 minutes per business. The same picture is kept once per business.
- Photos are private: the app serves them to the signed-in owner after its
  own checks. Only the active logo has a public address, which contains its
  id and the SHA-256 of its bytes.
- A deleted picture can be restored for one day and is purged by
  `npm run store:sweep` 30 days after deletion. A replaced logo counts as
  deleted.

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
