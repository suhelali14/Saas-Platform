import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';

export function Catalog() {
  const { fetchWithAuth, isLoading } = useApi();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', price: '', sku: '', description: '', initialStock: '0', lowStockThreshold: '10', categoryId: '' });

  useEffect(() => { load(); }, [search, categoryId]);

  const load = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (categoryId) params.set('categoryId', categoryId);

      const [prodRes, catRes] = await Promise.all([
        fetchWithAuth(`/catalog/products?${params}`),
        fetchWithAuth('/catalog/categories'),
      ]);
      setProducts(prodRes.data || []);
      setCategories(catRes.data || []);
      setLoadError(null);
    } catch (e: any) {
      setLoadError(e?.message || 'Could not load catalog.');
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchWithAuth('/catalog/products', { method: 'POST', data: form });
      setShowModal(false);
      load();
    } catch {}
  };

  const getStockBadge = (item: any) => {
    const qty = item.inventory?.quantity ?? 0;
    const threshold = item.inventory?.lowStockThreshold ?? 10;
    if (qty === 0) return <Badge variant="error">Out of Stock</Badge>;
    if (qty <= threshold) return <Badge variant="warning">Low: {qty}</Badge>;
    return <Badge variant="success">{qty} in stock</Badge>;
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Product Catalog</h1>
          <p className="page-subtitle">{products.length} products · {categories.length} categories</p>
        </div>
        <div className="page-actions">
          <Button variant="secondary">Import CSV</Button>
          <Button variant="accent" onClick={() => setShowModal(true)}>+ Add Product</Button>
        </div>
      </div>

      {loadError && (
        <div style={{ background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', padding: '10px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
          {loadError} <button onClick={load} style={{ background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', fontSize: 'inherit' }}>Retry</button>
        </div>
      )}

      {/* Category Tabs */}
      <div className="tabs mb-6">
        <button className={`tab ${!categoryId ? 'active' : ''}`} onClick={() => setCategoryId('')}>All Products</button>
        {categories.map((c: any) => (
          <button
            key={c.id}
            className={`tab ${categoryId === c.id ? 'active' : ''}`}
            onClick={() => setCategoryId(c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="filter-bar mb-6">
        <div className="filter-search">
          <span className="filter-search-icon">🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products by name, SKU..." />
        </div>
      </div>

      {/* Product Grid */}
      <div className="grid grid-auto">
        {products.map((p: any, i) => (
          <Card key={p.id} interactive className={`stagger-${(i % 6) + 1}`}>
            {/* Product Image Placeholder */}
            <div style={{ height: '120px', background: 'var(--bg-tertiary)', borderRadius: 'var(--border-radius-sm)', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px' }}>
              {p.images?.[0] ? <img src={p.images[0]} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--border-radius-sm)' }} /> : '📦'}
            </div>

            <div className="font-semibold mb-1 truncate">{p.name}</div>
            <div className="text-xs text-tertiary mb-3">{p.category?.name || 'Uncategorized'} {p.sku && `· ${p.sku}`}</div>

            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-accent">₹{p.price}</span>
              {getStockBadge(p)}
            </div>

            <div className="flex gap-2 mt-3">
              <Button variant="ghost" size="sm" className="flex-1">Edit</Button>
              <Button variant="secondary" size="sm" className="flex-1">Stock +</Button>
            </div>
          </Card>
        ))}

        {products.length === 0 && (
          <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
            <div className="empty-state-icon">📦</div>
            <h3 className="empty-state-title">No products yet</h3>
            <p className="empty-state-description">Add your first product or import from a CSV file.</p>
            <Button variant="accent" onClick={() => setShowModal(true)}>+ Add Product</Button>
          </div>
        )}
      </div>

      {/* Add Product Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Add New Product"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button variant="accent" isLoading={isLoading} onClick={handleAdd as any}>Add Product</Button>
          </>
        }
      >
        <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="grid grid-2" style={{ gap: '16px' }}>
            <Input label="Product Name *" placeholder="Aashirvaad Atta 5kg" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            <Input label="Price (₹) *" type="number" placeholder="280" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} required />
          </div>
          <div className="grid grid-2" style={{ gap: '16px' }}>
            <Input label="SKU / Barcode" placeholder="AATA-5KG" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} />
            <div className="input-group">
              <label className="input-label">Category</label>
              <select className="input" value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })}>
                <option value="">No Category</option>
                {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-2" style={{ gap: '16px' }}>
            <Input label="Initial Stock" type="number" placeholder="0" value={form.initialStock} onChange={e => setForm({ ...form, initialStock: e.target.value })} />
            <Input label="Low Stock Alert Threshold" type="number" placeholder="10" value={form.lowStockThreshold} onChange={e => setForm({ ...form, lowStockThreshold: e.target.value })} />
          </div>
          <Input label="Description" placeholder="Short product description..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
        </form>
      </Modal>
    </div>
  );
}
