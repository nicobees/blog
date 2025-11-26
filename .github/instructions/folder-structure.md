├── .github/
│   └── workflows/
│       └── deploy.yml                    ← GitHub Actions workflow
├── content/
│   └── posts/
│       └── ssg-github-pages.md          ← Your first blog article
├── public/
│   └── pages/                           ← Generated HTML files (created by build)
├── src/
│   ├── assets/favicon.svg
│   ├── components/
│   │   ├── BlogLayout.tsx
│   │   ├── MarkdownRenderer.tsx
│   │   ├── Navigation.tsx
│   │   └── Footer.tsx
│   ├── hooks/
│   │   └── useMarkdownContent.ts
│   ├── types/
│   │   └── blog.ts
│   ├── data/
│   │   └── blog-index.json              ← Generated at build time
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── .env.local
├── .env.local.example
├── .gitignore
├── build-pages.ts                       ← Build script (critical)
├── content-registry.json                ← Content sources configuration
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── biome.json
└── README.md