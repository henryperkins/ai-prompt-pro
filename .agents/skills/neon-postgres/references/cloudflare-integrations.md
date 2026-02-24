# Neon + Cloudflare Integrations

Cloudflare-related guides listed under Neon Integrations:

- Deploy: [Cloudflare Pages](https://neon.com/docs/guides/cloudflare-pages)
- Deploy: [Cloudflare Workers](https://neon.com/docs/guides/cloudflare-workers)
- File & media storage: [Cloudflare R2](https://neon.com/docs/guides/cloudflare-r2)
- Query: [Cloudflare Hyperdrive](https://neon.com/docs/guides/cloudflare-hyperdrive)

## 1) Use Neon with Cloudflare Pages

Reference: https://neon.com/docs/guides/cloudflare-pages

- Cloudflare Pages serves frontend; Pages Functions (under top-level `functions/`) run server-side code.
- Use `@neondatabase/serverless` in Functions and read `DATABASE_URL` from `context.env.DATABASE_URL`.
- Typical function shape in guide:
  - `functions/books/index.js` (GET): `SELECT * FROM books_to_read`
  - `functions/books/add.js` (POST): parse request JSON and `INSERT` row
- Local development:
  - Set `DATABASE_URL=...` in `.dev.vars`
  - Run `npx wrangler pages dev -- npm run dev`
- Deploy:
  - `npm run build`
  - `npx wrangler pages deploy dist --project-name <name>`
  - Set production `DATABASE_URL` env var in Cloudflare dashboard, then redeploy

## 2) Use Neon with Cloudflare Workers

Reference: https://neon.com/docs/guides/cloudflare-workers

The guide supports two paths.

### 2A) Hyperdrive path (recommended)

- Use Hyperdrive for low latency and pooling on Cloudflare's network.
- With Hyperdrive, use native Postgres drivers (`pg` or `postgres`) rather than `@neondatabase/serverless`.
- Neon setup in guide:
  - Create dedicated role (for example `hyperdrive-user`)
  - Use direct (non-pooled) Neon connection string for Hyperdrive
- Worker setup shape:
  - Scaffold Worker project with `npm create cloudflare@latest`
  - `npx wrangler login`
  - `npx wrangler hyperdrive create ... --connection-string="postgres://..."`
  - Install `pg` (+ `@types/pg` for TypeScript)
  - Run `npm run cf-typegen`
- `wrangler.jsonc` key details:
  - `"compatibility_flags": ["nodejs_compat"]`
  - Hyperdrive binding with `binding`, `id`, and `localConnectionString`
- Worker code pattern:
  - Connect with `env.HYPERDRIVE.connectionString`
  - Create a new `Client` per request
  - Close in background via `ctx.waitUntil(client.end())`

### 2B) Neon serverless driver path

- If not using Hyperdrive, use `@neondatabase/serverless` in Worker.
- Prefer Neon pooled connection string (`-pooler`) for this path.
- Install `npm install @neondatabase/serverless`.
- Connect using `new Client(env.DATABASE_URL)`.
- Local dev:
  - Set `DATABASE_URL=...` in `.dev.vars`
  - Run `npm run dev` (Wrangler)
- Deploy:
  - Add secret: `npx wrangler secret put DATABASE_URL`
  - Publish: `npm run deploy`

## 3) File storage with Cloudflare R2

Reference: https://neon.com/docs/guides/cloudflare-r2

Core pattern:

- Store files in R2 (blobs)
- Store metadata in Neon (object key, URL, user ID, timestamp)
- Common presigned flow:
  1. Backend creates presigned upload URL
  2. Client uploads directly to R2
  3. Backend writes metadata record to Neon

Setup notes from guide:

- Create an R2 bucket.
- Create R2 API token with object read/write access.
- Get Cloudflare Account ID.
- Configure bucket CORS for browser-based direct uploads (for example allow `PUT`/`GET` from production + localhost origins).
- If bucket is public, object URLs are publicly readable; use private buckets/signed access for sensitive files.

Suggested Neon metadata table: `r2_files` with unique `object_key`, `file_url`, `user_id`, and upload timestamp.

- With Neon RLS, apply policies to metadata table in Neon.
- RLS does not secure R2 objects directly.

Example backend endpoints:

- `POST /presign-upload` → `{ presignedUrl, objectKey, publicFileUrl }`
- `POST /save-metadata` → insert `{ objectKey, file_url, user_id }` into Neon

## 4) Use Neon with Cloudflare Hyperdrive

Reference: https://neon.com/docs/guides/cloudflare-hyperdrive

- Hyperdrive keeps globally distributed pooled DB connections and routes queries to nearby connections.
- Guide callout: Hyperdrive requires a paid Cloudflare Workers plan.
- Worker setup shape in guide:
  - Scaffold Worker with `npm create cloudflare@latest`
  - Enable Node compatibility in Wrangler config: `compatibility_flags = ["nodejs_compat"]`
  - Use either `pg` or `postgres`
  - Start with direct `env.DATABASE_URL`, then swap to Hyperdrive connection once binding is configured
