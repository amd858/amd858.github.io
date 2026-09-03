#!/usr/bin/env python3
"""
Optional price updater for Parts Bin.

Two strategies live here, because Pakistani electronics stores split
roughly into two platforms:

  SHOPIFY_STORES  - stores running Shopify (confirmed so far: Digilog.pk,
                    via its sitemap_products_N.xml naming). These expose a
                    public JSON search endpoint, so no HTML parsing is
                    needed at all - just call the endpoint and read price
                    and availability straight out of the response.

  RULES           - stores running WooCommerce or something else, scraped
                    by CSS selector against their search-results HTML.
                    This is a SKELETON - every shop lays its markup out
                    differently, so you fill in a selector set per shop
                    after inspecting its page. Empty by default.

Before you point this at any shop:
  - Read that shop's terms of service and its /robots.txt.
  - Keep DELAY at a couple of seconds. One request every two seconds is a
    visitor; fifty a second is a problem for a small shop's server.
  - Scrape only what you need, and only shops that allow it.
  - If a shop offers an API or a price feed, use that instead.

Run locally:
    pip install requests beautifulsoup4
    python scripts/scrape.py

It writes data/prices.json, which index.html picks up on load. Existing
entries for parts/stores not touched by this run are left as-is.
"""

import json
import pathlib
import re
import sys
import time

# Only the network side needs these. The matcher is pure Python, so --selftest
# still runs on a bare interpreter.
try:
    import requests
    from bs4 import BeautifulSoup
    HAVE_DEPS = True
except ImportError:
    HAVE_DEPS = False

ROOT = pathlib.Path(__file__).resolve().parent.parent
DELAY = 2.0          # seconds between requests — be polite
TIMEOUT = 20
MAX_PARTS = 40       # keep runs short; raise once you trust it

UA = ("Mozilla/5.0 (compatible; PartsBinBot/1.0; "
      "personal price tracker; contact: you@example.com)")

# ---------------------------------------------------------------------------
# SHOPIFY_STORES — store id (must match the id in data/stores.json) -> domain.
# Uses Shopify's public predictive-search JSON endpoint:
#   https://{domain}/search/suggest.json?q={term}&resources[type]=product
# No selectors to maintain; this only breaks if the shop disables the
# endpoint or migrates off Shopify.
# ---------------------------------------------------------------------------
SHOPIFY_STORES = {
    # Each confirmed via DNS: the domain CNAMEs to *.myshopify.com and/or
    # resolves into Shopify's 23.227.38.0/24 range.
    "digilog": "digilog.pk",
    "chippk": "chip.pk",
    "hallroadlahore": "hallroadlahore.pk",
    "electronicsoln": "electronicsolution.pk",
    "modernelec": "modernelectronics.pk",
    "smarteshop": "smarteshop.pk",
}

# ---------------------------------------------------------------------------
# RULES — one entry per WooCommerce-style shop you want to read automatically.
#
#   search   : the shop's search URL, with {q} where the term goes
#   currency : what that shop quotes in
#   item     : CSS selector for a single result card on the results page
#   title    : CSS selector for the product title, inside the card
#   price    : CSS selector for the price, inside the card
#   link     : CSS selector for the product link, inside the card
#
# The selectors below are guesses for common WooCommerce themes. Open the
# shop's search page, right-click a price, choose Inspect, and correct them.
# Leave a shop out of this dict and it simply is not scraped.
# ---------------------------------------------------------------------------
RULES = {
    # "Circuit.pk": {
    #     "search": "https://circuit.pk/?s={q}&post_type=product",
    #     "currency": "PKR",
    #     "item": "li.product",
    #     "title": "h2.woocommerce-loop-product__title",
    #     "price": "span.woocommerce-Price-amount",
    #     "link": "a.woocommerce-LoopProduct-link",
    # },
}

PRICE_RE = re.compile(r"[\d][\d,\.]*")


def to_number(text):
    """Pull the first number out of something like 'Rs 1,450.00 – Rs 1,600.00'."""
    if not text:
        return None
    m = PRICE_RE.search(text.replace(" ", " "))
    if not m:
        return None
    try:
        return float(m.group(0).replace(",", ""))
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Product matching.
#
# The hard part of this whole script. The same board is named differently at
# every shop: Digilog lists "arduino-uno", Hall Road lists
# "arduino-uno-smd-price-in-pakistan". Matching on the exact catalogue string
# misses that, and matching loosely picks up cables and cases instead.
#
# So: score the store's title against the part name by weighted token overlap,
# veto accessories outright, and then — the important bit — only accept the
# title if no OTHER part in the catalogue explains it better. That last rule is
# what stops "Arduino Mega 2560 R3" being filed under "Arduino UNO R3", and
# "RGB LED 5mm" under "LED 5mm".
#
# Run `python scripts/scrape.py --selftest` to exercise this with no network.
# ---------------------------------------------------------------------------

# Not the part at all — a thing that goes *around* the part. Reject outright.
# "cable" lives here because "Arduino Uno Cable USB" is a cable, not a board.
ACCESSORY_WORDS = {
    "cable", "case", "holder", "shield", "kit", "bracket", "mount", "cover",
    "adapter", "stand", "enclosure", "box", "sticker", "book", "screw",
    "spacer", "sleeve", "bag",
}

# Same part, different bundle or quantity — and a different price because of it.
# These are NOT rejected: an Arduino Nano sold *with* a USB cable is still a
# Nano, it just costs more. They are accepted and tagged, so a 910 sitting next
# to a 660 reads as "with cable" instead of as an unexplained gap.
#
# Third field = accessory words this phrasing excuses. That is what separates
# "Nano with cable" (a bundled board) from "Uno Cable USB" (just a cable).
VARIANT_PATTERNS = [
    (re.compile(r"\bwith\s+(usb\s+)?cable\b|\bincluding\s+cable\b|\bcable\s+included\b"),
     "with cable", frozenset({"cable"})),
    (re.compile(r"\bwith\s+(uln2003|driver)\b"), "with driver", frozenset()),
    (re.compile(r"\bpre[\s-]?soldered\b|\bheaders?\s+soldered\b|\bsoldered\b"),
     "soldered", frozenset()),
    (re.compile(r"\bunsoldered\b|\bwithout\s+header"), "unsoldered", frozenset()),
    (re.compile(r"\bpack\s+of\s+(\d+)\b|\b(\d+)\s*pcs\b|\b(\d+)\s*pieces\b"),
     "multi-pack", frozenset()),
    (re.compile(r"\bsmd\b"), "SMD", frozenset()),
    (re.compile(r"\bdip\b"), "DIP", frozenset()),
    (re.compile(r"\bclone\b"), "clone", frozenset()),
]


def _variant_hits(title):
    low = title.lower()
    return [(label, excuses) for rx, label, excuses in VARIANT_PATTERNS if rx.search(low)]


def detect_variant(title):
    """Return a short label if the title advertises a priced-differently variant."""
    labels = [label for label, _ in _variant_hits(title)]
    return ", ".join(dict.fromkeys(labels)) if labels else ""


def _excused(title):
    """Accessory words that this title's phrasing legitimately explains."""
    out = set()
    for _, excuses in _variant_hits(title):
        out |= excuses
    return out


# words shops sprinkle on every listing; they carry no identity
GENERIC = {
    "price", "in", "pakistan", "buy", "online", "for", "with", "the", "best",
    "new", "original", "pcs", "pack", "of", "and", "module", "board", "sensor",
    "development", "arduino", "compatible", "quality", "high", "low", "free",
    "delivery", "shop", "store", "inch", "type",
}
# revision markers: shops drop these freely, so their absence proves nothing
REVISION = {"r1", "r2", "r3", "v1", "v2", "v3", "rev"}

MATCH_THRESHOLD = 0.55


def toks(s):
    return [t for t in re.split(r"[^a-z0-9]+", s.lower()) if t]


def _weight(tok):
    if tok in REVISION:
        return 0.2
    return 2.0 if any(ch.isdigit() for ch in tok) else 1.0


def raw_score(part, title):
    """0..1 — how well a store's product title matches one catalogue part."""
    p = toks(part)
    if not p:
        return 0.0
    tset = set(toks(title))
    # An accessory word the part name never mentions means it's a different
    # item — unless the phrasing excuses it ("Nano *with* cable" is still a Nano).
    if (ACCESSORY_WORDS & tset) - set(p) - _excused(title):
        return 0.0
    total = sum(_weight(x) for x in p)
    hit = sum(_weight(x) for x in p if x in tset)
    s = (hit / total) if total else 0.0
    # extra model-ish tokens suggest a different variant (2560, N16R8, 1.3)
    extra = [x for x in tset - set(p) - GENERIC - REVISION if any(c.isdigit() for c in x)]
    return max(0.0, s - 0.15 * len(extra))


def match(part, title, catalogue):
    """(accepted, score, reason) — accepted only if `part` is the catalogue's
    own best explanation of this title."""
    s = raw_score(part, title)
    if s < MATCH_THRESHOLD:
        return False, s, "below threshold"
    best_p, best_s = part, s
    for other in catalogue:
        if other == part:
            continue
        o = raw_score(other, title)
        if o > best_s or (abs(o - best_s) < 1e-9 and len(toks(other)) > len(toks(best_p))):
            best_p, best_s = other, o
    if best_p != part:
        return False, s, f"'{best_p}' fits better"
    return True, s, ""


def pick_best(part, candidates, catalogue):
    """candidates: [(title, payload)] -> (payload, title, score) or (None, '', best_score).

    Never guesses. If nothing clears the bar, returns None so the caller skips
    the part rather than recording a price for the wrong product.
    """
    ranked = []
    for title, payload in candidates:
        ok, s, why = match(part, title, catalogue)
        ranked.append((ok, s, -len(toks(title)), title, payload, why))
    ranked.sort(key=lambda r: (r[0], r[1], r[2]), reverse=True)
    if not ranked:
        return None, "", 0.0, "no results"
    ok, s, _, title, payload, why = ranked[0]
    if not ok:
        return None, title, s, why
    return payload, title, s, ""


def scrape_store(session, store_name, rule, parts, catalogue):
    rows = []
    for part in parts:
        url = rule["search"].format(q=requests.utils.quote(part))
        try:
            r = session.get(url, timeout=TIMEOUT)
            r.raise_for_status()
        except Exception as e:
            print(f"  ! {store_name} / {part}: {e}")
            time.sleep(DELAY)
            continue

        soup = BeautifulSoup(r.text, "html.parser")
        cards = soup.select(rule["item"])
        if not cards:
            print(f"  - {store_name} / {part}: no results (or the 'item' selector is wrong)")
            time.sleep(DELAY)
            continue

        candidates = []
        for c in cards:
            t = c.select_one(rule["title"])
            candidates.append((t.get_text(" ", strip=True) if t else "", c))

        card, title, sc, why = pick_best(part, candidates, catalogue)
        if card is None:
            print(f"  - {store_name} / {part}: no confident match ({why}; best {sc:.2f})")
            time.sleep(DELAY)
            continue

        pnode = card.select_one(rule["price"])
        price = to_number(pnode.get_text(" ", strip=True) if pnode else "")
        if price is None:
            print(f"  - {store_name} / {part}: matched '{title}' but no price (check the 'price' selector)")
            time.sleep(DELAY)
            continue

        link = ""
        lnode = card.select_one(rule.get("link", "a"))
        if lnode and lnode.get("href"):
            link = lnode["href"]

        variant = detect_variant(title)
        rows.append({
            "part": part,
            "store": store_name,
            "price": price,
            "currency": rule["currency"],
            "stock": "unk",
            "url": link,
            "date": time.strftime("%Y-%m-%d"),
            "variant": variant,
            "matched_title": title,
        })
        print(f"  + {store_name} / {part}: {rule['currency']} {price}"
              f"{' [' + variant + ']' if variant else ''}  ({sc:.2f}) {title[:44]}")
        time.sleep(DELAY)
    return rows


def scrape_shopify_store(session, store_id, domain, parts, catalogue):
    """Query Shopify's predictive-search JSON endpoint — no HTML parsing needed."""
    rows = []
    base = f"https://{domain}/search/suggest.json"
    for part in parts:
        try:
            r = session.get(
                base,
                params={"q": part, "resources[type]": "product", "resources[limit]": 3},
                timeout=TIMEOUT,
            )
            r.raise_for_status()
            data = r.json()
        except Exception as e:
            print(f"  ! {store_id} / {part}: {e}")
            time.sleep(DELAY)
            continue

        products = (data.get("resources", {}).get("results", {}) or {}).get("products", [])
        if not products:
            print(f"  - {store_id} / {part}: no results")
            time.sleep(DELAY)
            continue

        best, title, sc, why = pick_best(
            part, [(p.get("title", ""), p) for p in products], catalogue
        )
        if best is None:
            print(f"  - {store_id} / {part}: no confident match ({why}; best {sc:.2f})"
                  f"{' — closest: ' + title[:40] if title else ''}")
            time.sleep(DELAY)
            continue

        price = to_number(str(best.get("price", "")))
        if price is None:
            print(f"  - {store_id} / {part}: matched '{title}' but no readable price")
            time.sleep(DELAY)
            continue

        url = best.get("url", "")
        if url and not url.startswith("http"):
            url = f"https://{domain}{url}"

        variant = detect_variant(title)
        rows.append({
            "part": part,
            "store": store_id,
            "price": price,
            "currency": "PKR",
            "stock": "in" if best.get("available", True) else "out",
            "url": url,
            "date": time.strftime("%Y-%m-%d"),
            "variant": variant,
            "matched_title": title,
        })
        print(f"  + {store_id} / {part}: PKR {price}"
              f"{' [' + variant + ']' if variant else ''}  ({sc:.2f}) {title[:44]}")
        time.sleep(DELAY)
    return rows


def main():
    if not HAVE_DEPS:
        sys.exit("Install dependencies first:  pip install requests beautifulsoup4")
    comps = json.loads((ROOT / "data" / "components.json").read_text(encoding="utf-8"))
    catalogue = [c["part"] for c in comps]   # full list, for disambiguation
    parts = catalogue[:MAX_PARTS]            # subset actually queried

    session = requests.Session()
    session.headers.update({"User-Agent": UA, "Accept-Language": "en"})

    all_rows = []

    for store_id, domain in SHOPIFY_STORES.items():
        print(f"\n{store_id} ({domain}, Shopify)")
        all_rows += scrape_shopify_store(session, store_id, domain, parts, catalogue)

    if not RULES:
        print("\nRULES is empty — no WooCommerce-style shops configured.")
        print("Open scripts/scrape.py and fill one in if you want more coverage.")
    else:
        for name, rule in RULES.items():
            print(f"\n{name}")
            all_rows += scrape_store(session, name, rule, parts, catalogue)

    if not all_rows:
        print("\nNothing scraped — leaving data/prices.json untouched.")
        return 0

    out = ROOT / "data" / "prices.json"
    existing = []
    if out.exists():
        try:
            existing = json.loads(out.read_text(encoding="utf-8"))
        except Exception:
            existing = []

    # Merge: replace any existing (part, store) row with the fresh one,
    # keep everything else (e.g. rows for stores this run didn't touch).
    touched = {(r["part"], r["store"]) for r in all_rows}
    kept = [r for r in existing if (r.get("part"), r.get("store")) not in touched]
    merged = kept + all_rows

    out.write_text(json.dumps(merged, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"\nWrote {len(merged)} price(s) ({len(all_rows)} fresh, {len(kept)} kept) to {out.relative_to(ROOT)}")
    return 0


# ---------------------------------------------------------------------------
# Self-test — exercises the matcher against real store titles, no network.
# Every case here came from an actual listing seen in the wild.
#     python scripts/scrape.py --selftest
# ---------------------------------------------------------------------------
SELFTEST_CASES = [
    # (part, store title, should_match, expected variant)
    ("Arduino UNO R3", "Arduino Uno R3 Development Board", True, ""),
    ("Arduino UNO R3", "Arduino Uno SMD Price in Pakistan", True, "SMD"),
    ("Arduino UNO R3", "Arduino Uno Cable USB", False, ""),
    ("Arduino UNO R3", "Arduino Uno R3 Case Acrylic", False, ""),
    ("Arduino UNO R3", "Arduino Uno Starter Kit 37 in 1", False, ""),
    ("Arduino UNO R3", "Arduino Mega 2560 R3", False, ""),
    ("Arduino Nano", "Arduino Nano V3 - Breadboard Friendly Board", True, ""),
    ("Arduino Nano", "Arduino Nano V3 With Cable ATMEGA328", True, "with cable"),
    ("HC-SR04", "SR04 Arduino Ultrasonic Sensor HC-SR04", True, ""),
    ("HC-SR04", "Ultrasonic Distance Sensor Module", False, ""),
    ("SSD1306 0.96\"", "Arduino 0.96 inch IIC OLED Display 128X64 I2C SSD1306 LCD Screen", True, ""),
    ("SSD1306 0.96\"", "SSD1306 1.3 inch OLED Display", False, ""),
    ("NE555", "555 Timer IC NE555 LM555 Timer IC in Pakistan", True, ""),
    ("L298N", "Motor Driver Module L298N Arduino Dual Bridge", True, ""),
    ("ESP32 DevKit V1", "ESP32-S3 DevKitC-1 N16R8 Development Board", False, ""),
    ("Resistor kit 1/4W", "Resistor Kit 1/4W 600pcs Assorted", True, "multi-pack"),
    ("LED 5mm", "RGB LED 5mm Common Cathode", False, ""),
    ("LED 5mm", "LED 5mm Red Diffused (10 pcs)", True, "multi-pack"),
    # the catalogue entry for this one is itself "stepper with ULN2003 board",
    # so tagging the bundle is correct, not noise
    ("28BYJ-48", "28BYJ-48 5V Stepper Motor with ULN2003 Driver", True, "with driver"),
    ("DHT11", "DHT22 Temperature Humidity Sensor", False, ""),
    ("HC-05", "HC-06 Bluetooth Slave Module", False, ""),
]


def selftest():
    comps = json.loads((ROOT / "data" / "components.json").read_text(encoding="utf-8"))
    catalogue = [c["part"] for c in comps]
    print(f"{'':5}{'part':20} {'want':6} {'got':6} {'score':6} {'variant':16} note")
    print("-" * 104)
    failures = 0
    for part, title, want, want_variant in SELFTEST_CASES:
        got, sc, why = match(part, title, catalogue)
        variant = detect_variant(title) if got else ""
        bad = (got != want) or (got and variant != want_variant)
        failures += bad
        print(f"{'FAIL ' if bad else 'ok   '}{part:20} {str(want):6} {str(got):6} "
              f"{sc:<6.2f} {variant or '-':16} {why or title[:34]}")
    print(f"\n{len(SELFTEST_CASES) - failures}/{len(SELFTEST_CASES)} passed")
    return 1 if failures else 0


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        raise SystemExit(selftest())
    raise SystemExit(main())
