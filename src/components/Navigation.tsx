export default function Navigation() {
  return (
    <nav className="navigation">
      <div className="nav-container">
        <a className="nav-brand" href="/blog/">
          📝 My Blog
        </a>
        <ul className="nav-links">
          <li>
            <a href="/blog/">Home</a>
          </li>
          <li>
            <a href="#about">About</a>
          </li>
        </ul>
      </div>
    </nav>
  );
}
