#!/usr/bin/env python3
"""Bernie deck v4 — Karma-gallery design philosophy: near-uniform small type,
hierarchy by position and whitespace, no ornament. Nimbus Sans Novus, all caps."""
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor

F = "/Users/moabot/Library/Fonts/"
pdfmetrics.registerFont(TTFont("NSN", F + "nimbus-sans-novus-regular.ttf"))
pdfmetrics.registerFont(TTFont("NSN-Med", F + "nimbus-sans-novus-medium.ttf"))

BLACK = HexColor("#111111"); GRAY = HexColor("#767470"); WHITE = HexColor("#FFFFFF")
W, H = 390, 844
M = 48                       # generous margins
MEAS = 268                   # narrow reading measure
TOTAL = 12

c = canvas.Canvas("/Users/moabot/chase-contemporary/docs/bernie-deck-v1.pdf", pagesize=(W, H))
c.setTitle("Chase Contemporary — Revenue Engine: The Execution Plan")

# ---------- type system (Karma: micro-contrast) ----------
# wordmark  : Med 7pt  +3.2                       top-left, every page
# section   : Reg 7pt  +3.2  gray                 top-right
# title     : Med 12.5pt +2.6                     one per page
# body      : Reg 9pt  +1.1  leading 17           narrow measure
# quiet     : Reg 7.5pt +1.6 gray                 secondary lines
# folio     : Reg 6.5pt +2.4 gray                 bottom center

def sw(t, f, s, cs=0):
    t = t.upper()
    w = pdfmetrics.stringWidth(t, f, s)
    return w + (cs * (len(t) - 1) if cs and len(t) > 1 else 0)

def txt(x, y, t, f="NSN", s=9, cs=1.1, col=BLACK):
    c.setFont(f, s); c.setFillColor(col)
    o = c.beginText(x, y); o.setCharSpace(cs); o.textOut(t.upper()); c.drawText(o)

def wrap(t, f, s, maxw, cs):
    out, cur = [], ""
    for word in t.split():
        trial = (cur + " " + word).strip()
        if sw(trial, f, s, cs) <= maxw: cur = trial
        else:
            if cur: out.append(cur)
            cur = word
    if cur: out.append(cur)
    return out

def para(y, t, f="NSN", s=9, cs=1.1, col=BLACK, maxw=MEAS, lead=17, x=M):
    for ln in wrap(t, f, s, maxw, cs):
        txt(x, y, ln, f, s, cs, col)
        y -= lead
    return y

def quiet(y, t, x=M, maxw=MEAS):
    return para(y, t, "NSN", 7.5, 1.6, GRAY, maxw, 13, x)

def page_start(idx, section):
    c.setFillColor(WHITE); c.rect(0, 0, W, H, stroke=0, fill=1)
    txt(M, H - 64, "CHASE CONTEMPORARY", "NSN-Med", 7, 3.2)
    t = section
    txt(W - M - sw(t, "NSN", 7, 3.2), H - 64, t, "NSN", 7, 3.2, GRAY)

def page_end(idx):
    t = f"{idx:02d} / {TOTAL}"
    txt((W - sw(t, "NSN", 6.5, 2.4)) / 2, 52, t, "NSN", 6.5, 2.4, GRAY)
    c.showPage()

def title(y, t):
    txt(M, y, t, "NSN-Med", 12.5, 2.6)
    return y

def gap(y, n=1):
    return y - 17 * n

# =========================================================
# 01 — COVER
# =========================================================
c.setFillColor(WHITE); c.rect(0, 0, W, H, stroke=0, fill=1)
txt(M, H - 64, "CHASE CONTEMPORARY", "NSN-Med", 7, 3.2)
y = H - 236
txt(M, y, "REVENUE ENGINE", "NSN-Med", 12.5, 2.6)
y -= 26
txt(M, y, "THE EXECUTION PLAN", "NSN", 7.5, 1.6, GRAY)
y -= 92
y = para(y, "A NEW WEBSITE.")
y = para(y, "AN ENGINE BEHIND IT.")
y = gap(y)
y = quiet(y, "WHAT WE ARE BUILDING, WHAT IT DOES FOR THE GALLERY, AND THE ONE THING WE NEED FROM YOU.", maxw=210)
y = 168
y = quiet(y, "PREPARED FOR BERNIE CHASE")
y = quiet(y, "AUGUST 2026")
y -= 13
quiet(y, "NEW YORK · PALM BEACH · LOS ANGELES")
page_end(1)

# =========================================================
# 02 — WHERE SALES SLIP AWAY
# =========================================================
page_start(2, "TODAY")
y = H - 158
title(y, "WHERE SALES SLIP AWAY")
y -= 46
y = para(y, "WHEN A COLLECTOR WANTS A PIECE, THEIR MESSAGE LANDS IN ONE SHARED EMAIL BOX. NO ONE OWNS IT. SOME GET ANSWERED FAST. SOME NEVER GET ANSWERED AT ALL.")
y = gap(y)
y = para(y, "EVERY SINGLE ONE CAN BE A FIVE-THOUSAND-DOLLAR SALE, OR A MILLION-DOLLAR SALE.")
y = gap(y)
y = para(y, "THE OLD WEBSITE IS GONE TOO: ABOUT FIFTY SHOWS, HAMBLETON TO VALENCIA, ERASED. PEOPLE STILL SEARCH FOR THEM AND FIND NOTHING.")
y = gap(y, 2)
for big, small in [("1", "SHARED INBOX WHERE EVERY INQUIRY LANDS"),
                   ("0", "FOLLOW-UPS WHEN NOBODY ANSWERS"),
                   ("50", "SHOWS WIPED OFF THE INTERNET"),
                   ("$5K – $1M+", "WHAT EACH INQUIRY CAN BE WORTH")]:
    txt(M, y, big, "NSN-Med", 9, 1.4)
    txt(M + 78, y, small, "NSN", 7.5, 1.6, GRAY)
    y -= 22
y = gap(y)
para(y, "ONE SAVED SALE PAYS FOR THIS ENTIRE PROJECT.", "NSN-Med", 9, 1.4)
page_end(2)

# =========================================================
# 03 — ONE WEBSITE. ONE BOOK.
# =========================================================
page_start(3, "THE IDEA")
y = H - 158
title(y, "ONE WEBSITE. ONE BOOK.")
y -= 46
y = para(y, "WE ARE BUILDING TWO THINGS THAT WORK AS ONE.")
y = gap(y)
for h, b in [("A WEBSITE WORTHY OF THE ART",
              "BEAUTIFUL, MUSEUM-GRADE, AND BUILT TO SELL. PRINTS AND EDITIONS BOUGHT ON THE SPOT. IMPORTANT WORKS START A CONVERSATION."),
             ("ONE BOOK THAT RUNS THE GALLERY",
              "EVERY ARTWORK, EVERY COLLECTOR, EVERY DEAL, EVERY DOLLAR, WRITTEN DOWN IN ONE PLACE INSTEAD OF SCATTERED ACROSS EMAILS AND MEMORY."),
             ("A TEAM THAT NEVER DROPS A LEAD",
              "EVERY INQUIRY HAS AN OWNER, A CLOCK, AND A NEXT STEP. NOTHING SLIPS.")]:
    txt(M, y, h, "NSN-Med", 9, 1.4)
    y = quiet(y - 16, b)
    y -= 20
y = gap(y)
para(y, "AND THE HEART OF THE BUSINESS DOES NOT CHANGE. THE ARTISTS, THE TASTE, THE WAY YOU BUY AND SELL: UNTOUCHED.")
page_end(3)

# =========================================================
# 04 — NEVER MISS A COLLECTOR
# =========================================================
page_start(4, "SPEED")
y = H - 158
title(y, "NEVER MISS A COLLECTOR")
y -= 46
for h, b in [("A COLLECTOR PRESSES “INQUIRE” ON A PAINTING.", None),
             ("THE TEAM'S PHONES BUZZ THAT SECOND.",
              "NOT TOMORROW. NOT “WHEN SOMEONE CHECKS THE INBOX.” THAT SECOND."),
             ("WHOEVER PICKS IT UP SEES THE FULL PICTURE.",
              "WHO IS ASKING, WHICH WORK, WHAT THEY LOOKED AT, WHAT THEY HAVE BOUGHT BEFORE. ALL ON ONE CARD."),
             ("THE COLLECTOR HEARS BACK IN MINUTES.",
              "FROM A PERSON. WITH THE RIGHT ANSWER, AND A WAY TO PAY IF THEY ARE READY.")]:
    y = para(y, h, "NSN-Med", 9, 1.4)
    if b: y = quiet(y + 1, b)
    y -= 22
y = gap(y)
y = para(y, "ANSWER INSIDE FIVE MINUTES AND A BUYER IS 21 TIMES MORE LIKELY TO BECOME A REAL CONVERSATION.")
page_end(4)

# =========================================================
# 05 — MONEY, ON THE COLLECTOR'S TERMS
# =========================================================
page_start(5, "PAYMENT")
y = H - 158
title(y, "MONEY, ON THE COLLECTOR'S TERMS")
y -= 46
y = para(y, "WHEN A COLLECTOR IS READY, WE TAKE THE MONEY HOWEVER THEY WANT TO GIVE IT.")
y = gap(y)
for h, b in [("CARD", "FOR EDITIONS AND DEPOSITS"),
             ("BANK TRANSFER", "THE EASY MIDDLE, FIVE TO A HUNDRED FIFTY THOUSAND"),
             ("WIRE", "FOR LARGE WORKS, INSTRUCTIONS SENT AUTOMATICALLY"),
             ("PAYMENT PLANS", "SO MORE COLLECTORS CAN SAY YES"),
             ("A LINK BY TEXT", "SENT ON THE PHONE. THEY TAP, THEY PAY, DONE.")]:
    txt(M, y, h, "NSN-Med", 9, 1.4)
    y = quiet(y - 16, b)
    y -= 14
y = gap(y)
y = para(y, "THE HOLD", "NSN-Med", 9, 1.4)
y = para(y - 1, "A COLLECTOR WHO SAYS “LET ME THINK ABOUT IT” PUTS DOWN A SMALL REFUNDABLE DEPOSIT, AND THE WORK IS HELD FOR 72 HOURS. “A HOLD HAS BEEN PLACED ON THIS WORK” IS THE MOST HONEST URGENCY IN THE BUSINESS, AND IT TURNS MAYBES INTO SALES.")
page_end(5)

# =========================================================
# 06 — THE WHOLE GALLERY, IN ONE PLACE
# =========================================================
page_start(6, "THE BOOK")
y = H - 158
title(y, "THE WHOLE GALLERY, IN ONE PLACE")
y -= 46
y = para(y, "EVERY ARTWORK, WITH ITS IMAGES AND PROVENANCE. EVERY COLLECTOR AND EVERYTHING THEY EVER BOUGHT OR ASKED ABOUT. EVERY DEAL, EVERY PAYMENT, EVERY DOLLAR. ONE BOOK.")
y = gap(y)
y = para(y, "YOU CAN ASK IT QUESTIONS THE WAY YOU WOULD ASK A PERSON:")
y = gap(y)
y = para(y, "“WHO BOUGHT STREET ART UNDER FIFTY THOUSAND NEAR PALM BEACH IN THE LAST THREE YEARS?”", "NSN-Med", 9, 1.4)
y = quiet(y + 1, "TEN SECONDS LATER: YOUR NEXT INVITE LIST.")
y = gap(y)
y = para(y, "WHEN A NEW PIECE COMES IN, THE BOOK ALREADY KNOWS WHICH COLLECTORS WILL CARE, AND IT WRITES THE NOTE TO EACH OF THEM. A PERSON READS IT, APPROVES IT, AND ONLY THEN DOES IT SEND.")
y = gap(y)
y = para(y, "WHO SEES WHAT IS UP TO YOU. YOU SEE EVERYTHING. EACH PERSON ON THE TEAM SEES THEIR OWN DEALS AND THEIR OWN NUMBERS.")
y = gap(y)
para(y, "HISTORY GOES IN FIRST: PAST SALES, PAST INVOICES, PAST CLIENTS. THE BOOK IS ONLY AS SMART AS ITS MEMORY.")
page_end(6)

# =========================================================
# 07 — YOUR HISTORY, BACK ONLINE
# =========================================================
page_start(7, "LEGACY")
y = H - 158
title(y, "YOUR HISTORY, BACK ONLINE")
y -= 46
y = para(y, "WE FOUND THE OLD PAGES PRESERVED IN INTERNET ARCHIVES: ABOUT FIFTY SHOWS, FROM THE CHELSEA YEARS TO THE SOHO FLAGSHIP. WE ARE BRINGING EVERY ONE OF THEM BACK.")
y = gap(y)
y = quiet(y, "HAMBLETON. VALENCIA. TAUPIN. SCHARF. FEUERMAN. THE FAIRS, THE PRESS, THE STORY.")
y = gap(y, 2)
y = para(y, "PEOPLE DON'T JUST ASK GOOGLE ANYMORE. THEY ASK THEIR PHONE, AND THEIR PHONE ASKS AN AI.")
y = gap(y)
y = para(y, "“WHERE DO I BUY A KENNY SCHARF?”", "NSN-Med", 9, 1.4)
y = para(y, "THE ANSWER SHOULD BE CHASE CONTEMPORARY.", "NSN-Med", 9, 1.4)
y = gap(y)
para(y, "THE MORE OF YOUR HISTORY THAT LIVES ONLINE, THE MORE OFTEN THE GALLERY IS THE ANSWER. THE SHOWS. THE PRESS. YOUR EYE FOR ARTISTS LIKE ANDRES VALENCIA. YOUR PAST SELLS FOR YOU, AROUND THE CLOCK.")
page_end(7)

# =========================================================
# 08 — WHAT YOU SEE
# =========================================================
page_start(8, "VISIBILITY")
y = H - 158
title(y, "WHAT YOU SEE")
y -= 46
y = para(y, "ONE SCREEN, LIVE, ANY TIME YOU LOOK. NOT MONTH-END REPORTS, BUT ANSWERS TO THE QUESTIONS AN OWNER ACTUALLY ASKS.")
y = gap(y)
for h, b in [("WHO IS ASKING ABOUT WHAT", "EVERY OPEN CONVERSATION, AND WHO OWNS IT"),
             ("WHO ANSWERS FASTEST", "AND WHO CLOSES, AND WHO DISCOUNTS TOO MUCH"),
             ("WHAT IS MOVING", "BY ARTIST, BY SIZE, BY PRICE, AND WHAT IS STUCK"),
             ("WHERE THE MONEY IS", "PAID, OWED, AND ON THE WAY, TO THE DOLLAR")]:
    txt(M, y, h, "NSN-Med", 9, 1.4)
    y = quiet(y - 16, b)
    y -= 14
y = gap(y)
para(y, "WHEN EVERYONE CAN SEE THE BOARD, THE FLOOR MANAGES ITSELF. ONCE WE SEE WHAT YOUR BEST CLOSER DOES DIFFERENTLY, WE TEACH IT TO EVERYONE.")
page_end(8)

# =========================================================
# 09 — COMMISSIONS THAT SPLIT THEMSELVES
# =========================================================
page_start(9, "BACK OFFICE")
y = H - 158
title(y, "COMMISSIONS THAT SPLIT THEMSELVES")
y -= 46
y = para(y, "THE COMMISSION STRUCTURE IS AGREED ONCE, UP FRONT: WHO EARNS WHAT SHARE OF EVERY SALE. THAT AGREEMENT LIVES IN THE BOOK, AS A RULE.")
y = gap(y)
y = para(y, "THE MOMENT A PAYMENT LANDS, THE SPLIT HAPPENS ON ITS OWN. EACH PERSON'S SHARE IS DRIVEN STRAIGHT INTO THEIR POOL. INSTALLMENTS AND PARTIAL PAYMENTS TOO.")
y = gap(y)
y = para(y, "NOBODY CALCULATES. NOBODY RECONCILES. NOTHING WAITS FOR MONTH-END.", "NSN-Med", 9, 1.4)
y = gap(y)
y = quiet(y, "NO SPREADSHEET ARCHAEOLOGY. NO DISPUTES. NO “I THOUGHT WE AGREED...”")
y = gap(y)
para(y, "SALESPEOPLE WHO TRUST THEIR NUMBER TO THE PENNY PUSH HARDER. AND BECAUSE EVERY DISCOUNT IS ON THE RECORD, THE QUIET LEAK MOST GALLERIES NEVER SEE BECOMES MONEY YOU KEEP.")
page_end(9)

# =========================================================
# 10 — WHAT THIS IS NOT
# =========================================================
page_start(10, "THE RULES")
y = H - 158
title(y, "WHAT THIS IS NOT")
y -= 46
for h, b in [("NO CHATBOTS.", "NO ROBOT EVER SPEAKS TO A COLLECTOR. EVER."),
             ("NOTHING SENDS ITSELF.", "EVERY EMAIL THE SYSTEM PREPARES IS READ AND APPROVED BY A PERSON BEFORE IT GOES ANYWHERE."),
             ("NO MACHINE QUOTES A PRICE.", "PRICE-ON-REQUEST MEANS A PERSON PICKS UP THE PHONE."),
             ("YOUR LIST NEVER LEAVES.", "COLLECTOR NAMES AND NUMBERS STAY INSIDE THE GALLERY. THEY ARE THE CROWN JEWELS AND WE TREAT THEM THAT WAY.")]:
    y = para(y, h, "NSN-Med", 9, 1.4)
    y = quiet(y + 1, b)
    y -= 22
y = gap(y)
para(y, "THE MACHINERY DOES THE REMEMBERING, THE TIMING, AND THE PAPERWORK. PEOPLE DO THE SELLING.")
page_end(10)

# =========================================================
# 11 — ONE MONTH
# =========================================================
page_start(11, "TIMELINE")
y = H - 158
title(y, "ONE MONTH, START TO FINISH")
y -= 46
y = para(y, "WE BUILD WITH THE SAME AI THAT POWERS THE ENGINE. WORK THAT ONCE TOOK A YEAR NOW FITS IN FOUR WEEKS, AND THE FIRST WINS LAND IN DAYS.")
y = gap(y)
for weeks, name, b in [("WEEK 1", "STOP THE LEAK",
                        "EVERY INQUIRY GETS AN OWNER, A FAST ANSWER, AND A FOLLOW-UP. WE DIG THE PAST YEARS OF INQUIRIES OUT OF THE INBOX AND REVIVE EVERY ONE THAT WENT QUIET."),
                       ("WEEKS 2–3", "TAKE THE MONEY",
                        "CARD, BANK TRANSFER, WIRE, PLANS, HOLDS, PAYMENT LINKS. COLLECTORS COMMIT THE MOMENT THEY ARE READY, ON WHATEVER TERMS SUIT THE WORK."),
                       ("WEEK 4", "COMPOUND",
                        "THE NEW WEBSITE. THE HISTORY RESTORED. THE DASHBOARD. THE COMMISSIONS THAT SPLIT THEMSELVES. EVERY SALE MAKES THE NEXT ONE EASIER.")]:
    txt(M, y, weeks, "NSN", 7.5, 1.6, GRAY)
    txt(M + 78, y, name, "NSN-Med", 9, 1.4)
    y = quiet(y - 16, b, x=M + 78, maxw=MEAS - 78)
    y -= 18
y = gap(y)
para(y, "MEASURED BEFORE PROMISED: THE FIRST THING WE BUILD IS THE COUNTING, SO EVERY CLAIM GETS PROVEN WITH YOUR REAL NUMBERS.")
page_end(11)

# =========================================================
# 12 — ALL WE NEED IS THE KEYS
# =========================================================
page_start(12, "TO START")
y = H - 158
title(y, "ALL WE NEED IS THE KEYS")
y -= 46
y = para(y, "YOU HAVE ALREADY GIVEN US THE VISION AND THE STORIES. WHAT IS LEFT IS EXECUTION, AND EXECUTION STARTS THE DAY WE HAVE ACCESS.")
y = gap(y)
for h, b in [("THE KEYS", "THE WEBSITE, EMAIL, AND PAYMENT LOGINS. YOUR OFFICE MANAGER CAN HAND THEM OVER. WE TAKE IT FROM THERE, IMMEDIATELY."),
             ("A FEW FACTS", "ADDRESSES, THE TEAM, WHICH ARTISTS ARE CURRENT. TEN MINUTES WITH YOUR OFFICE MANAGER COVERS IT."),
             ("YOUR EYE", "YOU APPROVE EVERY DESIGN AND EVERY WORD BEFORE THE WORLD SEES IT.")]:
    txt(M, y, h, "NSN-Med", 9, 1.4)
    y = quiet(y - 16, b)
    y -= 20
y = gap(y, 2)
y = para(y, "COMPETITORS HAVE AN INBOX.")
para(y, "CHASE CONTEMPORARY WILL HAVE AN OPERATING SYSTEM.", "NSN-Med", 9, 1.4)
page_end(12)

c.save()
print("done")
