import { useMemo } from 'react';
import Footer from './Footer';
import MarkdownRenderer from './MarkdownRenderer';
import Navigation from './Navigation';

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  description: string;
  date: string;
  content: string;
  metadata: Record<string, string>; // TODO: align with interface already existing
}

interface BlogLayoutProps {
  post: BlogPost;
}

export default function BlogLayout({ post }: BlogLayoutProps) {
  const formattedDate = useMemo(() => {
    return new Date(post.date).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, [post.date]);

  return (
    <div className="blog-layout">
      <Navigation />

      <main className="blog-main">
        <article className="blog-post">
          <header className="post-header">
            <h1 className="post-title">{post.title}</h1>
            <div className="post-meta">
              <time dateTime={post.date}>{formattedDate}</time>
              {post.metadata.author && <span className="post-author">by {post.metadata.author}</span>}
            </div>
            {post.description && <p className="post-description">{post.description}</p>}
          </header>

          <section className="post-content">
            <MarkdownRenderer content={post.content} />
          </section>

          <footer className="post-footer">
            {post.metadata.tags && Array.isArray(post.metadata.tags) && (
              <div className="post-tags">
                {post.metadata.tags.map((tag: string) => (
                  <a className="tag" href={`/blog/tags/${tag}`} key={tag}>
                    {tag}
                  </a>
                ))}
              </div>
            )}
          </footer>
        </article>
      </main>

      <Footer />
    </div>
  );
}
