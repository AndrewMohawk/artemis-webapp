# Artemis RF Reference

A responsive web implementation of the Artemis radio-signal identification workflow. It includes the complete SigID v74 catalog of 583 recognized signals, instant text and parameter filtering, spectrum and audio samples, saved references, local field notes, JSON import/export, and live AresValley Poseidon space-weather data.

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Build the Cloudflare-compatible production output with:

```bash
npm run build
```

## Data and attribution

The reference catalog and linked media come from [AresValley/Artemis-DB](https://github.com/AresValley/Artemis-DB), derived from the community-maintained [Signal Identification Wiki](https://www.sigidwiki.com/wiki/Signal_Identification_Guide). The original Artemis project is licensed under GPL-3.0; see [LICENSE](LICENSE).

This web implementation is independently structured for the browser and retains source links in the product interface.
