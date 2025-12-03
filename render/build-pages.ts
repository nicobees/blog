import { execSync } from 'node:child_process';
import path from 'node:path';
import { Octokit } from '@octokit/rest';
import fs from 'fs-extra';
import matter from 'gray-matter';
import { marked } from 'marked';
import { minimatch } from 'minimatch';
import React from 'react';
import { renderToString } from 'react-dom/server';
import App from '../src/App';
import { NavigationWrapper } from '../src/components/Navigation';
import Post, { MARKDOWN_CONTENT_PLACEHOLDER } from '../src/components/Post';
import { labels } from '../src/data/constants';
import { customRenderer } from './customRenderer';
import { escapeHtml, log } from './utils';

const SHOW_ALL_POSTS = process.env.SHOW_ALL_POSTS === 'true';

const __dirname = import.meta.dirname;
const __filename = import.meta.filename;

// ============================================================================
// Type Definitions
// ============================================================================

interface BlogPostMetadata {
  author: string;
  tags: string[];
}

type BlogPostStatus = 'archived' | 'draft' | 'published';

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  description: string;
  date: string;
  content: string;
  metadata: BlogPostMetadata;
  source: 'local' | 'github';
  sourceRepo?: string;
  status: BlogPostStatus;
}

interface BlogIndex {
  posts: BlogPost[];
  lastUpdated: string;
}

interface ContentSource {
  type: 'local' | 'github';
  path: string;
  pattern?: string;
  owner?: string;
  repo?: string;
  branch?: string;
}

// ============================================================================
// Constants
// ============================================================================

const PROJECT_ROOT = path.resolve(__dirname, '..');
const CONTENT_REGISTRY = path.resolve(PROJECT_ROOT, 'content-registry.json');
const OUTPUT_PAGES_DIR = path.resolve(PROJECT_ROOT, 'public/pages');
const INDEX_OUTPUT = path.resolve(PROJECT_ROOT, 'src/data/blog-index.json');
const BASE_PATH = process.env.VITE_BASE_PATH || '/blog';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// ============================================================================
// GitHub API Setup
// ============================================================================

const octokit = new Octokit({
  auth: GITHUB_TOKEN,
  baseUrl: 'https://api.github.com',
});

const fetchStats = {
  failed: 0,
  success: 0,
  total: 0,
};

// ============================================================================
// Tailwind CSS Processing
// ============================================================================

async function generateTailwindCSS(htmlContent: string): Promise<string> {
  try {
    const tempHtmlFile = path.join(__dirname, '.temp-tailwind.html');
    const tempCssFile = path.join(__dirname, '.temp-tailwind.css');

    fs.writeFileSync(tempHtmlFile, htmlContent, 'utf-8');

    // Write CSS to a file instead of /dev/stdout
    execSync(`npx tailwindcss -i ./src/styles/tailwind-input.css -o ${tempCssFile} --content ${tempHtmlFile}`, {
      encoding: 'utf-8',
    });

    const css = fs.readFileSync(tempCssFile, 'utf-8');

    fs.removeSync(tempHtmlFile);
    fs.removeSync(tempCssFile);

    return css;
  } catch (error) {
    log(`Error generating Tailwind CSS: ${error}`, 'error');
    console.error(error);
    return '';
  }
}

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

// ============================================================================
// Local File Scanning
// ============================================================================

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
        metadata: data as BlogPostMetadata, // TODO: validate metadata at runtime
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

// ============================================================================
// GitHub File Fetching
// ============================================================================

async function fetchGitHubFile(owner: string, repo: string, filePath: string, branch: string): Promise<string | null> {
  try {
    const response = await octokit.repos.getContent({
      headers: {
        Accept: 'application/vnd.github.raw',
      },
      owner,
      path: filePath,
      ref: branch,
      repo,
    });

    if (typeof response.data === 'string') {
      return response.data;
    }

    return null;
  } catch (error) {
    const genericErrorMessage = `Error fetching`;

    const filePathSubstring = `${owner}/${repo}/${filePath}`;
    // TODO: add handling for 404 file not found, check in error.status if available
    // const isNotFoundSubstring = `File not found`;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorMessageComputed = `${genericErrorMessage}: ${filePathSubstring} - ${errorMessage}`;
    log(errorMessageComputed, 'error');

    fetchStats.failed++;
    return null;
  }
}

async function listGitHubDirectory(
  owner: string,
  repo: string,
  dirPath: string,
  branch: string,
  pattern: string = '*.md',
): Promise<string[]> {
  try {
    const response = await octokit.repos.getContent({
      owner,
      path: dirPath || '.',
      ref: branch,
      repo,
    });

    if (Array.isArray(response.data)) {
      return response.data
        .filter((item) => item.type === 'file')
        .map((item) => item.path)
        .filter((path) => minimatch(path, pattern));
    }

    if (response.data && 'path' in response.data) {
      const filePath = response.data.path;
      if (minimatch(filePath, pattern)) {
        return [filePath];
      }
    }

    return [];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Error listing directory ${owner}/${repo}/${dirPath}: ${errorMessage}`, 'error');
    return [];
  }
}

async function scanGitHubMarkdown(source: ContentSource): Promise<BlogPost[]> {
  const { owner, repo, path: repoPath, branch = 'main', pattern = '*.md' } = source;

  if (!owner || !repo) {
    log('Invalid GitHub source configuration', 'error');
    return [];
  }

  log(`Fetching from GitHub: ${owner}/${repo} (${repoPath})`);

  try {
    const files = await listGitHubDirectory(owner, repo, repoPath, branch, pattern);
    log(`Found ${files.length} files matching pattern "${pattern}" in ${owner}/${repo}`);

    const posts: BlogPost[] = [];

    for (const filePath of files) {
      const content = await fetchGitHubFile(owner, repo, filePath, branch);

      if (!content) {
        fetchStats.total++;
        continue;
      }

      try {
        const { data, content: body } = matter(content);

        const pathSegments = filePath.replace(/\.md$/, '').split('/');

        const rawSlug = pathSegments.pop() || filePath;

        const slug = rawSlug
          .toLowerCase()
          .replace(/[^\w-]/g, '-')
          .replace(/-+/g, '-');

        posts.push({
          content: body,
          date: data.date || new Date().toISOString().split('T'),
          description: data.description || '',
          id: `post-${owner}-${slug}`,
          metadata: data as BlogPostMetadata, // TODO: validate metadata at runtime
          slug: `${owner}-${slug}`,
          source: 'github',
          sourceRepo: `${owner}/${repo}`,
          status: data.status || 'draft',
          title: data.title || filePath,
        });

        fetchStats.success++;
      } catch (parseError) {
        log(`Error parsing ${filePath}: ${parseError}`, 'error');
      }

      fetchStats.total++;
    }

    return posts;
  } catch (error) {
    log(`Error scanning GitHub repo: ${error}`, 'error');
    return [];
  }
}

// ============================================================================
// Content Aggregation
// ============================================================================

async function loadContentRegistry(): Promise<BlogPost[]> {
  if (!fs.existsSync(CONTENT_REGISTRY)) {
    log(`Registry not found: ${CONTENT_REGISTRY}`, 'warn');
    return [];
  }

  const registry = fs.readJsonSync(CONTENT_REGISTRY) as {
    sources: ContentSource[];
  };

  let allPosts: BlogPost[] = [];

  for (const source of registry.sources) {
    let posts: BlogPost[] = [];

    if (source.type === 'local') {
      posts = await scanLocalMarkdown(source.path);
    } else if (source.type === 'github') {
      posts = await scanGitHubMarkdown(source);
    }

    allPosts = allPosts.concat(posts);
  }

  return allPosts;
}

// ============================================================================
// HTML Generation
// ============================================================================

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
<body class="min-h-screen bg-bg text-text">
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

// ============================================================================
// Blog Index Generation
// ============================================================================

async function generateBlogIndex(posts: BlogPost[]): Promise<BlogIndex> {
  const index: BlogIndex = {
    lastUpdated: new Date().toISOString(),
    posts: posts
      .map((p) => ({
        ...p,
        content: '',
        date: p.date,
        description: p.description,
        id: p.id,
        slug: p.slug,
        title: p.title,
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  };

  fs.ensureDirSync(path.dirname(INDEX_OUTPUT));
  fs.writeFileSync(INDEX_OUTPUT, JSON.stringify(index, null, 2), 'utf-8');
  log(`Generated index with ${posts.length} posts`);

  return index;
}

// ============================================================================
// Homepage HTML Generation
// ============================================================================

async function generateHomePageHTML({
  description,
  title,
  posts,
}: {
  description?: string;
  title: string;
  posts: BlogPost[];
}): Promise<void> {
  const homePageWithPostContentHtml = renderToString(React.createElement(App, { posts }));
  const pagesPath = `${BASE_PATH}/pages`;

  const initialHtml = `<!DOCTYPE html>
<html lang="en" class="h-full">
<head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/blog/favicon.svg" priority="low"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>${description ? `<meta name="description" content="${escapeHtml(description)}" />` : ''}
    <script type="speculationrules">
      {
        "prefetch": [{
          "source": "document",
          "where": {
            "and": [
              { "href_matches": "${pagesPath}/*" },
              { "not": { "href_matches": "/*.pdf" } }
            ]
          },
          "eagerness": "eager"
        }],
        "prerender": [{
          "source": "document",
          "where": {
            "and": [
              { "href_matches": "${pagesPath}/*" }
            ]
          },
          "eagerness": "eager"
        }]
      }
    </script>
</head>
<body class="min-h-screen bg-bg text-text">
  <div id="root">${homePageWithPostContentHtml}</div><script type="module" src="/src/main.tsx"></script>
</body>
</html>`;

  // Generate Tailwind CSS for this specific HTML
  const tailwindCSS = await generateTailwindCSS(initialHtml);

  // Inject CSS into HTML
  const htmlWithTailwind = initialHtml.replace('</head>', `<style>${tailwindCSS}</style>\n</head>`);

  const outputPath = path.join(PROJECT_ROOT, `index.html`);
  fs.writeFileSync(outputPath, htmlWithTailwind, 'utf-8');
  log(`Generated: index.html`);
}

// ============================================================================
// Main Build Process
// ============================================================================

async function build(): Promise<void> {
  try {
    log('Starting blog build process...\n');

    if (!GITHUB_TOKEN) {
      log('⚠️  No GITHUB_TOKEN found. Will only process local content.', 'warn');
      log('💡 To fetch from GitHub repos, set GITHUB_TOKEN in .env.local\n', 'info');
    } else {
      log('✅ GitHub token configured for cross-repo access\n', 'success');
    }

    const posts = await loadContentRegistry();

    const uniquePosts = Array.from(new Map(posts.map((p) => [p.slug, p])).values());

    log(`\nTotal posts found: ${uniquePosts.length}\n`);

    const filteredPosts = SHOW_ALL_POSTS ? uniquePosts : uniquePosts.filter((post) => post.status === 'published');

    log(`\n Total posts in published status to be rendered: ${filteredPosts.length}\n`);

    for (const post of filteredPosts) {
      await generatePostHTML(post);
    }

    const blogIndex = await generateBlogIndex(filteredPosts);

    await generateHomePageHTML({
      description: labels.description,
      posts: blogIndex?.posts || [],
      title: labels.title,
    });

    log(`\n🎉 Build complete!`);
    log(`   Success: ${fetchStats.success}/${fetchStats.total}`, 'success');
    if (fetchStats.failed > 0) {
      log(`   Failed: ${fetchStats.failed}`, 'warn');
    }
  } catch (error) {
    log(`Build failed: ${error}`, 'error');
    process.exit(1);
  }
}

if (process.argv[1] === __filename) {
  build();
}

export type { build };
