import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, Camera, Copy, Globe, Mail, Server, Share2, Tag } from 'lucide-react';
import SocialSidebar from '../SocialSidebar';
import { useSocialStorage } from '../hooks/useSocialStorage';

function PageNav() {
  return (
    <nav className="winlab-public-nav">
      <a href="/" className="flex items-center gap-2">
        <div className="w-6 h-6 bg-red-600 flex items-center justify-center rounded">
          <Server className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="font-black tracking-tighter text-white italic text-lg">WINLAB</span>
      </a>
      <div className="winlab-public-nav-links">
        <a href="/blog" className="text-xs text-gray-500 hover:text-white transition-colors">Index</a>
        <a href="/" className="text-xs text-gray-500 hover:text-white transition-colors">Back</a>
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

function buildShareUrls(post) {
  if (!post || typeof window === 'undefined') return null;
  const pageUrl = window.location.href;
  const shareText = `${post.title} | WinLab`;
  const emailSubject = post.title;
  const emailBody = `${post.excerpt || post.title}\n\n${pageUrl}`;
  return {
    pageUrl,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`,
    x: `https://x.com/intent/tweet?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent(shareText)}`,
    email: `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`,
  };
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
  const [shareFeedback, setShareFeedback] = useState('');
  const shareUrls = useMemo(() => buildShareUrls(post), [post]);

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

  useEffect(() => {
    if (!shareFeedback) return undefined;
    const timer = window.setTimeout(() => setShareFeedback(''), 2200);
    return () => window.clearTimeout(timer);
  }, [shareFeedback]);

  async function handleNativeShare() {
    if (!post || !shareUrls?.pageUrl || !navigator?.share) return;
    try {
      await navigator.share({
        title: post.title,
        text: post.excerpt || post.title,
        url: shareUrls.pageUrl,
      });
    } catch {
      // User-cancelled share should stay silent.
    }
  }

  async function handleCopyLink(label = 'Link copied') {
    if (!shareUrls?.pageUrl || !navigator?.clipboard) return;
    try {
      await navigator.clipboard.writeText(shareUrls.pageUrl);
      setShareFeedback(label);
    } catch {
      setShareFeedback('Copy failed');
    }
  }

  return (
    <div className="winlab-public-page font-sans">
      <SocialSidebar links={socialLinks} />
      <PageNav />
      <div className="winlab-public-main max-w-4xl">
        {!slug && (
          <div className="winlab-public-hero">
            <p className="winlab-public-eyebrow">Editorial</p>
            <h1 className="winlab-public-title">Blog</h1>
            <p className="winlab-public-copy mb-8">
              Product notes, incident design decisions, platform updates and real operational lessons from WinLab.
            </p>
          </div>
        )}

        {slug && post && (
          <div className="mb-14">
            <a href="/blog" className="mb-4 inline-flex items-center gap-2 text-xs text-gray-500 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to all posts
            </a>
            <p className="winlab-public-eyebrow">Blog Post</p>
            <h1 className="winlab-public-title max-w-3xl">{post.title}</h1>
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
            {shareUrls && (
              <div className="mt-6 flex flex-wrap items-center gap-3">
                {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
                  <button
                    type="button"
                    onClick={handleNativeShare}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white transition-colors hover:border-red-600/40 hover:bg-red-600/10"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    Share
                  </button>
                )}
                <a
                  href={shareUrls.facebook}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white transition-colors hover:border-blue-500/40 hover:bg-blue-500/10"
                >
                  <Globe className="h-3.5 w-3.5" />
                  Facebook
                </a>
                <button
                  type="button"
                  onClick={() => handleCopyLink('Link copied for Instagram')}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white transition-colors hover:border-pink-500/40 hover:bg-pink-500/10"
                >
                  <Camera className="h-3.5 w-3.5" />
                  Instagram
                </button>
                <a
                  href={shareUrls.x}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white transition-colors hover:border-slate-200/30 hover:bg-white/10"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  X
                </a>
                <a
                  href={shareUrls.email}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white transition-colors hover:border-amber-500/40 hover:bg-amber-500/10"
                >
                  <Mail className="h-3.5 w-3.5" />
                  Email
                </a>
                <button
                  type="button"
                  onClick={() => handleCopyLink()}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/10"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy Link
                </button>
                {shareFeedback && (
                  <span className="text-xs uppercase tracking-[0.18em] text-emerald-300">
                    {shareFeedback}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {loading && (
            <div className="winlab-public-card text-sm text-gray-500">
            Loading...
          </div>
        )}

        {!loading && error && (
            <div className="winlab-public-card border-red-500/15 bg-red-500/5 text-sm text-red-300">
            {error}
          </div>
        )}

        {!loading && !error && !slug && (
          <div className="grid grid-cols-1 gap-5">
            {posts.length === 0 && (
              <div className="winlab-public-card text-sm text-gray-500">
                No published posts yet.
              </div>
            )}

            {posts.map((entry) => {
              const tags = parseTags(entry.tags);
              return (
                <a
                  key={entry.id}
                  href={`/blog/${entry.slug}`}
                  className="block rounded-[18px] border border-white/5 bg-zinc-950 p-5 hover:border-red-600/30 transition-colors sm:rounded-[32px] sm:p-8"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="max-w-2xl">
                      <h2 className="mb-3 text-xl font-black text-white tracking-tight sm:text-2xl">{entry.title}</h2>
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
          <article className="winlab-public-card md:p-10">
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
