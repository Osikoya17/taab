# taab

Taab is an expense-sharing app for trips, households, couples, and friends. It runs on iOS, Android, and the web with Expo SDK 57, React Native, and Expo Router.

The app supports groups and invitations, equal and custom splits, receipt attachments, balances, recorded repayments, activity, recurring expenses, notification preferences, and account settings. Money is stored in integer minor units. Recording a repayment updates the ledger; it does not move money between bank accounts.

## Run the demo

Use Node.js 24 or newer and npm. On a fresh checkout:

```sh
npm ci
```

Copy `.env.example` to `.env.local` if that file does not already exist. Leave `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` and `EXPO_PUBLIC_API_URL` blank to use the local demo. Then run:

```sh
npm start
```

Use `npm run web` to open the web version. Demo data stays on the device/browser. Sample groups are optional during setup, and Extras simulates pack purchases and receipt scans without charging anyone. PostHog analytics is optional; leave its token blank to disable it.

## Run with shared data

The repository includes a Node HTTP API backed by SQLite. Shared mode requires a Clerk application for sign-in.

1. Copy `.env.server.example` to `.env.server.local` if it does not already exist. Set `CLERK_SECRET_KEY` for your Clerk application.
2. In `.env.local`, set the matching public Clerk key and `EXPO_PUBLIC_API_URL=http://localhost:3001` for a browser on the same computer.
3. Set `ALLOWED_ORIGINS` and `CLERK_AUTHORIZED_PARTIES` to the exact web origins you use, including the port. For example, a web preview on port 8099 needs `http://localhost:8099`. Multiple origins are comma-separated.
4. Run the API and app in separate terminals:

```sh
npm run server
npm start
```

The API listens on `127.0.0.1:3001` by default. For a phone on your local network, use `HOST=0.0.0.0` and the computer's LAN address in `EXPO_PUBLIC_API_URL`; localhost on a phone refers to that phone. Deployed apps need an HTTPS API URL.

Keep secret keys in `.env.server.local`, never in an `EXPO_PUBLIC_` variable. The server loads `.env.server.local`; it does not automatically load the app's `.env.local`.

The API verifies Clerk sessions and verified primary email addresses. It checks group membership and validates ledger changes before saving. SQLite data defaults to `.data/taab.sqlite`. Run one server process per database: this implementation keeps the ledger in memory and saves it as a single SQLite record. It is intended for a small deployment, not multiple API replicas. Back up the database with the server stopped or with SQLite backup tooling.

Rate limiting uses the connecting address. Behind exactly one reverse proxy, set `TRUST_PROXY=1` so each client is limited separately; leave it unset otherwise, because clients can forge `X-Forwarded-For`.

The server checks recurring expenses, queued account deletions, push delivery, and unused receipt photos every minute. Failures are retried without blocking unrelated accounts or job types. Shutdown waits for an active worker cycle and HTTP requests before closing SQLite.

## Deploy

The API runs on Railway (project `taab`, service `api`) from the root `Dockerfile`, which bundles the server with `npm run server:build`. SQLite lives on a Railway volume mounted at `/data`. Deploy with `railway up --ci`. Set secrets such as `CLERK_SECRET_KEY` in Railway's variables, never in the image; `.dockerignore` keeps `.env` files and `.data/` out of it. Keep one replica, because the ledger is held in memory.

The web app is hosted on EAS Hosting at `taab.expo.app`. `EXPO_PUBLIC_API_URL` in `.env` is baked in at build time, so rebuild after changing it: `npx expo export --platform web`, then `npx eas-cli@latest deploy --prod`.

## Invitations, receipts, and notifications

- Shareable invite links expire after seven days. Email/phone invitations create pending members; the app does not send invitation email or SMS. An invited person can join using the shared link. Verified email matching preserves their existing expense shares and activity.
- People search only finds accounts you already share a taab with, and only those people are added directly. Anyone else, even with an existing account, becomes a pending member until they join from the link.
- `EXPO_PUBLIC_INVITE_BASE_URL` defaults to `taab://join`. Set the same value in app and server configuration. For web links, use the deployed app URL followed by `/join` and configure the web host to serve `index.html` for application routes.
- Receipt photos are resized to at most 1600 px wide and saved as JPEG on the device, capped at roughly 1 MB. The server keeps them in a separate SQLite table, not the ledger, and serves them only to members of the expense's group. Photos from deleted or edited expenses are removed after a day. Large-scale receipt storage will need an object store.
- The notification inbox works without device push. Remote push needs an EAS project ID, push credentials, and a compatible development or production build. See the [SDK 57 notification setup](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/). Registration failures remain retryable in notification settings.
- Push goes to up to five devices per account; registering a sixth drops the oldest. A device signed into a new account stops receiving the previous account's notifications. The outbox checks delivery receipts, retries temporary failures, and removes only the devices Expo rejects.

## Packs (one-off purchases)

Everyday sharing is free: every split method, recurring bills, full history, the plain-text summary, balances, confirmations, edit history and reminders. There is no subscription. The only limits are operational (100 active taabs per account, 100 members per taab, 20 receipts per bulk upload).

Two optional packs, priced in `src/features/billing/products.ts` in kobo (provisional):

| Pack | Price | Unit | Adds |
|---|---|---|---|
| Receipt-scanning pack | ₦1,000 | per pack | `RECEIPT_PACK_SCANS` scan credits for the buyer. They never expire or renew. |
| Trip & event pack | ₦2,000 | per taab | `TRIP_PACK_SCANS` shared scans for current members, bulk scanning and a downloadable report. One per taab. |

Manual entry and attaching a receipt photo stay free.

**Settings (server).** A pack can't be bought until its allowance is set, and nothing is sold until checkout is configured:

| Variable | What it does |
|---|---|
| `RECEIPT_PACK_SCANS`, `TRIP_PACK_SCANS` | Scans per pack, a whole number from 1 to 1000. Unset means "Coming soon". Not decided yet. |
| `PAYSTACK_SECRET_KEY`, `PAYSTACK_CALLBACK_URL` | Real web checkout with Paystack. The callback is the web app's Extras page, e.g. `https://taab.expo.app/extras`. Both are needed. |
| `ANTHROPIC_API_KEY` | Real receipt scanning with Claude (`claude-opus-5-5`, server-side refusal fallbacks enabled). Without it, scanning is off. |
| `DEMO_PACKS=1` | Simulated checkout, sample scans and demo allowances (10 and 40) for development. Refused when `NODE_ENV=production`, so it can't run on Railway. |

In Paystack's dashboard, set the webhook URL to `<API URL>/webhooks/paystack`. Webhooks are checked by HMAC-SHA512 signature, and even then only name a payment: the server always asks Paystack's verify API what happened.

**How purchases are granted.** Starting checkout creates a `pending` purchase and grants nothing. Credits arrive only when the server verifies the payment with the provider, from the app returning to Extras or from a webhook. The amount and currency must match, and repeats are no-ops. A refund removes whatever is unused and, for a trip pack, the taab's pack tools; the taab's records stay. Unfinished checkouts expire after a day (a late confirmed payment still counts). Two members paying for the same taab at once is blocked; if it still happens, the second purchase is flagged `duplicate_group_pack` for a refund decision.

**Platforms.** Apple and Google require their own in-app purchase systems for digital extras bought in their store apps, and outside the US forbid pointing people elsewhere to buy. So real checkout runs on the web only. The phone apps show packs, use owned credits, and say buying isn't available in the app yet. Store billing (StoreKit and Play Billing) needs products set up in each store and server-side receipt validation. It plugs into the same `PaymentProvider` verification in `src/services/packs/runtime.ts`.

**Scanning.** A scan reserves one credit, calls the scanner, and spends the credit only when the draft is saved; failures return it. Each photo carries an idempotency key, so retries and duplicate taps never charge twice, and bulk retries skip finished receipts. Scans cut off by a restart are released after 10 minutes by the worker (also run at startup), and a late result is ignored. Drafts are labelled "Scanned", never "Verified", and flag unclear or mismatched totals. A scan never creates an expense or confirms a payment: the person reviews the photo beside the draft and saves through the normal form. Receipt contents are never logged. Unused scan photos are deleted after 30 days.

**Legacy taab+ records.** `subscriptions` in the ledger are kept for history and no longer read. Billing was never switched on (`CLERK_BILLING_ENABLED=false`), so no one had paid access to migrate. If a paid record exists, decide case by case (for example, grant goodwill scan credits by hand).

The on-device demo (no API URL) always uses demo checkout and sample scans, clearly labelled in the app.

## Checks

```sh
npm run lint
npm run typecheck
npm test -- --runInBand
npm run test:server
```

The backend tests use a temporary SQLite database and a test-only identity provider. They do not contact Clerk or send real push notifications. App tests mock analytics and device notification services.

For a production web bundle:

```sh
npx expo export --platform web
```

## Code layout

- `src/app/`: Expo Router screens and layouts.
- `src/components/`: shared UI and forms.
- `src/features/`: authentication, billing, calculations, queries, and notification handling.
- `src/services/`: domain rules and local/remote service adapters.
- `src/services/mock/`: shared ledger repository, with device storage in demo mode and SQLite storage on the server.
- `server/`: HTTP API, Clerk integration, background worker, push delivery, and integration tests.

Install new dependencies with `npx expo install <package>` so Expo can choose SDK-compatible versions. Native changes belong in app configuration and config plugins; the `ios/` and `android/` directories are generated.
