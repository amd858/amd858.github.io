#!/usr/bin/env python3
"""
Optional price updater for Parts Bin.

This is a SKELETON, not a finished scraper. Every shop lays its pages out
differently, so you have to tell it where the price sits on each site by
filling in the RULES table below.

Before you point this at any shop:
  - Read that shop's terms of service and its /robots.txt.
  - Keep DELAY at a couple of seconds. One request every two seconds is a
    visitor; fifty a second is a problem for a small shop's server.
  - Scrape only what you need, and only shops that allow it.
  - If a shop offers an API or a price feed, use that instead.

Run locally:
    pip install requests beautifulsoup4
    python scripts/scrape.py

It writes data/prices.json, which index.html picks up on load.
"""

import json
import pathlib
import re
import sys
import time

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    sys.exit("Install dependencies first:  pip install requests beautifulsoup4")

ROOT = pathlib.Path(__file__).resolve().parent.parent
DELAY = 2.0          # seconds between requests — be polite
TIMEOUT = 20
MAX_PARTS = 40       # keep runs short; raise once you trust it

UA = ("Mozilla/5.0 (compatible; PartsBinBot/1.0; "
      "personal price tracker; contact: you@example.com)")

# ---------------------------------------------------------------------------
# RULES — one entry per shop you want to read automatically.
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
    # "Digilog.pk": {
    #     "search": "https://digilog.pk/?s={q}&post_type=product",
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
    m = PRICE_RE.search(text.replace("\u00a0", " "))
    if not m:
        return None
    try:
        return float(m.group(0).replace(",", ""))
    except ValueError:
        return None


def best_match(cards, part, rule):
    """Prefer a card whose title actually contains the part number."""
    key = re.sub(r"[^a-z0-9]", "", part.lower())
    fallback = None
    for card in cards:
        t = card.select_one(rule["title"])
        title = t.get_text(" ", strip=True) if t else ""
        if fallback is None:
            fallback = (card, title)
        if key and key in re.sub(r"[^a-z0-9]", "", title.lower()):
            return card, title
    return fallback if fallback else (None, "")


def scrape_store(session, store_name, rule, parts):
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

        card, title = best_match(cards, part, rule)
        pnode = card.select_one(rule["price"]) if card else None
        price = to_number(pnode.get_text(" ", strip=True) if pnode else "")
        if price is None:
            print(f"  - {store_name} / {part}: found a card but no price (check the 'price' selector)")
            time.sleep(DELAY)
            continue

        link = ""
        lnode = card.select_one(rule.get("link", "a"))
        if lnode and lnode.get("href"):
            link = lnode["href"]

        rows.append({
            "part": part,
            "store": store_name,
            "price": price,
            "currency": rule["currency"],
            "stock": "unk",
            "url": link,
            "date": time.strftime("%Y-%m-%d"),
            "matched_title": title,
        })
        print(f"  + {store_name} / {part}: {rule['currency']} {price}")
        time.sleep(DELAY)
    return rows


def main():
    if not RULES:
        print("RULES is empty — nothing to do.")
        print("Open scripts/scrape.py and fill in a shop before running this.")
        return 0

    comps = json.loads((ROOT / "data" / "components.json").read_text(encoding="utf-8"))
    parts = [c["part"] for c in comps][:MAX_PARTS]

    session = requests.Session()
    session.headers.update({"User-Agent": UA, "Accept-Language": "en"})

    all_rows = []
    for name, rule in RULES.items():
        print(f"\n{name}")
        all_rows += scrape_store(session, name, rule, parts)

    out = ROOT / "data" / "prices.json"
    out.write_text(json.dumps(all_rows, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"\nWrote {len(all_rows)} price(s) to {out.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
