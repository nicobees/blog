import { useEffect, useState } from 'react';
import Footer from './components/Footer';
import Navigation from './components/Navigation';
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

  return (
    <div className="app">
      <Navigation />

      <main className="main-content">
        <header className="page-header">
          <h1>My Blog</h1>
          <p className="subtitle">Thoughts on React, TypeScript, and web development</p>
        </header>

        <section className="posts-grid">
          {posts.map((post) => (
            <article className="post-card" key={post.id}>
              <h2>
                <a href={`/blog/pages/${post.slug}.html`}>{post.title}</a>
              </h2>
              <time dateTime={post.date}>
                {new Date(post.date).toLocaleDateString('en-US', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </time>
              <p className="post-summary">{post.description}</p>
              <a className="read-more" href={`/blog/pages/${post.slug}.html`}>
                Read More →
              </a>
            </article>
          ))}
        </section>
      </main>

      <Footer />
    </div>
  );
}

export default App;
