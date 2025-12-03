import { NavigationWrapper } from './components/Navigation';
import blogIndex from './data/blog-index.json';
import { labels } from './data/constants';

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

const initialPosts = (blogIndex as BlogIndexType)?.posts;

function App({ posts = initialPosts }: { posts?: BlogIndexType['posts'] }) {
  const noPostsMessage = 'No posts available.';

  const Content = (
    <main className="flex-1 w-full max-w-3xl lg:max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 lg:py-12">
      <header className="mb-12">
        <h1 className="text-4xl text-center font-bold mb-4">{labels.title}</h1>
        <h2 className="text-2xl text-text-secondary text-center">{labels.description}</h2>
      </header>

      <section className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {!posts?.length ? (
          <p>{noPostsMessage}</p>
        ) : (
          posts.map((post) => (
            <article
              className="bg-surface border border-(--color-border) rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow"
              key={post.id}
            >
              <h2 className="text-xl font-semibold mb-2">
                <a className="hover:underline" href={`/blog/pages/${post.slug}.html`}>
                  {post.title}
                </a>
              </h2>
              <time className="block text-sm text-text-secondary mb-3" dateTime={post.date}>
                {new Date(post.date).toLocaleDateString('en-US', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </time>
              <p className="text-sm text-text-secondary mb-4">{post.description}</p>
              <a
                className="text-primary hover:text-white bg-(--color-code-bg) hover:bg-primary rounded-full px-3 py-1 text-sm font-medium transition-colors"
                href={`/blog/pages/${post.slug}.html`}
              >
                {`${labels.readMore} →`}
              </a>
            </article>
          ))
        )}
      </section>
    </main>
  );

  return <NavigationWrapper content={Content}></NavigationWrapper>;
}

export default App;
