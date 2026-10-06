import React, { useState, useEffect, useMemo } from 'react';
import { 
  Receipt, 
  TrendingUp, 
  RefreshCw, 
  Calendar, 
  ShoppingBag, 
  CreditCard, 
  AlertCircle, 
  CheckCircle2, 
  Search, 
  ExternalLink,
  DollarSign,
  Layers,
  ArrowUpRight,
  Filter,
  BarChart2,
  Clock,
  ChevronRight,
  Wallet,
  QrCode,
  Banknote,
  Truck,
  Eye,
  X,
  FileText
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { formatIDR, formatDateID } from '../lib/formatters';
import { 
  getKasirProApiKey, 
  fetchKasirProSalesSummary, 
  fetchKasirProTransactions, 
  fetchAllKasirProTransactions,
  fetchKasirProTransactionDetail,
  fetchKasirProProductSales,
  fetchKasirProCatalog,
  testKasirProConnection
} from '../lib/kasirProService';

export default function KasirProView({ onNavigateToSettings, onNavigateToInput }) {
  const apiKey = getKasirProApiKey();

  // Helper format local YYYY-MM-DD (WIB / Local timezone safe)
  const formatLocalDate = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Date Filters (default: hari ini)
  const todayStr = useMemo(() => formatLocalDate(new Date()), []);
  const [fromDate, setFromDate] = useState(todayStr);
  const [toDate, setToDate] = useState(todayStr);

  // Quick preset filter
  const [activePreset, setActivePreset] = useState('today');

  // Sub Tab: 'summary' | 'transactions' | 'products'
  const [activeSubTab, setActiveSubTab] = useState('summary');

  // Data states
  const [storeInfo, setStoreInfo] = useState(null);
  const [summaryData, setSummaryData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [productsData, setProductsData] = useState([]);
  const [catalogMap, setCatalogMap] = useState({}); // produk_id -> { kategori, sku, satuan }

  // Loading & Error states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [searchTrx, setSearchTrx] = useState('');
  const [selectedPaymentFilter, setSelectedPaymentFilter] = useState('ALL');
  const [selectedShiftFilter, setSelectedShiftFilter] = useState('ALL');

  // Transaction Detail Modal States
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState(null);
  const [orderDetailData, setOrderDetailData] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState(null);

  // Product tab filter states
  const [searchProduct, setSearchProduct] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]); // array string nama kategori (kosong = semua)

  // Handle preset date switches
  const applyPreset = (preset) => {
    setActivePreset(preset);
    const now = new Date();
    if (preset === 'today') {
      const d = formatLocalDate(now);
      setFromDate(d);
      setToDate(d);
    } else if (preset === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const d = formatLocalDate(y);
      setFromDate(d);
      setToDate(d);
    } else if (preset === 'this_month') {
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const firstDay = `${year}-${month}-01`;
      const currentDay = formatLocalDate(now);
      setFromDate(firstDay);
      setToDate(currentDay);
    } else if (preset === 'last_7_days') {
      const past = new Date();
      past.setDate(past.getDate() - 6);
      setFromDate(formatLocalDate(past));
      setToDate(formatLocalDate(now));
    }
  };

  // Load Store Info on mount
  useEffect(() => {
    if (!apiKey) return;
    testKasirProConnection().then(res => {
      if (res.success) {
        setStoreInfo(res.data);
      }
    });
  }, [apiKey]);

  // Load Data
  const loadData = async () => {
    if (!apiKey) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      if (activeSubTab === 'summary') {
        const [sumRes, trxRes] = await Promise.all([
          fetchKasirProSalesSummary(fromDate, toDate),
          fetchAllKasirProTransactions(fromDate, toDate, 3000).catch(() => ({ data: [] }))
        ]);
        setSummaryData(sumRes);
        setTransactions(trxRes.data || []);
      } else if (activeSubTab === 'transactions') {
        const res = await fetchAllKasirProTransactions(fromDate, toDate, 3000);
        setTransactions(res.data || []);
      } else if (activeSubTab === 'products') {
        const [prodRes, catRes] = await Promise.all([
          fetchKasirProProductSales(fromDate, toDate),
          fetchKasirProCatalog(1, 200).catch(() => ({ data: [] }))
        ]);
        setProductsData(prodRes.data || []);
        
        // Build map produk_id -> { kategori, sku, satuan }
        if (catRes.data && Array.isArray(catRes.data)) {
          const map = {};
          catRes.data.forEach(p => {
            map[p.id] = {
              kategori: p.kategori?.nama || p.kategori || 'Umum',
              sku: p.sku || '',
              satuan: p.satuan || 'porsi'
            };
          });
          setCatalogMap(map);
        }
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Gagal memuat data dari KasirPro.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [apiKey, fromDate, toDate, activeSubTab]);

  // Handler untuk membuka modal rincian order
  const handleOpenOrderDetail = async (trx) => {
    setSelectedOrderForDetail(trx);
    setLoadingDetail(true);
    setDetailError(null);
    setOrderDetailData(null);

    // Cek apakah trx.items sudah ada dan memiliki harga/subtotal yang valid
    const hasFullItems = trx.items && Array.isArray(trx.items) && trx.items.length > 0 && 
      trx.items.some(it => (it.harga || it.harga_satuan || it.subtotal || it.total || it.nilai));

    if (hasFullItems) {
      setOrderDetailData(trx);
      setLoadingDetail(false);
      return;
    }

    try {
      // Gunakan trx.id jika ada, atau trx.nota
      const targetId = trx.id || trx.nota;
      const res = await fetchKasirProTransactionDetail(targetId);
      
      // Ambil objek detail terdalam jika dibungkus oleh backend
      const detail = res?.data || res;
      console.log('KasirPro Order Detail Response:', detail);

      // Gabungkan dengan data order dasar jika detail tidak memiliki beberapa metadata
      setOrderDetailData({
        ...trx,
        ...detail,
        items: detail.items || detail.rincian || detail.details || detail.produk || trx.items || []
      });
    } catch (err) {
      console.warn('Gagal mengambil rincian transaksi detail dari KasirPro:', err);
      setDetailError(err.message || 'Rincian item tidak lengkap dari server KasirPro.');
      setOrderDetailData(trx);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCloseOrderDetail = () => {
    setSelectedOrderForDetail(null);
    setOrderDetailData(null);
    setDetailError(null);
  };

  // Breakdown kanal pembayaran dari transaksi
  const paymentBreakdown = useMemo(() => {
    if (!transactions || transactions.length === 0) return null;

    let cash = 0;
    let qris = 0;
    let edc = 0;
    let delivery = 0;
    let transfer = 0;
    let other = 0;
    let totalNetTrx = 0;

    transactions.forEach(t => {
      const net = Math.max(0, (Number(t.total) || 0) - (Number(t.refund) || 0));
      totalNetTrx += net;
      const m = (t.metode || '').toLowerCase();
      const notaStr = (t.nota || '').toLowerCase();

      // 1. Delivery Online (GoFood, GrabFood, ShopeeFood)
      if (
        m.includes('gofood') || m.includes('go-food') || m.includes('go food') ||
        m.includes('grab') || m.includes('grabfood') || m.includes('grab food') ||
        m.includes('shopee') || m.includes('shopeefood') || m.includes('shopee food') ||
        m.includes('maxim') || m.includes('delivery') || m.includes('online') ||
        notaStr.includes('gf-') || notaStr.includes('grb-') || notaStr.includes('sp-')
      ) {
        delivery += net;
      } 
      // 2. Tunai
      else if (m.includes('tunai') || m.includes('cash')) {
        cash += net;
      } 
      // 3. QRIS
      else if (m.includes('qris') || m.includes('gopay') || m.includes('ovo') || m.includes('dana') || m.includes('linkaja')) {
        qris += net;
      } 
      // 4. EDC
      else if (m.includes('edc') || m.includes('debit') || m.includes('kartu') || m.includes('kredit') || m.includes('card')) {
        edc += net;
      } 
      // 5. Transfer
      else if (m.includes('transfer') || m.includes('bca') || m.includes('mandiri') || m.includes('bri') || m.includes('bni')) {
        transfer += net;
      } 
      else {
        other += net;
      }
    });

    const divisor = totalNetTrx || 1;
    return {
      cash,
      qris,
      edc,
      delivery,
      transfer,
      other,
      totalNetTrx,
      cashPct: Math.round((cash / divisor) * 100),
      qrisPct: Math.round((qris / divisor) * 100),
      edcPct: Math.round((edc / divisor) * 100),
      deliveryPct: Math.round((delivery / divisor) * 100),
      transferPct: Math.round((transfer / divisor) * 100),
      otherPct: Math.round((other / divisor) * 100)
    };
  }, [transactions]);

  // Filtered transactions by search, payment method & shift
  const filteredTransactions = useMemo(() => {
    // Helper konversi "HH:mm" atau "HH:mm:ss" ke menit
    const parseTimeToMinutes = (timeStr) => {
      if (!timeStr) return 720;
      const parts = timeStr.split(':');
      const h = parseInt(parts[0], 10) || 0;
      const m = parseInt(parts[1], 10) || 0;
      return (h * 60) + m;
    };

    return transactions.filter(t => {
      // 1. Text search filter
      if (searchTrx.trim()) {
        const q = searchTrx.toLowerCase();
        const matchesSearch = (t.nota && t.nota.toLowerCase().includes(q)) ||
                              (t.metode && t.metode.toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }

      // 2. Shift filter (Pagi: 06:00 - 15:00, Malam: 15:00 - 23:59)
      if (selectedShiftFilter !== 'ALL') {
        const mins = parseTimeToMinutes(t.waktu);
        if (selectedShiftFilter === 'PAGI') {
          if (mins < 360 || mins >= 900) return false;
        } else if (selectedShiftFilter === 'MALAM') {
          if (mins < 900 || mins > 1439) return false;
        }
      }

      // 3. Payment method filter
      if (selectedPaymentFilter === 'ALL') return true;

      const m = (t.metode || '').toLowerCase();
      const notaStr = (t.nota || '').toLowerCase();

      if (selectedPaymentFilter === 'DELIVERY') {
        return m.includes('gofood') || m.includes('go-food') || m.includes('go food') ||
               m.includes('grab') || m.includes('grabfood') || m.includes('grab food') ||
               m.includes('shopee') || m.includes('shopeefood') || m.includes('shopee food') ||
               m.includes('maxim') || m.includes('delivery') || m.includes('online') ||
               notaStr.includes('gf-') || notaStr.includes('grb-') || notaStr.includes('sp-');
      }

      if (selectedPaymentFilter === 'CASH') {
        return (m.includes('tunai') || m.includes('cash')) && 
               !m.includes('gofood') && !m.includes('grab') && !m.includes('shopee');
      }

      if (selectedPaymentFilter === 'QRIS') {
        return m.includes('qris') || m.includes('gopay') || m.includes('ovo') || m.includes('dana');
      }

      if (selectedPaymentFilter === 'EDC') {
        return m.includes('edc') || m.includes('debit') || m.includes('kartu') || m.includes('kredit') || m.includes('card');
      }

      if (selectedPaymentFilter === 'TRANSFER') {
        return m.includes('transfer') || m.includes('bca') || m.includes('mandiri') || m.includes('bri') || m.includes('bni');
      }

      return true;
    });
  }, [transactions, searchTrx, selectedPaymentFilter, selectedShiftFilter]);

  // Total summary untuk transaksi yang sedang terfilter
  const filteredTotals = useMemo(() => {
    let totalNominal = 0;
    let totalRefund = 0;

    filteredTransactions.forEach(t => {
      totalNominal += Number(t.total) || 0;
      totalRefund += Number(t.refund) || 0;
    });

    const netNominal = Math.max(0, totalNominal - totalRefund);

    return {
      count: filteredTransactions.length,
      totalGross: totalNominal,
      totalRefund,
      netNominal
    };
  }, [filteredTransactions]);

  // Daftar seluruh kategori yang ada
  const availableCategories = useMemo(() => {
    const set = new Set();
    productsData.forEach(p => {
      const cat = catalogMap[p.produk_id]?.kategori || 'Umum';
      set.add(cat);
    });
    return Array.from(set).sort();
  }, [productsData, catalogMap]);

  // Filter produk berdasarkan pencarian dan multiple kategori
  const filteredProducts = useMemo(() => {
    return productsData.filter(p => {
      // 1. Text search
      if (searchProduct.trim()) {
        const q = searchProduct.toLowerCase();
        if (!p.nama || !p.nama.toLowerCase().includes(q)) return false;
      }

      // 2. Category filter (multiple selection)
      if (selectedCategories.length > 0) {
        const cat = catalogMap[p.produk_id]?.kategori || 'Umum';
        if (!selectedCategories.includes(cat)) return false;
      }

      return true;
    });
  }, [productsData, catalogMap, searchProduct, selectedCategories]);

  // Ringkasan metrik produk terfilter
  const filteredProductsTotals = useMemo(() => {
    let totalQty = 0;
    let totalNilai = 0;

    filteredProducts.forEach(p => {
      totalQty += Number(p.qty) || 0;
      totalNilai += Number(p.nilai) || 0;
    });

    return {
      count: filteredProducts.length,
      totalQty,
      totalNilai
    };
  }, [filteredProducts]);

  // Breakdown performa per kategori (total omset & porsi per kategori)
  const categoryBreakdown = useMemo(() => {
    const map = {};
    let totalAllVal = 0;

    productsData.forEach(p => {
      const cat = catalogMap[p.produk_id]?.kategori || 'Umum';
      const val = Number(p.nilai) || 0;
      const qty = Number(p.qty) || 0;
      totalAllVal += val;

      if (!map[cat]) {
        map[cat] = { nama: cat, totalNilai: 0, totalQty: 0, count: 0 };
      }
      map[cat].totalNilai += val;
      map[cat].totalQty += qty;
      map[cat].count += 1;
    });

    const list = Object.values(map);
    list.sort((a, b) => b.totalNilai - a.totalNilai);

    return list.map(item => ({
      ...item,
      pct: totalAllVal > 0 ? Math.round((item.totalNilai / totalAllVal) * 100) : 0
    }));
  }, [productsData, catalogMap]);

  // Helper toggle kategori (bisa pilih beberapa sekaligus)
  const toggleCategory = (catName) => {
    setSelectedCategories(prev => {
      if (prev.includes(catName)) {
        return prev.filter(c => c !== catName);
      } else {
        return [...prev, catName];
      }
    });
  };

  // Jika API Key belum disetel
  if (!apiKey) {
    return (
      <div className="animate-fade-in" style={{ maxWidth: '780px', margin: '30px auto', textAlign: 'center' }}>
        <div className="glass-card" style={{ padding: '36px 24px', borderColor: 'rgba(207, 58, 74, 0.3)' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'rgba(207, 58, 74, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px auto'
          }}>
            <Receipt size={28} color="#cf3a4a" />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>
            Hubungkan KasirPro API
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '520px', margin: '0 auto 20px auto', lineHeight: 1.6 }}>
            Pantau omset penjualan, jumlah transaksi, dan menu terlaris secara real-time langsung dari mesin kasir KasirPro toko Bara Coffee.
          </p>

          <div style={{
            background: 'var(--bg-input)',
            padding: '16px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            maxWidth: '480px',
            margin: '0 auto 24px auto',
            textAlign: 'left',
            fontSize: '0.84rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.6
          }}>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>Langkah mudah aktivasi:</div>
            1. Buka <strong>backoffice.kasirpro.com</strong> → menu <strong>API Akses</strong>.<br />
            2. Buat kunci baru (Mode: <em>Hanya Baca</em>, Scope: <code>laporan</code> & <code>transaksi</code>).<br />
            3. Salin token (<code>kp_live_...</code>) dan tempel di Pengaturan Bara Coffee.
          </div>

          <button 
            onClick={onNavigateToSettings}
            className="btn btn-primary"
            style={{ padding: '10px 24px', fontSize: '0.92rem' }}
          >
            <span>Buka Pengaturan untuk Masukkan Kunci</span>
            <ArrowUpRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1060px', margin: '0 auto', paddingBottom: '60px' }}>
      
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Receipt size={24} color="#cf3a4a" />
              <span>Monitoring KasirPro POS</span>
            </h2>
            {storeInfo && (
              <span className="badge" style={{ background: 'rgba(207, 58, 74, 0.15)', color: '#cf3a4a', border: '1px solid rgba(207, 58, 74, 0.3)', fontWeight: 700 }}>
                🏪 {storeInfo.toko?.nama || 'Toko Kasir'} ({storeInfo.lisensi})
              </span>
            )}
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
            Integrasi live data pesanan dan omset resmi dari server KasirPro.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button 
            onClick={loadData} 
            disabled={loading}
            className="btn btn-secondary" 
            style={{ fontSize: '0.82rem', padding: '6px 14px' }}
            title="Segarkan data terbaru"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>{loading ? 'Menyinkronkan...' : 'Segarkan Data'}</span>
          </button>
        </div>
      </div>

      {/* Date & Preset Filter Toolbar */}
      <div className="glass-card" style={{ padding: '16px 20px', marginBottom: '22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          
          {/* Quick Presets */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[
              { id: 'today', label: 'Hari Ini' },
              { id: 'yesterday', label: 'Kemarin' },
              { id: 'last_7_days', label: '7 Hari Terakhir' },
              { id: 'this_month', label: 'Bulan Ini' }
            ].map(preset => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset.id)}
                style={{
                  background: activePreset === preset.id ? 'var(--burgundy-primary)' : 'var(--bg-input)',
                  color: activePreset === preset.id ? '#ffffff' : 'var(--text-secondary)',
                  border: `1px solid ${activePreset === preset.id ? 'var(--burgundy-primary)' : 'var(--border-subtle)'}`,
                  borderRadius: '8px',
                  padding: '5px 12px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Custom Date Pickers */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Dari:</span>
              <input 
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setActivePreset('custom');
                }}
                className="form-input"
                style={{ padding: '4px 8px', fontSize: '0.8rem', width: '135px' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Sampai:</span>
              <input 
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setActivePreset('custom');
                }}
                className="form-input"
                style={{ padding: '4px 8px', fontSize: '0.8rem', width: '135px' }}
              />
            </div>
          </div>

        </div>
      </div>

      {/* Error Notice */}
      {errorMsg && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          background: 'rgba(231, 111, 81, 0.1)',
          border: '1px solid rgba(231, 111, 81, 0.3)',
          color: 'var(--danger)',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '20px'
        }}>
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Sub Tabs Selection */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '20px', paddingBottom: '2px' }}>
        <button
          onClick={() => setActiveSubTab('summary')}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: activeSubTab === 'summary' ? '2px solid #cf3a4a' : '2px solid transparent',
            color: activeSubTab === 'summary' ? '#cf3a4a' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: '0.9rem',
            padding: '8px 14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <TrendingUp size={16} />
          <span>Ringkasan Omset</span>
        </button>

        <button
          onClick={() => setActiveSubTab('transactions')}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: activeSubTab === 'transactions' ? '2px solid #cf3a4a' : '2px solid transparent',
            color: activeSubTab === 'transactions' ? '#cf3a4a' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: '0.9rem',
            padding: '8px 14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Receipt size={16} />
          <span>Daftar Order / Nota</span>
          {transactions.length > 0 && (
            <span className="badge" style={{ 
              background: activeSubTab === 'transactions' ? 'rgba(207, 58, 74, 0.15)' : 'var(--bg-input)', 
              color: activeSubTab === 'transactions' ? '#cf3a4a' : 'var(--text-muted)', 
              fontSize: '0.7rem',
              padding: '2px 6px'
            }}>
              {transactions.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('products')}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: activeSubTab === 'products' ? '2px solid #cf3a4a' : '2px solid transparent',
            color: activeSubTab === 'products' ? '#cf3a4a' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: '0.9rem',
            padding: '8px 14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <ShoppingBag size={16} />
          <span>Menu / Produk Terjual</span>
        </button>
      </div>

      {/* SUB TAB 1: RINGKASAN OMSET */}
      {activeSubTab === 'summary' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* KPI Metrics Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            
            {/* Total Net Omset */}
            <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid #cf3a4a' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
                  Total Omset Bersih (Net)
                </span>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(207, 58, 74, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <DollarSign size={17} color="#cf3a4a" />
                </div>
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                {summaryData ? formatIDR(summaryData.total?.omzet || 0) : 'Rp 0'}
              </div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                Periode: {fromDate === toDate ? formatDateID(fromDate) : `${fromDate} s/d ${toDate}`}
              </span>
            </div>

            {/* Total Transaksi */}
            <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid var(--info)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
                  Total Transaksi / Order
                </span>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(58, 134, 255, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Receipt size={17} color="var(--info)" />
                </div>
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                {summaryData ? (summaryData.total?.trx || 0).toLocaleString('id-ID') : '0'} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-muted)' }}>Struk</span>
              </div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                Rata-rata order: {summaryData && summaryData.total?.trx > 0 ? formatIDR(Math.round(summaryData.total.omzet / summaryData.total.trx)) : 'Rp 0'} / trx
              </span>
            </div>

            {/* Rata-rata Harian */}
            <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid var(--gold-light)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
                  Jumlah Hari Terdata
                </span>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(233, 196, 106, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Calendar size={17} color="var(--gold-light)" />
                </div>
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                {summaryData?.per_hari?.length || 1} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-muted)' }}>Hari</span>
              </div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                Rata-rata omset: {summaryData && summaryData.per_hari?.length ? formatIDR(Math.round(summaryData.total.omzet / summaryData.per_hari.length)) : 'Rp 0'} / hari
              </span>
            </div>

          </div>

          {/* Breakdown Kanal Pembayaran (Tunai, QRIS, EDC, Transfer) */}
          {paymentBreakdown && (
            <div className="glass-card" style={{ padding: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CreditCard size={18} color="#cf3a4a" />
                    <span>Breakdown Kanal Pembayaran (Kasir)</span>
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Rincian omset berdasarkan metode pembayaran yang digunakan pelanggan di kasir.
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="badge badge-primary" style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                    Total Terinci: {formatIDR(paymentBreakdown.totalNetTrx)}
                  </span>
                  {summaryData?.total?.omzet && Math.abs(paymentBreakdown.totalNetTrx - (summaryData.total.omzet || 0)) <= 100 ? (
                    <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>
                      ✓ 100% Sesuai Omset
                    </span>
                  ) : (
                    <span className="badge" style={{ background: 'var(--bg-input)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {transactions.length} Nota Teranalisis
                    </span>
                  )}
                </div>
              </div>

              {/* Progress Bar Visual */}
              <div style={{ height: '10px', borderRadius: '999px', background: 'var(--bg-input)', overflow: 'hidden', display: 'flex', marginBottom: '20px' }}>
                {paymentBreakdown.qris > 0 && (
                  <div style={{ width: `${paymentBreakdown.qrisPct}%`, background: '#3a86ff' }} title={`QRIS: ${paymentBreakdown.qrisPct}%`} />
                )}
                {paymentBreakdown.cash > 0 && (
                  <div style={{ width: `${paymentBreakdown.cashPct}%`, background: '#2ec4b6' }} title={`Tunai: ${paymentBreakdown.cashPct}%`} />
                )}
                {paymentBreakdown.delivery > 0 && (
                  <div style={{ width: `${paymentBreakdown.deliveryPct}%`, background: '#f59e0b' }} title={`Delivery (GoFood/Grab): ${paymentBreakdown.deliveryPct}%`} />
                )}
                {paymentBreakdown.edc > 0 && (
                  <div style={{ width: `${paymentBreakdown.edcPct}%`, background: '#e9c46a' }} title={`EDC/Kartu: ${paymentBreakdown.edcPct}%`} />
                )}
                {paymentBreakdown.transfer > 0 && (
                  <div style={{ width: `${paymentBreakdown.transferPct}%`, background: '#9d4edd' }} title={`Transfer: ${paymentBreakdown.transferPct}%`} />
                )}
                {paymentBreakdown.other > 0 && (
                  <div style={{ width: `${paymentBreakdown.otherPct}%`, background: '#94a3b8' }} title={`Lainnya: ${paymentBreakdown.otherPct}%`} />
                )}
              </div>

              {/* Grid 5 Kartu Metode Pembayaran */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                
                {/* 1. QRIS */}
                <div style={{ background: 'var(--bg-input)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 700, color: '#3a86ff' }}>
                      <QrCode size={16} /> <span>QRIS</span>
                    </div>
                    <span className="badge" style={{ background: 'rgba(58, 134, 255, 0.15)', color: '#3a86ff', fontSize: '0.72rem' }}>
                      {paymentBreakdown.qrisPct}%
                    </span>
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {formatIDR(paymentBreakdown.qris)}
                  </div>
                </div>

                {/* 2. TUNAI / CASH */}
                <div style={{ background: 'var(--bg-input)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 700, color: '#2ec4b6' }}>
                      <Banknote size={16} /> <span>Tunai (Cash)</span>
                    </div>
                    <span className="badge" style={{ background: 'rgba(46, 196, 182, 0.15)', color: '#2ec4b6', fontSize: '0.72rem' }}>
                      {paymentBreakdown.cashPct}%
                    </span>
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {formatIDR(paymentBreakdown.cash)}
                  </div>
                </div>

                {/* 3. DELIVERY (GOFOOD / GRABFOOD) */}
                <div style={{ background: 'var(--bg-input)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 700, color: '#f59e0b' }}>
                      <Truck size={16} /> <span>Delivery App</span>
                    </div>
                    <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#d97706', fontSize: '0.72rem' }}>
                      {paymentBreakdown.deliveryPct}%
                    </span>
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {formatIDR(paymentBreakdown.delivery)}
                  </div>
                </div>

                {/* 4. EDC / KARTU DEBIT-KREDIT */}
                <div style={{ background: 'var(--bg-input)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 700, color: '#e9c46a' }}>
                      <CreditCard size={16} /> <span>EDC / Mesin Kartu</span>
                    </div>
                    <span className="badge" style={{ background: 'rgba(233, 196, 106, 0.15)', color: '#b45309', fontSize: '0.72rem' }}>
                      {paymentBreakdown.edcPct}%
                    </span>
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {formatIDR(paymentBreakdown.edc)}
                  </div>
                </div>

                {/* 5. TRANSFER */}
                <div style={{ background: 'var(--bg-input)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 700, color: '#9d4edd' }}>
                      <Wallet size={16} /> <span>Transfer Bank</span>
                    </div>
                    <span className="badge" style={{ background: 'rgba(157, 78, 221, 0.15)', color: '#9d4edd', fontSize: '0.72rem' }}>
                      {paymentBreakdown.transferPct}%
                    </span>
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {formatIDR(paymentBreakdown.transfer)}
                  </div>
                </div>

                {/* 6. LAINNYA / MULTI-PAYMENT (JIKA ADA) */}
                {paymentBreakdown.other > 0 && (
                  <div style={{ background: 'var(--bg-input)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 700, color: '#64748b' }}>
                        <CreditCard size={16} /> <span>Lainnya</span>
                      </div>
                      <span className="badge" style={{ background: 'rgba(100, 116, 139, 0.15)', color: '#64748b', fontSize: '0.72rem' }}>
                        {paymentBreakdown.otherPct}%
                      </span>
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {formatIDR(paymentBreakdown.other)}
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}
          {summaryData?.per_hari && summaryData.per_hari.length > 1 && (
            <div className="glass-card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart2 size={16} color="#cf3a4a" />
                <span>Rincian Omset Per Hari</span>
              </h3>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase' }}>
                      <th style={{ padding: '8px 12px' }}>Tanggal</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center' }}>Order / Trx</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Omset Bersih</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Rata-rata / Trx</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryData.per_hari.map((row) => (
                      <tr key={row.tanggal} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {formatDateID(row.tanggal)}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span className="badge" style={{ background: 'var(--bg-input)', fontSize: '0.74rem' }}>
                            {row.trx} trx
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#cf3a4a' }}>
                          {formatIDR(row.omzet)}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                          {row.trx > 0 ? formatIDR(Math.round(row.omzet / row.trx)) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

      {/* SUB TAB 2: DAFTAR TRANSAKSI / NOTA */}
      {activeSubTab === 'transactions' && (
        <div className="glass-card" style={{ padding: '20px' }}>
          
          {/* Header & Search */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Daftar Nota Transaksi
              </h3>
              <span className="badge badge-primary" style={{ fontSize: '0.72rem' }}>
                {filteredTransactions.length} dari {transactions.length} Nota
              </span>
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative', width: '220px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text"
                placeholder="Cari no. nota / nama..."
                value={searchTrx}
                onChange={(e) => setSearchTrx(e.target.value)}
                className="form-input"
                style={{ padding: '6px 10px 6px 30px', fontSize: '0.8rem' }}
              />
            </div>
          </div>

          {/* Filters Bar: Shift & Payment Type */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
            
            {/* Row 1: Shift Filter */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, minWidth: '70px' }}>
                Filter Shift:
              </span>
              {[
                { id: 'ALL', label: 'Semua Shift' },
                { id: 'PAGI', label: '☀️ Shift Pagi (06:00 - 15:00)' },
                { id: 'MALAM', label: '🌙 Shift Malam (15:00 - 23:59)' }
              ].map(btn => {
                const isActive = selectedShiftFilter === btn.id;
                return (
                  <button
                    key={btn.id}
                    type="button"
                    onClick={() => setSelectedShiftFilter(btn.id)}
                    style={{
                      background: isActive ? 'var(--burgundy-primary)' : 'var(--bg-input)',
                      color: isActive ? '#ffffff' : 'var(--text-secondary)',
                      border: `1px solid ${isActive ? 'var(--burgundy-primary)' : 'var(--border-subtle)'}`,
                      borderRadius: '8px',
                      padding: '5px 12px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {btn.label}
                  </button>
                );
              })}
            </div>

            {/* Row 2: Payment Method Filter */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, minWidth: '70px' }}>
                Filter Tipe:
              </span>
              {[
                { id: 'ALL', label: 'Semua Tipe' },
                { id: 'DELIVERY', label: '🚚 Delivery (GoFood/Grab)', color: '#d97706', bg: 'rgba(245, 158, 11, 0.15)' },
                { id: 'QRIS', label: '📱 QRIS', color: '#3a86ff', bg: 'rgba(58, 134, 255, 0.15)' },
                { id: 'CASH', label: '💵 Tunai', color: '#2ec4b6', bg: 'rgba(46, 196, 182, 0.15)' },
                { id: 'EDC', label: '💳 EDC / Kartu', color: '#b45309', bg: 'rgba(233, 196, 106, 0.15)' },
                { id: 'TRANSFER', label: '🏦 Transfer', color: '#9d4edd', bg: 'rgba(157, 78, 221, 0.15)' }
              ].map(btn => {
                const isActive = selectedPaymentFilter === btn.id;
                return (
                  <button
                    key={btn.id}
                    type="button"
                    onClick={() => setSelectedPaymentFilter(btn.id)}
                    style={{
                      background: isActive ? (btn.color || 'var(--burgundy-primary)') : 'var(--bg-input)',
                      color: isActive ? '#ffffff' : (btn.color || 'var(--text-secondary)'),
                      border: `1px solid ${isActive ? (btn.color || 'var(--burgundy-primary)') : 'var(--border-subtle)'}`,
                      borderRadius: '8px',
                      padding: '5px 11px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {btn.label}
                  </button>
                );
              })}
            </div>

          </div>

          {/* Total Ringkasan Filtered Transactions Banner */}
          <div style={{
            background: 'var(--bg-input)',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                Total Transaksi ({selectedShiftFilter === 'ALL' ? 'Semua Shift' : selectedShiftFilter === 'PAGI' ? 'Shift Pagi ☀️' : 'Shift Malam 🌙'} • {selectedPaymentFilter === 'ALL' ? 'Semua Tipe' : selectedPaymentFilter}):
              </span>
              <strong style={{ fontSize: '1.15rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                {formatIDR(filteredTotals.netNominal)}
              </strong>
            </div>

            <div style={{ display: 'flex', gap: '14px', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <span>Jumlah: <strong>{filteredTotals.count} Struk</strong></span>
              {filteredTotals.totalRefund > 0 && (
                <span style={{ color: 'var(--danger)' }}>Refund: <strong>{formatIDR(filteredTotals.totalRefund)}</strong></span>
              )}
            </div>
          </div>

          {filteredTransactions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {loading ? 'Memuat transaksi dari KasirPro...' : 'Tidak ada transaksi yang sesuai dengan filter yang dipilih.'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '8px 12px' }}>No. Nota</th>
                    <th style={{ padding: '8px 12px' }}>Waktu</th>
                    <th style={{ padding: '8px 12px' }}>Metode Bayar</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total Transaksi</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>Status</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>Rincian Item</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((trx) => {
                    const m = (trx.metode || '').toLowerCase();
                    const notaStr = (trx.nota || '').toLowerCase();
                    const isDelivery = m.includes('gofood') || m.includes('grab') || m.includes('shopee') || m.includes('delivery') || notaStr.includes('gf-') || notaStr.includes('grb-');
                    const isQris = m.includes('qris') || m.includes('gopay') || m.includes('ovo') || m.includes('dana');
                    const isCash = m.includes('tunai') || m.includes('cash');

                    return (
                      <tr 
                        key={trx.id || trx.nota} 
                        style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s ease' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(79, 70, 229, 0.04)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                          {trx.nota}
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                          <Clock size={12} style={{ display: 'inline', marginRight: '4px' }} />
                          {trx.waktu || trx.tanggal}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span className="badge" style={{ 
                            background: isDelivery ? 'rgba(245, 158, 11, 0.15)' : isQris ? 'rgba(58, 134, 255, 0.12)' : isCash ? 'rgba(46, 196, 182, 0.15)' : 'rgba(233, 196, 106, 0.15)',
                            color: isDelivery ? '#d97706' : isQris ? 'var(--info)' : isCash ? '#2ec4b6' : 'var(--gold-light)',
                            fontSize: '0.72rem',
                            fontWeight: 700
                          }}>
                            {isDelivery && <Truck size={11} style={{ display: 'inline', marginRight: '3px' }} />}
                            {trx.metode || 'Tunai'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {formatIDR(trx.total || 0)}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          {trx.refund > 0 ? (
                            <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>Refund: {formatIDR(trx.refund)}</span>
                          ) : (
                            <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>✓ Berhasil</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenOrderDetail(trx)}
                            className="btn btn-secondary"
                            style={{
                              padding: '5px 10px',
                              fontSize: '0.75rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              borderRadius: '6px'
                            }}
                            title="Klik untuk melihat breakdown menu / item yang dibeli"
                          >
                            <Eye size={13} color="var(--burgundy-primary)" />
                            <span>Lihat Item</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border-subtle)', fontWeight: 700, background: 'rgba(0,0,0,0.02)' }}>
                    <td colSpan={3} style={{ padding: '12px', textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      TOTAL ({filteredTransactions.length} Struk):
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', fontSize: '1rem', color: '#cf3a4a' }}>
                      {formatIDR(filteredTotals.netNominal)}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

        </div>
      )}

      {/* SUB TAB 3: PRODUK / MENU TERJUAL */}
      {activeSubTab === 'products' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Section: Kartu Performa Per Kategori */}
          {categoryBreakdown && categoryBreakdown.length > 0 && (
            <div className="glass-card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Layers size={18} color="#cf3a4a" />
                    <span>Performa Penjualan Per Kategori</span>
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Klik salah satu atau beberapa kartu kategori di bawah untuk menyaring produk di tabel secara instan.
                  </p>
                </div>
                {selectedCategories.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedCategories([])}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                  >
                    Reset Filter ({selectedCategories.length} Dipilih)
                  </button>
                )}
              </div>

              {/* Grid Kartu Kategori Interaktif */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                {categoryBreakdown.map((cat) => {
                  const isSelected = selectedCategories.includes(cat.nama);
                  return (
                    <div
                      key={cat.nama}
                      onClick={() => toggleCategory(cat.nama)}
                      style={{
                        padding: '14px',
                        borderRadius: 'var(--radius-md)',
                        background: isSelected ? 'var(--burgundy-subtle)' : 'var(--bg-input)',
                        border: `1.5px solid ${isSelected ? 'var(--burgundy-primary)' : 'var(--border-subtle)'}`,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                      title="Klik untuk memilih/membatalkan kategori ini"
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.86rem', color: isSelected ? 'var(--burgundy-primary)' : 'var(--text-primary)' }}>
                          {cat.nama}
                        </span>
                        <span className="badge" style={{ 
                          background: isSelected ? 'var(--burgundy-primary)' : 'rgba(0,0,0,0.06)',
                          color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                          fontSize: '0.7rem',
                          fontWeight: 700
                        }}>
                          {cat.pct}% omset
                        </span>
                      </div>

                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: isSelected ? 'var(--burgundy-primary)' : 'var(--text-primary)' }}>
                        {formatIDR(cat.totalNilai)}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        <span>Terjual: <strong>{cat.totalQty} porsi</strong></span>
                        <span>{cat.count} menu</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section: Tabel Daftar Menu Terjual */}
          <div className="glass-card" style={{ padding: '20px' }}>
            
            {/* Header & Filter Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShoppingBag size={18} color="#cf3a4a" />
                  <span>Daftar Menu / Produk Terjual</span>
                </h3>
                <span className="badge badge-primary" style={{ fontSize: '0.72rem', marginTop: '4px' }}>
                  {filteredProducts.length} dari {productsData.length} Menu
                </span>
              </div>

              {/* Search Bar Menu */}
              <div style={{ position: 'relative', width: '240px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="text"
                  placeholder="Cari nama menu..."
                  value={searchProduct}
                  onChange={(e) => setSearchProduct(e.target.value)}
                  className="form-input"
                  style={{ padding: '6px 10px 6px 30px', fontSize: '0.8rem' }}
                />
              </div>
            </div>

            {/* Filter Pills Kategori (Multi-select) */}
            {availableCategories.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, marginRight: '4px' }}>
                  Filter Kategori:
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedCategories([])}
                  style={{
                    background: selectedCategories.length === 0 ? 'var(--burgundy-primary)' : 'var(--bg-input)',
                    color: selectedCategories.length === 0 ? '#ffffff' : 'var(--text-secondary)',
                    border: `1px solid ${selectedCategories.length === 0 ? 'var(--burgundy-primary)' : 'var(--border-subtle)'}`,
                    borderRadius: '8px',
                    padding: '4px 10px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Semua ({productsData.length})
                </button>

                {availableCategories.map(cat => {
                  const isActive = selectedCategories.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      style={{
                        background: isActive ? 'var(--burgundy-primary)' : 'var(--bg-input)',
                        color: isActive ? '#ffffff' : 'var(--text-secondary)',
                        border: `1px solid ${isActive ? 'var(--burgundy-primary)' : 'var(--border-subtle)'}`,
                        borderRadius: '8px',
                        padding: '4px 10px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <span>{isActive ? '✓ ' : ''}{cat}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Total Ringkasan Filter Produk */}
            <div style={{
              background: 'var(--bg-input)',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              marginBottom: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                  Total Nilai Menu Terfilter ({selectedCategories.length === 0 ? 'Semua Kategori' : selectedCategories.join(', ')}):
                </span>
                <strong style={{ fontSize: '1.15rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {formatIDR(filteredProductsTotals.totalNilai)}
                </strong>
              </div>

              <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                Total Porsi: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{filteredProductsTotals.totalQty.toLocaleString('id-ID')} porsi</strong>
              </div>
            </div>

            {filteredProducts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {loading ? 'Memuat laporan menu...' : 'Tidak ada produk yang sesuai dengan filter atau pencarian.'}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase' }}>
                      <th style={{ padding: '8px 12px' }}>Nama Menu</th>
                      <th style={{ padding: '8px 12px' }}>Kategori</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center' }}>Qty Terjual</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Nilai Penjualan</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Rata-rata Harga</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((item, idx) => {
                      const catName = catalogMap[item.produk_id]?.kategori || 'Umum';
                      const avgPrice = item.qty > 0 ? Math.round(item.nilai / item.qty) : 0;

                      return (
                        <tr key={item.produk_id || idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {item.nama}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <span className="badge" style={{ background: 'rgba(207, 58, 74, 0.12)', color: '#cf3a4a', fontSize: '0.72rem', fontWeight: 700 }}>
                              {catName}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <span className="badge" style={{ background: 'var(--bg-input)', fontWeight: 700 }}>
                              {item.qty} {catalogMap[item.produk_id]?.satuan || 'porsi'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#cf3a4a' }}>
                            {formatIDR(item.nilai || 0)}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                            {formatIDR(avgPrice)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid var(--border-subtle)', fontWeight: 700, background: 'rgba(0,0,0,0.02)' }}>
                      <td colSpan={2} style={{ padding: '12px', textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        TOTAL ({filteredProducts.length} Menu):
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', fontSize: '0.95rem' }}>
                        {filteredProductsTotals.totalQty} porsi
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontSize: '1rem', color: '#cf3a4a' }}>
                        {formatIDR(filteredProductsTotals.totalNilai)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ORDER BREAKDOWN DETAIL MODAL */}
      {selectedOrderForDetail && typeof document !== 'undefined' && createPortal(
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
            animation: 'fadeIn 0.2s ease-out'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseOrderDetail();
          }}
        >
          <div 
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: '680px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'var(--bg-card, #1c1917)',
              borderRadius: '16px',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              overflow: 'hidden',
              animation: 'scaleUp 0.2s ease-out'
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '18px 22px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.15) 0%, transparent 100%)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'rgba(207, 58, 74, 0.15)',
                  color: '#cf3a4a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Receipt size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Rincian Order: <span style={{ fontFamily: 'monospace', color: '#cf3a4a' }}>{selectedOrderForDetail.nota || `#${selectedOrderForDetail.id}`}</span>
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    <span>{selectedOrderForDetail.waktu || selectedOrderForDetail.tanggal || '-'}</span>
                    <span>•</span>
                    <span className="badge" style={{
                      background: 'rgba(207, 58, 74, 0.1)',
                      color: '#cf3a4a',
                      fontSize: '0.72rem',
                      padding: '2px 8px'
                    }}>
                      {selectedOrderForDetail.metode || 'Metode Tidak Diketahui'}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseOrderDetail}
                style={{
                  background: 'var(--bg-input, rgba(255,255,255,0.06))',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--text-primary)';
                  e.currentTarget.style.borderColor = 'var(--burgundy-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-secondary)';
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px 22px', overflowY: 'auto', flex: 1 }}>
              {loadingDetail ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                  <RefreshCw size={26} className="animate-spin" style={{ margin: '0 auto 12px auto', display: 'block', color: 'var(--burgundy-primary)' }} />
                  <p style={{ margin: 0, fontSize: '0.9rem' }}>Mengambil rincian item transaksi dari KasirPro...</p>
                </div>
              ) : (
                <div>
                  {/* Metadata Ringkas (Kasir, Meja, Pelanggan jika ada) */}
                  {orderDetailData && (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                      gap: '10px',
                      marginBottom: '18px',
                      padding: '12px',
                      background: 'var(--bg-input, rgba(255,255,255,0.02))',
                      borderRadius: '10px',
                      border: '1px solid var(--border-subtle)'
                    }}>
                      <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Status</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#10b981' }}>
                          {selectedOrderForDetail.refund > 0 ? 'Refund' : 'Berhasil'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Kasir</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {orderDetailData.kasir?.nama || orderDetailData.kasir || orderDetailData.user || '-'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Pelanggan</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {orderDetailData.pelanggan?.nama || orderDetailData.pelanggan || orderDetailData.customer || 'Umum'}
                        </div>
                      </div>
                      {(orderDetailData.meja || orderDetailData.table) && (
                        <div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Meja</div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {orderDetailData.meja?.nama || orderDetailData.meja || orderDetailData.table}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Warning notice if detail items API had partial error */}
                  {detailError && (
                    <div style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: 'rgba(245, 158, 11, 0.1)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      color: '#d97706',
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '16px'
                    }}>
                      <AlertCircle size={15} />
                      <span>{detailError}</span>
                    </div>
                  )}

                  {/* Breakdown Item Table */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                      <FileText size={15} color="var(--burgundy-primary)" />
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        Daftar Menu / Produk Dibeli
                      </span>
                    </div>

                    {(() => {
                      const items = orderDetailData?.items || 
                                    orderDetailData?.rincian || 
                                    orderDetailData?.details || 
                                    orderDetailData?.produk || 
                                    [];

                      if (!items || items.length === 0) {
                        return (
                          <div style={{
                            padding: '24px',
                            textAlign: 'center',
                            background: 'var(--bg-input, rgba(255,255,255,0.02))',
                            borderRadius: '10px',
                            border: '1px dashed var(--border-subtle)',
                            color: 'var(--text-muted)',
                            fontSize: '0.85rem'
                          }}>
                            Tidak ada rincian sub-item per menu yang dikembalikan oleh API KasirPro untuk transaksi ini.
                          </div>
                        );
                      }

                      return (
                        <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '10px' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead>
                              <tr style={{ background: 'var(--bg-input, rgba(255,255,255,0.03))', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                                <th style={{ padding: '8px 12px' }}>Menu / Produk</th>
                                <th style={{ padding: '8px 12px', textAlign: 'center' }}>Qty</th>
                                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Harga Satuan</th>
                                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Subtotal</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((it, idx) => {
                                const name = it.nama_produk || it.nama || it.produk?.nama || it.item_name || it.product_name || 'Produk';
                                const qty = Number(it.qty ?? it.jumlah ?? it.quantity ?? it.porsi ?? 1) || 1;
                                
                                // Deteksi harga satuan & subtotal dengan fallback menyeluruh dari field API KasirPro
                                const rawPrice = it.harga ?? it.harga_satuan ?? it.price ?? it.unit_price ?? it.nilai ?? null;
                                const rawSub = it.subtotal ?? it.sub_total ?? it.total ?? it.nilai_total ?? it.total_harga ?? it.total_item ?? null;

                                let price = rawPrice !== null ? Number(rawPrice) : 0;
                                let sub = rawSub !== null ? Number(rawSub) : 0;

                                // Jika subtotal ada tapi harga satuan 0/kosong -> hitung balik (sub / qty)
                                if (sub > 0 && (!price || price === 0)) {
                                  price = Math.round(sub / qty);
                                }
                                // Jika harga satuan ada tapi subtotal 0/kosong -> hitung (price * qty)
                                else if (price > 0 && (!sub || sub === 0)) {
                                  sub = price * qty;
                                }

                                const notes = it.catatan || it.notes || it.modifier || it.varian || it.opsi || (Array.isArray(it.modifiers) ? it.modifiers.map(m => m.nama || m).join(', ') : null);

                                return (
                                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                    <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>
                                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{name}</div>
                                      {notes && (
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px', fontStyle: 'italic' }}>
                                          Catatan: {notes}
                                        </div>
                                      )}
                                    </td>
                                    <td style={{ padding: '10px 12px', textAlign: 'center', verticalAlign: 'top' }}>
                                      <span className="badge" style={{ background: 'var(--bg-input)', fontWeight: 700 }}>
                                        {qty}x
                                      </span>
                                    </td>
                                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)', verticalAlign: 'top' }}>
                                      {price > 0 ? formatIDR(price) : '-'}
                                    </td>
                                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#cf3a4a', verticalAlign: 'top' }}>
                                      {sub > 0 ? formatIDR(sub) : (price > 0 ? formatIDR(price * qty) : '-')}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Summary Biaya / Total */}
                  <div style={{
                    marginTop: '16px',
                    padding: '14px',
                    borderRadius: '10px',
                    background: 'var(--bg-input, rgba(255,255,255,0.02))',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    fontSize: '0.85rem'
                  }}>
                    {orderDetailData?.subtotal !== undefined && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                        <span>Subtotal Produk:</span>
                        <span>{formatIDR(orderDetailData.subtotal)}</span>
                      </div>
                    )}
                    {Number(orderDetailData?.diskon || 0) > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10b981' }}>
                        <span>Diskon / Potongan:</span>
                        <span>- {formatIDR(orderDetailData.diskon)}</span>
                      </div>
                    )}
                    {Number(orderDetailData?.pajak || 0) > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                        <span>Pajak (PB1):</span>
                        <span>+ {formatIDR(orderDetailData.pajak)}</span>
                      </div>
                    )}
                    {Number(orderDetailData?.service || 0) > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                        <span>Service Charge:</span>
                        <span>+ {formatIDR(orderDetailData.service)}</span>
                      </div>
                    )}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderTop: '1px dashed var(--border-subtle)',
                      paddingTop: '8px',
                      fontWeight: 700,
                      fontSize: '1rem',
                      color: 'var(--text-primary)'
                    }}>
                      <span>Total Tagihan:</span>
                      <span style={{ color: '#cf3a4a' }}>
                        {formatIDR(orderDetailData?.total || selectedOrderForDetail?.total || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '14px 22px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'flex-end',
              background: 'var(--bg-input, rgba(255,255,255,0.02))'
            }}>
              <button
                type="button"
                onClick={handleCloseOrderDetail}
                className="btn btn-secondary"
                style={{ padding: '8px 18px', fontSize: '0.85rem' }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}

