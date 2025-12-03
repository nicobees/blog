export default function Footer() {
  const currentYear = new Date().getFullYear();
  const footerMessage = `Built with React, Vite, and `;

  return (
    <footer className="border-t border-(--color-border) bg-surface py-8 text-sm text-text-secondary">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <p>&copy; {currentYear} My Blog. All rights reserved.</p>
        <p className="mt-1">
          {footerMessage}
          <a
            className="font-medium text-primary hover:underline"
            href="https://pages.github.com/"
            rel="noopener noreferrer"
            target="_blank"
          >
            GitHub Pages
          </a>
        </p>
      </div>
    </footer>
  );
}
