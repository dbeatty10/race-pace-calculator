# GitHub Pages Deployment Instructions

This is a Vite + React application that can be deployed to GitHub Pages for free.

## Option 1: GitHub Actions (Recommended — Automatic)

This approach automatically builds and deploys the app whenever you push to `main`.

### Step 1: Create the GitHub Actions workflow

Create a new file `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "18"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Build
        run: npm run build

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
          cname: # Leave empty unless using a custom domain
```

### Step 2: Configure vite.config.ts

Update `vite.config.ts` to set the correct base path (replace `race-pace-calculator` with your actual repo name):

```ts
export default defineConfig({
  base: "/race-pace-calculator/",  // <- Add this line
  plugins: [react()],
  // ... rest of config
});
```

### Step 3: Verify GitHub Pages settings

1. Go to your GitHub repository settings
2. Navigate to **Settings > Pages**
3. Verify that **Source** is set to **Deploy from a branch**
4. Select the **gh-pages** branch and **/ (root)** folder
5. Click **Save**

Your site will be live at: `https://dbeatty10.github.io/race-pace-calculator/`

(The `gh-pages` branch is created automatically by the GitHub Actions workflow.)

---

## Option 2: Manual Deployment (Deploy on demand)

If you prefer to build and deploy manually only when needed:

### Step 1: Install gh-pages package

```bash
npm install --save-dev gh-pages
```

### Step 2: Update vite.config.ts

Add the base path (replace `race-pace-calculator` with your repo name):

```ts
export default defineConfig({
  base: "/race-pace-calculator/",  // <- Add this line
  plugins: [react()],
  // ... rest of config
});
```

### Step 3: Add deploy script to package.json

In the `"scripts"` section of `package.json`, add:

```json
"deploy": "npm run build && gh-pages -d dist"
```

So your scripts section looks like:
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest",
  "deploy": "npm run build && gh-pages -d dist"
}
```

### Step 4: Configure GitHub Pages settings

1. Go to **Settings > Pages**
2. Set **Source** to **Deploy from a branch**
3. Select the **gh-pages** branch and **/ (root)** folder
4. Click **Save**

### Step 5: Deploy

Whenever you're ready to deploy:

```bash
npm run deploy
```

This builds the app and pushes it to the `gh-pages` branch. Your site will be live at: `https://dbeatty10.github.io/race-pace-calculator/`

---

## Customization

### Custom Domain

If you want to use a custom domain instead of `github.io`:

1. Create a `CNAME` file in the `public/` directory with your domain name
2. Update your DNS provider's CNAME record to point to `dbeatty10.github.io`
3. Enable **Enforce HTTPS** in GitHub Pages settings

### Repository Name

The instructions above assume your repository is named `race-pace-calculator`. If it's different:
- Replace `race-pace-calculator` in the `base` path in `vite.config.ts`
- Adjust the deployed URL accordingly

---

## Testing Locally

Before deploying, test the production build locally:

```bash
npm run build
npm run preview
```

Visit `http://localhost:5173/race-pace-calculator/` to verify everything works.

---

## Troubleshooting

**Site shows 404:**
- Verify the `base` path in `vite.config.ts` matches your repository name
- Check GitHub Pages settings point to the correct branch (`gh-pages`)
- Clear browser cache

**GitHub Actions workflow fails:**
- Check the **Actions** tab in your repository for error logs
- Verify all tests pass locally: `npm test`
- Ensure `package.json` has all required dependencies

**Slow deployment:**
- First deployment may take 2-5 minutes
- Subsequent deployments typically take 30 seconds to 1 minute
