"""BLACKLINE quality gate. Usage: python scripts/quality_gate.py marketing/weeks/2026-W44.md

Fixes what it safely can (dashes) in place, then prints FAIL/WARN lines per post.
FAIL = must fix before posting. WARN = Safwan decides.
"""
import re
import sys

BANNED = ["game-changer", "game changer", "unlock", "leverage", "revolutionise", "revolutionize",
          "seamless", "delve", "in today's fast-paced", "letting agent", "supercharge", "skyrocket"]
EMOJI = re.compile("[\U0001F300-\U0001FAFF☀-➿]")
URL = re.compile(r"(https?://|www\.|\.co\.uk|\.com\b)", re.I)
HEADER = re.compile(r"^## (P\d+) \| (\w+)", re.M)


def check(post_id, platform, body):
    issues = []
    copy = body.split("COPY:", 1)[-1].split("VISUAL:", 1)[0]
    hook = re.search(r"HOOK:\s*(.+)", body)
    low = copy.lower()
    for word in BANNED:
        if word in low:
            issues.append(("FAIL", f"banned phrase '{word}'"))
    if len(EMOJI.findall(copy)) > 2:
        issues.append(("FAIL", "more than 2 emojis"))
    tags = re.findall(r"#\w+", copy)
    limit = 3 if platform.lower() in ("linkedin", "facebook") else 5
    if len(tags) > limit:
        issues.append(("FAIL", f"{len(tags)} hashtags (max {limit})"))
    if platform.lower() == "linkedin" and URL.search(copy):
        issues.append(("FAIL", "link in LinkedIn post (costs reach)"))
    if hook and len(hook.group(1).split()) > 12:
        issues.append(("FAIL", "hook over 12 words"))
    if not hook:
        issues.append(("FAIL", "missing HOOK line"))
    if "[NUMBER?]" in body or re.search(r"\[[A-Z ]+\?\]", body):
        issues.append(("WARN", "placeholder needs a real figure"))
    for n in re.findall(r"\b\d+(?:\.\d+)?%|\b\d{2,}\b", copy):
        issues.append(("WARN", f"number '{n}' - confirm it's real and sourced"))
        break
    if re.search(r"\b(clients? (said|told)|testimonial|our clients|we've helped)\b", low):
        issues.append(("WARN", "sounds like a client claim - BLACKLINE has no clients yet"))
    words = len(copy.split())
    if platform.lower() == "linkedin" and words > 300:
        issues.append(("WARN", f"{words} words - long for LinkedIn"))
    return issues


def main(path):
    text = open(path, encoding="utf-8").read()
    fixed = text.replace(" — ", ", ").replace("—", ", ").replace(" – ", ", ").replace("–", "-")
    if fixed != text:
        open(path, "w", encoding="utf-8").write(fixed)
        print("FIXED: replaced em/en dashes")
    parts = HEADER.split(fixed)
    fails = warns = 0
    for i in range(1, len(parts), 3):
        post_id, platform, body = parts[i], parts[i + 1], parts[i + 2]
        for level, msg in check(post_id, platform, body):
            print(f"{level} {post_id} ({platform}): {msg}")
            fails += level == "FAIL"
            warns += level == "WARN"
    count = (len(parts) - 1) // 3
    print(f"\n{count} posts checked: {fails} FAIL, {warns} WARN")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main(sys.argv[1])
