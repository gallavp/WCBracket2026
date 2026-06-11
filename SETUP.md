# World Cup 2026 Bracket Challenge — Setup Guide

## Step 1: Create a Firebase Project (free)

1. Go to https://console.firebase.google.com
2. Click **"Add project"**, name it `wc2026-bracket` (or anything)
3. Disable Google Analytics (optional), click **"Create project"**

## Step 2: Create a Firestore Database

1. In the Firebase Console, click **"Firestore Database"** in the left menu
2. Click **"Create database"**
3. Choose **"Start in test mode"** (lets anyone read/write — fine for internal use)
4. Pick any region, click **"Enable"**

## Step 3: Get Your Firebase Config

1. In the Firebase Console, click the ⚙️ gear → **"Project settings"**
2. Scroll down to **"Your apps"** → click the `</>` web icon
3. Register the app (any name), skip "Firebase Hosting"
4. Copy the `firebaseConfig` object — it looks like:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "wc2026-bracket.firebaseapp.com",
  projectId: "wc2026-bracket",
  storageBucket: "wc2026-bracket.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

## Step 4: Paste Config into index.html

Open `index.html` and find this block near the top of the `<script>`:

```js
const FIREBASE_CONFIG = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  ...
};
const ADMIN_PASS = "wc2026admin";  // ← change this too!
```

Replace each `"YOUR_..."` value with the real values from Step 3.
**Also change `ADMIN_PASS` to something private** — this is the password
for the admin results entry screen.

## Step 5: Share with the Company

Host the single `index.html` file anywhere:

- **Easiest**: Upload to Google Drive → Share link (choose "Anyone with link can view")
  - Then open it locally or with a viewer
- **Better**: Use GitHub Pages, Netlify Drop, or any static host
  - Drag `index.html` into https://app.netlify.com/drop → get a URL instantly (free)

All 20 participants visit the same URL, submit their brackets, and see
the shared leaderboard in real time.

## How it Works

| Who | What they do |
|-----|--------------|
| Participants | Open the page, enter their name, fill out the 9-step bracket wizard, submit |
| Admin (you) | Click "Admin" in the nav, enter the password, enter real match results as the tournament progresses |
| Everyone | Check the Leaderboard at any time — it updates automatically as you save results |

## Point System

| Prediction | Points |
|---|---|
| Correct group winner | 3 |
| Correct group runner-up | 2 |
| Correct 3rd-place qualifier (group) | 1 each |
| Round of 32 team advances | 2 each |
| Round of 16 team advances | 3 each |
| Quarterfinalist | 5 each |
| Semifinalist | 8 each |
| 3rd place match winner | 3 |
| Champion | 13 |
| Top scorer (Golden Boot) | 10 |

**Maximum possible: 186 points**

## Updating Results (Admin)

As each phase ends:
1. Open the app → click **Admin** → enter password
2. Enter the group results (1st and 2nd per group)
3. Select which 8 groups had their 3rd-place team qualify
4. For each knockout round, select the teams that advanced
5. At the end, set Champion, 3rd-place winner, and Top Scorer
6. Click **Save All Results** — leaderboard updates immediately for everyone
