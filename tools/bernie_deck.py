#!/usr/bin/env python3
"""Bernie deck — phone-format PDF in Chase Contemporary proposal branding."""
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor

# ---------- fonts ----------
AN = "/System/Library/Fonts/Avenir Next.ttc"
pdfmetrics.registerFont(TTFont("AN-UltraLight", AN, subfontIndex=10))
pdfmetrics.registerFont(TTFont("AN-Regular", AN, subfontIndex=7))
pdfmetrics.registerFont(TTFont("AN-Medium", AN, subfontIndex=5))
pdfmetrics.registerFont(TTFont("AN-Demi", AN, subfontIndex=2))
pdfmetrics.registerFont(TTFont("AN-Bold", AN, subfontIndex=0))

# ---------- palette (from the Revenue Engine proposal) ----------
CREAM      = HexColor("#FBFAF7")
INK        = HexColor("#211F1B")
INK_SOFT   = HexColor("#6E685E")
DARK       = HexColor("#191813")
DARK_CARD  = HexColor("#211F19")
LIGHT_ON_D = HexColor("#F2EFE8")
SOFT_ON_D  = HexColor("#A8A296")
GOLD       = HexColor("#A67C2E")
GOLD_BRIGHT= HexColor("#B4913F")
RULE_L     = HexColor("#DDD8CE")
RULE_D     = HexColor("#3A372E")
CARD_L     = HexColor("#F4F1EA")

W, H = 390, 844
M = 34                      # side margin
TOTAL = 12

c = canvas.Canvas("/Users/moabot/chase-contemporary/docs/bernie-deck-v1.pdf", pagesize=(W, H))
c.setTitle("Chase Contemporary — The Plan, In Plain English")

# ---------- helpers ----------
def sw(text, font, size, cs=0):
    w = pdfmetrics.stringWidth(text, font, size)
    if cs and len(text) > 1:
        w += cs * (len(text) - 1)
    return w

def draw(x, y, text, font, size, color, cs=0):
    c.setFont(font, size); c.setFillColor(color)
    t = c.beginText(x, y); t.setCharSpace(cs); t.textOut(text); c.drawText(t)

def draw_center(y, text, font, size, color, cs=0):
    draw((W - sw(text, font, size, cs)) / 2, y, text, font, size, color, cs)

def wrap(text, font, size, maxw, cs=0):
    words, lines, cur = text.split(), [], ""
    for w_ in words:
        trial = (cur + " " + w_).strip()
        if sw(trial, font, size, cs) <= maxw: cur = trial
        else:
            if cur: lines.append(cur)
            cur = w_
    if cur: lines.append(cur)
    return lines

def para(x, y, text, font, size, color, maxw, leading, cs=0, center=False):
    for ln in wrap(text, font, size, maxw, cs):
        if center: draw_center(y, ln, font, size, color, cs)
        else: draw(x, y, ln, font, size, color, cs)
        y -= leading
    return y

def bg(dark):
    c.setFillColor(DARK if dark else CREAM)
    c.rect(0, 0, W, H, stroke=0, fill=1)

def footer(page, dark):
    col = SOFT_ON_D if dark else INK_SOFT
    draw(M, 30, "CHASE CONTEMPORARY", "AN-Demi", 6.5, col, cs=1.6)
    s = f"{page:02d} / {TOTAL}"
    draw(W - M - sw(s, "AN-Demi", 6.5, 1.6), 30, s, "AN-Demi", 6.5, col, cs=1.6)

def kicker(y, text, dark):
    draw(M, y, text, "AN-Demi", 8.5, GOLD if not dark else GOLD_BRIGHT, cs=2.6)

def title(y, lines, dark, size=27):
    col = LIGHT_ON_D if dark else INK
    for ln in lines:
        draw(M, y, ln, "AN-Medium", size, col, cs=0.4)
        y -= size * 1.22
    return y

def hrule(y, dark, x0=M, x1=W-M):
    c.setStrokeColor(RULE_D if dark else RULE_L); c.setLineWidth(0.7)
    c.line(x0, y, x1, y)

# =========================================================
# 01 — COVER (dark)
# =========================================================
bg(True)
draw_center(H-150, "C H A S E", "AN-Bold", 30, LIGHT_ON_D, cs=6)
draw_center(H-190, "C O N T E M P O R A R Y", "AN-Bold", 21, LIGHT_ON_D, cs=4)
draw_center(H-268, "THE PLAN, IN PLAIN ENGLISH", "AN-Demi", 9, GOLD_BRIGHT, cs=3)
draw_center(H-330, "A NEW WEBSITE.", "AN-UltraLight", 30, LIGHT_ON_D, cs=1)
draw_center(H-368, "AN ENGINE BEHIND IT.", "AN-UltraLight", 30, LIGHT_ON_D, cs=1)
para(0, H-425, "What we are building, what it does for the gallery, and the few things we need from you.",
     "AN-Regular", 12.5, SOFT_ON_D, 270, 19, center=True)
draw_center(200, "PREPARED FOR BERNIE CHASE", "AN-Demi", 8.5, SOFT_ON_D, cs=2.4)
draw_center(182, "AUGUST 2026", "AN-Demi", 8.5, SOFT_ON_D, cs=2.4)
draw_center(150, "NEW YORK  ·  PALM BEACH  ·  LOS ANGELES", "AN-Demi", 7.5, SOFT_ON_D, cs=1.8)
footer(1, True); c.showPage()

# =========================================================
# 02 — WHERE SALES SLIP AWAY (light)
# =========================================================
bg(False)
kicker(H-70, "TODAY", False)
y = title(H-104, ["WHERE SALES", "SLIP AWAY"], False)
y -= 6
y = para(M, y, "Right now, when a collector wants a piece, their message lands in one shared email box.",
         "AN-Regular", 12.5, INK, W-2*M, 19)
y -= 8
y = para(M, y, "No one owns it. Some get answered fast. Some never get answered at all. And every single one can be a five-thousand-dollar sale, or a million-dollar sale.",
         "AN-Regular", 12.5, INK, W-2*M, 19)
y -= 8
y = para(M, y, "The old website is gone too. About fifty shows: Hambleton, Valencia, Taupin, Scharf. Erased. People still search for them and find nothing.",
         "AN-Regular", 12.5, INK, W-2*M, 19)
# stat cards 2x2
cy = y - 24
cw, ch, gap = (W - 2*M - 12) / 2, 92, 12
stats = [("1", "shared inbox where every inquiry lands"),
         ("0", "follow-ups when nobody answers"),
         ("50", "shows wiped off the internet"),
         ("$5k–$1M+", "what each inquiry can be worth")]
for i, (big, small) in enumerate(stats):
    x = M + (i % 2) * (cw + gap)
    yy = cy - (i // 2) * (ch + gap)
    c.setFillColor(CARD_L); c.setStrokeColor(RULE_L); c.setLineWidth(0.7)
    c.rect(x, yy - ch, cw, ch, stroke=1, fill=1)
    draw(x+14, yy-34, big, "AN-Medium", 21, INK)
    para(x+14, yy-52, small, "AN-Regular", 9, INK_SOFT, cw-26, 12.5)
end_y = cy - 2*ch - gap
para(M, end_y - 30, "One saved sale pays for this entire project.", "AN-Medium", 13.5, INK, W-2*M, 19)
footer(2, False); c.showPage()

# =========================================================
# 03 — THE BIG IDEA (dark)
# =========================================================
bg(True)
kicker(H-70, "THE BIG IDEA", True)
y = title(H-104, ["ONE WEBSITE.", "ONE BOOK."], True)
y -= 6
y = para(M, y, "We are building two things that work as one:",
         "AN-Regular", 12.5, SOFT_ON_D, W-2*M, 19)
items = [
    ("A WEBSITE WORTHY OF THE ART",
     "Beautiful, museum-grade, and built to sell. Prints and editions can be bought on the spot. Important works start a conversation."),
    ("ONE BOOK THAT RUNS THE GALLERY",
     "Every artwork, every collector, every deal, every dollar, written down in one place instead of scattered across emails and memory."),
    ("A TEAM THAT NEVER DROPS A LEAD",
     "Every inquiry has an owner, a clock, and a next step. Nothing slips."),
]
yy = y - 24
for i, (h, b) in enumerate(items, 1):
    draw(M, yy, f"{i}", "AN-Medium", 19, GOLD_BRIGHT)
    para(M+30, yy, h, "AN-Demi", 10.5, LIGHT_ON_D, W-2*M-30, 15, cs=1.2)
    yy = para(M+30, yy-19, b, "AN-Regular", 11.5, SOFT_ON_D, W-2*M-30, 17)
    yy -= 20
hrule(yy+2, True)
para(M, yy - 26, "And the heart of the business does not change. The artists, the taste, the way you buy and sell: untouched.",
     "AN-Medium", 13, LIGHT_ON_D, W-2*M, 20)
footer(3, True); c.showPage()

# =========================================================
# 04 — NEVER MISS A COLLECTOR (light)
# =========================================================
bg(False)
kicker(H-96, "STEP ONE", False)
y = title(H-130, ["NEVER MISS", "A COLLECTOR"], False)
y -= 6
steps = [
    ("A collector presses “Inquire” on a painting.", None),
    ("The team's phones buzz that second.", "Not tomorrow. Not “when someone checks the inbox.” That second."),
    ("Whoever picks it up sees the full picture.", "Who is asking, which work, what they looked at, what they have bought before. All on one card."),
    ("The collector hears back in minutes.", "From a person. With the right answer, and a way to pay if they are ready."),
]
yy = y
for i, (h, b) in enumerate(steps, 1):
    c.setFillColor(GOLD); c.circle(M+8, yy+4, 8.5, stroke=0, fill=1)
    d = str(i); draw(M+8-sw(d,"AN-Demi",9)/2, yy+1, d, "AN-Demi", 9, CREAM)
    yy = para(M+30, yy, h, "AN-Medium", 12.5, INK, W-2*M-30, 17)
    if b: yy = para(M+30, yy-1, b, "AN-Regular", 11, INK_SOFT, W-2*M-30, 16)
    yy -= 16
c.setFillColor(DARK)
c.rect(M, yy-88, W-2*M, 78, stroke=0, fill=1)
draw(M+16, yy-34, "WHY IT MATTERS", "AN-Demi", 7.5, GOLD_BRIGHT, cs=2.2)
para(M+16, yy-52, "Answer inside five minutes and a buyer is 21 times more likely to become a real conversation.",
     "AN-Regular", 11, LIGHT_ON_D, W-2*M-32, 15.5)
footer(4, False); c.showPage()

# =========================================================
# 05 — MONEY, ON THE COLLECTOR'S TERMS (light)
# =========================================================
bg(False)
kicker(H-70, "STEP TWO", False)
y = title(H-104, ["MONEY, ON THE", "COLLECTOR'S TERMS"], False)
y -= 6
y = para(M, y, "When a collector is ready, we take the money however they want to give it:",
         "AN-Regular", 12.5, INK, W-2*M, 19)
rails = [
    ("CARD", "for editions and deposits"),
    ("BANK TRANSFER", "the easy middle, five to a hundred fifty thousand"),
    ("WIRE", "for large works, instructions sent automatically"),
    ("PAYMENT PLANS", "so more collectors can say yes"),
    ("A LINK BY TEXT", "sent while they are still on the phone. They tap, they pay, done"),
]
yy = y - 14
for h, b in rails:
    draw(M, yy, h, "AN-Demi", 10, INK, cs=1.4)
    yy = para(M + 128, yy, b, "AN-Regular", 10.5, INK_SOFT, W-M-16-(M+128-M), 14.5)
    yy -= 10
    hrule(yy+4, False)
    yy -= 12
c.setFillColor(DARK)
bh = 128
c.rect(M, yy-bh, W-2*M, bh, stroke=0, fill=1)
c.setFillColor(GOLD_BRIGHT); c.rect(M+16, yy-30, 68, 15, stroke=0, fill=1)
draw(M+22, yy-26, "THE HOLD", "AN-Demi", 7.5, DARK, cs=1.6)
para(M+16, yy-50, "A collector who says “let me think about it” puts down a small refundable deposit, and the work is held for 72 hours. “A hold has been placed on this work” is the most honest urgency in the business, and it turns maybes into sales.",
     "AN-Regular", 10.5, LIGHT_ON_D, W-2*M-32, 15)
footer(5, False); c.showPage()

# =========================================================
# 06 — ONE BOOK (light)
# =========================================================
bg(False)
kicker(H-70, "THE BOOK", False)
y = title(H-104, ["THE WHOLE GALLERY,", "IN ONE PLACE"], False)
y -= 6
y = para(M, y, "Every artwork, with its images and provenance. Every collector and everything they ever bought or asked about. Every deal, every payment, every consignment. One book.",
         "AN-Regular", 12.5, INK, W-2*M, 19)
y -= 8
y = para(M, y, "And you can ask it questions the way you would ask a person:",
         "AN-Regular", 12.5, INK, W-2*M, 19)
c.setFillColor(CARD_L); c.setStrokeColor(RULE_L)
qh = 84
c.rect(M, y-14-qh, W-2*M, qh, stroke=1, fill=1)
para(M+16, y-40, "“Who bought street art under fifty thousand near Palm Beach in the last three years?”",
     "AN-Medium", 12, INK, W-2*M-32, 17)
draw(M+16, y-14-qh+16, "TEN SECONDS LATER: YOUR NEXT INVITE LIST.", "AN-Demi", 7.5, GOLD, cs=1.8)
y2 = y - qh - 44
y2 = para(M, y2, "Who sees what is up to you. You see everything. Each person on the team sees their own deals. Artists, later, can see only their own statements.",
         "AN-Regular", 12.5, INK, W-2*M, 19)
y2 -= 8
para(M, y2, "History goes in first: past sales, past invoices, past clients. The book is only as smart as its memory.",
     "AN-Regular", 12.5, INK, W-2*M, 19)
footer(6, False); c.showPage()

# =========================================================
# 07 — YOUR HISTORY, BACK ONLINE (dark)
# =========================================================
bg(True)
kicker(H-90, "THE LEGACY", True)
y = title(H-124, ["YOUR HISTORY,", "BACK ONLINE"], True)
y -= 6
y = para(M, y, "We found the old pages preserved in internet archives: about fifty shows, from the Chelsea years to the SoHo flagship. We are bringing every one of them back.",
         "AN-Regular", 12.5, SOFT_ON_D, W-2*M, 19)
y -= 8
y = para(M, y, "Hambleton. Valencia. Taupin. Scharf. Feuerman. The fairs, the press, the story.",
         "AN-Medium", 12.5, LIGHT_ON_D, W-2*M, 19)
y -= 16
hrule(y, True)
y -= 28
draw(M, y, "WHY BOTHER?", "AN-Demi", 8, GOLD_BRIGHT, cs=2.4)
y -= 22
y = para(M, y, "Because people don't just ask Google anymore. They ask their phone, and their phone asks an AI.",
         "AN-Regular", 12.5, SOFT_ON_D, W-2*M, 19)
y -= 8
y = para(M, y, "When someone asks “where do I buy a Kenny Scharf?”, the answer should be Chase Contemporary.",
         "AN-Medium", 13, LIGHT_ON_D, W-2*M, 20)
y -= 8
y = para(M, y, "The more of your history that lives online, the more often the gallery is the answer. The shows. The press. Your eye for artists like Andres Valencia. Your past sells for you, around the clock.",
         "AN-Regular", 12.5, SOFT_ON_D, W-2*M, 19)
footer(7, True); c.showPage()

# =========================================================
# 08 — WHAT YOU SEE (light)
# =========================================================
bg(False)
kicker(H-116, "VISIBILITY", False)
y = title(H-150, ["WHAT YOU SEE"], False)
y -= 6
y = para(M, y, "One screen, live, any time you look. Not month-end reports, but answers to the questions an owner actually asks:",
         "AN-Regular", 12.5, INK, W-2*M, 19)
qs = [
    ("WHO IS ASKING ABOUT WHAT", "every open conversation, and who owns it"),
    ("WHO ANSWERS FASTEST", "and who closes, and who discounts too much"),
    ("WHAT IS MOVING", "by artist, by size, by price, and what is stuck"),
    ("WHERE THE MONEY IS", "paid, owed, and on the way, to the dollar"),
]
yy = y - 14
for h, b in qs:
    c.setFillColor(GOLD); c.rect(M, yy-2, 3, 12, stroke=0, fill=1)
    draw(M+14, yy, h, "AN-Demi", 10.5, INK, cs=1.2)
    yy = para(M+14, yy-17, b, "AN-Regular", 11, INK_SOFT, W-2*M-14, 16)
    yy -= 18
hrule(yy+4, False)
para(M, yy-24, "When everyone can see the board, the floor manages itself. And once we can see what your best closer does differently, we teach it to everyone.",
     "AN-Regular", 12.5, INK, W-2*M, 19)
footer(8, False); c.showPage()

# =========================================================
# 09 — ARTISTS PAID RIGHT (light)
# =========================================================
bg(False)
kicker(H-116, "THE BACK OFFICE", False)
y = title(H-150, ["ARTISTS PAID RIGHT,", "AUTOMATICALLY"], False)
y -= 6
y = para(M, y, "The artist's share, the salesperson's commission, the house cut: every split is written down once, as a rule.",
         "AN-Regular", 12.5, INK, W-2*M, 19)
y -= 8
y = para(M, y, "The moment a payment lands, the numbers work themselves out. Installments too. Discounts shared fairly, automatically.",
         "AN-Regular", 12.5, INK, W-2*M, 19)
y -= 8
y = para(M, y, "Artist statements go out monthly, on time, every time. Salespeople see their own numbers live.",
         "AN-Regular", 12.5, INK, W-2*M, 19)
y -= 16
hrule(y, False)
y -= 28
y = para(M, y, "No month-end spreadsheet archaeology. No disputes. No “I thought we agreed…”",
         "AN-Medium", 13, INK, W-2*M, 20)
y -= 8
para(M, y, "And because every discount is on the record, the quiet leak most galleries never see becomes money you keep.",
     "AN-Regular", 12.5, INK, W-2*M, 19)
footer(9, False); c.showPage()

# =========================================================
# 10 — WHAT THIS IS NOT (dark)
# =========================================================
bg(True)
kicker(H-100, "THE RULES", True)
y = title(H-134, ["WHAT THIS", "IS NOT"], True)
y -= 6
rules = [
    ("NO CHATBOTS.", "No robot ever speaks to a collector. Ever."),
    ("NOTHING SENDS ITSELF.", "Every email the system prepares is read and approved by a person before it goes anywhere."),
    ("NO MACHINE QUOTES A PRICE.", "Price-on-request means a person picks up the phone."),
    ("YOUR LIST NEVER LEAVES.", "Collector names and numbers stay inside the gallery. They are the crown jewels and we treat them that way."),
]
yy = y - 6
for h, b in rules:
    draw(M, yy, h, "AN-Demi", 12, GOLD_BRIGHT, cs=1)
    yy = para(M, yy-19, b, "AN-Regular", 12, SOFT_ON_D, W-2*M, 17.5)
    yy -= 22
hrule(yy+6, True)
para(M, yy-22, "The machinery does the remembering, the timing, and the paperwork. People do the selling.",
     "AN-Medium", 13, LIGHT_ON_D, W-2*M, 20)
footer(10, True); c.showPage()

# =========================================================
# 11 — HOW IT ROLLS OUT (light)
# =========================================================
bg(False)
kicker(H-70, "THE ROLLOUT", False)
y = title(H-104, ["FIRST WINS", "IN DAYS"], False)
y -= 4
phases = [
    ("WEEKS 1–3", "STOP THE LEAK",
     "Every inquiry gets an owner, a fast answer, and a follow-up. We dig the last years of inquiries out of the inbox and revive every one that went quiet."),
    ("WEEKS 3–8", "TAKE THE MONEY",
     "Card, bank transfer, wire, plans, holds, payment links. Collectors can commit the moment they are ready, on whatever terms suit the work."),
    ("WEEKS 8–16", "COMPOUND",
     "The beautiful new website. The history restored. The dashboard. The automatic artist statements. Every sale makes the next one easier."),
]
yy = y - 14
for weeks, name, body in phases:
    c.setFillColor(CARD_L); c.setStrokeColor(RULE_L); c.setLineWidth(0.7)
    bh2 = 118
    c.rect(M, yy-bh2, W-2*M, bh2, stroke=1, fill=1)
    draw(M+16, yy-26, name, "AN-Demi", 11, INK, cs=1.4)
    wtxt = weeks
    draw(W-M-16-sw(wtxt,"AN-Demi",8,1.6), yy-25, wtxt, "AN-Demi", 8, GOLD, cs=1.6)
    para(M+16, yy-46, body, "AN-Regular", 10.5, INK_SOFT, W-2*M-32, 15)
    yy -= bh2 + 14
para(M, yy-8, "Measured before promised: the first thing we build is the counting, so every claim gets proven with your real numbers.",
     "AN-Regular", 11.5, INK, W-2*M, 17)
footer(11, False); c.showPage()

# =========================================================
# 12 — WHAT WE NEED FROM YOU (dark close)
# =========================================================
bg(True)
kicker(H-90, "FROM YOU", True)
y = title(H-124, ["FOUR THINGS,", "NONE OF THEM HARD"], True)
y -= 6
needs = [
    ("AN HOUR OF TALK", "Addresses, who is on the team, which artists are current. The facts only you know."),
    ("THE KEYS", "Your office manager can hand us the website and email access. We take it from there."),
    ("YOUR STORIES", "An hour of you talking, like the Schachter interview, becomes pages that sell for years."),
    ("YOUR EYE", "You approve every design and every word before the world sees it."),
]
yy = y - 4
for i, (h, b) in enumerate(needs, 1):
    draw(M, yy, f"{i:02d}", "AN-Medium", 13, GOLD_BRIGHT)
    draw(M+34, yy, h, "AN-Demi", 11, LIGHT_ON_D, cs=1.4)
    yy = para(M+34, yy-18, b, "AN-Regular", 11.5, SOFT_ON_D, W-2*M-34, 17)
    yy -= 22
hrule(yy+6, True)
yy -= 30
draw(M, yy, "Competitors have an inbox.", "AN-Medium", 15.5, LIGHT_ON_D)
draw(M, yy-24, "Chase Contemporary will have", "AN-Medium", 15.5, LIGHT_ON_D)
draw(M, yy-48, "an operating system.", "AN-Medium", 15.5, GOLD_BRIGHT)
footer(12, True); c.showPage()

c.save()
print("done")
EOF = None
