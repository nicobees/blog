import type { ReactNode } from 'react';
import { labels } from '../data/constants';
import Footer from './Footer';
import { LogoIcon } from './LogoIcon';

function Navigation() {
  return (
    <nav className="sticky top-0 z-50 border-b border-(--color-border) bg-surface/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-3xl lg:max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center text-lg font-semibold text-text">
          <LogoIcon aria-hidden="true" className="fill-current text-primary" height={40} width={40} />
          <div className="">{labels.shortTitle}</div>
        </div>
        <ul className="flex list-none gap-6 text-sm text-text-secondary">
          <li>
            <a className="transition-colors hover:text-primary" href="/blog/">
              {labels.home}
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
    <div className="min-h-screen flex flex-col bg-bg text-text">
      <Navigation />
      {content}
      <Footer />
    </div>
  );
};
