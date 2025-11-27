import hljs from 'highlight.js';
import type { Tokens } from 'marked';
import { escapeHtml, log } from './utils';

export const customRenderer = {
  // Blockquotes
  blockquote(token: Tokens.Blockquote) {
    const text = this.parser.parse(token.tokens);
    return `<blockquote class="border-l-4 border-blue-600 dark:border-blue-400 pl-6 my-6 text-gray-600 dark:text-gray-400 italic">${text}</blockquote>`;
  },

  // Breaks
  br() {
    return '<br class="my-2">';
  },

  // Code blocks with syntax highlighting
  code(token: Tokens.Code) {
    const lang = token.lang || 'plaintext';
    let code = token.text;

    if (lang && hljs.getLanguage(lang)) {
      try {
        code = hljs.highlight(code, { ignoreIllegals: true, language: lang }).value;
      } catch (error) {
        log(`Error highlighting ${lang}: ${error}`, 'warn');
        code = hljs.highlight(code, { language: 'plaintext' }).value;
      }
    } else {
      code = hljs.highlight(code, { language: 'plaintext' }).value;
    }

    return `<pre class="bg-gray-100 dark:bg-gray-900 rounded-lg p-6 overflow-x-auto mb-6 border border-gray-300 dark:border-gray-700"><code class="hljs language-${lang}">${code}</code></pre>`;
  },

  // Inline code
  codespan(token: Tokens.Codespan) {
    return `<code class="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-1.5 py-0.5 rounded text-sm font-mono">${escapeHtml(token.text)}</code>`;
  },

  // Delete (strikethrough)
  del(token: Tokens.Del) {
    const text = this.parser.parseInline(token.tokens);
    return `<del class="line-through text-gray-500 dark:text-gray-400">${text}</del>`;
  },

  // Text styling - emphasis
  em(token: Tokens.Em) {
    const text = this.parser.parseInline(token.tokens);
    return `<em class="italic">${text}</em>`;
  },
  // Headings
  heading(token: Tokens.Heading) {
    const level = token.depth;
    const text = this.parser.parseInline(token.tokens);

    const headingClasses = {
      1: 'text-4xl font-bold mb-6 mt-8 first:mt-0',
      2: 'text-3xl font-bold mb-4 mt-8 border-b-2 border-gray-300 dark:border-gray-600 pb-2',
      3: 'text-2xl font-semibold mb-4 mt-6',
      4: 'text-xl font-semibold mb-3 mt-4',
      5: 'text-lg font-semibold mb-3 mt-3',
      6: 'text-base font-semibold mb-3 mt-3',
    };

    const classes = headingClasses[level] || headingClasses;
    return `<h${level} class="${classes}">${text}</h${level}>`;
  },

  // Horizontal rule
  hr() {
    return '<hr class="my-8 border-t-2 border-gray-300 dark:border-gray-700">';
  },

  // Images
  image(token: Tokens.Image) {
    return `<img src="${token.href}" alt="${escapeHtml(token.text)}" class="max-w-full h-auto rounded-lg my-6">`;
  },

  // Links
  link(token: Tokens.Link) {
    const text = this.parser.parseInline(token.tokens);
    const href = token.href;
    const isExternal = href.startsWith('http');
    const target = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a href="${href}" class="text-blue-600 dark:text-blue-400 hover:underline"${target}>${text}</a>`;
  },

  // Lists (unordered)
  list(token: Tokens.List) {
    let body = '';
    for (const item of token.items) {
      body += this.listitem(item);
    }
    const type = token.ordered ? 'ol' : 'ul';
    const classes = token.ordered
      ? 'list-decimal list-inside ml-4 mb-4 space-y-2'
      : 'list-disc list-inside ml-4 mb-4 space-y-2';
    return `<${type} class="${classes}">${body}</${type}>`;
  },

  // List items
  listitem(token: Tokens.ListItem) {
    const text = this.parser.parse(token.tokens, false);
    return `<li class="leading-7">${text}</li>`;
  },

  // Paragraphs
  paragraph(token: Tokens.Paragraph) {
    const text = this.parser.parseInline(token.tokens);
    return `<p class="mb-4 leading-7">${text}</p>`;
  },

  // Text styling - strong
  strong(token: Tokens.Strong) {
    const text = this.parser.parseInline(token.tokens);
    return `<strong class="font-bold">${text}</strong>`;
  },

  // Tables
  table(token: Tokens.Table) {
    const header = this.tablerow({ text: token.header });
    const body = this.parser.parse(token.rows);
    return `<table class="w-full border-collapse mb-6 border border-gray-300 dark:border-gray-700">
      <thead class="bg-gray-100 dark:bg-gray-800">${header}</thead>
      <tbody>${body}</tbody>
    </table>`;
  },

  // Table cells
  tablecell(token: Tokens.TableCell) {
    const type = token.header ? 'th' : 'td';
    const align = token.align ? ` text-${token.align}` : '';
    const classes = token.header
      ? `px-4 py-2 text-left font-semibold border-b border-gray-300 dark:border-gray-700${align}`
      : `px-4 py-2 border-b border-gray-300 dark:border-gray-700${align}`;
    const text = this.parser.parseInline(token.tokens);
    return `<${type} class="${classes}">${text}</${type}>`;
  },

  // Table rows
  tablerow(token: Tokens.TableRow) {
    let body = '';
    for (const cell of token.text) {
      body += this.tablecell(cell);
    }
    return `<tr>${body}</tr>`;
  },

  // Text (plain)
  text(token: Tokens.Text) {
    return token.text;
  },
};
