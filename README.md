# ICICI Trade P&L Web App

This repository contains only the GitHub Pages frontend for the ICICI Trade P&L utility.

## Scope

Included in this repository:
- the React + TypeScript browser app in `github_pages_app/`
- the GitHub Pages deployment workflow in `.github/workflows/deploy-pages.yml`

Not included in this repository:
- local Python parsing scripts
- broker PDFs
- generated reports, CSVs, or Excel files
- local test fixtures and desktop-only tooling

## Privacy model

The app is designed so uploaded PDF statements are processed locally in the browser. No backend is required for the MVP.

## Local development

```bash
cd github_pages_app
npm install
npm run dev
```

## Production build

```bash
cd github_pages_app
npm run build
```

## Tests

```bash
cd github_pages_app
npm test
```

## Deployment

GitHub Actions builds `github_pages_app` and publishes the generated `dist` output to GitHub Pages.
