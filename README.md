# Blog

A static site generation (SSG) blog built with React, Vite, and Markdown, deployed on GitHub Pages.
Blog articles are pure markdown files stored in the repository or in other GitHub repositories.

## Features

- ⚡ Ultra-fast page loads (static HTML)
- 📝 Markdown-first content authoring
- 🔄 Cross-repository content fetching
- 🎨 Modern React components for interactivity
- 🔍 Perfect SEO with server-rendered meta tags
- 🚀 Zero infrastructure maintenance

## Quick Start

### Installation

```bash
git clone git@github.com:nicobees/blog.git
cd blog
npm install
```

### Local Development

```bash
npm run dev
```

The page will be available at http://localhost:5173

### Create a New Post

Create a new markdown file in `content/posts/`, this has frontmatter structure with metadata on top:

```text
---
title: "My Awesome Post"
description: "A brief description"
date: "2025-11-26"
author: "Your Name"
tags: ["markdown", "blog"]
---

# My Awesome Post

Actual post content here...
```

### Test build locally

```bash
npm run build
npm run preview
```

## Build Process

```bash
npm run build
```

This runs:

build-pages.ts - Generates HTML from markdown

vite build - Bundles assets and JavaScript

Output is in /dist and ready for deployment.

## Project Structure

```text
├── content/posts/          # Markdown articles
├── src/
│   ├── components/         # React components
│   ├── styles/             # Styles
│   ├── types/              # Types
│   └── main.tsx            # Entry point
├── render/
│   ├── build-pages.ts       # Render pages to html and inject markdown
│   └── customRenderer.ts    # Customize markdown rendering with code highlighting
├── content-registry.json  # Content sources
└── vite.config.ts         # Vite configuration
```

## Tech Stack

React 19
TypeScript
Vite
Markdown
GitHub Pages - Hosting
GitHub Actions - CI/CD

## 🎯 Next Steps

- Configure cross-repo content fetching in content-registry.json
- Comments and votes functionality (e.g. utterances)
- Customisation options for themes
