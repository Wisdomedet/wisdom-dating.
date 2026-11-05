WISDOM DATING — REAL BACKEND STARTER
====================================

WHAT THIS PACKAGE INCLUDES
- Email/password registration and login (Supabase Auth)
- Adult-only profile validation (18+ in the interface and database)
- Profiles stored in Supabase
- City-based profile discovery (exact GPS coordinates are not collected)
- Like system and automatic mutual matching
- Match list
- Private match-only messages with Supabase Realtime updates
- Row Level Security policies for the database

IMPORTANT
This is a working starter project, not a deployed/production-certified dating service.
You must create and configure your own Supabase project. Do not publish until you have
tested it, added moderation/report/block flows, privacy/terms pages, secure photo uploads,
rate limits, email verification and abuse handling.

STEP 1 — CREATE A SUPABASE PROJECT
1. Go to https://supabase.com and create an account/project.
2. In the project dashboard, open SQL Editor.
3. Open supabase.sql from this folder, copy all its contents, paste into SQL Editor,
   and run it.
4. Go to Project Settings > API (or Data API / API Keys, depending on dashboard version).
5. Copy the Project URL and the anon/public key. Never use the service_role key in a browser.

STEP 2 — CONNECT THE WEBSITE
1. Open app.js.
2. Replace YOUR_SUPABASE_PROJECT_URL with your Project URL.
3. Replace YOUR_SUPABASE_ANON_PUBLIC_KEY with your anon/public key.
4. Save the file.

STEP 3 — AUTH EMAIL SETTINGS
For easiest local testing, use Supabase Authentication > URL Configuration:
- Set Site URL to http://127.0.0.1:5500
- Add http://127.0.0.1:5500/** to Redirect URLs if required.
For production, set these to your actual deployed domain.
Keep email confirmation enabled for a real public launch. Test the confirmation flow.

STEP 4 — RUN LOCALLY
Option A:
- Open the folder in Visual Studio Code.
- Install the "Live Server" extension.
- Right-click index.html > Open with Live Server.
Option B:
- Open a terminal in this folder and run:
    python -m http.server 5500
- Visit http://127.0.0.1:5500

Do not simply double-click index.html for full Supabase testing; use a local web server.

STEP 5 — TEST WITH TWO ACCOUNTS
1. Register account A and complete its profile with a city and area.
2. Register account B in the same city using another browser/incognito window.
3. Account A likes B; account B likes A.
4. Both should see a match.
5. Open Messages and send a message. The other account should receive it live.

LOCATION BEHAVIOUR
Discovery currently searches exact city text (case-insensitive), not GPS distance.
The area is displayed on profile cards, but city is the search filter.
Users should choose a broad city name consistently (for example, "Abuja") and
put neighbourhoods such as "Wuse" or "Gwarinpa" in the area field.
Do not collect or display home addresses.

BEFORE PUBLIC LAUNCH
- Add report, block, unmatch and moderation tools.
- Add private image storage with file type/size validation; do not rely on arbitrary image URLs.
- Add profile visibility and account deletion controls.
- Add privacy policy, terms, community guidelines and a contact/support route.
- Add rate limiting, spam detection and moderation review.
- Test RLS policies with separate accounts and unauthenticated sessions.
- Configure backups, monitoring and a custom domain.
- Review local legal requirements and data-protection obligations.
- Never put the Supabase service_role key in app.js or any public frontend file.

TROUBLESHOOTING
- "Setup needed": Supabase URL/key have not been filled in app.js.
- "Invalid API key": use the anon/public key, not service_role; check for extra spaces.
- Email confirmation not received: check spam and Supabase Auth email settings.
- No profiles found: ensure both accounts use the same city spelling.
- Chat does not update live: check that messages is included in supabase_realtime publication.
