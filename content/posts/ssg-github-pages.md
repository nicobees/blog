---
title: "Markdown to GitHub Pages: Building a Static Blog with SSG"
description: "How I built a scalable, SEO-friendly blog using React, Vite, and static site generation. A complete SSG approach for markdown-driven content on GitHub Pages."
date: "2025-11-26"
author: "Your Name"
tags: ["static-site-generation", "react", "vite", "github-pages", "markdown", "ssg", "web-development"]
keywords: "SSG, static site generation, GitHub Pages, React, Vite, markdown blog, static site builder"
status: "published"
---

## TL;DR

I built a Static Site Generation (SSG) blog that converts markdown files into pre-rendered HTML pages at build time, then deploys everything to GitHub Pages. The tech stack is pretty straightforward: Vite with React and TypeScript handles the component rendering, a build-time script processes the markdown, GitHub API pulls content from multiple repositories, and GitHub Actions orchestrates everything. The real magic is that nothing runs at runtime—it's all just static files, which means instant page loads and perfect SEO.

Why take this approach? Traditional single-page apps have this awkward dance where the browser fetches JavaScript, then fetches markdown, then renders everything. By the time users see content, half a second has passed. With SSG, the HTML is already built and sitting on GitHub Pages waiting to be downloaded. Plus, you get all the SEO benefits of a static site while keeping the flexibility of React components for anything interactive.

---

## How I Got Here

When I started thinking about a personal blog, I realized I had some specific requirements that made me uncomfortable with the usual options. I didn't want to run a database somewhere or deal with a content management system. I write everything in markdown anyway—it's just easier—so why would I convert it into some other format? The real kicker was that some of my content lives in project repositories, some in dedicated content repos, and I wanted to pull it all together into one place without duplicating anything.

Performance and discoverability matter too. Search engines favor fast sites, and modern users have gotten accustomed to instant page loads. Waiting for JavaScript to download and execute before seeing content feels slow in 2025. I wanted readers to see the actual article the moment the page loads, not a loading spinner. And search bots? They shouldn't have to run JavaScript to index my content either.

From an infrastructure perspective, I wanted something that lived on GitHub Pages and required zero ongoing maintenance. No servers to monitor, no databases to back up, no deployments to orchestrate manually. Just push code and it's live. That simplicity appeals to me, especially since I'm building this alongside actual development work.

Finally, I wanted to use modern tooling. React is powerful, Vite is fast, and TypeScript catches bugs. But I didn't want to be locked into someone else's opinionated framework like Next.js or VitePress. I needed the flexibility to control exactly how my blog works, and the ability to reuse this approach for other projects.

---

## The SPA Trap

My first instinct was to build a React single-page application that would fetch markdown at runtime. The appeal is obvious: deploy a JavaScript bundle to GitHub Pages, and when users visit, the app fetches the markdown from the repo, parses it, renders it, and displays it. Simple, right?

Except it's not. Cold starts on an SPA blog typically take 500-800 milliseconds. The browser needs to download the JavaScript bundle, parse and execute it, then make an API call to fetch the markdown, parse that, render the React components, and finally display the content. That might not sound like much, but it adds up. Every extra millisecond is a tiny bit of friction.

Then there are rate limits. Without authentication, fetching from GitHub's raw content API is limited to 60 requests per hour per IP address. That's fine for a tiny audience, but if you're behind a corporate network or VPN with shared IP addresses, you hit the limit fast. You could use authentication tokens to get 5000 requests per hour, but now you're managing secrets in the browser, which is a security headache.

Search engines are another problem. When a crawler visits your SPA blog, it sees a loading spinner, not your actual content. Some search engines are smart enough to wait for JavaScript and grab the content anyway, but many just give up and index whatever they see in the initial HTML—which is usually a spinner. Your SEO takes a hit.

The real frustration though is the network waterfall. The browser requests the index, waits for it, then requests the post list, waits for that, then requests the actual markdown, waits for that, then renders. It's sequential instead of parallel. By contrast, a pre-rendered HTML file is already complete when it arrives.

---

## Static Site Generation: A Different Approach

Instead of generating content at runtime, what if we generated it at build time? Before anything goes to GitHub Pages, we run a Node.js script that reads all the markdown files, parses them, renders the React components to HTML strings, and writes those HTML files to the output directory. Then GitHub Actions deploys the entire `/dist` folder to GitHub Pages.

Here's the flow that makes it all work:

```
build-pages.ts (Node.js script runs locally or in CI)
  ↓
Scan markdown files (local + GitHub repos)
  ↓
Parse frontmatter & content with gray-matter
  ↓
Render React components to HTML strings
  ↓
Write /dist/post-slug.html (complete HTML files)
  ↓
Vite bundles assets & JavaScript for hydration
  ↓
GitHub Actions deploys /dist to GitHub Pages
  ↓
User visits → instant HTML download ✨
```

When users visit, they're just downloading static HTML files, the same way they would visit any website built decades ago. The performance difference is stark. Load times drop from 500-800ms to 100-200ms or even faster, depending on browser cache. There are no API requests to GitHub—everything is already on the page. Rate limiting becomes irrelevant. Search engines see real HTML with proper meta tags, not a loading spinner.

And here's the thing: you still get React. The JavaScript bundle still ships, but now it's there for progressive enhancement—adding interactivity like search filters, comment sections, or dynamic TOC generation. The main content is already there though. If JavaScript fails or takes a second to load, users can still read the article.

---

## The Technical Foundation

### Setting Up GitHub Authentication

Before diving into code, let's address GitHub authentication. If you're fetching content from multiple repositories at build time, you need a GitHub token to avoid rate limits. This is simpler than it sounds.

First, create a personal access token in your GitHub settings (Settings → Developer settings → Personal access tokens → Tokens (classic)). Select the `public_repo` scope if you're only accessing public repositories, or `repo` if you need access to private ones. Copy the token and add it to your `.env.local` file:

```
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Never commit `.env.local` to your repository. Instead, commit `.env.local.example` with a placeholder so others know what's needed. In your GitHub Actions workflow, the token is provided automatically as `${{ secrets.GITHUB_TOKEN }}`, so you don't need to manage it manually for deployments—GitHub gives you 5000 requests per hour in CI/CD environments.

The beauty of this setup is that the build-time process has full access to GitHub's API with authentication, so cross-repository content fetching isn't rate-limited. This is only possible because the fetching happens at build time, not in the browser.

### Build Script: From Markdown to HTML Strings

The heart of this system is a single Node.js script that I run at build time. It scans for markdown files, parses them, and generates HTML files. Here's the core logic:

```typescript
// build-pages.ts
import path from 'path';
import fs from 'fs-extra';
import matter from 'gray-matter';
import { Octokit } from '@octokit/rest';

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  description: string;
  date: string;
  content: string;
  metadata: Record<string, any>;
}

const CONTENT_DIR = path.resolve(__dirname, 'content/posts');
const OUTPUT_DIR = path.resolve(__dirname, 'public/pages');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// GitHub API client with authentication
const octokit = new Octokit({ auth: GITHUB_TOKEN });

// Step 1: Scan local markdown files
async function scanLocalMarkdown(): Promise<BlogPost[]> {
  const posts: BlogPost[] = [];
  const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md'));

  for (const file of files) {
    const raw = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf-8');
    const { data, content } = matter(raw);

    const slug = file
      .replace('.md', '')
      .toLowerCase()
      .replace(/[^\w-]/g, '-');

    posts.push({
      id: `post-${slug}`,
      slug,
      title: data.title || file,
      description: data.description || '',
      date: data.date || new Date().toISOString().split('T')[0],
      content,
      metadata: data,
    });
  }

  return posts.sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

// Step 2: Fetch markdown from other GitHub repositories
async function fetchGitHubMarkdown(
  owner: string,
  repo: string,
  filePath: string,
  branch: string = 'main'
): Promise<string | null> {
  try {
    const response = await octokit.repos.getContent({
      owner,
      repo,
      path: filePath,
      ref: branch,
      headers: { 'Accept': 'application/vnd.github.raw' },
    });

    return typeof response.data === 'string' ? response.data : null;
  } catch (error) {
    console.error(`Error fetching ${owner}/${repo}/${filePath}:`, error);
    return null;
  }
}

async function build() {
  const posts = await scanLocalMarkdown();
  console.log(`📝 Found ${posts.length} posts`);

  // You can add cross-repo fetching here
  // For now, we focus on local markdown

  return posts;
}

build();
```

Key insight: We use `gray-matter` to parse the frontmatter (metadata) from markdown. This separates the YAML header with title, date, tags from the actual markdown content. Each post becomes a structured object we can work with programmatically.

### Rendering React Components to HTML Strings

Once we have the markdown content, the next step is rendering React components to HTML strings. This is where the SSG magic happens. We're not creating a browser-based React app; we're running React in Node.js and capturing the rendered output as a string.

```typescript
// In build-pages.ts, add React rendering

import { renderToString } from 'react-dom/server';
import React from 'react';
import BlogLayout from './src/components/BlogLayout';

async function generatePostHTML(post: BlogPost): Promise<void> {
  // Create a React component that renders the post
  const element = React.createElement(BlogLayout, { post });

  // Render to HTML string
  const html = renderToString(element);

  // Create complete HTML document with SEO metadata
  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(post.title)} | Blog</title>
  <meta name="description" content="${escapeHtml(post.description)}">
  <meta property="og:title" content="${escapeHtml(post.title)}">
  <meta property="og:description" content="${escapeHtml(post.description)}">
  <meta property="article:published_time" content="${post.date}">
  <meta name="author" content="${escapeHtml(post.metadata.author || 'Your Name')}">
  ${post.metadata.tags ? `<meta name="keywords" content="${escapeHtml(post.metadata.tags.join(', '))}">` : ''}
</head>
<body>
  <div id="root">${html}</div>
  <script type="module" src="/blog/assets/main.js"><\/script>
</body>
</html>`;

  fs.ensureDirSync(OUTPUT_DIR);
  fs.writeFileSync(path.join(OUTPUT_DIR, `${post.slug}.html`), fullHtml, 'utf-8');
  console.log(`✓ Generated: ${post.slug}`);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
```

This is the crucial step: `renderToString` takes a React component and returns a string of HTML. We embed all the SEO metadata in the `<head>` tags—title, description, Open Graph properties for social sharing, publication date. The body contains the rendered component wrapped in a `<div id="root">` where React will later hydrate.

### Vite Configuration for Asset Bundling

After we've generated all the HTML files, Vite handles bundling any JavaScript and CSS. The key is understanding that Vite is now processing pre-rendered HTML files, not creating a traditional SPA entry point.

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/blog/',
  build: {
    target: 'esnext',
    minify: 'terser',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        // Vite will process all HTML files in public/pages
      },
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
  server: {
    port: 5173,
  },
});
```

The build process works like this:

1. Our `build-pages.ts` script generates individual HTML files in `public/pages/`
2. Vite then processes everything: bundling JavaScript, optimizing CSS, hashing assets for cache busting
3. The final `/dist` folder contains both the pre-generated HTML files and the bundled assets
4. GitHub Pages serves the entire `/dist` folder

---

## The Hydration Strategy: Minimizing JavaScript

This is where the performance magic really lives. Traditional SPAs ship a large JavaScript bundle that includes the entire app. Our approach ships a much smaller bundle because it only needs to hydrate existing DOM.

```typescript
// src/main.tsx - Entry point for hydration
import React from 'react';
import { hydrateRoot } from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');

if (rootElement?.hasChildNodes()) {
  // Hydrate existing pre-rendered content
  hydrateRoot(rootElement, <App />);
} else {
  // Fallback for dev mode
  const { createRoot } = await import('react-dom/client');
  createRoot(rootElement!).render(<App />);
}
```

Hydration means React takes the existing HTML (which was pre-rendered on the server at build time) and attaches event listeners and interactivity to it. The browser doesn't re-render; it enhances what's already there. This is vastly faster than mounting a fresh React app.

The bundle size is smaller because:
- We're not shipping a markdown parser (rendering already happened)
- We're not shipping routing logic (URLs are just static HTML files)
- We only ship interactive components (search, filters, etc.)

On a typical blog, this hydration bundle is 50-100KB gzipped, compared to 200-400KB for a full SPA bundle.

---

## GitHub Actions: Automating the Build and Deploy

The entire pipeline is orchestrated by a GitHub Actions workflow that runs every time you push to main:

```yaml
# .github/workflows/deploy.yml
name: Build and Deploy Blog

on:
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build markdown pages
        run: npx tsx build-pages.ts
        env:
          # GitHub Actions provides this automatically
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Build with Vite
        run: npm run build

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'

  deploy:
    runs-on: ubuntu-latest
    needs: build
    environment:
      name: github-pages
    steps:
      - name: Deploy to GitHub Pages
        uses: actions/deploy-pages@v4
```

What's happening here:

1. **Checkout code**: GitHub Actions checks out your repository
2. **Setup Node.js**: Installs Node.js with caching for faster builds
3. **Install dependencies**: Runs `npm ci` (clean install)
4. **Build markdown pages**: Runs our `build-pages.ts` script with the GitHub token available as an environment variable
5. **Build with Vite**: Bundles JavaScript, CSS, and optimizes assets
6. **Upload and deploy**: GitHub Actions handles deploying to GitHub Pages

The beautiful part: `${{ secrets.GITHUB_TOKEN }}` is automatically available in GitHub Actions. You don't need to create it or manage it. GitHub provides it with 5000 API requests per hour, which is more than enough for building a blog.

---

## Why This Structure Matters

I chose to use markdown frontmatter for metadata because it keeps the source files simple and self-contained. All the information about a post—its title, date, tags, description—lives right at the top of the markdown file. When you're writing the post, you see all that context immediately. It also makes the markdown files portable; if you ever wanted to move this blog to another system, the metadata is already there.

Pre-rendering HTML at build time creates a fundamental shift in how you think about performance. There's no runtime work on the server or the browser. Everything that can be computed is computed during the build, and the output is just files. This is remarkably efficient and aligns with how the web worked before single-page applications became the default.

The hydration strategy is where you get the best of both worlds. You get instant-loading pre-rendered HTML for SEO and performance, plus React for progressive enhancement. The JavaScript bundle is minimal because it only needs to make the pre-rendered HTML interactive, not render it from scratch.

Cross-repository content fetching is possible because at build time, we have full access to GitHub's API with authentication. We can fetch markdown from multiple repos, aggregate them, and generate a single unified blog. This decouples content authoring from the blog infrastructure.

---

## Performance in the Real World

The difference in real-world performance is noticeable. First paint on an SSG site typically happens around 300 milliseconds. Time to interactive is under 500 milliseconds. There are zero API requests—everything came down with the initial HTML. The bundle size is smaller because we're not shipping a markdown parser; it's just React for interactivity.

On a Lighthouse audit, SSG blogs routinely score in the 95-100 range. SPAs struggle to get past 80 because of the runtime overhead and JavaScript execution time. Users notice the difference. Pages feel instant.

---

## Scaling and Maintenance

One thing I love about this approach is how well it scales. If you have 10 posts or 1000 posts, the build process works exactly the same way. The build time increases slightly with more content (maybe 5-10 seconds per 50 posts), but it's still measured in seconds. The deployed site is equally fast regardless of how many articles you've published.

Maintenance is minimal. The blog repository contains your React components and build script. Content lives in markdown files, either in the same repo or in other repos you own. When you write a new post, you create a new markdown file. On your next push, GitHub Actions automatically builds everything and deploys it. There's no manual intervention, no operations overhead, no infrastructure to maintain.

If you ever decide you want to move to a different platform—maybe you want a more sophisticated blog system someday—your markdown files are portable. They're not locked into this approach. You could adapt them to work with Next.js, Hugo, or whatever else you prefer. The markdown is the source of truth.

---

## What Actually Happens When You Publish

The workflow is beautifully simple. You write a markdown file with frontmatter, push it to the repository, and within seconds you have a published article. GitHub Actions picks up the push, checks out the code, installs dependencies, runs the build script to generate HTML files from your markdown using the authenticated GitHub token to fetch any cross-repo content, bundles assets with Vite, and deploys the result to GitHub Pages. The entire process is automated and takes maybe 30-60 seconds.

The blog URL structure makes sense too. If your markdown file is `my-awesome-article.md`, the generated HTML file is `my-awesome-article.html` and it's available at `/blog/my-awesome-article`. Clean, predictable, and SEO-friendly.

---

## Real Benefits You'll Actually Experience

Building a blog with this system removes so much cognitive overhead. You don't think about deployments, caching strategies, or load balancing. You write markdown and push code. The platform handles the rest.

The speed is real. When you share an article on Twitter and someone clicks through, they're not staring at a loading spinner while JavaScript loads. The content is there instantly. That might sound like a small thing, but it compounds—every millisecond counts in user experience.

Search visibility improves dramatically. Because your content is real HTML served from the server, search engines index it completely on the first visit. You get all the SEO benefits without needing to do anything special. No meta tag injection, no JavaScript framework workarounds, no complexity.

The GitHub token understanding was crucial for me too. Once I realized that build-time processes have full API access without rate limits, while browser-based fetches are rate-limited to 60 requests per hour, the architecture clicked into place. Build time became the perfect place to do expensive operations like fetching from multiple repositories.

And there's something satisfying about the approach philosophically. The web has moved through several eras, and we've sometimes forgotten that the simplest solution is often the best one. Static files served quickly are hard to beat. This approach combines that simplicity with modern tooling and flexibility.

---

## Getting Your First Post Published

To start, you'd create your repository with the Vite scaffolding already set up, add the build script, and create a `content/posts` directory. Your first markdown file goes in there with frontmatter at the top. Running the build locally generates the HTML files, and you can preview them. When you're happy, you push to main and GitHub Actions takes care of the deployment.

```bash
# Clone and setup
git clone <your-repo>
npm install

# Create first post
cat > content/posts/hello-world.md << 'EOF'
---
title: "Hello World"
date: "2025-11-26"
description: "My first blog post"
---

# My first post

This is the content...
EOF

# Build locally
npx tsx build-pages.ts
npm run build

# Deploy
git add .
git commit -m "Add first post"
git push
```

The whole process—from empty repository to published article—takes maybe an hour, most of which is just setting up the React components the way you like them. The actual SSG machinery is straightforward once you understand the flow.

---

## Conclusion

The elegance of static site generation is that it removes layers of complexity without sacrificing capability. You get lightning-fast page loads, perfect search engine optimization, minimal infrastructure, minimal JavaScript bundles through hydration-only strategy, and the ability to use modern tools like React and Vite. It's the best of both worlds: the simplicity and reliability of static files, plus the power and flexibility of a modern JavaScript framework.

For a personal blog especially, this approach shines. Your content is in version control where you can track changes and maintain history. Your site is decoupled from any particular framework or platform. Your readers get an instant, beautiful experience. And you spend your time writing and creating, not wrestling with infrastructure.

That's the real win. ✨
