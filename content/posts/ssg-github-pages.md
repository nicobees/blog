---
title: "Personal blog in GitHub Pages: From markdown to html with SSG"
description: "Simple, scalable, SEO-friendly, and cheap! A complete SSG approach for markdown-driven content on GitHub Pages."
date: "2025-11-26"
author: "Nicola Abis"
tags: ["static-site-generation", "react", "vite", "github-pages", "markdown", "ssg", "web-development"]
keywords: "SSG, static site generation, GitHub Pages, React, Vite, markdown blog, static site builder"
status: "published"
---

> #### TL;DR
> I built a Static Site Generation (SSG) blog that converts markdown files into pre-rendered HTML pages at build time, then deploys everything to GitHub Pages. The tech stack is pretty straightforward: Vite with React and TypeScript handles the component rendering, a build-time script processes the markdown, GitHub API pulls content from multiple repositories, and GitHub Actions orchestrates everything. The real magic is that nothing runs at runtime—it's all just static files, which means instant page loads and perfect SEO.


## How I Got Here

When I started thinking about a personal blog, I realised I had some specific requirements that made me uncomfortable with the usual options. I didn't want to host a website, run a database somewhere or deal with a content management system. I write everything in markdown anyway—it's just easier—so why would I convert it into some other format? The real kicker was that some of my content lives in project repositories, some in dedicated content repos, and I wanted to pull it all together into one place without duplicating anything.

At the same time, I didn't have any specific or fancy requirements in terms of page interactivity or additional features (such as votes, comments, etc), at least not now. Hence simple static html page could do the job perfectly, without the need for additional javascript. But still I decided to use React for the flexibility of building web components, so that if I ever wanted to add interactivity later, I could do so easily.

I didn't have as well any requirements in terms of page discoverability, SEO, and performance: my goal here is simply to showcase some of my projects and ideas to anyone interested when visiting my github account. But still, this is a SEO and performance friendly approach: with SSG, the HTML is already built and sitting on GitHub Pages waiting to be downloaded.

I know that there are existing and well-established platforms such as Medium or Dev.to that could have done the job, but I wanted to build something custom to not be locked into someone else's platform and rules. Still, someone else have already created similar solutions, also shared in github, but I just wanted to do my own and experiment a bit, why not? 🙂

Again, create something simple, to write and publish articles fast was the main goal here.

## The SPA anti-pattern

My first instinct was to build a React SPA (Single Page Application) that would fetch markdown at runtime. The appeal is obvious: deploy a JavaScript bundle to GitHub Pages, and when users visit, the app fetches the markdown from the repo, parses it, renders it, and displays it.

But there are a few downsides (expand on each point for more details)

<details>
  <summary>Network waterfall
  </summary>
  The browser requests the index, waits for it, then download the Javascript bundle, waits for that, then requests the post list, waits for that, then requests the actual markdown, waits for that, then renders. It's sequential instead of parallel. By contrast, a pre-rendered HTML file is already complete when it arrives.
</details>

<details>
  <summary>Rate limits on GitHub
  </summary>
  Without authentication, fetching from GitHub's raw content API is limited to 60 requests per hour per IP address. That's fine for a tiny audience, but if you're behind a corporate network or VPN with shared IP addresses, you hit the limit fast. You could use authentication tokens to get 5000 requests per hour, but now you're managing secrets in the browser, which is a security headache.
</details>

<details>
  <summary>Search engines optimisation
  </summary>
  When a crawler visits your SPA blog, it sees a loading spinner, not your actual content. Some search engines are smart enough to wait for JavaScript and grab the content anyway, but many just give up and index whatever they see in the initial HTML—which is usually a spinner. Your SEO takes a hit.
</details>

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

There are no API requests to GitHub—everything is already on the page. Search engines see real HTML with proper meta tags, not a loading spinner.

And here's the thing: you still get React. The JavaScript bundle still ships, but now it's there for progressive future enhancement—adding interactivity like search filters, comment sections, or dynamic Table of Contents (TOC) generation.

---

## The Technical Foundation

### Setting Up GitHub Authentication

Before diving into code, let's address GitHub authentication. If you're fetching content from multiple repositories at build time, you need a GitHub token to avoid rate limits.

First, create a personal access token in your GitHub settings (Settings → Developer settings → Personal access tokens → Tokens (classic)). Select the `public_repo` scope if you're only accessing public repositories, or `repo` if you need access to private ones. Copy the token and add it to your `.env.local` file:

```
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Never commit `.env.local` to your repository. In your GitHub Actions workflow, the token is provided automatically as `${{ secrets.GITHUB_TOKEN }}`, so you don't need to manage it manually for deployments—GitHub gives you 5000 requests per hour in CI/CD environments.

With this setup, the fetching happens at build time, and since the build process has full access to GitHub's API with authentication, cross-repository content fetching isn't rate-limited.

### Blog posts pages: From Markdown to HTML Strings

The heart of this system is a single Node.js script that runs at build time. It scans for markdown files, parses them, and generates HTML files. Here below we will share snippets of the key parts. For the full implementation please refer to the file itself in the repo [render/build-pages.ts](https://github.com/nicobees/blog/blob/deploy-gh-pages/render/build-pages.ts).

#### Scan for markdown files

The script first scans both the local directory `content/posts` and any additional GitHub repositories specified in a `content-registry.json` file. It uses the GitHub API to fetch markdown files from other repos.

We use `gray-matter` to parse the frontmatter (metadata) from markdown. This separates the YAML header with title, date, tags from the actual markdown content. Each post becomes a structured object we can work with programmatically.

<details>
  <summary>Click to see the logic to scan the local markdown files</summary>

```typescript
// build-pages.ts
import path from 'path';
import fs from 'fs-extra';
import matter from 'gray-matter';

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  description: string;
  date: string;
  content: string;
  metadata: Record<string, any>;
}

// ... omitted for brevity ...

// Step 1: Scan local markdown files
async function scanLocalMarkdown(sourcePath: string): Promise<BlogPost[]> {
  const posts: BlogPost[] = [];
  const fullPath = path.resolve(PROJECT_ROOT, sourcePath);

  if (!fs.existsSync(fullPath)) {
    log(`Local path not found: ${fullPath}`, 'warn');
    return posts;
  }

  try {
    const files = fs.readdirSync(fullPath).filter((f) => f.endsWith('.md'));
    log(`Found ${files.length} local markdown files in ${sourcePath}`);

    for (const file of files) {
      const filePath = path.join(fullPath, file);
      const raw = fs.readFileSync(filePath, 'utf-8');
      const { data, content } = matter(raw);

      const slug = file
        .replace('.md', '')
        .toLowerCase()
        .replace(/[^\w-]/g, '-')
        .replace(/-+/g, '-');

      posts.push({
        content,
        date: data.date || new Date().toISOString().split('T'),
        description: data.description || '',
        id: `post-local-${slug}`,
        metadata: data as BlogPostMetadata,
        slug,
        source: 'local',
        status: data.status || 'draft',
        title: data.title || file,
      });

      fetchStats.success++;
      fetchStats.total++;
    }
  } catch (error) {
    log(`Error scanning local directory: ${error}`, 'error');
  }

  return posts;
}
```
</details>

#### Convert markdown into HTML

The convertion from markdown to HTML is done using the `marked` library, with a custom renderer in order to handle the code higlighting (with `highlight.js`).

<details>
  <summary>Click to see the markdown to HTML conversion logic</summary>

```typescript
import { marked } from 'marked';

marked.use({
  breaks: true,
  gfm: true,
  pedantic: false,
  renderer: customRenderer,
});

marked.setOptions({
  async: false,
  breaks: true,
  gfm: true,
  pedantic: false,
});

type ConvertMarkdownResult = { error: string; html?: never } | { error?: never; html: string };

const isConvertMarkdownResultError = (result: ConvertMarkdownResult): result is { error: string; html?: never } => {
  return !!result && !!result.error && !result.html;
};

async function convertMarkdownToHtml(markdown: string): Promise<ConvertMarkdownResult> {
  try {
    const html = await marked.parse(markdown);
    return { error: undefined, html };
  } catch (error) {
    const errorMessage = 'Error converting markdown into HTML';
    log(`${errorMessage}: ${error}`, 'error');
    return { error: errorMessage, html: undefined };
  }
}
```
</details>


#### Render React components to HTML strings

At this point, we have the html converted for each blog posts. In this step we first run React on the server, to render the output of `BlogLayout` component into and html string. Then we inject the html from the markdown conversion into the html from the React render-to-string output, using a specific placeholder.

The initial generated html is also enriched with all the SEO metadata in the `<head>` tags, such as title, description, Open Graph properties for social sharing, publication date, author, and keywords.

And furthermore, we generate Tailwind CSS specifically for this html content, to keep the injected css bundle size as small as possible.

<details>
  <summary>Click to see the React rendering logic</summary>

```typescript
async function generatePostHTML(post: BlogPost): Promise<void> {
  const sourceDisplay = post.source === 'github' ? ` (${post.sourceRepo})` : ' (local)';

  // Render markdown to HTML
  const conversionResult = await convertMarkdownToHtml(post.content);

  if (isConvertMarkdownResultError(conversionResult)) {
    log(`Skipping post generation to markdown render error: ${post.slug}${sourceDisplay}`, 'warn');
    return;
  }

  const { html: markdownContent } = conversionResult;

  const PostContent = React.createElement(Post, { post });

  const navigationWithPostContentHtml = renderToString(
    React.createElement(NavigationWrapper, { content: PostContent }),
  );
  const navigationWithPostContentAndMarkdownHtml = navigationWithPostContentHtml.replace(
    MARKDOWN_CONTENT_PLACEHOLDER,
    markdownContent,
  );

  const initialHtml = `<!DOCTYPE html>
<html lang="en" class="h-full">
<head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/blog/favicon.svg" priority="low"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(post.title)} | Blog</title>
    <meta name="description" content="${escapeHtml(post.description)}" />
    <meta property="og:title" content="${escapeHtml(post.title)}" />
    <meta property="og:description" content="${escapeHtml(post.description)}" />
    <meta property="og:type" content="article" />
    <meta property="article:published_time" content="${post.date}" />
    <meta name="author" content="${escapeHtml(post.metadata.author || 'Unknown')}" />
    ${post.metadata.tags ? `<meta name="keywords" content="${escapeHtml(post.metadata.tags.join(', '))}" />` : ''}
</head>
<body class="min-h-screen bg-(--color-bg) text-(--color-text)">
  ${navigationWithPostContentAndMarkdownHtml}
</body>
</html>`;

  // Generate Tailwind CSS for this specific HTML
  const tailwindCSS = await generateTailwindCSS(initialHtml);

  // Inject CSS into HTML
  const htmlWithTailwind = initialHtml.replace('</head>', `<style>${tailwindCSS}</style>\n</head>`);

  fs.ensureDirSync(OUTPUT_PAGES_DIR);
  const outputPath = path.join(OUTPUT_PAGES_DIR, `${post.slug}.html`);
  fs.writeFileSync(outputPath, htmlWithTailwind, 'utf-8');
  log(`Generated: ${post.slug}${sourceDisplay}`);
}
```
</details>

### Homepage: listing posts

The homepage of the blog lists all the posts. Also this page will be available as SSG content, with a few differences compared to the individual blog posts pages. 

No markdown is injected in the homepage html, but instead the list of blog posts is passed as prop into the homepage component `App.tsx`, so that the list can be rendered as React components.

Then the homepage is rendered as html string using React server side capabilities, together with specific tailwind css as well.

This time, when the homepage loads in the browser, it will also hydrate and download react and relative necessary javascript bundle. This keeps the homepage ready for interactivity and future enhancements (e.g. search, filters, sorting, etc).

<details>
  <summary>Click to see the homepage hydration logic</summary>

```typescript
import { createRoot, hydrateRoot } from 'react-dom/client';
import App from './App';
import './styles/index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

// Check if we have pre-rendered content to hydrate
if (rootElement.hasChildNodes()) {
  // Hydrate existing pre-rendered content
  hydrateRoot(rootElement, <App />);
} else {
  // Fresh render (for dev mode or when no content was pre-rendered)
  createRoot(rootElement).render(<App />);
}
```
</details>

### Summary of the build and serve process

1 - `render/build-pages.ts` script generates individual HTML files in `public/pages/` for each blog post in markdown format, and the homepage in `public/index.html`
2 - Vite then processes the public folder: it bundles JavaScript, optimises CSS, hashes assets for cache busting, and then outputs both the pre-generated HTML files and the bundled assets everything to the `/dist` folder
3 - GitHub Pages serves the entire `/dist` folder

The bundle size is smaller because:
- We are not shipping a markdown parser (rendering already happened)
- We are not shipping routing logic (URLs are just static HTML files)
- We will only ship interactive components (search, filters, etc.), if implemented in the feature

On a typical blog, this hydration bundle is 50-100KB gzipped, compared to 200-400KB for a full SPA bundle.

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
  contents: write
  pages: write
  id-token: write

env:
  NODE_VERSION: "24"

jobs:
  build:
    runs-on: ubuntu-latest
    env:
      VITE_BASE_PATH: "/blog/"
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build (pages with markdown + vite)
        run: npm run build-gh-pages
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'
          name: "frontend-gh-pages-artifact"
      
      - name: Deploy to Github pages
        uses: actions/deploy-pages@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          artifact_name: "frontend-gh-pages-artifact"
```

What's happening here:

1. Checkout code: checks out your repository
2. Setup Node.js: installs Node.js with caching for faster builds
3. Install dependencies: runs `npm ci` (clean install)
4. Build markdown pages: runs our `build-pages.ts` script with the GitHub token available as an environment variable
5. Build with Vite: Runs vite build bundling passing proper base path (needed to properly serve `/dist` folder in GitHub Pages)
6. Upload and deploy: GitHub Actions handles deploying to GitHub Pages

`${{ secrets.GITHUB_TOKEN }}` is automatically available in GitHub Actions. You don't need to create it or manage it, and this allows up to 5000 API requests per hour, which is more than enough for building a personal blog.

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

# Build full content to test locally
npm run build-gh-pages-test

# Deploy
git add .
git commit -m "Add first post"
git push
```

The workflow is beautifully simple. You write a markdown file with frontmatter, push it to the repository, and within seconds you have a published article. GitHub Actions picks up the push, checks out the code, installs dependencies, runs the build script to generate HTML files from your markdown using the authenticated GitHub token to fetch any cross-repo content, bundles assets with Vite, and deploys the result to GitHub Pages. The entire process is automated and takes maybe 30-60 seconds.

The blog URL structure makes sense too. If your markdown file is `my-awesome-article.md`, the generated HTML file is `my-awesome-article.html` and it's available at `/blog/my-awesome-article`. Clean, predictable, and SEO-friendly.

## Conclusion

The elegance of static site generation is that it removes layers of complexity without sacrificing capability. You get lightning-fast page loads, perfect search engine optimization, minimal infrastructure, minimal JavaScript bundles through hydration-only strategy, and the ability to use modern tools like React and Vite. It's the best of both worlds: the simplicity and reliability of static files, plus the power and flexibility of a modern JavaScript framework.

For a personal blog especially, this approach shines. Your content is in version control where you can track changes and maintain history. Your site is decoupled from any particular framework or platform. Your readers get an instant, beautiful experience. And you spend your time writing and creating.

That's the real win. ✨
