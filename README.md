# iRide — personal garage

One Next.js app with a public Garage, Google Drive car photos, an interactive engine simulator and Traffic Endless Ride. There are no accounts, sessions or login screens. Anyone who opens the app can read and change Garage data.

## Run locally

Use Node 24 and pnpm 11.25.0.

1. Run `pnpm install --frozen-lockfile`.
2. Copy `.env.example` to `.env.local`.
3. With Docker running, run `pnpm db:start`, then `pnpm db:reset`. Copy the local API URL and service-role key from `pnpm exec supabase status` into `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
4. Run `pnpm dev` and open http://127.0.0.1:3000.

The new Garage starts empty. The two photos supplied from the separate example Drive folder are bundled as read-only display assets on the Garage page, not inserted as vehicle data.

## Connect Google Drive (owner setup only)

The live upload destination is the existing folder `1mFCIBIJHkQjYn4y_gg0GRkiELEatHMf0`. Website visitors never connect Google or log in.

1. In your Google Cloud project, enable Google Drive API and Google Picker API.
2. Configure an OAuth web client with redirect URI `http://127.0.0.1:8787/callback` and authorized JavaScript origin `http://127.0.0.1:8787`.
3. Create a Picker API key restricted to Google Picker API and the setup origin. Put the client ID, client secret, Picker key and Google Cloud **project number** in the corresponding `.env.local` variables.
4. Run `pnpm drive:setup`. Open http://127.0.0.1:8787, connect the owning Google account and select the exact existing **iRide image** folder in Picker.
5. The tool verifies write access and saves the four runtime values to ignored `.env.drive.local`. Stop the setup process and restart the web server.
6. For production, add those four values to the existing Vercel `iride` project's encrypted environment variables, together with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

The setup requests only `drive.file` and offline access. Configure the OAuth consent app for lasting access before production; external apps left in Testing can have refresh tokens expire after seven days. Reconnect if access is revoked. See [Google offline OAuth](https://developers.google.com/identity/protocols/oauth2/web-server) and [Drive scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).

Images remain private in Drive. The website serves only linked photo IDs through its backend. Uploads accept JPEG/PNG/WebP up to 4 MB per image, one request per image. Each vehicle gets an app-owned UUID subfolder. Deletions move app-created photos to Drive trash. Pre-existing Drive files are never changed.

## Verification

- `pnpm check`: lint, TypeScript, unit tests, PostgreSQL baseline integration tests and production build.
- `pnpm test:e2e`: Playwright browser tests (UI flow uses an explicitly mocked Garage API; live cloud credentials are not required).
- `pnpm db:test`: pgTAP against the local Supabase stack when Docker is available.

Portable PostgreSQL tests execute the complete migration and verify RLS/grants, cover ownership, service totals, upload/delete interlocks and cascades. These do not replace a live Supabase/Drive smoke test before production cutover.

## Recover interrupted photo uploads

Reservations older than 30 minutes remain visible to the maintenance tool and block vehicle deletion until reconciled. Pause uploads first. Run:

```powershell
node --env-file=.env.local --env-file=.env.drive.local scripts/reconcile-photos.mjs
node --env-file=.env.local --env-file=.env.drive.local scripts/reconcile-photos.mjs --apply
```

The first command exports a dry-run report to `.tmp/photo-reconciliation.json`. The second verifies each file belongs to the configured vehicle folder, moves stale uploads to trash, and removes their reservations. If Drive cleanup fails, metadata remains for retry.

## Production cutover

The existing Supabase target is `bgflnssilreepfzxoqpc`, Vercel web project `iride`, and retired API project `iride-api`. Do not apply the fresh baseline over the old schema.

Use the separate `scripts/production-cutover.mjs` procedure after successful local checks, a verified staged production deployment with database/Drive credentials, a successful backup, and disabling old API writers. The script defaults to a non-mutating preflight; its destructive mode is explicitly project-bound and exports the database and storage manifest before deleting anything.

Keep the current production app intact until the new runtime and backup prerequisites are satisfied. The repository reset does not itself reset hosted data.
