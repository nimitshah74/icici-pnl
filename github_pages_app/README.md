# GitHub Pages App

This folder contains the browser-side MVP scaffold for hosting the ICICI Trade P&L utility on GitHub Pages.

Current slice includes:
- React + TypeScript + Vite app scaffold
- UI structure based on the approved HTML reference
- local PDF upload flow
- content-based statement detection using sampled PDF text via `pdfjs-dist`
- frozen output-contract types for the later parser/export work
- GitHub Pages deployment workflow support from the repository root

Not implemented yet in this slice:
- full trade parsing
- trade reconstruction
- workbook generation
- CSV/JSON/Markdown downloads
- zip bundle downloads

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploy on GitHub Pages

The repository root includes `.github/workflows/deploy-pages.yml`.
Once the project is in a GitHub repository and GitHub Pages is enabled for GitHub Actions:

1. push the repository to `main`
2. let the workflow build `github_pages_app`
3. GitHub will publish the `dist` folder automatically
