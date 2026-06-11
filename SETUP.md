# World Cup 2026 Bracket Challenge — Setup Guide

## Step 1: Create a Supabase Project (free)

1. Go to https://supabase.com and sign up / log in
2. Click **"New project"**, give it any name (e.g. `wc2026-bracket`)
3. Set a database password (save it somewhere — you won't need it in the app but Supabase requires it)
4. Choose any region, click **"Create new project"** and wait ~2 minutes

## Step 2: Create the Database Tables

1. In the Supabase dashboard, click **"SQL Editor"** in the left sidebar
2. Click **"New query"** and paste the following, then click **Run**:

```sql
-- Participant bracket submissions (one row per person)
create table brackets (
  pid  text primary key,
  data jsonb not null default '{}',
  submitted_at timestamptz default now(),
  updated_at   timestamptz default now()
);

-- Admin-entered results (single row)
create table results (
  id   int primary key default 1,
  data jsonb not null default '{}'
);

-- Allow public read/write (no login required — internal tool)
alter table brackets enable row level security;
alter table results  enable row level security;
create policy "public_brackets" on brackets for all to anon using (true) with check (true);
create policy "public_results"  on results  for all to anon using (true) with check (true);

-- Enable real-time updates for the leaderboard
alter publication supabase_realtime add table brackets;
```

## Step 3: Get Your API Keys

1. In the Supabase dashboard, click ⚙️ **Settings** → **API**
2. Copy two values:
   - **Project URL** — looks like `https://abcxyzabc.supabase.co`
   - **anon / public** key — a long JWT string starting with `eyJ...`

## Step 4: Paste Config into index.html

Open `index.html` and find this block near the top of the `<script>`:

```js
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_KEY = 'YOUR_SUPABASE_ANON_KEY';
const ADMIN_PASS   = 'wc2026admin';
```

Replace the placeholder strings with your real values.  
**Also change `ADMIN_PASS`** to something private — this protects the result-entry screen.

## Step 5: Deploy to Vercel (auto-deploy from GitHub)

The repo is already connected to Vercel at `gallavp/WCBracket2026`.  
Just push your changes to `main` and Vercel deploys automatically.

```bash
git add index.html
git commit -m "Add Supabase config"
git push
```

## Step 6 (Optional): Live Auto-Scoring via football-data.org

To have leaderboard scores update automatically as matches finish:

1. Register for a free API key at https://www.football-data.org
2. In the Vercel dashboard → your project → **Settings** → **Environment Variables**  
   Add: `FOOTBALL_API_KEY` = your key
3. Redeploy (trigger via Vercel dashboard or push any change)

Without this, an admin can still enter results manually (see below).

---

## How It Works

| Who | What they do |
|-----|--------------|
| Participants | Open the page, fill out the bracket wizard, submit |
| Admin (you) | Click **Admin** in the nav, enter the password, enter real match results as the tournament progresses |
| Everyone | Check the **Leaderboard** at any time — updates live as brackets are submitted or results change |

## Updating Results (Admin)

As each phase ends:
1. Open the app → click **Admin** → enter password
2. Enter the group results (1st and 2nd per group)
3. Select which 8 groups had their 3rd-place team qualify
4. For each knockout round, select the teams that advanced
5. At the end, set Champion, 3rd-place winner, and Top Scorer
6. Click **Save All Results** — leaderboard updates immediately for everyone

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
