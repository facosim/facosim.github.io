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
| `404.html`, `robots.txt`, `sitemap.xml`, `attribution.html` | Error page, crawler files and credits |

## Working on it

Serve the folder with any static server and open it in a browser:

```
python3 -m http.server 8000
```

Work happens on the `staging` branch. `master` is the live site: the workflow in `.github/workflows/static.yml` publishes it to GitHub Pages on every push to `master`, so merge `staging` into `master` when a change is ready.

## Offline tools

Flight Instruments, Briefing Lines and the Flight Calculator work without a connection after one visit. `sw.js` is a service worker that keeps their files, and `manifest.webmanifest` lets them be installed as an app.

When a file the tools load is added, renamed or removed, update the `FILES` list at the top of `sw.js` and raise its `VERSION`. `node tools/check-offline.mjs` checks that every file the three pages reference is in that list.

## Flight data

`tools/build-navdata.mjs` takes the two gzipped FAA files from the `@squawk` data packages (navaids and airports) and rewrites the compact `brief/inst/navdata.js`:

```
node tools/build-navdata.mjs navaids.json.gz airports.json.gz
```

The data is for training only and has no terrain. Credits for the data, Phaser and the fonts are on [attribution.html](attribution.html).

## Copyright

Site content and tools are (c) 2026 FACO Simulations, LLC. Third-party components keep their own licenses, listed on the credits page.
