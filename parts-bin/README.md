# Parts Bin

A search engine for electronic components. Type a part number, see what each store charges, spot the cheapest one, and jump straight to the shop's own listing.

Runs entirely in the browser. No server, no build step, no npm install. Just open `index.html`.

---

## What it does

- **144 components** already in the catalogue — ESP32, Arduino boards, sensors, drivers, ICs, passives, prototyping bits.
- **Live store search.** Type a part and get one-click links into 12 shops (Pakistan, India, China, US). This is where today's real prices come from.
- **Saved prices.** Record what you found, per store, with the date you checked. The cheapest gets highlighted.
- **Cross-currency comparison.** PKR, INR, USD and more, converted so "cheapest" actually means cheapest.
- **Your own stores.** Add the shop down the road with its own search URL.
- **CSV in and out.** Bulk-edit prices in Excel or Google Sheets, load them back.
- **Optional shared database** so your phone and laptop see the same data.

---

## Try it locally

Double-click `index.html`. That's it. Everything works from `file://` except the shared database and `data/prices.json` loading, which need a real URL.

To run a local server instead:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

---

## Hosting

This copy lives inside the `amd858.github.io` portfolio repo, under `parts-bin/`,
rather than as its own repository — the app doesn't care either way, since every
path in it is relative. It's served at:

```
https://amd858.github.io/parts-bin/
```

The repo root already carries `.nojekyll`, so GitHub Pages serves this folder
(including `data/`) as plain static files with no Jekyll processing. The
`update-partsbin-prices.yml` workflow at the repo root runs the scraper below
and writes back to `parts-bin/data/prices.json` — it does nothing until the
`RULES` table in `scripts/scrape.py` is filled in.

To run a standalone copy elsewhere instead, drop the contents of this folder
(`index.html`, `app.js`, `data/`, `.nojekyll`) at the root of any static host —
nothing needs rewriting for a domain root or a subpath.

---

## Free shared database (optional)

By default your data lives in one browser. Clear your browsing data and it's gone. If you want your phone and laptop to share a catalogue — or you want a friend to add prices too — connect [Supabase](https://supabase.com). The free tier is plenty for this.

### 1. Create the project

Sign up, create a new project, pick any region near you. Wait for it to finish setting up.

### 2. Create the tables

Open **SQL Editor**, paste this, click Run:

```sql
create table stores (
  id text primary key,
  name text not null,
  country text,
  currency text default 'PKR',
  search_url text,
  enabled boolean default true
);

create table components (
  id text primary key,
  part_no text not null,
  name text,
  category text,
  package text,
  tags text,
  notes text
);

create table prices (
  id text primary key,
  component_id text references components(id) on delete cascade,
  store_id text,
  price numeric,
  currency text default 'PKR',
  stock text default 'unk',
  url text,
  checked_on date default current_date
);

alter table stores     enable row level security;
alter table components enable row level security;
alter table prices     enable row level security;

-- Anyone with your site link can read AND write. Fine for a shared parts list.
-- If you only want yourself writing, drop the "write" policies and use Supabase Auth.
create policy "read"  on stores     for select using (true);
create policy "write" on stores     for all    using (true) with check (true);
create policy "read"  on components for select using (true);
create policy "write" on components for all    using (true) with check (true);
create policy "read"  on prices     for select using (true);
create policy "write" on prices     for all    using (true) with check (true);
```

### 3. Connect the app

In Supabase: **Settings → API**. Copy the **Project URL** and the **anon public** key.

In Parts Bin: **Manage data → Shared database**. Paste both, hit **Save connection**, then **Upload my data**.

On your other device, open the same site, paste the same two values, and hit **Download shared data**.

**Know what you're agreeing to:** the anon key is designed to be public, but with the write policies above, anyone who opens your site can edit the tables. That's fine for a parts price list. Don't put anything private in there.

---

## Automatic price updates (optional, advanced)

GitHub Pages can't scrape shops by itself — it only serves files. But GitHub Actions can run a script on a schedule, write the results into your repo, and Pages will then serve them.

`scripts/scrape.py` is a starting point, deliberately left empty. Every shop's HTML is different, so you have to tell it where the price sits:

1. Open a shop's search results page in your browser.
2. Right-click a price → **Inspect**.
3. Note the CSS class of the price, the product title, and the card that wraps them.
4. Fill in an entry in the `RULES` dictionary in `scrape.py`.
5. Test it locally: `pip install requests beautifulsoup4 && python scripts/scrape.py`
6. Once it works, uncomment the `schedule:` block in `../.github/workflows/update-partsbin-prices.yml` (repo root, not this folder).

The app reads `data/prices.json` on load and merges anything it finds.

**Before you point it at a shop:** read that shop's terms of service and its `/robots.txt`. Keep the delay between requests at a couple of seconds. Most of these are small businesses; hammering their server is a real cost to them. If a shop publishes an API or a price feed, use that instead.

---

## Keyboard shortcuts

| Key | Does |
|---|---|
| `/` | Jump to the search box |
| `Esc` | Close whatever dialog is open |

---

## Files

```
parts-bin/
  index.html      the whole interface
  app.js          catalogue, search, price logic
  data/
    components.json   catalogue as plain JSON, for the scraper
    stores.json       default store list
    prices.json       written by the scraper, empty to start
  scripts/scrape.py             optional price updater
.github/workflows/update-partsbin-prices.yml   optional scheduled run (repo root)
.nojekyll       stops GitHub from mangling the folder structure (repo root)
```

---

## A note on the store links

The 12 default store URLs are best-effort guesses at each shop's search address. Sites redesign and links break. If one lands on the wrong page:

**Manage data → Stores → Edit.** Copy a real search URL from the shop, replace the search term with `{q}`, save. Ten seconds.

Same way you add any shop that isn't listed.

---

## A note on prices

The app ships with six made-up sample prices so the first screen isn't blank. They're labelled `sample` and there's a **Clear sample prices** button on the banner. Clear them before you trust anything.

Saved prices are a record of what you saw on the day you saw it, nothing more. Prices move, stock runs out, and the shop's page is always right where this app is wrong. Use the live store links before you actually order.
