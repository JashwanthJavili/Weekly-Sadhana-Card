# Youth Sadhana Card

A web version of the printed *Youth Sadhana Card*. Youth pick a week, fill the card
day by day, mark it complete, and download it as a PDF or image.

Live: https://weeklysadhanacard.web.app

## Features

- **Week picker**: any date opens its Monday–Sunday card (`/card?week=YYYY-MM-DD`).
- **Easy input**: scroll-wheel pickers for times, durations and chanting rounds, Yes/No
  toggle for NBS class, free text for Seva and the reflections.
- **Autosave**, **Complete** (locks the card), **Edit** to unlock it again.
- **Your details** are filled once and shown on every week's card.
- **Download PDF / image / print**: always rendered in the full A4 card layout.
- **Responsive**: the printed-card table on desktop; on phones, a day-by-day list with
  bottom sheets and a fixed action bar.
- **Privacy**: a short notice when each week opens; full details behind the ⓘ on the home page.
- **Optional Google sign-in**: cards follow the person to any device, still end-to-end encrypted
  with a personal passphrase (create once, enter on each new device).
- **Streaks**: a day counts when 5+ of its 9 items are filled; current/best streak on the home page.
- **Send to mentor**: shares the PDF via the phone's share sheet (WhatsApp, …), or downloads it and
  opens WhatsApp on desktop.

## Storage (Firestore, end-to-end encrypted)

```
SadhanaCard/{uid}                    → { uid, updatedAt, profile: {v,iv,ct}, keyWrap? }  encrypted profile (+ passphrase-locked key)
SadhanaCard/{uid}/weeks/{weekStart}  → { uid, weekStart, v, iv, ct, updatedAt }  encrypted card
```

- Each browser signs in with **Firebase Anonymous Auth**, and `firestore.rules` lets a user
  read and write only their own documents. The rules also accept only encrypted payloads.
- Card contents are encrypted **in the browser** with AES-256-GCM (`src/lib/crypto.ts`).
  The key is generated per user, stored non-extractable in IndexedDB and never uploaded, so
  the database owner sees only ciphertext plus the week date and last-saved time.
- Because the key lives on one device, clearing site data or switching devices makes old
  cards unreadable. Users can download a PDF to keep a copy.

Key handling: guests get a device-only key. With Google sign-in, the data key is also stored in
`SadhanaCard/{uid}.keyWrap`, encrypted with a key derived from the user's passphrase
(PBKDF2-SHA256, 600k iterations). Forgetting the passphrase means the old cards can't be opened.

One-time Firebase setup:
1. Authentication → Sign-in method → enable **Anonymous** and **Google**.
2. Authentication → Settings → Authorized domains → add `weeklysadhanacard.web.app`
   (and `weeklysadhanacard.firebaseapp.com`).
3. `firebase deploy --only firestore:rules`
4. Abuse protection (App Check): create a reCAPTCHA Enterprise key for the site domain, register
   it in Firebase Console → App Check, build with `NEXT_PUBLIC_RECAPTCHA_SITE_KEY=<key>`, then
   turn on enforcement for Firestore and Authentication. (On localhost a debug token is printed
   to the console; add it under App Check → Manage debug tokens.)

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
