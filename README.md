# Nuvio TopCinema

TopCinema provider for Nuvio.

## Install after publishing

Add this manifest URL to Nuvio's plugin repository settings:

`https://raw.githubusercontent.com/iiwaz/nuvio-topcinema/gh-pages/manifest.json`

Then refresh repositories and enable **TopCinema**.

## How it works

- Uses the TMDB ID passed by Nuvio to look up the title and year.
- Searches TopCinema by title and checks candidate title/year.
- For TV, tries to locate the requested season and episode.
- Reads the player iframe and looks for publicly exposed HLS/MP4 URLs.
- If an HLS master playlist is exposed, sorts its variants by bandwidth.

The provider expects the Nuvio runtime to expose `TMDB_API_KEY`. No key is stored in this repository.

## Build locally

Requires Node.js 20 or newer.

```bash
npm install
npm run build
```

Build output is written to `dist/`. GitHub Actions also builds and publishes `dist/` to the `gh-pages` branch after a push to `main`.

## Important limitations

- This code has not yet been tested in the Nuvio app runtime.
- TopCinema's domain, markup, and player implementation can change.
- Some video hosts generate signed URLs dynamically or only expose them during playback. In those cases this provider may return no stream.
- It does not bypass DRM, authentication, paywalls, or other access restrictions.
