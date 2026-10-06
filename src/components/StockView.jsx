import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Boxes, ArrowDownCircle, ArrowUpCircle, Plus, Trash2, Edit3, Settings, 
  RefreshCw, CheckCircle2, AlertTriangle, Search, FileText, ShoppingCart, X
} from 'lucide-react';
import { 
  getInventoryProducts, 
  getStockTransactions, 
  saveStockBatch, 
  calculateStockBalances,
  addInventoryProduct,
  deleteStockTransaction
} from '../lib/stockService';
import { getStaffList } from '../lib/auth';
import { formatRupiah } from '../lib/formatters';

const KETERANGAN_OPTIONS_OUT = [
  'Bahan Baku Bar',
  'Bahan Baku Dapur',
  'Kemasan / Packaging',
  'Bahan Rusak / Kadaluwarsa (Waste)',
  'Lainnya'
];

const KETERANGAN_OPTIONS_IN = [
  'Restock Supplier Rutin',
  'Belanja Darurat Pasar / Grosir',
  'Koreksi Opname / Penyesuaian',
  'Lainnya'
];
export default function StockView({ currentUser, activeOutlet = 'kedai' }) {
  const [tab, setTab] = useState('inventory');
  const [direction, setDirection] = useState('in');
  
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [historyFilterType, setHistoryFilterType] = useState('ALL');
  const [historyFilterDestination, setHistoryFilterDestination] = useState('ALL');

  const [cart, setCart] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [qtyInput, setQtyInput] = useState('');
  const [priceInput, setPriceInput] = useState('');
  
  const [meta, setMeta] = useState({
    date: new Date().toISOString().split('T')[0],
    destination: activeOutlet === 'gerobak' ? 'Gerobak' : 'Kedai Utama',
    notes: 'Restock Supplier Rutin',
    recordedBy: currentUser?.name || ''
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [editProd, setEditProd] = useState(null);
  const [newProd, setNewProd] = useState({
    name: '', category: 'Bahan Baku Bar', unit: 'Kg', min_stock: 5, unit_price: '', initial_stock: ''
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [pData, tData, sList] = await Promise.all([
        getInventoryProducts(),
        getStockTransactions(),
        getStaffList()
      ]);
      setProducts(pData);
      setTransactions(tData);
      setStaffList(sList || []);

      if (!meta.recordedBy && sList && sList.length > 0) {
        setMeta(prev => ({
          ...prev,
          recordedBy: currentUser?.name || sList[0].name
        }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    setMeta(prev => ({
      ...prev,
      destination: activeOutlet === 'gerobak' ? 'Gerobak' : 'Kedai Utama',
      notes: direction === 'in' ? 'Restock Supplier Rutin' : 'Bahan Baku Bar',
      recordedBy: currentUser?.name || prev.recordedBy
    }));
  }, [activeOutlet, currentUser, direction]);

  const balances = useMemo(() => calculateStockBalances(products, transactions), [products, transactions]);

  const filteredBalances = useMemo(() => {
    return balances.filter(b => {
      const matchSearch = b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (b.category && b.category.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchCat = categoryFilter === 'ALL' || b.category === categoryFilter;
      return matchSearch && matchCat;
    });
  }, [balances, searchTerm, categoryFilter]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const searchLower = searchTerm.toLowerCase();
      const matchSearch = !searchTerm || 
        tx.product_name?.toLowerCase().includes(searchLower) ||
        tx.notes?.toLowerCase().includes(searchLower) ||
        tx.recorded_by?.toLowerCase().includes(searchLower);
      const matchType = historyFilterType === 'ALL' || tx.type === historyFilterType;
      const isGerobak = String(tx.destination || '').toLowerCase().includes('gerobak');
      const matchDest = historyFilterDestination === 'ALL' || 
        (historyFilterDestination === 'gerobak' ? isGerobak : !isGerobak);
      return matchSearch && matchType && matchDest;
    });
  }, [transactions, searchTerm, historyFilterType, historyFilterDestination]);

  const stats = useMemo(() => {
    const totalItems = balances.length;
    const lowCount = balances.filter(b => b.isLow).length;
    const totalValuation = balances.reduce((sum, b) => sum + (b.valuation || (Math.max(0, b.currentBalance) * (Number(b.unit_price) || 0))), 0);
    const totalUsageValuation = balances.reduce((sum, b) => sum + (b.totalUsageCost || 0), 0);
    const usageKedaiValuation = balances.reduce((sum, b) => sum + (b.totalUsageCostKedai || 0), 0);
    const usageGerobakValuation = balances.reduce((sum, b) => sum + (b.totalUsageCostGerobak || 0), 0);
    const avgItemPrice = totalItems > 0 ? Math.round(balances.reduce((sum, b) => sum + (Number(b.avgPrice) || Number(b.unit_price) || 0), 0) / totalItems) : 0;
    return { totalItems, lowCount, totalValuation, totalUsageValuation, usageKedaiValuation, usageGerobakValuation };
  }, [balances]);
  const handleAddToCart = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!selectedProductId) {
      alert('Pilih barang yang ingin dimutasi terlebih dahulu!');
      return;
    }
    const qty = parseFloat(qtyInput);
    if (isNaN(qty) || qty <= 0) {
      alert('Kuantiti jumlah barang harus lebih dari 0!');
      return;
    }

    const prod = products.find(p => p.id === selectedProductId);
    if (!prod) return;

    if (direction === 'out') {
      const bal = balances.find(b => b.id === prod.id);
      if (bal && bal.currentBalance < qty) {
        if (!confirm('Peringatan: Stok ' + prod.name + ' tersisa ' + bal.currentBalance + ' ' + prod.unit + '. Tetap catat pengeluaran ' + qty + ' ' + prod.unit + '?')) {
          return;
        }
      }
    }

    const bal = balances.find(b => b.id === prod.id);
    const estimatedUnitCost = bal ? (bal.avgPrice || bal.latestPrice || Number(prod.unit_price) || 0) : (Number(prod.unit_price) || 0);
    const unitPrice = direction === 'in'
      ? (Number(priceInput) !== 0 && priceInput !== '' ? Number(priceInput) : (Number(prod.latestPrice) || Number(prod.unit_price) || 0))
      : estimatedUnitCost;
    const totalCost = qty * unitPrice;

    setCart([...cart, {
      productId: prod.id,
      productName: prod.name,
      category: prod.category,
      unit: prod.unit,
      quantity: qty,
      unitPrice,
      totalCost
    }]);

    setQtyInput('');
    setPriceInput('');
    setSelectedProductId('');
  };

  const handleRemoveFromCart = (idx) => {
    setCart(cart.filter((_, i) => i !== idx));
  };

  const handleSubmitBatch = async () => {
    if (!meta.recordedBy.trim()) {
      alert('Pilih nama kru penanggung jawab penginput!');
      return;
    }
    if (cart.length === 0) {
      alert('Keranjang barang mutasi masih kosong!');
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      await saveStockBatch({
        direction,
        transactionDate: meta.date,
        recordedBy: meta.recordedBy.trim(),
        notes: meta.notes,
        destination: meta.destination,
        items: cart
      });

      setFeedback({
        type: 'success',
        msg: 'Berhasil mencatat ' + cart.length + ' item ' + (direction === 'in' ? 'Stok Masuk' : 'Stok Keluar') + ' untuk ' + meta.destination + '!'
      });
      setCart([]);
      await loadData();
      setTimeout(() => { setTab('inventory'); }, 1400);
    } catch (err) {
      setFeedback({ type: 'error', msg: 'Gagal mencatat mutasi stok: ' + err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    if (!editProd || !editProd.name.trim()) return;
    try {
      await updateInventoryProduct(editProd.id, {
        name: editProd.name.trim(),
        category: editProd.category,
        unit: editProd.unit,
        min_stock: Number(editProd.min_stock) || 0,
        unit_price: Number(editProd.unit_price) || 0
      });
      setEditProd(null);
      await loadData();
      setFeedback({ type: 'success', msg: 'Master barang ' + editProd.name + ' berhasil diperbarui!' });
    } catch (err) {
      alert('Gagal memperbarui master barang: ' + err.message);
    }
  };

  const handleDeleteMasterProduct = async (prodId, prodName) => {
    if (!confirm('Hapus master barang \'' + prodName + '\'? Seluruh riwayat transaksi stok yang bersangkutan akan tetap ada namun master barang ini tidak akan muncul lagi di daftar input.')) return;
    try {
      await deleteInventoryProduct(prodId);
      if (editProd && editProd.id === prodId) setEditProd(null);
      await loadData();
      setFeedback({ type: 'success', msg: 'Master barang ' + prodName + ' berhasil dihapus.' });
    } catch (err) {
      alert('Gagal menghapus: ' + err.message);
    }
  };
const handleCreateProduct = async (e) => {
    e.preventDefault();
    if (!newProd.name.trim()) return;

    try {
      await addInventoryProduct({
        ...newProd,
        unit_price: Number(newProd.unit_price) || 0,
        min_stock: Number(newProd.min_stock) || 5,
        initial_stock: Number(newProd.initial_stock) || 0
      });
      setShowAddModal(false);
      setNewProd({ name: '', category: 'Bahan Baku Bar', unit: 'Kg', min_stock: 5, unit_price: '', initial_stock: '' });
      await loadData();
      setFeedback({ type: 'success', msg: 'Master barang ' + newProd.name + ' berhasil ditambahkan!' });
    } catch (err) {
      alert('Gagal menambah master barang: ' + err.message);
    }
  };

  const handleDeleteTx = async (txId) => {
    if (!confirm('Hapus baris riwayat mutasi ini? Saldo stok barang akan dihitung ulang secara otomatis.')) return;
    try {
      await deleteStockTransaction(txId);
      await loadData();
    } catch (e) {
      alert('Gagal menghapus: ' + e.message);
    }
  };
  return (
    <div className='view-container'>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '22px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ 
              width: '42px', 
              height: '42px', 
              borderRadius: '12px', 
              background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)'
            }}>
              <Boxes size={22} color='#ffffff' />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Logistik & Stok Bahan
                </h2>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background: activeOutlet === 'gerobak' ? 'rgba(217, 119, 6, 0.15)' : 'rgba(79, 70, 229, 0.12)',
                  color: activeOutlet === 'gerobak' ? '#d97706' : '#4F46E5'
                }}>
                  {activeOutlet === 'gerobak' ? 'Gerobak Bara' : 'Kedai Utama'}
                </span>
              </div>
              <p style={{ margin: '3px 0 0 0', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                Inventaris bahan baku, harga rata-rata (HPP), sisa fisik dan riwayat mutasi
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-input)', padding: '5px', borderRadius: '14px', border: '1px solid var(--border-subtle)' }}>
          <button
            type='button'
            className={'btn ' + (tab === 'inventory' ? 'btn-primary' : 'btn-ghost')}
            style={{ fontSize: '0.84rem', padding: '8px 16px', borderRadius: '10px' }}
            onClick={() => setTab('inventory')}
          >
            <Boxes size={15} />
            <span>Katalog Sisa Stok</span>
          </button>
          <button
            type='button'
            className={'btn ' + (tab === 'mutate' ? 'btn-primary' : 'btn-ghost')}
            style={{ fontSize: '0.84rem', padding: '8px 16px', borderRadius: '10px' }}
            onClick={() => setTab('mutate')}
          >
            <Plus size={15} />
            <span>Input Mutasi Stok</span>
          </button>
          <button
            type='button'
            className={'btn ' + (tab === 'history' ? 'btn-primary' : 'btn-ghost')}
            style={{ fontSize: '0.84rem', padding: '8px 16px', borderRadius: '10px' }}
            onClick={() => setTab('history')}
          >
            <FileText size={15} />
            <span>Riwayat & Ledger</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className={'alert-banner alert-' + feedback.type} style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} />
            <span>{feedback.msg}</span>
          </div>
          <button onClick={() => setFeedback(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>✕</button>
        </div>
      )}

      {/* KPI Stats Bar: Detail Nilai Stok & Pemakaian Kedai vs Gerobak */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        <div className='glass-card' style={{ padding: '16px 20px', borderLeft: '4px solid #4F46E5' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Item Terdaftar</span>
          <h3 style={{ margin: '6px 0 0 0', fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {stats.totalItems} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Bahan</span>
          </h3>
        </div>

        <div className='glass-card' style={{ padding: '16px 20px', borderLeft: '4px solid #10b981' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Estimasi Nilai Sisa Stok</span>
          <h3 style={{ margin: '6px 0 0 0', fontSize: '1.5rem', fontWeight: 800, color: '#0F172A' }}>
            {formatRupiah(stats.totalValuation)}
          </h3>
        </div>

        <div className='glass-card' style={{ padding: '16px 20px', borderLeft: '4px solid #6366F1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#4338CA', textTransform: 'uppercase' }}>Pemakaian Kedai Utama</span>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, background: '#EEF2FF', color: '#4338CA', padding: '2px 6px', borderRadius: '4px' }}>Kedai</span>
          </div>
          <h3 style={{ margin: '6px 0 0 0', fontSize: '1.5rem', fontWeight: 800, color: '#1E1B4B' }}>
            {formatRupiah(stats.usageKedaiValuation)}
          </h3>
        </div>

        <div className='glass-card' style={{ padding: '16px 20px', borderLeft: '4px solid #F59E0B' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#B45309', textTransform: 'uppercase' }}>Pemakaian Gerobak Bara</span>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, background: '#FEF3C7', color: '#B45309', padding: '2px 6px', borderRadius: '4px' }}>Gerobak</span>
          </div>
          <h3 style={{ margin: '6px 0 0 0', fontSize: '1.5rem', fontWeight: 800, color: '#78350F' }}>
            {formatRupiah(stats.usageGerobakValuation)}
          </h3>
        </div>

        <div className='glass-card' style={{ padding: '16px 20px', borderLeft: '4px solid #D97706', background: 'linear-gradient(180deg, #FFFFFF 0%, #FFFBEB 100%)' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Nilai Penggunaan Bahan</span>
          <h3 style={{ margin: '6px 0 0 0', fontSize: '1.5rem', fontWeight: 800, color: '#92400E' }}>
            {formatRupiah(stats.totalUsageValuation)}
          </h3>
        </div>
      </div>
      {/* TAB 1: KATALOG SISA STOK DALAM FORMAT TABEL YANG RAPI & BERSIH */}
      {tab === 'inventory' && (
        <div className='glass-card' style={{ padding: '22px' }}>
          {/* Controls: Search, Filter, Buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '18px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '10px', flex: '1', minWidth: '280px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type='text'
                  className='form-input'
                  style={{ paddingLeft: '36px', margin: 0, height: '40px' }}
                  placeholder='Cari nama barang atau kategori...'
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <select
                className='form-input'
                style={{ width: 'auto', minWidth: '160px', height: '40px', margin: 0 }}
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value='ALL'>Semua Kategori</option>
                <option value='Bahan Baku Bar'>Bahan Baku Bar</option>
                <option value='Bahan Baku Dapur'>Bahan Baku Dapur</option>
                <option value='Kemasan / Packaging'>Kemasan / Packaging</option>
                <option value='Lainnya'>Lainnya</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                type='button' 
                className='btn btn-secondary' 
                onClick={loadData} 
                style={{ height: '40px', padding: '0 14px' }}
                title='Refresh Data'
              >
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                <span>Segarkan</span>
              </button>

              <button 
                type='button' 
                className='btn btn-primary' 
                onClick={() => setShowAddModal(true)}
                style={{ height: '40px', padding: '0 16px' }}
              >
                <Plus size={16} />
                <span>Tambah Master Barang</span>
              </button>
            </div>
          </div>

          {/* Clean Table Layout */}
          <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-input)', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '12px 14px' }}>Nama Bahan / Barang</th>
                  <th style={{ padding: '12px 14px' }}>Sisa Fisik</th>
                  <th style={{ padding: '12px 14px' }}>Harga Terakhir</th>
                  <th style={{ padding: '12px 14px' }}>Harga Rata-rata (HPP)</th>
                  <th style={{ padding: '12px 14px' }}>Nilai Aset Stok</th>
                  <th style={{ padding: '12px 14px' }}>Total Masuk</th>
                  <th style={{ padding: '12px 14px' }}>Pakai (Kedai)</th>
                  <th style={{ padding: '12px 14px' }}>Pakai (Gerobak)</th>
                  <th style={{ padding: '12px 14px' }}>Status</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredBalances.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      <Boxes size={36} style={{ margin: '0 auto 8px auto', opacity: 0.3 }} />
                      <div>Tidak ada data barang yang sesuai filter pencarian.</div>
                    </td>
                  </tr>
                ) : (
                  filteredBalances.map((item) => (
                    <tr 
                      key={item.id} 
                      style={{ 
                        borderBottom: '1px solid var(--border-subtle)',
                        background: item.isLow ? 'rgba(239, 68, 68, 0.03)' : 'transparent',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {item.name}
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                          <span style={{ 
                            fontSize: '1.25rem', 
                            fontWeight: 900, 
                            color: item.isLow ? '#ef4444' : '#4F46E5' 
                          }}>
                            {item.currentBalance}
                          </span>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                            {item.unit}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Min: {item.min_stock} {item.unit}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: '#334155' }}>
                        <div>{formatRupiah(item.latestPrice || item.unit_price || 0)}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>/{item.unit}</div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#F1F5F9', padding: '3px 8px', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>
                          <span>{formatRupiah(item.avgPrice || item.unit_price || 0)}</span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {item.totalPurchasedQty > 0 ? ('dari ' + item.totalPurchasedQty + ' ' + item.unit + ' belanja') : 'baseline'}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 800, color: '#0F172A' }}>
                        {formatRupiah(item.valuation || 0)}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 600, color: '#10b981' }}>
                        +{item.stockIn} {item.unit}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        {item.stockOutKedai} {item.unit}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        {item.stockOutGerobak} {item.unit}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        {item.isLow ? (
                          <span style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '4px', 
                            padding: '3px 9px', 
                            borderRadius: '12px', 
                            fontSize: '0.74rem', 
                            fontWeight: 800, 
                            background: 'rgba(239, 68, 68, 0.12)', 
                            color: '#ef4444' 
                          }}>
                            <AlertTriangle size={12} /> Menipis
                          </span>
                        ) : (
                          <span style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '4px', 
                            padding: '3px 9px', 
                            borderRadius: '12px', 
                            fontSize: '0.74rem', 
                            fontWeight: 800, 
                            background: 'rgba(16, 185, 129, 0.12)', 
                            color: '#10b981' 
                          }}>
                            ● Aman
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <button
                          type='button'
                          onClick={() => setEditProd({ ...item })}
                          className='btn btn-ghost'
                          style={{ padding: '6px 10px', borderRadius: '8px', color: '#4F46E5', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: 700 }}
                          title='Edit master barang atau batas minimum stok'
                        >
                          <Edit3 size={14} /> Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* TAB 2: INPUT MUTASI STOK */}
      {tab === 'mutate' && (
        <div style={{ maxWidth: '820px', margin: '0 auto' }}>
          <div className='glass-card' style={{ padding: '24px' }}>
            <h3 style={{ margin: '0 0 14px 0', fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Form Mutasi & Transaksi Stok Bahan
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <button
                type='button'
                onClick={() => setDirection('in')}
                className={'btn ' + (direction === 'in' ? 'btn-primary' : 'btn-secondary')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '14px',
                  borderRadius: '12px',
                  fontWeight: 800
                }}
              >
                <ArrowDownCircle size={18} />
                <span>Stok Masuk (Belanja / Restock)</span>
              </button>

              <button
                type='button'
                onClick={() => setDirection('out')}
                className={'btn ' + (direction === 'out' ? 'btn-primary' : 'btn-secondary')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '14px',
                  borderRadius: '12px',
                  fontWeight: 800
                }}
              >
                <ArrowUpCircle size={18} />
                <span>Stok Keluar (Pemakaian / Transfer)</span>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '20px' }}>
              <div className='form-group' style={{ margin: 0 }}>
                <label className='form-label'>Tanggal Transaksi</label>
                <input 
                  type='date' 
                  className='form-input' 
                  value={meta.date} 
                  onChange={e => setMeta({ ...meta, date: e.target.value })} 
                />
              </div>

              <div className='form-group' style={{ margin: 0 }}>
                <label className='form-label'>Lokasi / Unit Tujuan</label>
                <select 
                  className='form-input' 
                  value={meta.destination} 
                  onChange={e => setMeta({ ...meta, destination: e.target.value })}
                >
                  <option value='Kedai Utama'>Kedai Utama</option>
                  <option value='Gerobak'>Gerobak Bara</option>
                  <option value='Gudang'>Gudang Penyimpanan</option>
                </select>
              </div>

              <div className='form-group' style={{ margin: 0 }}>
                <label className='form-label'>Keperluan / Keterangan</label>
                <select 
                  className='form-input' 
                  value={meta.notes} 
                  onChange={e => setMeta({ ...meta, notes: e.target.value })}
                >
                  {(direction === 'in' ? KETERANGAN_OPTIONS_IN : KETERANGAN_OPTIONS_OUT).map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div className='form-group' style={{ margin: 0 }}>
                <label className='form-label'>Penanggung Jawab (Kru)</label>
                <select 
                  className='form-input' 
                  value={meta.recordedBy} 
                  onChange={e => setMeta({ ...meta, recordedBy: e.target.value })}
                >
                  <option value=''>-- Pilih Kru --</option>
                  {staffList.map(s => (
                    <option key={s.id} value={s.name}>{s.name} ({s.position || 'Kru'})</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ 
              background: 'var(--bg-input)', 
              padding: '16px', 
              borderRadius: '14px', 
              border: '1px solid var(--border-subtle)',
              marginBottom: '20px' 
            }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Pilih Barang yang Dimutasi
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: direction === 'in' ? '2fr 1fr 1.2fr auto' : '2fr 1fr 1.2fr auto', gap: '10px', alignItems: 'flex-end' }}>
                <div className='form-group' style={{ margin: 0 }}>
                  <label className='form-label' style={{ fontSize: '0.78rem' }}>Pilih Barang</label>
                  <select 
                    className='form-input' 
                    value={selectedProductId} 
                    onChange={e => {
                      const id = e.target.value;
                      setSelectedProductId(id);
                      const p = products.find(prod => prod.id === id);
                      if (p && direction === 'in') {
                        setPriceInput(p.unit_price || '');
                      }
                    }}
                  >
                    <option value=''>-- Pilih Bahan Baku --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                    ))}
                  </select>
                </div>

                <div className='form-group' style={{ margin: 0 }}>
                  <label className='form-label' style={{ fontSize: '0.78rem' }}>Jumlah (Qty)</label>
                  <input 
                    type='number' 
                    step='any'
                    min='0.1'
                    className='form-input' 
                    placeholder='Contoh: 5'
                    value={qtyInput} 
                    onChange={e => setQtyInput(e.target.value)} 
                  />
                </div>

                {direction === 'in' && (
                  <div className='form-group' style={{ margin: 0 }}>
                    <label className='form-label' style={{ fontSize: '0.78rem' }}>Harga Beli Satuan (Rp)</label>
                    <input 
                      type='number' 
                      className='form-input' 
                      placeholder='Harga beli'
                      value={priceInput} 
                      onChange={e => setPriceInput(e.target.value)} 
                    />
                  </div>
                )}

                {direction === 'out' && (
                  <div className='form-group' style={{ margin: 0 }}>
                    <label className='form-label' style={{ fontSize: '0.78rem' }}>HPP Satuan (Rata-rata)</label>
                    <div style={{ height: '42px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '8px', display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: '0.88rem', fontWeight: 700, color: '#475569' }}>
                      {(() => {
                        const selBal = balances.find(b => b.id === selectedProductId);
                        const selProd = products.find(p => p.id === selectedProductId);
                        const price = selBal ? (selBal.avgPrice || selBal.latestPrice || selProd?.unit_price || 0) : (selProd?.unit_price || 0);
                        return formatRupiah(price);
                      })()}
                    </div>
                  </div>
                )}

                <button 
                  type='button' 
                  className='btn btn-primary' 
                  onClick={handleAddToCart}
                  style={{ height: '42px', padding: '0 18px', fontWeight: 800 }}
                >
                  <Plus size={16} /> Tambah
                </button>
              </div>
            </div>

            {cart.length > 0 ? (
              <div style={{ marginBottom: '22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800 }}>
                    Keranjang Draft ({cart.length} item)
                  </h4>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: direction === 'in' ? '#4F46E5' : '#B45309', background: direction === 'in' ? '#EEF2FF' : '#FEF3C7', padding: '4px 12px', borderRadius: '8px', border: '1px solid ' + (direction === 'in' ? '#C7D2FE' : '#FDE68A')  }}>
                    {direction === 'in' ? 'Total Belanja Masuk: ' : 'Total Nilai Pemakaian (HPP): '}
                    <strong>{formatRupiah(cart.reduce((sum, c) => sum + (c.totalCost || 0), 0))}</strong>
                  </span>
                </div>

                <div style={{ border: '1px solid var(--border-subtle)', borderRadius: '12px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-input)', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>
                        <th style={{ padding: '10px 14px' }}>Nama Barang</th>
                        <th style={{ padding: '10px 14px' }}>Jumlah</th>
                        <th style={{ padding: '10px 14px' }}>{direction === 'in' ? 'Harga Beli Satuan' : 'HPP Rata-rata'}</th>
                        <th style={{ padding: '10px 14px' }}>{direction === 'in' ? 'Total Belanja' : 'Total Nilai Pakai'}</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cart.map((c, i) => (
                        <tr key={i} style={{ borderBottom: i < cart.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                          <td style={{ padding: '10px 14px', fontWeight: 700 }}>{c.productName}</td>
                          <td style={{ padding: '10px 14px', fontWeight: 800, color: '#4F46E5' }}>
                            {c.quantity} {c.unit}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#475569' }}>{formatRupiah(c.unitPrice)}</td>
                          <td style={{ padding: '10px 14px', fontWeight: 800, color: direction === 'in' ? '#0F172A' : '#B45309' }}>{formatRupiah(c.totalCost)}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <button 
                              type='button' 
                              onClick={() => handleRemoveFromCart(i)}
                              className='btn btn-ghost' 
                              style={{ color: '#ef4444', padding: '4px 8px' }}
                              title='Hapus baris'
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.88rem', border: '1px dashed var(--border-subtle)', borderRadius: '12px', marginBottom: '20px' }}>
                <ShoppingCart size={32} style={{ margin: '0 auto 8px auto', opacity: 0.3 }} />
                <div>Keranjang mutasi masih kosong.</div>
                <div style={{ fontSize: '0.78rem' }}>Pilih bahan baku di atas lalu klik tombol <b>"+ Tambah"</b>.</div>
              </div>
            )}

            <button
              type='button'
              disabled={submitting || cart.length === 0}
              onClick={handleSubmitBatch}
              className='btn btn-primary'
              style={{ width: '100%', padding: '13px', fontSize: '0.98rem', fontWeight: 800, borderRadius: '12px' }}
            >
              {submitting ? 'Menyimpan & Mensinkronkan...' : ('Simpan ' + cart.length + ' Item Mutasi Stok (' + (direction === 'in' ? 'Stok Masuk' : 'Stok Keluar') + ')')}
            </button>
          </div>
        </div>
      )}
      {/* TAB 3: RIWAYAT & LEDGER TRANSAKSI STOK */}
      {tab === 'history' && (
        <div className='glass-card' style={{ padding: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Jurnal Riwayat Mutasi Stok
              </h3>
              <p style={{ margin: '2px 0 0 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                Log audit masuk & keluar barang Bara Coffee
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                className='form-input'
                style={{ width: 'auto', minWidth: '120px', margin: 0, height: '38px', fontSize: '0.84rem' }}
                value={historyFilterType}
                onChange={(e) => setHistoryFilterType(e.target.value)}
              >
                <option value='ALL'>Semua Jenis</option>
                <option value='in'>Stok Masuk (Belanja)</option>
                <option value='out'>Stok Keluar (Pemakaian)</option>
              </select>

              <select
                className='form-input'
                style={{ width: 'auto', minWidth: '140px', margin: 0, height: '38px', fontSize: '0.84rem' }}
                value={historyFilterDestination}
                onChange={(e) => setHistoryFilterDestination(e.target.value)}
              >
                <option value='ALL'>Semua Outlet</option>
                <option value='kedai'>Kedai Utama</option>
                <option value='gerobak'>Gerobak Bara</option>
              </select>

              <button type='button' className='btn btn-secondary' onClick={loadData} style={{ height: '38px', padding: '0 12px' }}>
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Mini Summary Pemakaian Tab Riwayat */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '16px', padding: '12px', background: 'var(--bg-input)', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
            <div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Baris Tampil</span>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{filteredTransactions.length} Transaksi</div>
            </div>
            <div>
              <span style={{ fontSize: '0.74rem', color: '#4338CA', fontWeight: 700 }}>Pemakaian Kedai Utama</span>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#4338CA' }}>
                {formatRupiah(filteredTransactions.filter(t => t.type === 'out' && !String(t.destination || '').toLowerCase().includes('gerobak')).reduce((sum, t) => sum + (t.total_cost || 0), 0))}
              </div>
            </div>
            <div>
              <span style={{ fontSize: '0.74rem', color: '#B45309', fontWeight: 700 }}>Pemakaian Gerobak Bara</span>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#B45309' }}>
                {formatRupiah(filteredTransactions.filter(t => t.type === 'out' && String(t.destination || '').toLowerCase().includes('gerobak')).reduce((sum, t) => sum + (t.total_cost || 0), 0))}
              </div>
            </div>
            <div>
              <span style={{ fontSize: '0.74rem', color: '#10b981', fontWeight: 700 }}>Total Belanja Masuk</span>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#047857' }}>
                {formatRupiah(filteredTransactions.filter(t => t.type === 'in').reduce((sum, t) => sum + (t.total_cost || 0), 0))}
              </div>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-input)', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '10px 14px' }}>Tanggal</th>
                  <th style={{ padding: '10px 14px' }}>Jenis</th>
                  <th style={{ padding: '10px 14px' }}>Nama Barang</th>
                  <th style={{ padding: '10px 14px' }}>Jumlah</th>
                  <th style={{ padding: '10px 14px' }}>Harga Satuan / HPP</th>
                  <th style={{ padding: '10px 14px' }}>Total Nilai (Rp)</th>
                  <th style={{ padding: '10px 14px' }}>Tujuan / Lokasi</th>
                  <th style={{ padding: '10px 14px' }}>Keterangan</th>
                  <th style={{ padding: '10px 14px' }}>Penginput</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                      Belum ada riwayat mutasi stok.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => (
                    <tr key={tx.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{tx.transaction_date}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '10px',
                          fontSize: '0.74rem',
                          fontWeight: 800,
                          background: tx.type === 'in' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                          color: tx.type === 'in' ? '#10b981' : '#ef4444'
                        }}>
                          {tx.type === 'in' ? 'MASUK' : 'KELUAR'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 700 }}>{tx.product_name}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 800, color: tx.type === 'in' ? '#10b981' : '#ef4444' }}>
                        {tx.type === 'in' ? '+' : '-'}{tx.quantity} {tx.unit}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#475569' }}>
                        {tx.unit_price > 0 ? formatRupiah(tx.unit_price) : '-'}
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: tx.type === 'in' ? '#0F172A' : '#B45309' }}>
                        {tx.total_cost > 0 ? formatRupiah(tx.total_cost) : '-'}
                      </td>
                      <td style={{ padding: '10px 14px' }}>{tx.destination || 'Kedai'}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>{tx.notes}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{tx.recorded_by}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <button
                          type='button'
                          onClick={() => handleDeleteTx(tx.id)}
                          className='btn btn-ghost'
                          style={{ padding: '4px', color: '#ef4444' }}
                          title='Hapus baris mutasi'
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL EDIT MASTER BARANG & MINIMUM STOCK ALERT */}
      {editProd && createPortal(
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '16px'
        }}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: '20px',
            border: '1px solid var(--border-hover)',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.25)',
            maxWidth: '480px',
            width: '100%',
            padding: '24px',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Edit Master Bahan Baku
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID Barang: {editProd.id}</span>
              </div>
              <button
                type='button'
                className='btn btn-ghost'
                onClick={() => setEditProd(null)}
                style={{ padding: '4px 8px', borderRadius: '50%' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateProduct} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className='form-group' style={{ margin: 0 }}>
                <label className='form-label'>Nama Bahan / Barang</label>
                <input
                  type='text'
                  required
                  className='form-input'
                  value={editProd.name}
                  onChange={e => setEditProd({ ...editProd, name: e.target.value })}
                />
              </div>

              <div className='form-group' style={{ margin: 0 }}>
                <label className='form-label'>Kategori</label>
                <select
                  className='form-input'
                  value={editProd.category || 'Bahan Baku Bar'}
                  onChange={e => setEditProd({ ...editProd, category: e.target.value })}
                >
                  <option value='Bahan Baku Bar'>Bahan Baku Bar</option>
                  <option value='Bahan Baku Dapur'>Bahan Baku Dapur</option>
                  <option value='Kemasan / Packaging'>Kemasan / Packaging</option>
                  <option value='Lainnya'>Lainnya</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className='form-group' style={{ margin: 0 }}>
                  <label className='form-label'>Satuan Unit</label>
                  <input
                    type='text'
                    required
                    className='form-input'
                    placeholder='Kg, Liter, Pcs, Botol'
                    value={editProd.unit}
                    onChange={e => setEditProd({ ...editProd, unit: e.target.value })}
                  />
                </div>

                <div className='form-group' style={{ margin: 0 }}>
                  <label className='form-label' style={{ color: '#D97706', fontWeight: 800 }}>Batas Minimum Alert</label>
                  <input
                    type='number'
                    step='any'
                    required
                    className='form-input'
                    style={{ borderColor: '#F59E0B', background: '#FFFBEB' }}
                    value={editProd.min_stock}
                    onChange={e => setEditProd({ ...editProd, min_stock: e.target.value })}
                  />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Peringatan jika stok &le; angka ini</span>
                </div>
              </div>

              <div className='form-group' style={{ margin: 0 }}>
                <label className='form-label'>Estimasi Harga Beli Satuan (Rp)</label>
                <input
                  type='number'
                  className='form-input'
                  value={editProd.unit_price}
                  onChange={e => setEditProd({ ...editProd, unit_price: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)' }}>
                <button
                  type='button'
                  onClick={() => handleDeleteMasterProduct(editProd.id, editProd.name)}
                  className='btn btn-ghost'
                  style={{ color: '#ef4444', padding: '8px 12px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Trash2 size={15} /> Hapus Barang
                </button>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type='button' className='btn btn-secondary' onClick={() => setEditProd(null)}>Batal</button>
                  <button type='submit' className='btn btn-primary'>Simpan Perubahan</button>
                </div>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
      {/* MODAL TAMBAH MASTER BARANG BARU (DENGAN CREATEPORTAL SUPAYA TAMPIL POPUP TENGAH LAYAR) */}
      {showAddModal && createPortal(
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '16px'
        }}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: '20px',
            border: '1px solid var(--border-hover)',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.25)',
            maxWidth: '460px',
            width: '100%',
            padding: '24px',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Tambah Master Bahan Baru
              </h3>
              <button 
                type='button'
                className='btn btn-ghost' 
                onClick={() => setShowAddModal(false)} 
                style={{ padding: '4px 8px', borderRadius: '50%' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className='form-group' style={{ margin: 0 }}>
                <label className='form-label'>Nama Barang / Bahan Baku</label>
                <input 
                  type='text' 
                  required
                  className='form-input' 
                  placeholder='Contoh: Biji Kopi Robusta Dampit' 
                  value={newProd.name} 
                  onChange={e => setNewProd({ ...newProd, name: e.target.value })} 
                />
              </div>

              <div className='form-group' style={{ margin: 0 }}>
                <label className='form-label'>Kategori</label>
                <select 
                  className='form-input' 
                  value={newProd.category} 
                  onChange={e => setNewProd({ ...newProd, category: e.target.value })}
                >
                  <option value='Bahan Baku Bar'>Bahan Baku Bar</option>
                  <option value='Bahan Baku Dapur'>Bahan Baku Dapur</option>
                  <option value='Kemasan / Packaging'>Kemasan / Packaging</option>
                  <option value='Lainnya'>Lainnya</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className='form-group' style={{ margin: 0 }}>
                  <label className='form-label'>Satuan</label>
                  <input 
                    type='text' 
                    required
                    className='form-input' 
                    placeholder='Kg, Liter, Pcs, Botol' 
                    value={newProd.unit} 
                    onChange={e => setNewProd({ ...newProd, unit: e.target.value })} 
                  />
                </div>

                <div className='form-group' style={{ margin: 0 }}>
                  <label className='form-label'>Batas Minimum Alert</label>
                  <input 
                    type='number' 
                    className='form-input' 
                    value={newProd.min_stock} 
                    onChange={e => setNewProd({ ...newProd, min_stock: e.target.value })} 
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className='form-group' style={{ margin: 0 }}>
                  <label className='form-label'>Saldo Stok Awal Saat Ini</label>
                  <input 
                    type='number' 
                    step='any'
                    className='form-input' 
                    placeholder='Contoh: 10' 
                    value={newProd.initial_stock} 
                    onChange={e => setNewProd({ ...newProd, initial_stock: e.target.value })} 
                  />
                </div>

                <div className='form-group' style={{ margin: 0 }}>
                  <label className='form-label'>Estimasi Harga Beli (Rp)</label>
                  <input 
                    type='number' 
                    className='form-input' 
                    placeholder='Harga satuan' 
                    value={newProd.unit_price} 
                    onChange={e => setNewProd({ ...newProd, unit_price: e.target.value })} 
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button type='button' className='btn btn-secondary' onClick={() => setShowAddModal(false)}>Batal</button>
                <button type='submit' className='btn btn-primary'>Simpan Master Bahan</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}