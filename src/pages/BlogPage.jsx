import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, Server, Tag } from 'lucide-react';
import SocialSidebar from '../SocialSidebar';
import { useSocialStorage } from '../hooks/useSocialStorage';

function PageNav() {
  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b border-white/5">
      <a href="/" className="flex items-center gap-2">
        <div className="w-6 h-6 bg-red-600 flex items-center justify-center rounded">
          <Server className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="font-black tracking-tighter text-white italic text-lg">WINLAB</span>
      </a>
      <div className="flex items-center gap-4">
        <a href="/blog" className="text-xs text-gray-500 hover:text-white transition-colors">Blog Index</a>
        <a href="/" className="text-xs text-gray-500 hover:text-white transition-colors">Back to Dashboard</a>
      </div>
    </nav>
  );
}

function parseTags(rawTags) {
  if (Array.isArray(rawTags)) return rawTags;
  if (typeof rawTags !== 'string' || !rawTags.trim()) return [];
  try {
    const parsed = JSON.parse(rawTags);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return rawTags.split(',').map((tag) => tag.trim()).filter(Boolean);
  }
}

function renderContent(content) {
  return String(content || '')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

export default function BlogPage() {
  const [socialLinks] = useSocialStorage();
  const path = window.location.pathname;
  const slug = useMemo(() => {
    const parts = path.split('/').filter(Boolean);
    return parts[0] === 'blog' && parts[1] ? decodeURIComponent(parts.slice(1).join('/')) : null;
  }, [path]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [posts, setPosts] = useState([]);
  const [post, setPost] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const endpoint = slug ? `/api/blog/${slug}` : '/api/blog/all';
        const res = await fetch(endpoint, { credentials: 'include' });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data) {
          if (!cancelled) setError(slug ? 'Post not found.' : 'Unable to load blog posts.');
          return;
        }
        if (!cancelled) {
          if (slug) {
            setPost(data);
            setPosts([]);
          } else {
            setPosts(Array.isArray(data) ? data : []);
            setPost(null);
          }
        }
      } catch {
        if (!cancelled) setError('Network error while loading the blog.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [slug]);

  return (
    <div className="min-h-screen bg-[#050505] text-gray-300 font-sans">
      <SocialSidebar links={socialLinks} />
      <PageNav />
      <div className="max-w-4xl mx-auto px-6 py-20">
        {!slug && (
          <>
            <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-4">Editorial</p>
            <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter mb-4">Blog</h1>
            <p className="text-gray-500 mb-16 max-w-2xl leading-relaxed">
              Product notes, incident design decisions, platform updates and real operational lessons from WinLab.
            </p>
          </>
        )}

        {slug && post && (
          <div className="mb-14">
            <a href="/blog" className="inline-flex items-center gap-2 text-xs text-gray-500 hover:text-white transition-colors mb-6">
              <ArrowLeft className="w-4 h-4" />
              Back to all posts
            </a>
            <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-4">Blog Post</p>
            <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter mb-4">{post.title}</h1>
            <div className="flex flex-wrap gap-4 text-xs text-gray-500">
              <span className="inline-flex items-center gap-2">
                <CalendarDays className="w-4 h-4" />
                {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : 'Draft'}
              </span>
              {parseTags(post.tags).length > 0 && (
                <span className="inline-flex items-center gap-2">
                  <Tag className="w-4 h-4" />
                  {parseTags(post.tags).join(' · ')}
                </span>
              )}
            </div>
          </div>
        )}

        {loading && (
          <div className="rounded-3xl border border-white/5 bg-zinc-950 p-8 text-sm text-gray-500">
            Loading...
          </div>
        )}

        {!loading && error && (
          <div className="rounded-3xl border border-red-500/15 bg-red-500/5 p-8 text-sm text-red-300">
            {error}
          </div>
        )}

        {!loading && !error && !slug && (
          <div className="grid grid-cols-1 gap-5">
            {posts.length === 0 && (
              <div className="rounded-3xl border border-white/5 bg-zinc-950 p-8 text-sm text-gray-500">
                No published posts yet.
              </div>
            )}

            {posts.map((entry) => {
              const tags = parseTags(entry.tags);
              return (
                <a
                  key={entry.id}
                  href={`/blog/${entry.slug}`}
                  className="block rounded-[32px] border border-white/5 bg-zinc-950 p-8 hover:border-red-600/30 transition-colors"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="max-w-2xl">
                      <h2 className="text-2xl font-black text-white uppercase italic tracking-tight mb-3">{entry.title}</h2>
                      <p className="text-sm text-gray-500 leading-relaxed mb-4">
                        {entry.excerpt || 'Read the full WinLab update.'}
                      </p>
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {tags.map((tag) => (
                            <span key={tag} className="px-3 py-1 rounded-full bg-white/5 text-[10px] font-black uppercase tracking-widest text-gray-500">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-left md:text-right shrink-0">
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-600 mb-2">Published</p>
                      <p className="text-sm text-white">
                        {entry.publishedAt ? new Date(entry.publishedAt).toLocaleDateString() : 'Draft'}
                      </p>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}

        {!loading && !error && slug && post && (
          <article className="rounded-[32px] border border-white/5 bg-zinc-950 p-8 md:p-10">
            {post.excerpt && (
              <p className="text-lg text-gray-300 leading-relaxed mb-8">
                {post.excerpt}
              </p>
            )}
            <div className="space-y-5">
              {renderContent(post.content).map((paragraph, index) => (
                <p key={index} className="text-sm text-gray-400 leading-7 whitespace-pre-wrap">
                  {paragraph}
                </p>
              ))}
            </div>
          </article>
        )}
      </div>
    </div>
  );
}
