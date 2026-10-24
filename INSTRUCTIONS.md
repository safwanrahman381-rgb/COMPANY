# BLACKLINE Marketing Engine: step-by-step instructions

## What's in the folder

| File | What it does |
| --- | --- |
| `.claude\skills\blackline-content\SKILL.md` | The skill: the rules Claude Code follows for planning, writing, checking and reviewing posts |
| `.claude\skills\blackline-content\brand.md` | Your brand: offer, audiences, topic buckets, contrarian takes, voice, house style, lead magnets |
| `.claude\skills\blackline-content\playbook.md` | Why the rules work, condensed from the 4 videos, the ads study and the platform research. Only read during reviews |
| `CLAUDE.md` | Tells Claude Code to use the skill and save usage |
| `scripts\quality_gate.py` | Checks drafts automatically: em dashes, hype words, emoji and hashtag limits, links on LinkedIn, hook length, made-up numbers |
| `scripts\render_slides.py` | Turns carousel text into 1080×1350 PNG slides in the black/blue house style |
| `marketing\inputs\this-week.md` | Where you dump your week's raw material before each run |
| `marketing\post-log.md` | Every post gets logged here, and you fill in its results 7 days later |
| `marketing\examples\` | A finished sample carousel showing the house style |
| `README.md` | Short version of these instructions |

## One-time setup (about 10 minutes, no Claude Code usage)

1. **Skill:** already installed in `.claude\skills\blackline-content\`. Nothing to do.
2. **Install Python** if you haven't already, from python.org. Tick "Add Python to PATH" during install.
3. **Install the slide renderer.** In the folder, click the address bar, type `cmd` and press Enter. Then run:
   ```
   pip install playwright
   python -m playwright install chromium
   ```
4. **Test that it works:**
   ```
   python scripts\render_slides.py marketing\examples\style-test-slides.json marketing\examples\test
   ```
   You should get 6 PNGs in `marketing\examples\test`.
5. **Check the style.** Look at `marketing\examples\style-test\`. If you like the look, skip the style run. If not, change the colours or fonts at the top of `render_slides.py` yourself. That's free; doing it through Claude costs usage.
6. **Edit `brand.md` yourself (free):**
    - Confirm or rewrite the 4 contrarian takes. They must be things you genuinely believe.
    - Check the audience rings and topic buckets match who you want.
7. **Build the LEAK lead magnet:** a one-page "10 places busy offices lose enquiries" checklist as a PDF. Have it ready to DM to anyone who comments LEAK.
8. Open the folder in VS Code and start Claude Code.

## Every week (about 30-40 minutes of your time)

1. **Collect material, 10 minutes.** Record a 5-10 minute voice note about your week:
    - who you called (niche only, no business names);
    - what they said;
    - objections you heard;
    - what you built;
    - any real numbers you measured.

   Transcribe it (your phone can do this) and paste it into `marketing\inputs\this-week.md`. List any photos or screenshots you took, e.g. you on calls, the demo pipeline, an instant reply landing.
2. **Run it, using 1 of your Claude Code runs.** Type: `/blackline-content week`

   You get:
    - `marketing\weeks\2026-Wxx.md`: 12 draft posts with hooks, copy, visual notes and a NEEDS line;
    - `marketing\weeks\2026-Wxx-slides.json` plus PNG slides in `marketing\assets\2026-Wxx\`;
    - new rows in `post-log.md`.
3. **Edit, 10 minutes, no usage.** Read each draft. Supply everything on a NEEDS line: real photos, real numbers, or delete the line. Tweak wording yourself.

   If you edit carousel text, re-render the slides for free:
   ```
   python scripts\render_slides.py marketing\weeks\2026-Wxx-slides.json marketing\assets\2026-Wxx
   ```
   Re-check the posts for free:
   ```
   python scripts\quality_gate.py marketing\weeks\2026-Wxx.md
   ```
4. **Schedule, 10 minutes.** Use GoHighLevel's Social Planner (you already pay for it).
    - **LinkedIn:** post from your personal profile, 5 posts Monday to Friday, ideally 8-9am or 12-1pm.
    - **Instagram:** 4 posts, carousels as the default.
    - **Facebook:** 3 posts. Personal profile or relevant groups only where the rules allow.
5. **Engage, about 15 minutes a day.**
    - Reply to every comment within the first hour of posting.
    - When someone comments a keyword (LEAK / DEMO / SYSTEM), DM them by hand on LinkedIn. Never use auto-DM tools there.
    - On Instagram you can set up a GoHighLevel comment-keyword-to-DM automation.
    - Treat anyone who comments, views your profile twice or DMs as a warm lead. Message them about the exact thing they engaged with, and offer the demo or a call.
6. **Track, 5 minutes.** Seven days after posting, fill in impressions, comments, saves/sends, DMs and calls booked in `post-log.md`.

## Monthly (1 Claude Code run)

After 4 weeks of metrics, type `/blackline-content review`. You get `marketing\review-2026-MM.md` with:

- your best and worst content formulas, ranked;
- which audience ring drives DMs;
- which call-to-action wording works;
- top hook patterns;
- next month's 70/20/10 plan.

It also adds proven patterns to `brand.md`, so every future run uses them.

## Making your 4 runs last

| Run | What | When |
| --- | --- | --- |
| 1 | `/blackline-content week` | This week |
| 2 | `/blackline-content week` | Next week |
| 3 | `/blackline-content review` (or a third week if there's little data yet) | After about 4 weeks |
| 4 | Spare: emergencies or a fix | Keep it |

**To save usage:**

- Never ask Claude Code for small edits. Edit the files yourself.
- Re-render slides and re-run the quality gate yourself with the commands above.
- Don't type `refresh trends` unless something big changes; it costs extra usage on web research.
- If you run out, the scripts and templates still work by hand. You can also paste `SKILL.md` and `brand.md` into a normal Claude chat and ask for "WEEK mode".

## Rules the skill always follows

- Drafts only. It never posts anything.
- No invented results, clients, testimonials or numbers. BLACKLINE has no client proof yet, so posts use the demo (labelled as a demo), your call notes and your own tests.
- No real business named or shamed.
- Static-first content that doesn't look like an ad: no stock photos, no "Book now" banners, no fake people.

## Best first post ideas while you have no clients

- **"What happens to a 9pm enquiry"** teardown carousel, using the demo. The sample is already made.
- **Your own mystery-shop test.** Send a test enquiry to 10-20 property managers' websites in the evening and record how long each takes to reply. Post the anonymised results. It's real data and the strongest proof you can have before clients.
- **Field notes:** "What 30 dealership managers told me about online leads this week", built from your real calls.
- **A raw photo of you cold calling,** with the honest story of why you're building BLACKLINE.
