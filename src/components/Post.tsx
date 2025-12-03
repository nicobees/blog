import { useMemo } from 'react';

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
  metadata: BlogPostMetadata; // TODO: align with interface already existing
  source: 'local' | 'github';
  sourceRepo?: string;
}

interface BlogLayoutProps {
  post: BlogPost;
}

export const MARKDOWN_CONTENT_PLACEHOLDER = '__markdownContentPlaceholder__';

export default function Post({ post }: BlogLayoutProps) {
  const formattedDate = useMemo(() => {
    return new Date(post.date).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, [post.date]);

  return (
    <main className="w-full max-w-3xl lg:max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 lg:py-12">
      <article className="bg-surface border border-(--color-border) rounded-lg p-8 sm:p-12 shadow-sm">
        <header className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-4 text-text">{post.title}</h1>
          <div className="flex flex-col sm:flex-row gap-4 text-text-secondary text-sm mb-4">
            <time dateTime={post.date}>{formattedDate}</time>
            {post.metadata.author ? <span className="italic">by {post.metadata.author}</span> : null}
          </div>
          {post.description ? <p className="text-lg text-text-secondary">{post.description}</p> : null}
        </header>
        <div className="prose prose-gray max-w-none space-y-4">{MARKDOWN_CONTENT_PLACEHOLDER}</div>
        {post.metadata.tags && Array.isArray(post.metadata.tags) ? (
          <footer className="mt-8 pt-8 border-t border-gray-300 dark:border-gray-700">
            <div className="flex flex-wrap gap-2">
              {post.metadata.tags.map((tag: string) => (
                <a
                  className="inline-block bg-gray-100 dark:bg-gray-800 text-primary hover:text-white hover:bg-primary dark:hover:bg-primary px-3 py-1 rounded-full text-sm transition-colors"
                  href={`/blog/tags/${tag}`}
                  key={tag}
                >
                  {tag}
                </a>
              ))}
            </div>
          </footer>
        ) : null}
      </article>
    </main>
  );
}
