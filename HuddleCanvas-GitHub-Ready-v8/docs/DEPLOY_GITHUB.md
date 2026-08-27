# Deploy HuddleCanvas to GitHub and GitHub Pages

This repository is already arranged so the current static prototype can be published directly with GitHub Pages.

## 1. Install Git

On Windows, install Git for Windows. On macOS, Git is usually available through Xcode Command Line Tools or Homebrew. Confirm:

```bash
git --version
```

## 2. Create a GitHub repository

1. Sign in to GitHub.
2. Create a new repository, for example `huddlecanvas`.
3. For the first upload, leave **Initialize with README** off because this folder already has a README.
4. Choose private while developing if your plan supports the workflow you want; note that the deployed GitHub Pages site itself may be public depending on plan/settings.

## 3. Open this folder in a terminal

In VS Code: **Terminal → New Terminal**. Then run:

```bash
git init
git branch -M main
git add .
git commit -m "Initial HuddleCanvas v8 prototype"
git remote add origin https://github.com/YOUR-ACCOUNT/huddlecanvas.git
git push -u origin main
```

If GitHub asks you to authenticate, use its browser/device authentication or Git Credential Manager. Do not paste passwords into source files.

## 4. Enable GitHub Pages

This repo includes `.github/workflows/deploy-pages.yml`. It follows GitHub's Pages Actions deployment pattern.

On GitHub:

1. Open the repository.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **GitHub Actions** as the source.
4. Push to `main` (or use the workflow's manual Run option).
5. Open the **Actions** tab and wait for `Deploy HuddleCanvas to GitHub Pages` to complete.
6. GitHub will show the Pages URL in the deployment.

GitHub Pages publishes static HTML/CSS/JavaScript directly from a repository, so the current prototype does not need a build step.

## 5. Update the app later

After editing:

```bash
git status
git add .
git commit -m "Describe the change"
git push
```

Every push to `main` triggers the included Pages workflow.

## 6. Optional custom subdomain

For a product deployment, a subdomain such as `huddlecanvas.getitechsolutions.com` or `canvas.getitechsolutions.com` is cleaner than exposing the GitHub Pages address.

High-level process:

1. In GitHub repository **Settings → Pages**, enter the custom domain.
2. At your DNS provider, create the subdomain record GitHub recommends. For a normal subdomain, GitHub documents using a `CNAME` pointing to your GitHub Pages account host, such as `YOUR-ACCOUNT.github.io`.
3. Verify the domain in GitHub where possible to reduce domain-takeover risk.
4. Enable **Enforce HTTPS** once the certificate is ready.

Do not rely on a repository `CNAME` file alone; GitHub's current documentation says the custom domain also needs to be configured in Pages settings or via the API.

## 7. Important deployment warning

GitHub Pages is suitable for the **static prototype/free demo**. It is not the production backend for:
- passwords or private secrets
- server-side AI keys
- subscriptions/billing
- realtime presence
- private cloud boards
- databases

Those require the Hosted Alpha architecture.

## Official references
- GitHub Pages quickstart: https://docs.github.com/en/pages/quickstart
- Publishing source: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- Automated Pages deployment: https://docs.github.com/en/get-started/start-your-journey/deploying-your-website-automatically
- HTTPS/custom-domain DNS: https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https
