export interface BlogPostMetadata {
  id: string;
  slug: string;
  title: string;
  description: string;
  date: string;
  author?: string;
  tags?: string[];
}

export interface BlogPost extends BlogPostMetadata {
  content: string;
  metadata: Record<string, string>; // TODO: align with interface already existing
  source: 'local' | 'github';
  sourceRepo?: string;
}

export interface BlogIndex {
  posts: BlogPostMetadata[];
  lastUpdated: string;
}
