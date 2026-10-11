import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Stethoscope, MapPin, Phone, Mail, Clock, CheckCircle2, Radio, ArrowRight,
  ShieldCheck, CalendarCheck, Menu, X, ChevronDown, Navigation, AlertCircle,
  Star, FileText, Send, Languages,
} from 'lucide-react';
import {
  PUBLIC_API_BASE, publicAsset, palette,
  type Palette, type PublicPost, type PublicFeedback, type GalleryItem,
} from '../lib/public-site';
import { publicSiteUrl } from '../lib/site-mode';
import { strings, localeMeta, LOCALES, type StringKey } from '../lib/ui-strings';

const LOCALE_STORAGE_KEY = 'clinicPublicLocale';

/** A visitor's own choice wins; otherwise the clinic's configured default
 * is adopted once the page loads. */
function readPreferredLocale(): string {
  try {
    const url = new URLSearchParams(window.location.search).get('lang');
    if (url) return url;
    return localStorage.getItem(LOCALE_STORAGE_KEY) ?? 'en';
  } catch {
    return 'en';
  }
}

function hasStoredLocale(): boolean {
  try {
    return Boolean(localStorage.getItem(LOCALE_STORAGE_KEY) || new URLSearchParams(window.location.search).get('lang'));
  } catch {
    return false;
  }
}

/**
 * The clinic's public website.
 *
 * Two things shape this file:
 *
 * 1. **The clinic controls the layout.** Sections render in the order and
 *    with the visibility the admin set in Settings → Website. Unknown keys
 *    from a hand-edited config are ignored rather than trusted.
 * 2. **Only authentic content.** Every word comes from something the
 *    clinic entered. No placeholder copy, no invented statistics, no stock
 *    photography -- a section with nothing in it doesn't render, rather
 *    than showing something untrue about a real medical practice.
 *
 * Always light-themed regardless of the staff portal's theme: this is read
 * once by a patient deciding whether to visit, not stared at all day.
 */

type SectionKey = 'about' | 'services' | 'highlights' | 'doctors' | 'gallery' | 'blog' | 'feedback' | 'queue' | 'faq' | 'contact';

interface Timing { day: string; opensAt?: string; closesAt?: string; closed?: boolean }
interface Highlight { title: string; description?: string }
interface Faq { question: string; answer: string }
interface Clinic {
  name: string; address: string | null; phone: string | null; email: string | null;
  about: string | null; timings: Timing[] | null; services: string[] | null;
  logoPath: string | null; registrationNumber: string | null;
  tagline: string | null; establishedYear: number | null;
  highlights: Highlight[] | null; faqs: Faq[] | null;
  emergencyPhone: string | null; mapUrl: string | null;
  publicSections: { key: SectionKey; enabled: boolean }[] | null;
  publicTheme: string | null; heroImagePath: string | null; mapEmbedUrl: string | null;
}
interface Doctor {
  id: string; name: string; qualifications: string | null; specialization: string | null;
  bio: string | null; photoPath: string | null; experienceYears: number | null; languages: string | null;
}

const DEFAULT_ORDER: SectionKey[] = ['about', 'services', 'highlights', 'doctors', 'gallery', 'blog', 'feedback', 'queue', 'faq', 'contact'];

export function PublicClinic() {
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [posts, setPosts] = useState<PublicPost[]>([]);
  const [feedback, setFeedback] = useState<PublicFeedback[]>([]);
  const [availableLocales, setAvailableLocales] = useState<string[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [locale, setLocale] = useState<string>(() => readPreferredLocale());

  useEffect(() => {
    fetch(`${PUBLIC_API_BASE}/public/clinic?lang=${encodeURIComponent(locale)}`)
      .then((res) => { if (!res.ok) throw new Error('not configured'); return res.json(); })
      .then((data) => {
        setClinic(data.clinic);
        setDoctors(data.doctors ?? []);
        setGallery(data.gallery ?? []);
        setPosts(data.posts ?? []);
        setFeedback(data.feedback ?? []);
        setAvailableLocales(data.availableLocales ?? []);
        // First visit with no stored choice: adopt the clinic's own default
        // rather than forcing English on a neighbourhood that doesn't read it.
        if (!hasStoredLocale() && data.locale && data.locale !== locale) setLocale(data.locale);
      })
      .catch(() => setNotFound(true));
  }, [locale]);

  const t = strings(locale);
  const meta = localeMeta(locale);

  // Screen readers and hyphenation need the real language; Urdu also needs
  // the whole page flipped to right-to-left.
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = meta.rtl ? 'rtl' : 'ltr';
    return () => { document.documentElement.dir = 'ltr'; };
  }, [locale, meta.rtl]);

  /**
   * Live preview from the Website builder.
   *
   * The builder renders this page in a same-origin iframe and posts its
   * unsaved section order, theme and hero into it. Applying the message
   * here means the preview is the real page with pending settings, not a
   * separate rendering that could disagree with it.
   *
   * The origin check is not optional: without it any page that framed this
   * one could rewrite what a patient sees.
   */
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; config?: Partial<Clinic> } | null;
      if (!data || data.type !== 'clinic-preview' || !data.config) return;
      setClinic((current) => (current ? { ...current, ...data.config } : current));
    };
    window.addEventListener('message', onMessage);
    // Tells the builder this frame is ready, so a config posted before the
    // fetch resolved is not silently dropped.
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'clinic-preview-ready' }, window.location.origin);
    }
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const changeLocale = (next: string) => {
    try { localStorage.setItem(LOCALE_STORAGE_KEY, next); } catch { /* private mode */ }
    setLocale(next);
  };

  useEffect(() => { if (clinic?.name) document.title = clinic.name; }, [clinic?.name]);

  if (notFound) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-600 flex items-center justify-center p-8 text-center">
        {strings(readPreferredLocale())('notPublished')}
      </div>
    );
  }
  if (!clinic) return <div className="min-h-screen bg-slate-50 text-slate-400 flex items-center justify-center">{strings(readPreferredLocale())('loading')}</div>;

  const p = palette(clinic.publicTheme);
  const services = clinic.services ?? [];
  const highlights = clinic.highlights ?? [];
  const faqs = clinic.faqs ?? [];
  const timings = clinic.timings ?? [];
  const status = openStatus(timings);
  const yearsServing = clinic.establishedYear ? new Date().getFullYear() - clinic.establishedYear : null;
  const hasContact = Boolean(clinic.address || clinic.phone || clinic.email);

  /** A section renders only if the clinic enabled it AND it has content.
   * Both conditions matter: an enabled-but-empty section would otherwise
   * print a heading over nothing. */
  const hasContent: Record<SectionKey, boolean> = {
    about: Boolean(clinic.about),
    services: services.length > 0,
    highlights: highlights.length > 0,
    doctors: doctors.length > 0,
    gallery: gallery.length > 0,
    blog: posts.length > 0,
    feedback: true, // the submission form is always worth showing
    queue: true,
    faq: faqs.length > 0,
    contact: hasContact,
  };

  const order = resolveOrder(clinic.publicSections);
  const visible = order.filter((k) => hasContent[k]);

  const navItems = visible
    .filter((k) => k !== 'about' && k !== 'queue')
    .map((k) => ({ id: k, label: t(NAV_KEYS[k]) }));

  return (
    <div className="min-h-screen bg-white text-slate-800 antialiased">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between gap-4">
          <a href="#top" className="flex items-center gap-2.5 min-w-0">
            {clinic.logoPath ? (
              <img src={publicAsset(clinic.logoPath)} alt={`${clinic.name} logo`} className="h-9 w-9 rounded-lg object-cover" />
            ) : (
              <span className={`h-9 w-9 rounded-lg ${p.solid} flex items-center justify-center shrink-0`}>
                <Stethoscope size={18} className="text-white" aria-hidden="true" />
              </span>
            )}
            <span className="font-semibold text-slate-900 truncate">{clinic.name}</span>
          </a>

          <nav className="hidden md:flex items-center gap-1" aria-label="Sections">
            {navItems.map((s) => (
              <a key={s.id} href={`#${s.id}`} className={`px-3 py-2 text-sm text-slate-600 ${p.ring.replace('text-', 'hover:text-')} rounded-lg hover:bg-slate-50`}>
                {s.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <LanguageSwitcher current={locale} available={availableLocales} onChange={changeLocale} label={t('language')} />
            {clinic.phone && (
              <a href={`tel:${clinic.phone}`} className={`hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-lg ${p.solid} ${p.solidHover} text-white text-sm font-medium transition-colors`}>
                <Phone size={14} aria-hidden="true" /> {t('callClinic')}
              </a>
            )}
            <button onClick={() => setMenuOpen((v) => !v)} className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen}>
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="md:hidden border-t border-slate-200 bg-white px-5 py-3 flex flex-col" aria-label="Sections">
            {navItems.map((s) => (
              <a key={s.id} href={`#${s.id}`} onClick={() => setMenuOpen(false)} className="py-2.5 text-sm text-slate-700">{s.label}</a>
            ))}
            {clinic.phone && (
              <a href={`tel:${clinic.phone}`} className={`mt-2 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg ${p.solid} text-white text-sm font-medium`}>
                <Phone size={14} aria-hidden="true" /> {t('callClinic')}
              </a>
            )}
          </nav>
        )}
      </header>

      <main id="top">
        <Hero clinic={clinic} p={p} status={status} timings={timings} doctors={doctors} yearsServing={yearsServing} t={t} />

        {visible.map((key) => {
          switch (key) {
            case 'about':
              return (
                <Section key={key}>
                  <div className="max-w-3xl">
                    <Label p={p}>{t('about')}</Label>
                    <p className="mt-4 text-lg text-slate-700 leading-relaxed whitespace-pre-line">{clinic.about}</p>
                  </div>
                </Section>
              );

            case 'services':
              return (
                <Section key={key} id="services" tinted>
                  <Label p={p}>{t('services')}</Label>
                  <Title>{t('whatWeTreat')}</Title>
                  <ul className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {services.map((s, i) => (
                      <li key={i} className={`flex items-start gap-3 bg-white rounded-xl border border-slate-200 p-4 ${p.border} hover:shadow-sm transition-all`}>
                        <span className={`h-8 w-8 rounded-lg ${p.soft} flex items-center justify-center shrink-0`}>
                          <CheckCircle2 size={16} className={p.ring} aria-hidden="true" />
                        </span>
                        <span className="text-slate-800 font-medium pt-1.5">{s}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              );

            case 'highlights':
              // id must match the section key -- the nav builds its anchors
              // from the key, so any other id would be a dead link.
              return (
                <Section key={key} id="highlights">
                  <Label p={p}>{t('whyUs')}</Label>
                  <Title>{t('whatMakesUsDifferent')}</Title>
                  <div className="mt-8 grid md:grid-cols-2 gap-5">
                    {highlights.map((h, i) => (
                      <div key={i} className="flex gap-4 p-5 rounded-2xl border border-slate-200 bg-white">
                        <span className={`h-10 w-10 rounded-xl ${p.solid} text-white flex items-center justify-center font-bold shrink-0`} aria-hidden="true">{i + 1}</span>
                        <div>
                          <h3 className="font-semibold text-slate-900">{h.title}</h3>
                          {h.description && <p className="mt-1.5 text-slate-600 leading-relaxed">{h.description}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              );

            case 'doctors':
              return (
                <Section key={key} id="doctors" tinted>
                  <Label p={p}>{t('ourTeam')}</Label>
                  <Title>{doctors.length === 1 ? t('meetDoctor') : t('meetDoctors')}</Title>
                  <div className="mt-8 grid md:grid-cols-2 gap-5">
                    {doctors.map((d) => (
                      <article key={d.id} className="bg-white rounded-2xl border border-slate-200 p-6 flex gap-5">
                        {d.photoPath ? (
                          <img src={publicAsset(d.photoPath)} alt={`Dr. ${d.name}`} className="h-20 w-20 rounded-2xl object-cover shrink-0" />
                        ) : (
                          <span className={`h-20 w-20 rounded-2xl ${p.soft} flex items-center justify-center shrink-0`} aria-hidden="true">
                            <Stethoscope size={26} className={p.ring} />
                          </span>
                        )}
                        <div className="min-w-0">
                          <h3 className="font-semibold text-lg text-slate-900">Dr. {d.name}</h3>
                          {d.qualifications && <p className={`text-sm font-medium ${p.ring} mt-0.5`}>{d.qualifications}</p>}
                          {d.specialization && <p className="text-sm text-slate-600 mt-0.5">{d.specialization}</p>}
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5 text-xs text-slate-500">
                            {d.experienceYears != null && d.experienceYears > 0 && <span>{d.experienceYears}+ years experience</span>}
                            {d.languages && <span>Speaks {d.languages}</span>}
                          </div>
                          {d.bio && <p className="mt-3 text-sm text-slate-600 leading-relaxed">{d.bio}</p>}
                        </div>
                      </article>
                    ))}
                  </div>
                </Section>
              );

            case 'gallery':
              return (
                <Section key={key} id="gallery">
                  <Label p={p}>{t('ourClinic')}</Label>
                  <Title>{t('lookInside')}</Title>
                  <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {gallery.map((g) => (
                      <figure key={g.id} className="rounded-2xl overflow-hidden border border-slate-200 bg-white">
                        <img src={publicAsset(g.storagePath)} alt={g.caption ?? ''} className="w-full h-52 object-cover" loading="lazy" />
                        {g.caption && <figcaption className="px-4 py-3 text-sm text-slate-600">{g.caption}</figcaption>}
                      </figure>
                    ))}
                  </div>
                </Section>
              );

            case 'blog':
              return (
                <Section key={key} id="blog" tinted>
                  <div className="flex items-end justify-between gap-4 flex-wrap">
                    <div>
                      <Label p={p}>{t('healthLibrary')}</Label>
                      <Title>{t('articlesFromDoctors')}</Title>
                    </div>
                    <Link to="/blog" className={`inline-flex items-center gap-1.5 text-sm font-medium ${p.ring} hover:underline`}>
                      {t('allArticles')} <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                  </div>
                  <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {posts.slice(0, 3).map((post) => (
                      <Link key={post.id} to={`/blog/${post.slug}`} className={`group bg-white rounded-2xl border border-slate-200 overflow-hidden ${p.border} hover:shadow-sm transition-all`}>
                        {post.coverImagePath ? (
                          <img src={publicAsset(post.coverImagePath)} alt="" className="w-full h-36 object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full h-36 bg-slate-50 flex items-center justify-center">
                            <FileText size={22} className="text-slate-300" aria-hidden="true" />
                          </div>
                        )}
                        <div className="p-5">
                          {post.tags && <p className={`text-[11px] font-semibold uppercase tracking-wide ${p.ring} mb-1.5`}>{post.tags}</p>}
                          <h3 className="font-semibold text-slate-900 leading-snug">{post.title}</h3>
                          {post.excerpt && <p className="mt-2 text-sm text-slate-600 leading-relaxed line-clamp-3">{post.excerpt}</p>}
                        </div>
                      </Link>
                    ))}
                  </div>
                </Section>
              );

            case 'feedback':
              return <FeedbackSection key={key} p={p} published={feedback} />;

            case 'queue':
              return (
                <Section key={key}>
                  <a href={publicSiteUrl('/live-queue')} className="group flex flex-col sm:flex-row sm:items-center justify-between gap-5 p-7 rounded-2xl bg-slate-900 text-white hover:bg-slate-800 transition-colors">
                    <div className="flex items-start gap-4">
                      <span className="h-11 w-11 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                        <Radio size={20} className="text-white" aria-hidden="true" />
                      </span>
                      <div>
                        <h2 className="font-semibold text-lg">{t('knowBeforeYouGo')}</h2>
                        <p className="text-slate-300 mt-1 leading-relaxed">
                          See how many patients are ahead of you in today's queue, live — so you can wait at home instead of the waiting room.
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-white font-medium shrink-0 group-hover:gap-2.5 transition-all">
                      {t('viewLiveQueue')} <ArrowRight size={17} aria-hidden="true" />
                    </span>
                  </a>
                </Section>
              );

            case 'faq':
              return (
                <Section key={key} id="faq" tinted>
                  <Label p={p}>{t('questions')}</Label>
                  <Title>{t('faq')}</Title>
                  <div className="mt-8 max-w-3xl divide-y divide-slate-200 border-y border-slate-200">
                    {faqs.map((f, i) => (
                      <details key={i} className="group py-4">
                        <summary className="flex items-center justify-between gap-4 cursor-pointer list-none font-medium text-slate-900">
                          {f.question}
                          <ChevronDown size={18} className="text-slate-400 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
                        </summary>
                        <p className="mt-3 text-slate-600 leading-relaxed">{f.answer}</p>
                      </details>
                    ))}
                  </div>
                </Section>
              );

            case 'contact':
              return (
                <Section key={key} id="contact">
                  <Label p={p}>{t('visitUs')}</Label>
                  <Title>{t('getInTouch')}</Title>
                  <div className="mt-8 grid md:grid-cols-3 gap-4">
                    {clinic.address && (
                      <ContactCard icon={MapPin} label={t('address')} p={p}>
                        <p className="text-slate-700 leading-relaxed">{clinic.address}</p>
                        {clinic.mapUrl && (
                          <a href={clinic.mapUrl} target="_blank" rel="noopener noreferrer" className={`mt-2 inline-flex items-center gap-1.5 text-sm font-medium ${p.ring} hover:underline`}>
                            <Navigation size={13} aria-hidden="true" /> {t('getDirections')}
                          </a>
                        )}
                      </ContactCard>
                    )}
                    {clinic.phone && (
                      <ContactCard icon={Phone} label={t('phone')} p={p}>
                        <a href={`tel:${clinic.phone}`} className="text-slate-700 hover:underline">{clinic.phone}</a>
                        {clinic.emergencyPhone && <p className="mt-1.5 text-sm text-rose-700">Emergency: {clinic.emergencyPhone}</p>}
                      </ContactCard>
                    )}
                    {clinic.email && (
                      <ContactCard icon={Mail} label={t('email')} p={p}>
                        <a href={`mailto:${clinic.email}`} className="text-slate-700 hover:underline break-all">{clinic.email}</a>
                      </ContactCard>
                    )}
                  </div>

                  {clinic.mapEmbedUrl && (
                    <div className="mt-6 rounded-2xl overflow-hidden border border-slate-200">
                      <iframe
                        src={clinic.mapEmbedUrl}
                        title={`Map showing ${clinic.name}`}
                        className="w-full h-80 border-0"
                        loading="lazy"
                        // Third-party frame: no access to this page, and no
                        // referrer leaked to the map provider.
                        referrerPolicy="no-referrer-when-downgrade"
                        sandbox="allow-scripts allow-same-origin allow-popups"
                      />
                    </div>
                  )}
                </Section>
              );

            default:
              return null;
          }
        })}
      </main>

      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="max-w-6xl mx-auto px-5 py-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-slate-500">
          <p>
            © {new Date().getFullYear()} {clinic.name}
            {clinic.registrationNumber && <span className="ml-2">· Reg. No: {clinic.registrationNumber}</span>}
          </p>
          <div className="flex gap-4">
            <Link to="/blog" className="hover:text-slate-800">Articles</Link>
            <a href={publicSiteUrl('/live-queue')} className="hover:text-slate-800">Live queue</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── Hero ──────────────────────────────────────────────────────────────── */

function Hero({ clinic, p, status, timings, doctors, yearsServing, t }: {
  clinic: Clinic; p: Palette; status: { open: boolean; label: string } | null;
  timings: Timing[]; doctors: Doctor[]; yearsServing: number | null;
  t: (k: StringKey) => string;
}) {
  const hasHeroImage = Boolean(clinic.heroImagePath);

  return (
    <section className={`relative overflow-hidden border-b border-slate-100 ${hasHeroImage ? '' : `bg-gradient-to-b ${p.gradient} via-slate-50 to-white`}`}>
      {hasHeroImage && (
        <>
          <img src={publicAsset(clinic.heroImagePath!)} alt="" className="absolute inset-0 w-full h-full object-cover" />
          {/* A photo behind text needs a scrim, or the headline becomes
              unreadable the moment someone uploads a bright image. */}
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/95 to-white/70" />
        </>
      )}

      <div className="relative max-w-6xl mx-auto px-5 py-16 md:py-24 grid md:grid-cols-[1.15fr_1fr] gap-12 items-center">
        <div>
          {status && (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium mb-5 ${status.open ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${status.open ? 'bg-emerald-600' : 'bg-slate-500'}`} aria-hidden="true" />
              {status.label}
            </span>
          )}

          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 leading-[1.1]">{clinic.name}</h1>
          {clinic.tagline && <p className="mt-4 text-lg md:text-xl text-slate-600 leading-relaxed max-w-xl">{clinic.tagline}</p>}

          {clinic.address && (
            <p className="mt-4 flex items-start gap-2 text-slate-600">
              <MapPin size={17} className={`${p.ring} shrink-0 mt-0.5`} aria-hidden="true" />
              <span>{clinic.address}</span>
            </p>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            {clinic.phone && (
              <a href={`tel:${clinic.phone}`} className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl ${p.solid} ${p.solidHover} text-white font-medium transition-colors shadow-sm`}>
                <CalendarCheck size={17} aria-hidden="true" /> {t('bookAppointment')}
              </a>
            )}
            <a href={publicSiteUrl('/live-queue')} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-slate-800 font-medium border border-slate-300 hover:border-slate-400 transition-colors">
              <Radio size={17} className={p.ring} aria-hidden="true" /> {t('checkLiveQueue')}
            </a>
          </div>

          {(yearsServing !== null || clinic.registrationNumber || doctors.length > 0) && (
            <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4">
              {yearsServing !== null && yearsServing > 0 && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">{t('servingSince')}</dt>
                  <dd className="text-2xl font-bold text-slate-900">{clinic.establishedYear}</dd>
                </div>
              )}
              {doctors.length > 0 && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">{doctors.length === 1 ? t('doctor') : t('doctors')}</dt>
                  <dd className="text-2xl font-bold text-slate-900">{doctors.length}</dd>
                </div>
              )}
              {clinic.registrationNumber && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">{t('registration')}</dt>
                  <dd className="text-sm font-semibold text-slate-900 mt-1.5 flex items-center gap-1.5">
                    <ShieldCheck size={15} className={p.ring} aria-hidden="true" />
                    {clinic.registrationNumber}
                  </dd>
                </div>
              )}
            </dl>
          )}
        </div>

        {timings.length > 0 && (
          <aside className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-4">
              <Clock size={16} className={p.ring} aria-hidden="true" /> {t('openingHours')}
            </h2>
            <dl className="space-y-2.5">
              {/* Loop variable is `row`, not `t` -- `t` is the translator,
                  and shadowing it here silently broke the labels. */}
              {timings.map((row) => {
                const isToday = row.day === currentDayName();
                return (
                  <div key={row.day} className={`flex justify-between gap-4 text-sm ${isToday ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>
                    <dt>{row.day}{isToday && <span className={`ml-1.5 text-[10px] uppercase tracking-wide ${p.ring}`}>{t('today')}</span>}</dt>
                    <dd className={row.closed ? 'text-slate-400' : ''}>{row.closed ? t('closed') : `${fmtTime(row.opensAt)} – ${fmtTime(row.closesAt)}`}</dd>
                  </div>
                );
              })}
            </dl>
            {clinic.emergencyPhone && (
              <a href={`tel:${clinic.emergencyPhone}`} className="mt-5 flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm hover:bg-rose-100 transition-colors">
                <AlertCircle size={16} className="shrink-0" aria-hidden="true" />
                <span><span className="font-semibold">{t('emergency')}:</span> {clinic.emergencyPhone}</span>
              </a>
            )}
          </aside>
        )}
      </div>
    </section>
  );
}

/* ── Feedback ──────────────────────────────────────────────────────────── */

function FeedbackSection({ p, published }: { p: Palette; published: PublicFeedback[] }) {
  const [rating, setRating] = useState(0);
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) { setError('Please choose a rating.'); return; }
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`${PUBLIC_API_BASE}/public/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, patientName: name || undefined, comment: comment || undefined }),
      });
      if (!res.ok) throw new Error('Could not send');
      setSent(true);
    } catch {
      setError('Could not send your feedback. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Section id="feedback" tinted>
      <Label p={p}>Your experience</Label>
      <Title>Tell us how we did</Title>

      <div className="mt-8 grid md:grid-cols-2 gap-8">
        <div>
          {sent ? (
            <div className="p-6 rounded-2xl bg-white border border-slate-200">
              <CheckCircle2 size={22} className="text-emerald-600 mb-2" aria-hidden="true" />
              <p className="font-medium text-slate-900">Thank you.</p>
              <p className="text-sm text-slate-600 mt-1">Your feedback goes straight to the clinic and helps us improve.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="p-6 rounded-2xl bg-white border border-slate-200 flex flex-col gap-4">
              <div>
                <span className="block text-sm font-medium text-slate-700 mb-2">How was your visit?</span>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} star${n > 1 ? 's' : ''}`} className="p-0.5">
                      <Star size={26} className={n <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-300'} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="fb-name">Your name (optional)</label>
                <input id="fb-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-slate-800 outline-none focus:border-slate-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="fb-comment">Anything you'd like to tell us?</label>
                <textarea id="fb-comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={4} maxLength={2000}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-slate-800 outline-none focus:border-slate-500" />
              </div>
              {error && <p className="text-sm text-rose-700">{error}</p>}
              <button type="submit" disabled={sending} className={`inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl ${p.solid} ${p.solidHover} text-white font-medium disabled:opacity-60 transition-colors`}>
                <Send size={16} aria-hidden="true" /> {sending ? 'Sending…' : 'Send Feedback'}
              </button>
              <p className="text-xs text-slate-500 leading-relaxed">
                Your feedback is sent privately to the clinic. It is not published on this page unless the clinic
                specifically chooses to publish it.
              </p>
            </form>
          )}
        </div>

        {published.length > 0 && (
          <div className="flex flex-col gap-3">
            {published.map((f) => (
              <blockquote key={f.id} className="p-5 rounded-2xl bg-white border border-slate-200">
                <div className="flex gap-0.5 mb-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} size={13} className={n <= f.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'} aria-hidden="true" />
                  ))}
                </div>
                {f.comment && <p className="text-slate-700 leading-relaxed">{f.comment}</p>}
                <footer className="mt-2 text-sm text-slate-500">{f.patientName || 'Anonymous'}</footer>
              </blockquote>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}

/* ── Language switcher ─────────────────────────────────────────────────── */

/**
 * A button-and-menu rather than a native <select>, for two reasons: a
 * native <option> can't be styled reliably across browsers (the portal's
 * own dropdowns rendered white-on-white for exactly that reason), and
 * showing each language in its own script is the whole point -- a patient
 * who can't read English needs to find "मराठी", not "Marathi".
 */
function LanguageSwitcher({ current, available, onChange, label }: {
  current: string; available: string[]; onChange: (l: string) => void; label: string;
}) {
  const [open, setOpen] = useState(false);
  // English is always offered: it is the language the content is authored
  // in and the fallback for anything untranslated.
  const options = LOCALES.filter((l) => l.code === 'en' || available.includes(l.code));
  if (options.length <= 1) return null;

  const currentMeta = localeMeta(current);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 hover:border-slate-400"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <Languages size={15} aria-hidden="true" />
        <span className="hidden sm:inline">{currentMeta.nativeName}</span>
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <>
          {/* Click-away layer, so the menu closes without a document listener. */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <ul
            role="listbox"
            className="absolute right-0 top-full mt-1 z-50 min-w-[160px] max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg py-1"
          >
            {options.map((l) => (
              <li key={l.code}>
                <button
                  role="option"
                  aria-selected={l.code === current}
                  onClick={() => { onChange(l.code); setOpen(false); }}
                  className={`w-full text-left px-3.5 py-2 text-sm hover:bg-slate-50 flex items-center justify-between gap-3 ${
                    l.code === current ? 'font-semibold text-slate-900' : 'text-slate-700'
                  }`}
                >
                  <span>{l.nativeName}</span>
                  {l.code !== 'en' && <span className="text-xs text-slate-400">{l.englishName}</span>}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/* ── Layout primitives ─────────────────────────────────────────────────── */

/** Nav labels are dictionary keys, not literals, so the menu translates
 * along with the rest of the page. */
const NAV_KEYS: Record<SectionKey, StringKey> = {
  about: 'about', services: 'services', highlights: 'whyUs', doctors: 'ourTeam',
  gallery: 'ourClinic', blog: 'healthLibrary', feedback: 'yourExperience',
  queue: 'viewLiveQueue', faq: 'questions', contact: 'visitUs',
};

/** Anchor ids differ from section keys in two places, so the nav has to use
 * the id the section actually renders with. */
function Section({ id, tinted, children }: { id?: string; tinted?: boolean; children: React.ReactNode }) {
  return (
    <section id={id} className={`${tinted ? 'bg-slate-50 border-y border-slate-100' : ''} scroll-mt-16`}>
      <div className="max-w-6xl mx-auto px-5 py-14 md:py-20">{children}</div>
    </section>
  );
}

function Label({ p, children }: { p: Palette; children: React.ReactNode }) {
  return <p className={`text-xs font-semibold uppercase tracking-widest ${p.ring}`}>{children}</p>;
}

function Title({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-2 text-2xl md:text-3xl font-bold tracking-tight text-slate-900">{children}</h2>;
}

function ContactCard({ icon: Icon, label, p, children }: { icon: any; label: string; p: Palette; children: React.ReactNode }) {
  return (
    <div className="p-5 rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500 mb-2">
        <Icon size={14} className={p.ring} aria-hidden="true" /> {label}
      </div>
      {children}
    </div>
  );
}

/* ── Helpers ───────────────────────────────────────────────────────────── */

/** Saved order, filtered to sections this build knows about, with any
 * newly-added section appended. A key the app doesn't recognise is dropped
 * rather than trusted -- config comes from the database, and the page
 * should never try to render something arbitrary. */
function resolveOrder(saved: { key: SectionKey; enabled: boolean }[] | null): SectionKey[] {
  if (!Array.isArray(saved) || saved.length === 0) return DEFAULT_ORDER;
  const known = saved.filter((s) => DEFAULT_ORDER.includes(s.key));
  const enabled = known.filter((s) => s.enabled).map((s) => s.key);
  const unlisted = DEFAULT_ORDER.filter((k) => !known.some((s) => s.key === k));
  return [...enabled, ...unlisted];
}

function currentDayName(): string {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()]!;
}

/** "Open now" / "Closed" from the clinic's own published hours -- the
 * question every patient has before calling. Null when hours aren't
 * published, so nothing is asserted that isn't known. */
function openStatus(timings: Timing[]): { open: boolean; label: string } | null {
  if (timings.length === 0) return null;
  const today = timings.find((t) => t.day === currentDayName());
  if (!today) return null;
  if (today.closed || !today.opensAt || !today.closesAt) return { open: false, label: 'Closed today' };

  const now = new Date();
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const [oh, om] = today.opensAt.split(':').map(Number);
  const [ch, cm] = today.closesAt.split(':').map(Number);
  if (oh == null || ch == null) return null;
  const open = minutesNow >= oh * 60 + (om ?? 0) && minutesNow <= ch * 60 + (cm ?? 0);

  return open
    ? { open: true, label: `Open now · until ${fmtTime(today.closesAt)}` }
    : { open: false, label: `Closed · opens ${fmtTime(today.opensAt)}` };
}

/** 24h "14:30" -> "2:30 PM", which is how Indian clinic signage reads. */
function fmtTime(t?: string): string {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  if (h == null) return t;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m ?? 0).padStart(2, '0')} ${suffix}`;
}
