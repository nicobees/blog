import type { ReactNode } from 'react';
import Footer from './Footer';
import { LogoIcon } from './LogoIcon';

function Navigation() {
  return (
    <nav className="sticky top-0 z-50 border-b border-(--color-border) bg-(--color-surface)/90 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center text-lg font-semibold text-(--color-text)">
          <LogoIcon aria-hidden="true" className="fill-current text-primary" height={40} width={40} />
          <div className="">nicoBlog</div>
        </div>
        <ul className="flex list-none gap-6 text-sm text-(--color-text-secondary)">
          <li>
            <a className="transition-colors hover:text-primary" href="/blog/">
              Home
            </a>
          </li>
          {/* <li>
            <a className="transition-colors hover:text-primary" href="#about">
              About
            </a>
          </li> */}
        </ul>
      </div>
    </nav>
  );
}

export const NavigationWrapper = ({ content }: { content: ReactNode }) => {
  return (
    <div className="min-h-screen flex flex-col bg-(--color-bg) text-(--color-text)">
      <Navigation />
      {content}
      <Footer />
    </div>
  );
};
