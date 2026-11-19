# Youth Sadhana Card

A web version of the printed *Youth Sadhana Card*. Youth pick a week, fill in the card
day by day, and share it with their mentor as a clear image.

Live: https://weeklysadhanacard.web.app

## Features

- **Week picker**: any date opens its Monday–Sunday card (`/card?week=YYYY-MM-DD`).
- **Easy input**: scroll-wheel pickers for times, durations and chanting rounds, Yes/No
  toggle for Japa Class, free text for Seva and the reflections, Gita For Youth (Friday).
- **Saves automatically**: no Save or Complete button.
- **Your details** (name, age, mentor, phone) are filled once and shown on every week's card.
- **Download / Send to mentor**: makes a sharp PNG of an easy-to-read weekly report
  (`src/components/WeekReport.tsx`), named `Name_Month_WeekN.png`. Send to mentor opens the
  phone's share menu with the image attached, so the person picks WhatsApp and their mentor.
  The message reads "Hare Krishna Prabhuji / Dandavat Pranams Prabhuji / Here is my Sadhana
  Card for …" (`shareMessage` in `src/lib/card.ts`).
- **Opens after the week**: Download and Send open at 12:00 am on the Monday after the week
  ends, with a countdown until then (`src/lib/useUnlock.ts`).
- **Responsive**: the printed-card table on desktop; on phones, a day-by-day list with bottom
  sheets and a fixed action bar. Checked down to 320 px wide.
- **Home page**: optional Google sign-in, streak, week selector and "My cards" (⋮ menu: open,
  send to mentor, download, delete).
- **Streaks**: a day counts when 5+ of its 9 items are filled.
- **Privacy**: a short notice when each week opens; full details behind the ⓘ on the home page.

## Storage (Firestore, end-to-end encrypted)

```
SadhanaCard/{uid}                    → { uid, updatedAt, profile: {v,iv,ct}, accountKey?, keyWrap? }  encrypted profile (+ account key)
SadhanaCard/{uid}/weeks/{weekStart}  → { uid, weekStart, v, iv, ct, updatedAt }        encrypted card
```

- Each browser signs in with **Firebase Anonymous Auth**, and `firestore.rules` lets a user
  read and write only their own documents. The rules also accept only encrypted payloads.
- Card contents are encrypted **in the browser** with AES-256-GCM (`src/lib/crypto.ts`).
  The key is generated per user and kept non-extractable in IndexedDB on each device.
- **Sync with Google sign-in**: guests get a key that lives only on their phone. When someone signs
  in with Google, their data key is kept in their own account record
  (`SadhanaCard/{uid}.accountKey`). The rules let only that signed-in account read it, and make it
  permanent once set. Every phone they sign in on picks it up, so cards open automatically with no
  password. Cards made earlier (as a guest, or with the older card password) are moved to the
  account key automatically; an older password-protected account asks for its password once.
  Note: since the key is stored with the account, someone with full admin access to the Firebase
  project could in principle read the cards; other users never can.
- Older cards may still carry `yuvaSetu` / `nbsClass` / `status` fields: the names are kept for
  compatibility (they now show as Gita For Youth / Japa Class; `status` is no longer used).

## One-time Firebase setup

1. Authentication → Sign-in method → enable **Anonymous** and **Google**.
2. Authentication → Settings → Authorized domains → add `weeklysadhanacard.web.app`
   and `weeklysadhanacard.firebaseapp.com`.
3. `firebase deploy --only firestore:rules`
4. **Abuse protection (App Check)**:
   1. Google Cloud console → Security → reCAPTCHA → **Create key**: type *Website*, domains
      `weeklysadhanacard.web.app`, `weeklysadhanacard.firebaseapp.com` (and `localhost` for testing).
   2. Firebase Console → App Check → Apps → the web app → **reCAPTCHA Enterprise** → paste the key.
   3. Build with the key: `NEXT_PUBLIC_RECAPTCHA_SITE_KEY=<key> npm run build`, then deploy.
   4. Watch App Check → **Metrics** for a day or two; when nearly all requests are "verified",
      press **Enforce** for Cloud Firestore and Authentication.
   On localhost a debug token is printed in the browser console; add it under
   App Check → Manage debug tokens.

Rules tests: see `firestore.rules`; they reject anything that isn't the owner's, isn't encrypted,
or has unexpected fields/sizes.

All storage goes through the `CardRepository` interface (`src/lib/storage`).

## Develop / deploy

```bash
npm install
npm run dev                      # http://localhost:3000
npm run build                    # static export → ./out
firebase deploy --only hosting:weeklysadhanacard
```

Icons are taken from the original PDF.

_In Service of HG Pranavananda Prabhuji_
