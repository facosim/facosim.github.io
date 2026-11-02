# FACO website

The static site for FACO Simulations: pilot training tools, simulator hardware and software pages, and learning resources. It is plain HTML, CSS and JavaScript with no build step, served by GitHub Pages at https://facosim.com.

## Layout

| Path | What it is |
| --- | --- |
| `index.html`, `about.html`, `links.html`, `contact.html` | Main pages |
| `software/`, `hardware/`, `learning/` | Section pages (`learning/od.html` is Of The Day) |
| `brief/instruments.html`, `brief/inst/` | Flight Instruments: a map, autopilot and instrument panels (six-pack, glass, T-6A, head-up display) for a Cessna 172, T-6A, F-16 or Boeing 737 |
| `brief/lines.html`, `brief/src/` | Briefing Lines: frame-by-frame flight debriefs with a radar B-scope |
| `brief/e6b.html`, `brief/e6b/` | Flight Calculator (E6B). `node brief/e6b/test.js` runs its checks |
| `brief/phaser.min.js` | Phaser 4, used by the first two tools (MIT, see `attribution.html`) |
| `css/`, `js/`, `fonts/`, `img/` | Shared styles, scripts, fonts and images |
| `tools/build-navdata.mjs` | Rebuilds `brief/inst/navdata.js` from FAA NASR data |
| `sw.js`, `manifest.webmanifest` | Offline support for the three tools (below) |
| `404.html`, `attribution.html` | Error page and credits |
| `robots.txt`, `sitemap.xml`, `llms.txt`, `llms-full.txt` | What crawlers and AI assistants read (below) |
| `tools/check-seo.mjs`, `tools/check-offline.mjs` | Checks for the search and offline setup |

## Working on it

Serve the folder with any static server and open it in a browser:

```
python3 -m http.server 8000
```

Work happens on the `staging` branch. `master` is the live site: the workflow in `.github/workflows/static.yml` publishes it to GitHub Pages on every push to `master`, so merge `staging` into `master` when a change is ready.

## Offline tools

Flight Instruments, Briefing Lines and the Flight Calculator work without a connection after one visit. `sw.js` is a service worker that keeps their files, and `manifest.webmanifest` lets them be installed as an app.

When a file the tools load is added, renamed or removed, update the `FILES` list at the top of `sw.js` and raise its `VERSION`. `node tools/check-offline.mjs` checks that every file the three pages reference is in that list.

## Search and AI crawlers

Every page carries what search engines and AI assistants read without running any script: one `<h1>`, a unique `<title>` and meta description, an absolute canonical URL that matches its `sitemap.xml` entry, Open Graph and Twitter tags, and a JSON-LD graph (Organization and WebSite everywhere, plus a page type, a breadcrumb trail and, where it fits, an item list, `SoftwareApplication` or `WebApplication`). The three tools also have a `<noscript>` notice saying what they do.

When a page is added, copy the head of a sibling page, change its fields, add the page to `sitemap.xml` and run:

```
node tools/check-seo.mjs
```

It fails when a page lacks an h1, repeats a title or description, has a canonical that is not in the sitemap, or has JSON-LD that does not parse or refers to something it does not define, and when `robots.txt`, `llms.txt` or `llms-full.txt` point at files that do not exist. Pages that carry `noindex` (`404.html`, `projects.html`) are skipped and must stay out of the sitemap.

`llms.txt` is a short Markdown guide to the site for AI assistants and `llms-full.txt` is the same with the details. Both are written by hand, so update them when a product or tool changes.

`robots.txt` allows every crawler and names the common AI ones so that the policy is explicit. To keep a crawler out, give it its own group:

```
User-agent: GPTBot
Disallow: /
```

The crawlers that collect content for model training are GPTBot, Google-Extended, ClaudeBot, CCBot, Applebot-Extended, Meta-ExternalAgent and Amazonbot. OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User, PerplexityBot, Perplexity-User, DuckAssistBot and MistralAI-User fetch pages to answer a search or a question, so blocking them also removes the site from those answers.

## Flight data

`tools/build-navdata.mjs` takes the two gzipped FAA files from the `@squawk` data packages (navaids and airports) and rewrites the compact `brief/inst/navdata.js`:

```
node tools/build-navdata.mjs navaids.json.gz airports.json.gz
```

The data is for training only and has no terrain. Credits for the data, Phaser and the fonts are on [attribution.html](attribution.html).

## Copyright

Site content and tools are (c) 2026 FACO Simulations, LLC. Third-party components keep their own licenses, listed on the credits page.
