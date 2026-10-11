import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { Button } from '../components/ui/Button';
import { Check, Code, Zap, Monitor, Smartphone, Tablet, ExternalLink, Settings2, Sparkles, Send } from 'lucide-react';

interface GenreProduct {
  id: string;
  genre: string;
  name: string;
  description: string;
  thumbnail: string;
  icon: string;
  defaultTheme: { primaryColor: string; font: string; mode: string };
  sections: any[];
}

export function Website() {
  const { fetchWithAuth } = useApi();
  const navigate = useNavigate();

  // Phase State: 'catalog' | 'customization' | 'request'
  const [phase, setPhase] = useState<'catalog' | 'customization' | 'request'>('catalog');
  
  // Data
  const [products, setProducts] = useState<GenreProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<GenreProduct | null>(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isApplying, setIsApplying] = useState(false);

  // Customization State
  const [theme, setTheme] = useState({ primaryColor: '#10b981', font: 'Plus Jakarta Sans' });
  const [sectionOverrides, setSectionOverrides] = useState<Record<string, any>>({});
  const [disabledSections, setDisabledSections] = useState<Set<string>>(new Set());

  // Request State
  const [requestGenre, setRequestGenre] = useState('');
  const [requestDesc, setRequestDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // UI State
  const [deviceView, setDeviceView] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    loadProductsAndState();
  }, []);

  const loadProductsAndState = async () => {
    try {
      // 1. Fetch available products
      const prodRes = await fetchWithAuth('/website/genre-products');
      if (prodRes?.data) setProducts(prodRes.data);

      // 2. Check if user already has a config (so we can drop them into customization)
      const cfgRes = await fetchWithAuth('/website/config');
      if (cfgRes?.data?.template?.startsWith('genre-')) {
        const genre = cfgRes.data.template.split('-')[1].toUpperCase();
        const prod = prodRes?.data?.find((p: any) => p.genre === genre);
        if (prod) {
          setSelectedProduct(prod);
          setTheme({
            primaryColor: cfgRes.data.theme?.primaryColor || prod.defaultTheme.primaryColor,
            font: cfgRes.data.theme?.font || prod.defaultTheme.font
          });
          setPhase('customization');
        }
      }

      // 3. Get preview
      const prevRes = await fetchWithAuth('/website/preview');
      if (prevRes?.data?.html) setPreviewHtml(prevRes.data.html);

    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const applyProduct = async (product: GenreProduct) => {
    setIsApplying(true);
    try {
      const res = await fetchWithAuth(`/website/genre-products/${product.id}/apply`, {
        method: 'POST',
        data: {
          customizations: {
            primaryColor: theme.primaryColor,
            font: theme.font,
            disabledSections: Array.from(disabledSections),
            sectionOverrides
          }
        }
      });
      if (res?.data) {
        setSelectedProduct(product);
        setPhase('customization');
        refreshPreview();
      }
    } catch (e) {
      alert("Error applying product");
    } finally {
      setIsApplying(false);
    }
  };

  const refreshPreview = async () => {
    try {
      const prevRes = await fetchWithAuth('/website/preview');
      if (prevRes?.data?.html) setPreviewHtml(prevRes.data.html);
    } catch (e) {}
  };

  const saveCustomizations = async () => {
    if (!selectedProduct) return;
    setIsApplying(true);
    try {
      await fetchWithAuth(`/website/genre-products/${selectedProduct.id}/apply`, {
        method: 'POST',
        data: {
          customizations: {
            primaryColor: theme.primaryColor,
            font: theme.font,
            disabledSections: Array.from(disabledSections),
            sectionOverrides
          }
        }
      });
      await refreshPreview();
      setSavedMsg('Changes Published ✨');
      setTimeout(() => setSavedMsg(''), 3000);
    } catch (e) {
      alert("Error saving");
    } finally {
      setIsApplying(false);
    }
  };

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await fetchWithAuth('/website/genre-requests', {
        method: 'POST',
        data: { genre: requestGenre, requirements: requestDesc }
      });
      alert("Request submitted successfully! Our team will build this solution for you.");
      setPhase('catalog');
    } catch (e: any) {
      alert(e.message || "Failed to submit request");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSection = (id: string) => {
    setDisabledSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleOverrideChange = (sectionId: string, field: string, value: string) => {
    setSectionOverrides(prev => ({
      ...prev,
      [sectionId]: {
        ...prev[sectionId],
        [field]: value
      }
    }));
  };

  // ─── Render ─────────────────────────────────────────────────────────
  if (isLoading) return <div className="h-screen flex items-center justify-center bg-[#080b11] text-white">Loading...</div>;

  return (
    <div className="wb-layout h-screen flex flex-col bg-[#080b11] text-slate-100 overflow-hidden font-sans">
      {/* Header */}
      <header className="h-14 bg-[#0d111a] border-b border-slate-800/80 px-4 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="flex justify-center items-center w-8 h-8 rounded-lg bg-slate-800/50 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors border border-slate-700/50">
            <span className="text-sm font-bold">←</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-400 to-teal-500 flex items-center justify-center font-black text-slate-950 text-sm">⚡</div>
            <div className="text-sm font-extrabold tracking-tight text-white flex items-center gap-2">
              BusinessOS Storefront
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">v4.0 Catalog</span>
            </div>
          </div>
        </div>

        {phase === 'customization' && (
          <div className="flex items-center gap-2.5">
            {savedMsg && <span className="text-xs px-3 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold flex items-center gap-1.5"><Check size={12} /> {savedMsg}</span>}
            <Button variant="outline" size="sm" onClick={() => setPhase('catalog')} style={{ fontSize: '11px', background: 'rgba(255,255,255,0.03)' }}>
              Change Solution
            </Button>
            <Button variant="accent" size="sm" isLoading={isApplying} onClick={saveCustomizations} style={{ fontSize: '11px', padding: '6px 16px', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#000', fontWeight: 700 }}>
              <Zap size={13} style={{ marginRight: '5px' }} />
              Publish Changes
            </Button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        
        {phase === 'catalog' && (
          <div className="flex-1 overflow-y-auto p-10 bg-[#080b11]">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-16">
                <h1 className="text-4xl font-extrabold text-white mb-4">Choose Your Industry Solution</h1>
                <p className="text-slate-400 text-lg">Select a complete, pre-built website product designed specifically for your business type.</p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {products.map(p => (
                  <div key={p.id} className="bg-[#0c1017] border border-slate-800 rounded-2xl overflow-hidden hover:border-emerald-500/50 transition-all group flex flex-col">
                    <div className="h-48 bg-slate-900 relative overflow-hidden">
                      {p.thumbnail && <img src={p.thumbnail} alt={p.name} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />}
                      <div className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-xl">{p.icon}</div>
                    </div>
                    <div className="p-6 flex-1 flex flex-col">
                      <div className="text-xs font-bold text-emerald-400 tracking-wider uppercase mb-2">{p.genre.replace('_', ' ')}</div>
                      <h3 className="text-xl font-bold text-white mb-2">{p.name}</h3>
                      <p className="text-sm text-slate-400 mb-6 flex-1">{p.description}</p>
                      <Button variant="accent" className="w-full bg-white text-black hover:bg-slate-200" onClick={() => {
                        setTheme({ primaryColor: p.defaultTheme.primaryColor, font: p.defaultTheme.font });
                        applyProduct(p);
                      }}>
                        Customize & Apply
                      </Button>
                    </div>
                  </div>
                ))}

                {/* Request Card */}
                <div className="bg-gradient-to-br from-[#1a1528] to-[#0c1017] border border-purple-900/50 rounded-2xl p-8 flex flex-col justify-center items-center text-center border-dashed">
                  <div className="w-16 h-16 rounded-full bg-purple-900/30 flex items-center justify-center text-2xl mb-4 border border-purple-500/30">✨</div>
                  <h3 className="text-xl font-bold text-white mb-2">Don't see your industry?</h3>
                  <p className="text-sm text-slate-400 mb-6">Our expert team will build a tailored solution product just for your business genre.</p>
                  <Button variant="outline" className="border-purple-500/50 text-purple-300 hover:bg-purple-900/30" onClick={() => setPhase('request')}>
                    Request Custom Solution
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {phase === 'request' && (
          <div className="flex-1 flex items-center justify-center bg-[#080b11] p-6">
            <div className="max-w-lg w-full bg-[#0c1017] border border-slate-800 rounded-2xl p-8">
              <button onClick={() => setPhase('catalog')} className="text-sm text-slate-400 hover:text-white mb-6">← Back to Catalog</button>
              <h2 className="text-2xl font-bold text-white mb-2">Request Custom Solution</h2>
              <p className="text-slate-400 text-sm mb-6">Tell us about your business. We'll build a custom product that matches your industry needs perfectly.</p>
              
              <form onSubmit={submitRequest} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Your Industry / Genre</label>
                  <input required value={requestGenre} onChange={e => setRequestGenre(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-emerald-500 focus:outline-none" placeholder="e.g. Yoga Studio, Car Wash, Consulting" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">What sections do you need?</label>
                  <textarea required value={requestDesc} onChange={e => setRequestDesc(e.target.value)} rows={4} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-emerald-500 focus:outline-none" placeholder="e.g. I need a class schedule, instructor profiles, and a membership pricing table." />
                </div>
                <Button type="submit" variant="accent" className="w-full bg-white text-black py-6 mt-4" isLoading={isSubmitting}>
                  Submit Request <Send size={16} className="ml-2" />
                </Button>
              </form>
            </div>
          </div>
        )}

        {phase === 'customization' && selectedProduct && (
          <>
            {/* Sidebar Controls */}
            <aside className="w-[380px] bg-[#0c1017] border-r border-slate-800/80 flex flex-col shrink-0 z-20 overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-lg font-bold text-white">{selectedProduct.name}</h2>
                    <p className="text-xs text-emerald-400 mt-1 uppercase font-bold tracking-wider">{selectedProduct.genre}</p>
                  </div>
                </div>

                <div className="space-y-8">
                  {/* Theme */}
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4"><Settings2 size={16} /> Theme Settings</h3>
                    <div className="space-y-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800/50">
                      <div>
                        <label className="text-xs text-slate-400 font-medium mb-2 block">Primary Color</label>
                        <div className="flex gap-2 flex-wrap">
                          {['#10b981', '#6366f1', '#f43f5e', '#f59e0b', '#000000', '#2563eb'].map(c => (
                            <button key={c} onClick={() => setTheme(p => ({ ...p, primaryColor: c }))} className={`w-8 h-8 rounded-full border-2 ${theme.primaryColor === c ? 'border-white scale-110' : 'border-transparent opacity-70'}`} style={{ backgroundColor: c }} />
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 font-medium mb-2 block">Typography</label>
                        <select value={theme.font} onChange={e => setTheme(p => ({ ...p, font: e.target.value }))} className="w-full bg-[#0a0d14] border border-slate-800 rounded-lg px-3 py-2 text-sm text-white">
                          <option>Plus Jakarta Sans</option>
                          <option>Outfit</option>
                          <option>Inter</option>
                          <option>Space Grotesk</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Sections */}
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4"><Monitor size={16} /> Sections Content</h3>
                    <div className="space-y-3">
                      {selectedProduct.sections.map((section: any) => (
                        <div key={section.id} className={`bg-slate-900/50 border ${disabledSections.has(section.id) ? 'border-red-900/30 opacity-50' : 'border-slate-800'} rounded-xl overflow-hidden`}>
                          <div className="px-4 py-3 flex items-center justify-between bg-slate-800/30">
                            <span className="text-sm font-bold text-white">{section.name}</span>
                            <button onClick={() => toggleSection(section.id)} className={`text-xs px-2 py-1 rounded ${disabledSections.has(section.id) ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                              {disabledSections.has(section.id) ? 'Hidden' : 'Visible'}
                            </button>
                          </div>
                          {!disabledSections.has(section.id) && (
                            <div className="p-4 space-y-3 border-t border-slate-800/50">
                              {section.defaultTitle && (
                                <div>
                                  <label className="text-xs text-slate-400 block mb-1">Heading</label>
                                  <input type="text" 
                                    value={sectionOverrides[section.id]?.title ?? section.defaultTitle}
                                    onChange={(e) => handleOverrideChange(section.id, 'title', e.target.value)}
                                    className="w-full bg-[#0a0d14] border border-slate-800 rounded-md px-3 py-1.5 text-xs text-white" />
                                </div>
                              )}
                              {section.defaultSubtitle && (
                                <div>
                                  <label className="text-xs text-slate-400 block mb-1">Sub-heading</label>
                                  <textarea rows={2} 
                                    value={sectionOverrides[section.id]?.subtitle ?? section.defaultSubtitle}
                                    onChange={(e) => handleOverrideChange(section.id, 'subtitle', e.target.value)}
                                    className="w-full bg-[#0a0d14] border border-slate-800 rounded-md px-3 py-1.5 text-xs text-white" />
                                </div>
                              )}
                              {section.defaultCta && (
                                <div>
                                  <label className="text-xs text-slate-400 block mb-1">Button Text</label>
                                  <input type="text" 
                                    value={sectionOverrides[section.id]?.ctaPrimary ?? section.defaultCta}
                                    onChange={(e) => handleOverrideChange(section.id, 'ctaPrimary', e.target.value)}
                                    className="w-full bg-[#0a0d14] border border-slate-800 rounded-md px-3 py-1.5 text-xs text-white" />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                </div>
              </div>
            </aside>

            {/* Live Preview Area */}
            <main className="flex-1 relative flex flex-col bg-[#05070a]">
              {/* Viewport Toggles */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex p-1 bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-800 shadow-2xl">
                {[
                  { id: 'desktop', icon: Monitor },
                  { id: 'tablet', icon: Tablet },
                  { id: 'mobile', icon: Smartphone }
                ].map(view => (
                  <button
                    key={view.id}
                    onClick={() => setDeviceView(view.id as any)}
                    className={`p-2.5 rounded-lg transition-all ${deviceView === view.id ? 'bg-slate-700 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    <view.icon size={16} />
                  </button>
                ))}
              </div>

              {/* Iframe Container */}
              <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
                <div 
                  className="bg-white shadow-2xl overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col"
                  style={{
                    width: deviceView === 'mobile' ? '390px' : deviceView === 'tablet' ? '768px' : '100%',
                    height: deviceView === 'mobile' ? '780px' : deviceView === 'tablet' ? '900px' : '100%',
                    borderRadius: deviceView !== 'desktop' ? '36px' : '0px',
                    border: deviceView !== 'desktop' ? '12px solid #1e293b' : 'none'
                  }}
                >
                  {/* Browser Bar for Desktop */}
                  {deviceView === 'desktop' && (
                    <div className="h-10 bg-slate-100 border-b border-slate-200 flex items-center px-4 gap-2 shrink-0">
                      <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full bg-red-400"/><div className="w-3 h-3 rounded-full bg-amber-400"/><div className="w-3 h-3 rounded-full bg-emerald-400"/></div>
                      <div className="mx-auto bg-white border border-slate-200 rounded text-[10px] text-slate-400 px-3 pr-24 py-1 font-mono flex items-center gap-2">
                        <ExternalLink size={10} /> {window.location.host}/public/preview
                      </div>
                    </div>
                  )}
                  <iframe
                    title="Website Preview"
                    srcDoc={`
                      <!DOCTYPE html>
                      <html>
                        <head>
                          <meta name="viewport" content="width=device-width, initial-scale=1.0">
                          <script src="https://cdn.tailwindcss.com"></script>
                          <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Outfit:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
                          <style>
                            body { font-family: '${theme.font}', sans-serif; }
                          </style>
                        </head>
                        <body>
                          ${previewHtml || '<div style="padding:40px;text-align:center;color:#666;">Apply changes to see preview</div>'}
                        </body>
                      </html>
                    `}
                    className="w-full flex-1 border-none bg-slate-50"
                  />
                </div>
              </div>
            </main>
          </>
        )}

      </div>
    </div>
  );
}
