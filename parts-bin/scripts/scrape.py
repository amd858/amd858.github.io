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


def scrape_shopify_store(session, store_id, domain, parts):
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

        # Prefer a hit whose title actually contains the part number.
        key = re.sub(r"[^a-z0-9]", "", part.lower())
        best = next(
            (p for p in products if key in re.sub(r"[^a-z0-9]", "", p.get("title", "").lower())),
            products[0],
        )

        price = to_number(str(best.get("price", "")))
        if price is None:
            print(f"  - {store_id} / {part}: matched '{best.get('title')}' but no readable price")
            time.sleep(DELAY)
            continue

        url = best.get("url", "")
        if url and not url.startswith("http"):
            url = f"https://{domain}{url}"

        rows.append({
            "part": part,
            "store": store_id,
            "price": price,
            "currency": "PKR",
            "stock": "in" if best.get("available", True) else "out",
            "url": url,
            "date": time.strftime("%Y-%m-%d"),
            "matched_title": best.get("title", ""),
        })
        print(f"  + {store_id} / {part}: PKR {price}")
        time.sleep(DELAY)
    return rows


def main():
    comps = json.loads((ROOT / "data" / "components.json").read_text(encoding="utf-8"))
    parts = [c["part"] for c in comps][:MAX_PARTS]

    session = requests.Session()
    session.headers.update({"User-Agent": UA, "Accept-Language": "en"})

    all_rows = []

    for store_id, domain in SHOPIFY_STORES.items():
        print(f"\n{store_id} ({domain}, Shopify)")
        all_rows += scrape_shopify_store(session, store_id, domain, parts)

    if not RULES:
        print("\nRULES is empty — no WooCommerce-style shops configured.")
        print("Open scripts/scrape.py and fill one in if you want more coverage.")
    else:
        for name, rule in RULES.items():
            print(f"\n{name}")
            all_rows += scrape_store(session, name, rule, parts)

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


if __name__ == "__main__":
    raise SystemExit(main())
