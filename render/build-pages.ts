import { execSync } from 'node:child_process';
import path from 'node:path';
import { Octokit } from '@octokit/rest';
import fs from 'fs-extra';
import matter from 'gray-matter';
import { marked } from 'marked';
import { minimatch } from 'minimatch';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { NavigationWrapper } from '../src/components/Navigation';
import Post, { MARKDOWN_CONTENT_PLACEHOLDER } from '../src/components/Post';
import { customRenderer } from './customRenderer';
import { escapeHtml, log } from './utils';

const __dirname = import.meta.dirname;
const __filename = import.meta.filename;

// ============================================================================
// Type Definitions
// ============================================================================

interface BlogPostMetadata {
  author: string;
  tags: string[];
}

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
const OUTPUT_DIR = path.resolve(PROJECT_ROOT, 'public/pages');
const INDEX_OUTPUT = path.resolve(PROJECT_ROOT, 'src/data/blog-index.json');
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
    // Create a temporary file with the HTML content for Tailwind to scan
    const tempFile = path.join(__dirname, '.temp-tailwind.html');
    fs.writeFileSync(tempFile, htmlContent, 'utf-8');

    // Generate CSS using Tailwind CLI
    const css = execSync(`npx tailwindcss -i ./src/styles/tailwind-input.css -o /dev/stdout --content ${tempFile}`, {
      encoding: 'utf-8',
    });

    // Clean up temp file
    fs.removeSync(tempFile);

    return css;
  } catch (error) {
    log(`Error generating Tailwind CSS: ${error}`, 'error');
    console.error(error);
    return '';
  }
}

// ============================================================================
// Markdown Rendering
// ============================================================================

// Configure marked to use highlight.js via the plugin
// marked.use(
//   markedHighlight({
//     highlight(code, lang) {
//       if (lang && hljs.getLanguage(lang)) {
//         try {
//           // Note: In modern highlight.js, the property is .value, not .html
//           return hljs.highlight(code, { ignoreIllegals: true, language: lang }).value;
//         } catch (error) {
//           log(`Error highlighting ${lang}: ${error}`, 'warn');
//         }
//       }
//       // Fallback to no highlighting
//       return hljs.highlight(code, { language: 'plaintext' }).value;
//     },
//     langPrefix: 'hljs language-',
//   }),
// );

// Set other options separately
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

async function renderMarkdownToHtml(markdown: string): Promise<string> {
  try {
    const html = await marked.parse(markdown);
    return html;
  } catch (error) {
    log(`Error rendering markdown: ${error}`, 'error');
    return '<p>Error rendering content</p>';
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
    if (error.status === 404) {
      log(`File not found: ${owner}/${repo}/${filePath}`, 'warn');
    } else {
      log(`Error fetching ${owner}/${repo}/${filePath}: ${error.message}`, 'error');
    }
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
    log(`Error listing directory ${owner}/${repo}/${dirPath}: ${error.message}`, 'error');
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
  const markdownContent = await renderMarkdownToHtml(post.content);

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

  fs.ensureDirSync(OUTPUT_DIR);
  const outputPath = path.join(OUTPUT_DIR, `${post.slug}.html`);
  fs.writeFileSync(outputPath, htmlWithTailwind, 'utf-8');
  log(`Generated: ${post.slug}${sourceDisplay}`);
}

// ============================================================================
// Blog Index Generation
// ============================================================================

async function generateBlogIndex(posts: BlogPost[]): Promise<void> {
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
}

// ============================================================================
// Main Build Process
// ============================================================================

async function build(): Promise<void> {
  console.info('inside build');
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

    for (const post of uniquePosts) {
      await generatePostHTML(post);
    }

    await generateBlogIndex(uniquePosts);

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
  console.info('running build');
  build();
}

export { build };
