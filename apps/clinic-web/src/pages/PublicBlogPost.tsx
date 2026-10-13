import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar } from 'lucide-react';
import { publicApiBase, publicAsset, type PublicPost } from '../lib/public-site';
import { applySeo } from '../lib/seo';

export function PublicBlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<PublicPost | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    fetch(`${publicApiBase()}/public/posts/${encodeURIComponent(slug)}`)
      .then((r) => { if (!r.ok) throw new Error('not found'); return r.json(); })
      .then(setPost)
      .catch(() => setNotFound(true));
  }, [slug]);

  /**
   * An article is the one thing on a clinic's site worth sharing, so it
   * gets its own card rather than inheriting the clinic's.
   *
   * Marked up as an Article, not a MedicalWebPage: these are general
   * health information written by the clinic, and every one of them
   * already carries a notice saying it is not a diagnosis. Claiming more
   * than that in the markup would be claiming more than the page does.
   */
  useEffect(() => {
    if (!post) return;
    const image = post.coverImagePath ? publicAsset(post.coverImagePath) : null;
    const description = (post.excerpt?.trim() || post.content?.replace(/\s+/g, ' ').trim() || '').slice(0, 300);
    applySeo({
      title: post.title,
      description: description || post.title,
      imageUrl: image,
      canonical: window.location.origin + window.location.pathname,
      type: 'article',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: post.title,
        ...(description ? { description } : {}),
        ...(image ? { image } : {}),
        ...(post.publishedAt ? { datePublished: post.publishedAt } : {}),
        ...(post.author?.name ? { author: { '@type': 'Person', name: `Dr. ${post.author.name}` } } : {}),
      },
    });
  }, [post]);

  if (notFound) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-slate-600">That article isn't available.</p>
        <Link to="/blog" className="text-teal-700 hover:underline text-sm">Back to all articles</Link>
      </div>
    );
  }
  if (!post) return <div className="min-h-screen bg-white flex items-center justify-center text-slate-400">Loading…</div>;

  return (
    <div className="min-h-screen bg-white text-slate-800">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-5 h-16 flex items-center">
          <Link to="/blog" className="flex items-center gap-2 text-sm text-slate-600 hover:text-teal-700">
            <ArrowLeft size={16} /> All articles
          </Link>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-5 py-12">
        {post.tags && <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">{post.tags}</p>}
        <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight text-slate-900 leading-tight">{post.title}</h1>

        <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
          <span className="flex items-center gap-1.5">
            <Calendar size={13} aria-hidden="true" />
            {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
          </span>
          {post.author?.name && (
            <span>
              Dr. {post.author.name}
              {post.author.qualifications && <span className="text-slate-400"> · {post.author.qualifications}</span>}
            </span>
          )}
        </p>

        {post.coverImagePath && (
          <img src={publicAsset(post.coverImagePath)} alt="" className="mt-8 w-full rounded-2xl object-cover max-h-80" />
        )}

        {post.excerpt && <p className="mt-8 text-lg text-slate-600 leading-relaxed">{post.excerpt}</p>}

        {/* Rendered as plain paragraphs, deliberately. The editor is a plain
            textarea and the content is stored as text -- injecting it as HTML
            would make a stored-XSS hole out of a blog post. */}
        <div className="mt-6 flex flex-col gap-5">
          {(post.content ?? '').split(/\n\s*\n/).map((para, i) => (
            <p key={i} className="text-slate-700 leading-relaxed whitespace-pre-line">{para}</p>
          ))}
        </div>

        {/* Health content written by a clinic needs this. Someone will read
            an article about their symptoms and decide not to come in. */}
        <p className="mt-12 p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-600 leading-relaxed">
          This article is general health information, not a diagnosis or a treatment plan. Please see a doctor about
          your own symptoms before acting on anything you read here.
        </p>
      </article>
    </div>
  );
}
