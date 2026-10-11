import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, Calendar } from 'lucide-react';
import { PUBLIC_API_BASE, publicAsset, type PublicPost } from '../lib/public-site';

/** The clinic's health library index. Light theme, like the rest of the
 * public site -- the portal's dark theme is for staff, not patients. */
export function PublicBlog() {
  const [posts, setPosts] = useState<PublicPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${PUBLIC_API_BASE}/public/posts`)
      .then((r) => r.json())
      .then((d) => setPosts(d.posts ?? []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
    document.title = 'Health Articles';
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-800">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-5 h-16 flex items-center">
          <Link to="/clinic" className="flex items-center gap-2 text-sm text-slate-600 hover:text-teal-700">
            <ArrowLeft size={16} /> Back to the clinic
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-12">
        <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">Health library</p>
        <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight text-slate-900">Articles from our doctors</h1>

        {loading && <p className="mt-8 text-slate-400">Loading…</p>}

        {!loading && posts.length === 0 && (
          <p className="mt-8 text-slate-500">No articles have been published yet.</p>
        )}

        <div className="mt-10 grid sm:grid-cols-2 gap-6">
          {posts.map((p) => (
            <Link key={p.id} to={`/blog/${p.slug}`} className="group rounded-2xl border border-slate-200 overflow-hidden hover:border-teal-300 hover:shadow-sm transition-all">
              {p.coverImagePath ? (
                <img src={publicAsset(p.coverImagePath)} alt="" className="w-full h-40 object-cover" />
              ) : (
                <div className="w-full h-40 bg-slate-50 flex items-center justify-center">
                  <FileText size={26} className="text-slate-300" aria-hidden="true" />
                </div>
              )}
              <div className="p-5">
                {p.tags && <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-700 mb-1.5">{p.tags}</p>}
                <h2 className="font-semibold text-slate-900 group-hover:text-teal-700 leading-snug">{p.title}</h2>
                {p.excerpt && <p className="mt-2 text-sm text-slate-600 leading-relaxed">{p.excerpt}</p>}
                <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                  <Calendar size={12} aria-hidden="true" />
                  {p.publishedAt ? new Date(p.publishedAt).toLocaleDateString() : ''}
                  {p.author?.name && <> · Dr. {p.author.name}</>}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
