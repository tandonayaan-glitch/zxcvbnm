# CricketHub

A production-style cricket **scoring + management + public viewer** platform built with
**React + TypeScript + Vite + Firebase**.

- Username/password auth (over Firebase Auth) with first-time admin setup
- Roles: `ADMIN`, `SCORER`, `VIEWER`, `TEAM_MANAGER`, `TOURNAMENT_MANAGER`
- Player / team / tournament / match management
- GullyScore-style match setup wizard + ball-by-ball live scoring engine
- Real-time public match centre, scorecards, and ball-by-ball commentary
- Player / team / tournament public pages with a real stats engine
- Customizable scorecards (per match) and global search

## 1. Prerequisites

- Node 18+
- A Firebase project with **Authentication (Email/Password)** and **Firestore** enabled

## 2. Configure Firebase

Copy the example env and fill it with your project's web-app config
(Firebase console → Project settings → Your apps → SDK setup):

```bash
cp .env.example .env.local
```

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_AUTH_EMAIL_DOMAIN=crickethub.local
```

In the Firebase console:

1. **Authentication → Sign-in method →** enable **Email/Password**.
2. **Firestore Database →** create a database.
3. Deploy the security rules in [`firestore.rules`](./firestore.rules)
   (`firebase deploy --only firestore:rules`).

> Usernames are mapped to synthetic emails (`username@VITE_AUTH_EMAIL_DOMAIN`)
> so we get a username/password UX on top of Firebase's email/password auth.
> Users never see the email — keep `VITE_AUTH_EMAIL_DOMAIN` stable for a project.

## 3. Run

```bash
npm install
npm run dev
```

Open the app. With no admin yet, you'll be guided to **/setup** to create the
first administrator. After that, sign in at **/login**.

## 4. Build & deploy

```bash
npm run build        # type-checks then builds to dist/
firebase deploy      # hosting + firestore rules (firebase.json included)
```

## Architecture

```
src/
  lib/            firebase init, formatting, defaults, cn, collections
  types/          all domain types (single source of truth)
  domain/         pure logic: scoring engine + stats engine
  services/       Firestore data access (auth, players, teams, tournaments,
                  matches, scoring, stats, search, users, settings)
  store/          zustand auth store + role helpers
  hooks/          useAsync
  components/     ui kit, layouts (AppShell / PublicLayout), route guards
  features/       auth, dashboard, players, teams, tournaments, matches,
                  scoring, scorecard, settings, public (viewer pages)
```

### Data model (Firestore)

| Collection | Purpose |
|---|---|
| `users` | profile `{ username, displayName, role }` (doc id = uid) |
| `usernameLookup` | unique username → uid (doc id = username) |
| `players`, `teams`, `tournaments` | core entities |
| `matches` | match doc holds setup + **denormalized live innings state** |
| `matches/{id}/deliveries` | append-only ball-by-ball event log |
| `tournaments/{id}/standings` | cached points table rows |
| `playerStats`, `teamStats` | cached aggregate stats |
| `settings/app` | platform defaults |

### How scoring & consistency work

- The **scoring engine** (`domain/scoring.ts`) is pure: `applyBall(state, input)`
  returns the next innings state + a `Delivery`. `rebuildInnings` replays the
  delivery log for reliable undo.
- Each ball writes the `Delivery` **and** the updated denormalized innings on
  the match doc in a single batch. Viewers subscribe to the match doc (score)
  and the deliveries subcollection (commentary) in real time.
- On match completion the result is computed automatically. The **stats engine**
  (`domain/stats.ts`) recomputes player/team stats and tournament standings from
  all completed matches (triggered from the scoring screen, the tournament page,
  or Settings → Recompute).

### Security note

The included rules give public read access to cricket data and gate writes by
role. Self-signup creates a `VIEWER`; the first admin is bootstrapped via
self-create at `/setup`. For a hardened production deployment, gate first-admin
creation with a Cloud Function and remove open profile self-create.
