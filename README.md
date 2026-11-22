[![Stand With Ukraine](https://raw.githubusercontent.com/vshymanskyy/StandWithUkraine/main/banner-direct-single.svg)](https://stand-with-ukraine.pp.ua)
![Vercel Deploy](https://therealsujitk-vercel-badge.vercel.app/?app=travelling-web&style=plastic)
<img alt="GitHub commit activity" src="https://img.shields.io/github/commit-activity/m/Turskyi/travelling-web">

# Travelling

Travelling is a responsive Next.js 14 and TypeScript travel tracker. Visitors can
browse countries, search and filter the list, mark countries as visited, and add,
edit, or remove cities without creating an account. Travel history and the
English/Ukrainian language selection are stored in the current browser.

The country catalogue and country details use the Android app's
[mledoze/countries](https://github.com/mledoze/countries) source through a
cached same-origin Next.js API route. The former REST Countries v3 endpoint
is deprecated and now returns an error, so the web app no longer relies on it.
Firebase authentication,
cloud sync and Google Play subscription API routes remain available for the
account and migration features; local travel tracking does not depend on these
services. Cloud backup is separate from local browser storage. Country selfies
are saved locally in IndexedDB and can be uploaded to Firebase Storage for users
with an active cloud backup entitlement; JPEG, PNG, and WebP files are limited
to 2 MB. Firebase Storage must be enabled in the configured Firebase project.

## Getting Started

Use Node.js 22 and install dependencies with `npm install`. The local tracker
can be used without Firebase credentials:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see
the result.

The country tracker and city editor run locally without an account. The
`/account` page provides Google sign-in, subscription and staged-migration
status, and explicit backup/restore actions. Differences between local and
cloud histories are shown before either copy is selected. The
`src/pages/api` directory contains the existing authenticated Firebase,
subscription, account-deletion, and sync/migration endpoints. To enable those
server features, configure the following environment variables in the local
environment or deployment platform:

- `NEXT_PUBLIC_FIREBASE_API_KEY` is required for browser Firebase sign-in.
  `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`,
  and `NEXT_PUBLIC_FIREBASE_APP_ID` can also be set for the Firebase app
  configuration.
- `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` (or the existing
  `FIREBASE_SERVICE_ACCOUNT_JSON` alias) is the server-only Firebase Admin
  service account JSON.
- `PLAY_SERVICE_ACCOUNT_JSON` is the server-only Google Play Developer API
  service account JSON used to verify subscriptions.
- `PUBSUB_VERIFICATION_TOKEN` optionally verifies subscription RTDN requests.
- `CRON_SECRET` is required to authorize the scheduled cleanup endpoint.
- `FREE_ACCESS_FOR_ALL` controls the existing temporary sync-access setting.
  It is disabled by default; set it to `true` only when intentionally granting
  temporary sync access to all authenticated users.

Do not commit credentials or expose server-only service account values through
`NEXT_PUBLIC_` variables. No new environment variables are required for local
country tracking.

Run `npm run lint`, `npx tsc --noEmit`, and `npm run build` to validate changes.

## Credits

This project is based on the
[Learn SWR by Building a Pokemon App (NextJS, React, TypeScript)](https://youtu.be/5a1-BuwwemY?si=PYQE7XuGUx0_JdPE)
by [Coding in Flow](https://github.com/codinginflow) YouTube channel.
All credit goes to the original author
[Florian Walther](https://github.com/florianwalther-private). I only followed
along and made some minor changes.
