import { useEffect, useState } from 'react';
import { NavigationWrapper } from './components/Navigation';
import blogIndex from './data/blog-index.json';

interface BlogIndexType {
  posts: Array<{
    id: string;
    slug: string;
    title: string;
    description: string;
    date: string;
  }>;
  lastUpdated: string;
}

function App() {
  const [posts, setPosts] = useState<BlogIndexType['posts']>([]);

  useEffect(() => {
    setPosts((blogIndex as BlogIndexType).posts);
  }, []);

  const Content = (
    <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-10">
      <header className="mb-12">
        <h1 className="text-4xl font-bold mb-4">My Blog</h1>
        <p className="text-lg text-(--color-text-secondary)">Thoughts on React, TypeScript, and web development</p>
      </header>

      <section className="grid gap-8 md:grid-cols-2">
        {posts.map((post) => (
          <article
            className="bg-(--color-surface) border border-(--color-border) rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow"
            key={post.id}
          >
            <h2 className="text-xl font-semibold mb-2">
              <a className="text-(--color-text) hover:underline" href={`/blog/pages/${post.slug}.html`}>
                {post.title}
              </a>
            </h2>
            <time className="block text-sm text-(--color-text-secondary) mb-3" dateTime={post.date}>
              {new Date(post.date).toLocaleDateString('en-US', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </time>
            <p className="text-sm text-(--color-text-secondary) mb-4">{post.description}</p>
            <a
              className="text-primary hover:text-white bg-(--color-code-bg) hover:bg-primary rounded-full px-3 py-1 text-sm font-medium transition-colors"
              href={`/blog/pages/${post.slug}.html`}
            >
              Read More →
            </a>
          </article>
        ))}
      </section>
    </main>
  );

  return <NavigationWrapper content={Content}></NavigationWrapper>;
}

export default App;
