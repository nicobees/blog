export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-content">
        <p>&copy; {currentYear} My Blog. All rights reserved.</p>
        <p>
          Built with React, Vite, and{' '}
          <a href="https://pages.github.com/" rel="noopener noreferrer" target="_blank">
            GitHub Pages
          </a>
        </p>
      </div>
    </footer>
  );
}
