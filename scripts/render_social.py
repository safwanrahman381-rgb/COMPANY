"""Render BLACKLINE native-style social visuals with headless Chromium (no playwright needed).
Usage: python3 scripts/render_social.py marketing/social/W45
Each design is a phone/app lookalike so it reads as a post, not an ad. Mock-ups are labelled as illustrations."""
import os, subprocess, sys, tempfile

CHROME = next((os.path.join(r, "chrome") for r, _, f in os.walk("/opt/pw-browsers") if "chrome" in f and "linux64" in r), "chromium")
BASE = "*{margin:0;box-sizing:border-box}body{font-family:Inter,'Helvetica Neue',Arial,sans-serif;overflow:hidden}"
FOOT = "<div style='position:absolute;left:0;right:0;bottom:34px;text-align:center;font-size:24px;opacity:.55'>%s</div>"
ILL = "Illustration of the demo flow, not a client result  ·  Safwan · BLACKLINE"

D = {}

D["01-lockscreen-dealers"] = (1080, 1350, f"""<style>{BASE}
body{{width:1080px;height:1350px;background:linear-gradient(160deg,#0b1020,#1b2a55 55%,#0b1020);color:#fff;padding:90px 70px}}
.t{{text-align:center;font-size:30px;opacity:.8}} .c{{text-align:center;font-size:230px;font-weight:300;letter-spacing:-.04em;line-height:1;margin:6px 0 80px}}
.n{{background:rgba(255,255,255,.16);border-radius:44px;padding:36px 40px;margin-bottom:26px;backdrop-filter:blur(10px)}}
.n b{{font-size:34px}} .n small{{float:right;font-size:26px;opacity:.7}} .n p{{font-size:36px;margin-top:10px;line-height:1.3}}
h1{{position:absolute;left:70px;right:70px;bottom:150px;font-size:76px;line-height:1.05;letter-spacing:-.02em}} h1 span{{color:#7FA2FF}}</style>
<div class=t>Sunday 8 November</div><div class=c>21:42</div>
<div class=n><b>Website enquiry</b><small>now</small><p>"Is the grey one still available? Could I see it tomorrow?"</p></div>
<div class=n style="opacity:.75"><b>Showroom</b><small>closed</small><p>Next person in: Monday, 9am.</p></div>
<h1>Car dealerships: <span>it's Sunday night.</span> Who answers?</h1>{FOOT % ILL}""")

D["02-inbox-property"] = (1080, 1350, f"""<style>{BASE}
body{{width:1080px;height:1350px;background:#f2f2f7;color:#111;padding:80px 0}}
.h{{padding:0 60px 30px;font-size:52px;font-weight:800}} .h small{{display:block;font-size:28px;color:#8e8e93;font-weight:500;margin-top:6px}}
.r{{background:#fff;padding:30px 60px;border-bottom:1px solid #e5e5ea;position:relative}}
.r:before{{content:"";position:absolute;left:24px;top:46px;width:18px;height:18px;border-radius:50%;background:#2F6BFF}}
.r b{{font-size:34px}} .r em{{float:right;font-style:normal;font-size:26px;color:#8e8e93}} .r p{{font-size:30px;color:#555;margin-top:6px}}
.r.g{{opacity:.5}} .r.g:before{{display:none}}
h1{{padding:60px 60px 0;font-size:70px;line-height:1.06;letter-spacing:-.02em}} h1 span{{color:#2F6BFF}}</style>
<div class=h>Inbox<small>3 unread · office opens 9:00am</small></div>
<div class=r><b>Website form</b><em>8:12pm</em><p>New enquiry: 2-bed flat, viewing?</p></div>
<div class=r><b>Website form</b><em>9:40pm</em><p>New enquiry: landlord, valuation please</p></div>
<div class=r><b>Website form</b><em>10:05pm</em><p>New enquiry: is the flat still let?</p></div>
<div class="r g"><b>Team update</b><em>5:31pm</em><p>Have a good evening all</p></div>
<h1>Property managers: <span>nobody owns the evening inbox.</span></h1>{FOOT % ILL}""")

D["03-notes-systems"] = (1080, 1350, f"""<style>{BASE}
body{{width:1080px;height:1350px;background:#1c1c1e;padding:70px}}
.p{{background:#fff7c2;border-radius:30px;height:100%;padding:70px 64px;font-family:'DejaVu Serif',Georgia,serif;color:#222;position:relative}}
.d{{font-family:Inter;font-size:26px;color:#a08f2a;margin-bottom:40px}} h1{{font-size:78px;line-height:1.12;font-weight:700}}
p{{font-size:50px;line-height:1.35;margin-top:44px}} .u{{background:linear-gradient(transparent 60%,#ffe14d 60%)}}
.f{{position:absolute;left:64px;bottom:44px;font-family:Inter;font-size:26px;color:#a08f2a}}</style>
<div class=p><div class=d>Notes · Today</div><h1>Property managers don't need AI.</h1>
<p>They need every enquiry <span class=u>answered, booked and logged.</span></p>
<p>The AI is just how it gets done.<br><b>Systems, not AI.</b></p><div class=f>Safwan · BLACKLINE</div></div>""")

D["04-chat-clinics"] = (1080, 1350, f"""<style>{BASE}
body{{width:1080px;height:1350px;background:#fff;padding:70px 56px}}
.top{{text-align:center;font-size:30px;color:#8e8e93;margin-bottom:34px}} .top b{{display:block;color:#111;font-size:36px}}
.b{{max-width:78%;padding:26px 34px;border-radius:44px;font-size:36px;line-height:1.3;margin-bottom:22px}}
.in{{background:#e9e9eb;color:#111}} .out{{background:#2F6BFF;color:#fff;margin-left:auto}} .tm{{text-align:center;font-size:24px;color:#8e8e93;margin:26px 0}}
h1{{margin-top:50px;font-size:68px;line-height:1.06;letter-spacing:-.02em}}</style>
<div class=top>Demo clinic<b>after-hours enquiry</b></div>
<div class=tm>9:12pm</div><div class="b in">Hi, do you have any appointments this week?</div>
<div class=tm>9:12pm · a few seconds later</div>
<div class="b out">Hi, thanks for getting in touch. Which service are you after?</div>
<div class="b in">A consultation</div>
<div class="b out">Thursday 4:30pm is free. Shall I book it?</div>
<h1>Clinics: a missed enquiry is a missed appointment.</h1>{FOOT % ILL}""")

D["05-booking-recruiters"] = (1080, 1350, f"""<style>{BASE}
body{{width:1080px;height:1350px;background:#0a0a0a;color:#fff;padding:90px 70px}}
.c{{background:#161a22;border:2px solid #262c3a;border-radius:36px;padding:54px}} .ok{{color:#35d07f;font-weight:700;font-size:34px}}
.c h2{{font-size:62px;margin:14px 0 34px}} .row{{display:flex;justify-content:space-between;font-size:34px;padding:22px 0;border-top:1px solid #262c3a;color:#c8ccd6}}
.row b{{color:#fff}} h1{{margin-top:70px;font-size:78px;line-height:1.05;letter-spacing:-.02em}} h1 span{{color:#7FA2FF}}</style>
<div class=c><div class=ok>✓ Call booked</div><h2>Thursday, 10:30am</h2>
<div class=row><span>Source</span><b>Website enquiry</b></div><div class=row><span>Qualified</span><b>Yes</b></div>
<div class=row><span>Logged in CRM</span><b>Yes</b></div><div class=row><span>Typed by a person</span><b>No</b></div></div>
<h1>Recruiters: <span>booked and logged</span> without typing.</h1>{FOOT % ILL}""")

D["06-checklist-brokers"] = (1080, 1350, f"""<style>{BASE}
body{{width:1080px;height:1350px;background:#efe9dc;color:#222;padding:90px 80px}}
h1{{font-size:78px;line-height:1.05;letter-spacing:-.02em}} h1 span{{background:linear-gradient(transparent 62%,#ffd84d 62%)}}
.i{{display:flex;gap:34px;align-items:center;font-size:46px;margin-top:48px;line-height:1.2}}
.k{{flex:none;width:70px;height:70px;border:5px solid #222;border-radius:14px;display:grid;place-items:center;font-size:54px;color:#2F6BFF}}
.n{{margin-top:70px;font-size:36px;color:#555}}</style>
<h1>Mortgage brokers: <span>4 questions</span> before the first call</h1>
<div class=i><div class=k>✓</div>What are they after?</div><div class=i><div class=k>✓</div>When do they need it by?</div>
<div class=i><div class=k>✓</div>Who else is involved?</div><div class=i><div class=k>✓</div>When can you ring?</div>
<div class=n>Ask them before the call, not on it. Swap in your own.</div>{FOOT % "Safwan · BLACKLINE"}""")

D["07-whiteboard-offices"] = (1080, 1350, f"""<style>{BASE}
body{{width:1080px;height:1350px;background:#e8edf2;padding:70px}}
.w{{background:#fff;border:16px solid #b9c2cc;border-radius:20px;height:100%;padding:70px 60px;color:#16233b;font-family:'DejaVu Sans',sans-serif;position:relative}}
h1{{font-size:70px;line-height:1.1;font-weight:800}} .s{{margin-top:54px;font-size:48px;font-weight:700;line-height:1.35}}
.s i{{font-style:normal;color:#2F6BFF}} .s span{{display:block;padding-left:56px}} .z{{margin-top:40px;font-size:40px;color:#c0392b;font-weight:700}}
.f{{position:absolute;left:60px;bottom:36px;font-size:26px;color:#8a94a3;font-weight:400}}</style>
<div class=w><h1>Busy service office?<br>Here's what I build.</h1>
<div class=s><i>1</i> Enquiry comes in<span>↓ reply in seconds</span><i>2</i> Right questions asked<span>↓</span><i>3</i> Booked in the calendar<span>↓</span><i>4</i> Logged in the CRM<span>↓</span><i>5</i> A person steps in when needed</div>
<div class=z>Behind the website you already have.</div><div class=f>Safwan · BLACKLINE · early days, live demo</div></div>""")

D["08-timeline-property-x"] = (1600, 900, f"""<style>{BASE}
body{{width:1600px;height:900px;background:#000;color:#fff;padding:90px;display:flex;flex-direction:column;justify-content:center}}
h1{{font-size:84px;line-height:1.05;letter-spacing:-.02em}} h1 span{{color:#7FA2FF}}
.t{{margin-top:150px;position:relative;height:6px;background:#2F6BFF;box-shadow:0 0 24px #2F6BFF}}
.p{{position:absolute;top:-50px;font-size:34px;text-align:center;width:300px;margin-left:-150px;line-height:1.3}}
.p:after{{content:"";position:absolute;left:50%;top:44px;width:24px;height:24px;margin-left:-12px;border-radius:50%;background:#fff}}
.p small{{display:block;color:#8A8F9C;font-size:26px;margin-top:70px}}</style>
<h1>Property managers: <span>12 hours</span> is a long time to wait.</h1>
<div class=t><div class=p style="left:0%;margin-left:0;text-align:left;width:360px"><b>6pm</b><small>Office shuts</small></div>
<div class=p style="left:45%"><b>9pm</b><small>Enquiry lands</small></div>
<div class=p style="left:100%;margin-left:-300px;text-align:right"><b>9am</b><small>Someone replies</small></div></div>
{FOOT % "Illustration · Safwan · BLACKLINE"}""")

D["09-tabs-dealers-x"] = (1600, 900, f"""<style>{BASE}
body{{width:1600px;height:900px;background:#202124;color:#fff;padding:60px 70px}}
.tb{{display:flex;gap:8px}} .tab{{padding:20px 34px;border-radius:20px 20px 0 0;background:#35363a;font-size:28px;color:#bbb}} .tab.a{{background:#fff;color:#111;font-weight:600}}
.pg{{background:#fff;height:300px;border-radius:0 0 20px 20px;color:#111;padding:40px 50px;font-size:34px}}
.pg b{{display:block;font-size:44px;margin-bottom:10px}} .btn{{display:inline-block;margin-top:20px;background:#d93025;color:#fff;padding:16px 36px;border-radius:12px;font-size:30px}}
h1{{margin-top:56px;font-size:70px;line-height:1.06;letter-spacing:-.02em}} h1 span{{color:#7FA2FF}}</style>
<div class=tb><div class="tab a">Your dealership · Enquiry sent ✓</div><div class=tab>Other dealer · Enquire now</div></div>
<div class=pg><b>Thanks, we'll be in touch.</b>Showroom opens Monday 9am.<br><span class=btn>Close tab</span></div>
<h1>Car dealers: the next dealer's form is <span>one tab away.</span></h1>{FOOT % "Illustration · Safwan · BLACKLINE"}""")

def render(out, w, h, html):
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False) as f:
        f.write("<meta charset=utf-8>" + html)
    subprocess.run([CHROME, "--headless", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
                    f"--window-size={w},{h}", f"--screenshot={out}", "file://" + f.name],
                   check=True, capture_output=True)
    os.unlink(f.name)

if __name__ == "__main__":
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    for name, (w, h, html) in D.items():
        render(os.path.join(out, name + ".png"), w, h, html); print(name)
