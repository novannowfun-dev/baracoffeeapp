import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  ChevronDown, 
  ChevronRight, 
  Search, 
  Download, 
  Share2, 
  Trash2, 
  Eye, 
  RefreshCw, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle,
  Calendar,
  Layers,
  Receipt,
  Printer,
  X,
  Filter,
  ArrowUpRight,
  TrendingDown,
  Tag,
  Wallet,
  Coins,
  Sparkles,
  MessageCircle
} from 'lucide-react';
import { formatIDR, formatDateID, getShiftBadge, getExpenseCategoryBadge } from '../lib/formatters';
import { syncToGoogleSheets } from '../lib/sheetsSync';

const SHIFTS = ['Semua', 'Shift Pagi', 'Shift Malam'];

export default function HistoryView({ 
  records, 
  onDeleteRecord, 
  onSelectRecord, 
  onRefreshData,
  activeSubTab = 'sales',
  onSubTabChange,
  currentUser
}) {
  const [internalSubTab, setInternalSubTab] = useState('sales');
  const currentSubTab = onSubTabChange ? activeSubTab : internalSubTab;
  const setCurrentSubTab = onSubTabChange || setInternalSubTab;

  // State untuk Tab Penjualan
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedShift, setSelectedShift] = useState('Semua');
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);

  // State untuk Tab Pengeluaran Kas Kecil
  const [expenseSearch, setExpenseSearch] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('Semua');
  const [expenseShift, setExpenseShift] = useState('Semua');
  const [expenseMonth, setExpenseMonth] = useState('Semua');
  const [isPrintLedgerOpen, setIsPrintLedgerOpen] = useState(false);

  // State untuk Tab Rekap Seharian (Daily Combined)
  const [expandedDates, setExpandedDates] = useState({});
  const [selectedDayPrint, setSelectedDayPrint] = useState(null);

  const handleSendDailyWhatsApp = (dayGroup) => {
    if (!dayGroup) return;
    const shiftDetails = dayGroup.records.map(r => 
      '  • ' + r.shift + ' (' + (r.cashier_name || '-') + '): Net ' + formatIDR(r.net_sales) + ' [Tunai: ' + formatIDR(r.payment_cash) + ']'
    ).join('\n');

    const text = [
      '☕ *REKAP OMSET SEHARIAN KEDAI KOPI BARA*',
      '📅 Tanggal: *' + formatDateID(dayGroup.date) + '* ',
      '👥 Kasir: ' + (Array.from(dayGroup.cashiers).join(', ') || '-'),
      '---------------------------------------',
      '💰 *Total Gross Sales:* ' + formatIDR(dayGroup.totalGross),
      '🏷️ *Diskon / Promo:* -' + formatIDR(dayGroup.totalDiscounts),
      '✨ *OMSET BERSIH (NET):* *' + formatIDR(dayGroup.totalNet) + '* ',
      '---------------------------------------',
      '💳 *RINCIAN KANAL PEMBAYARAN:*',
      '💵 Uang Tunai (Cash): ' + formatIDR(dayGroup.totalCash),
      '📱 QRIS: ' + formatIDR(dayGroup.totalQris),
      '💳 Mesin EDC: ' + formatIDR(dayGroup.totalEdc),
      '🛵 Delivery Online: ' + formatIDR(dayGroup.totalDelivery),
      '🏦 Transfer Bank: ' + formatIDR(dayGroup.totalTransfer),
      '---------------------------------------',
      '🔻 Kas Kecil Keluar: -' + formatIDR(dayGroup.totalPettyCash),
      '---------------------------------------',
      '📋 *RINCIAN PER SHIFT:*',
      shiftDetails,
      '\n_Laporan rekap harian otomatis Bara Coffee Coffee & Eatery._'
    ].join('\n');

    const encoded = encodeURIComponent(text);
    window.open('https://wa.me/?text=' + encoded, '_blank');
  };
  const toggleDateExpand = (dateKey) => {
    setExpandedDates(prev => ({ ...prev, [dateKey]: !prev[dateKey] }));
  };

  // ==========================================
  // DATA PREPARATION: TAB PENJUALAN
  // ==========================================
  const filteredSales = useMemo(() => {
    return (records || []).filter(r => {
      const matchShift = selectedShift === 'Semua' || 
        r.shift === selectedShift ||
        (selectedShift === 'Shift Malam' && r.shift === 'Shift Sore');
      const searchLower = searchTerm.toLowerCase();
      const matchSearch = 
        !searchTerm || 
        r.cashier_name?.toLowerCase().includes(searchLower) ||
        r.entry_date?.includes(searchLower) ||
        r.notes?.toLowerCase().includes(searchLower);

      return matchShift && matchSearch;
    });
  }, [records, selectedShift, searchTerm]);

  // ==========================================
  // DATA PREPARATION: TAB REKAP SEHARIAN (GABUNGAN SHIFT PAGI & MALAM)
  // ==========================================
  const dailyCombinedList = useMemo(() => {
    const groups = {};
    (records || []).forEach(r => {
      const d = r.entry_date || 'Tanpa Tanggal';
      if (!groups[d]) {
        groups[d] = {
          date: d,
          records: [],
          totalGross: 0,
          totalNet: 0,
          totalDiscounts: 0,
          totalCash: 0,
          totalQris: 0,
          totalEdc: 0,
          totalDelivery: 0,
          totalTransfer: 0,
          totalPettyCash: 0,
          cashiers: new Set(),
          shifts: new Set()
        };
      }
      groups[d].records.push(r);
      groups[d].totalGross += Number(r.gross_sales) || 0;
      groups[d].totalNet += Number(r.net_sales) || 0;
      groups[d].totalDiscounts += Number(r.discounts) || 0;
      groups[d].totalCash += Number(r.payment_cash) || 0;
      groups[d].totalQris += Number(r.payment_qris) || 0;
      groups[d].totalEdc += Number(r.payment_edc) || 0;
      groups[d].totalDelivery += Number(r.payment_delivery) || 0;
      groups[d].totalTransfer += Number(r.payment_transfer) || 0;
      groups[d].totalPettyCash += Number(r.petty_cash_out) || 0;
      if (r.cashier_name) groups[d].cashiers.add(r.cashier_name);
      if (r.shift) groups[d].shifts.add(r.shift);
    });

    return Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));
  }, [records]);

  // ==========================================
  // DATA PREPARATION: TAB PENGELUARAN KAS KECIL
  // Ekstrak seluruh item dari petty_cash_items di setiap record
  // ==========================================
  const allExpenses = useMemo(() => {
    const list = [];
    (records || []).forEach(record => {
      const shiftBadge = getShiftBadge(record.shift);
      const items = record.petty_cash_items;
      
      if (items && Array.isArray(items) && items.length > 0) {
        items.forEach((item, idx) => {
          const amt = Number(item.amount) || 0;
          if (amt > 0 || item.item_name) {
            list.push({
              id: item.id || `${record.id}-item-${idx}`,
              sales_id: record.id,
              date: record.entry_date,
              shift: record.shift,
              shiftBadge,
              cashier_name: record.cashier_name,
              item_name: item.item_name || 'Pengeluaran Kasir',
              category: item.category || 'Lain-lain',
              amount: amt,
              shiftNotes: record.notes,
              created_at: record.created_at,
              originalRecord: record
            });
          }
        });
      } else if (Number(record.petty_cash_out) > 0) {
        // Fallback untuk record lama atau input tunggal kas kecil
        list.push({
          id: `legacy-${record.id}`,
          sales_id: record.id,
          date: record.entry_date,
          shift: record.shift,
          shiftBadge,
          cashier_name: record.cashier_name,
          item_name: record.notes ? `Pengeluaran Shift (${record.notes})` : 'Pengeluaran Kas Kecil Shift',
          category: 'Operasional Kasir',
          amount: Number(record.petty_cash_out) || 0,
          shiftNotes: record.notes,
          created_at: record.created_at,
          originalRecord: record,
          isLegacy: true
        });
      }
    });

    // Urutkan dari tanggal terbaru, kemudian waktu input terbaru
    return list.sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return (b.created_at || '').localeCompare(a.created_at || '');
    });
  }, [records]);

  // Ekstrak daftar bulan yang ada
  const availableMonths = useMemo(() => {
    const months = new Set();
    allExpenses.forEach(e => {
      if (e.date && e.date.length >= 7) {
        months.add(e.date.substring(0, 7)); // 'YYYY-MM'
      }
    });
    return Array.from(months).sort().reverse();
  }, [allExpenses]);

  // Filter Data Pengeluaran
  const filteredExpenses = useMemo(() => {
    return allExpenses.filter(item => {
      const matchShift = expenseShift === 'Semua' || 
        item.shift === expenseShift ||
        (expenseShift === 'Shift Malam' && item.shift === 'Shift Sore');
      
      const matchCategory = expenseCategory === 'Semua' || item.category === expenseCategory;
      
      const matchMonth = expenseMonth === 'Semua' || item.date?.startsWith(expenseMonth);
      
      const s = expenseSearch.toLowerCase();
      const matchSearch = !expenseSearch ||
        item.item_name?.toLowerCase().includes(s) ||
        item.category?.toLowerCase().includes(s) ||
        item.cashier_name?.toLowerCase().includes(s) ||
        item.date?.includes(s) ||
        item.shiftNotes?.toLowerCase().includes(s);

      return matchShift && matchCategory && matchMonth && matchSearch;
    });
  }, [allExpenses, expenseShift, expenseCategory, expenseMonth, expenseSearch]);

  // Statistik & Metrik Pengeluaran
  const expenseStats = useMemo(() => {
    let totalAmount = 0;
    const categoryTotals = {};

    filteredExpenses.forEach(item => {
      totalAmount += item.amount;
      const cat = item.category || 'Lain-lain';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + item.amount;
    });

    const count = filteredExpenses.length;
    const avg = count > 0 ? Math.round(totalAmount / count) : 0;

    let topCat = '-';
    let topCatAmount = 0;
    Object.entries(categoryTotals).forEach(([cat, val]) => {
      if (val > topCatAmount) {
        topCat = cat;
        topCatAmount = val;
      }
    });

    const topCatPercent = totalAmount > 0 ? Math.round((topCatAmount / totalAmount) * 100) : 0;

    return {
      totalAmount,
      count,
      avg,
      topCat,
      topCatAmount,
      topCatPercent,
      categoryTotals
    };
  }, [filteredExpenses]);

  // Kategori unik untuk pill filter
  const allCategories = useMemo(() => {
    const cats = new Set();
    allExpenses.forEach(e => {
      if (e.category) cats.add(e.category);
    });
    return ['Semua', ...Array.from(cats)];
  }, [allExpenses]);

  // ==========================================
  // HANDLERS EXPORT CSV
  // ==========================================
  const handleExportSalesCSV = () => {
    if (filteredSales.length === 0) {
      alert('Tidak ada data untuk diekspor.');
      return;
    }

    const headers = [
      'ID', 'Tanggal', 'Shift', 'Kasir', 
      'Gross Sales', 'Diskon', 'Net Sales', 
      'Cash', 'QRIS', 'EDC', 'Delivery', 'Transfer',
      'Modal Awal', 'Kas Keluar', 'Kas Fisik', 'Selisih Kas',
      'Catatan', 'Waktu Dibuat'
    ];

    const rows = filteredSales.map(r => [
      `"${r.id}"`,
      `"${r.entry_date}"`,
      `"${r.shift}"`,
      `"${r.cashier_name}"`,
      r.gross_sales || 0,
      r.discounts || 0,
      r.net_sales || 0,
      r.payment_cash || 0,
      r.payment_qris || 0,
      r.payment_edc || 0,
      r.payment_delivery || 0,
      r.payment_transfer || 0,
      r.opening_cash || 0,
      r.petty_cash_out || 0,
      r.actual_cash || 0,
      r.cash_difference || 0,
      `"${(r.notes || '').replace(/"/g, '""')}"`,
      `"${r.created_at || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `baracoffee_omset_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportExpenseCSV = () => {
    if (filteredExpenses.length === 0) {
      alert('Tidak ada data pengeluaran untuk diekspor.');
      return;
    }

    const headers = [
      'No', 'Tanggal', 'Shift', 'Kasir (PIC)', 
      'Nama Pengeluaran / Kebutuhan', 'Kategori', 
      'Nominal (Rp)', 'Catatan Shift'
    ];

    const rows = filteredExpenses.map((item, idx) => [
      idx + 1,
      `"${item.date}"`,
      `"${item.shift}"`,
      `"${item.cashier_name}"`,
      `"${(item.item_name || '').replace(/"/g, '""')}"`,
      `"${(item.category || '').replace(/"/g, '""')}"`,
      item.amount,
      `"${(item.shiftNotes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `baracoffee_buku_pengeluaran_kas_kecil_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Sync All to Google Sheets Webhook
  const handleSyncAllToSheets = async () => {
    if (filteredSales.length === 0) return;
    setIsSyncingAll(true);
    setSyncStatus(null);

    let successCount = 0;
    for (const record of filteredSales) {
      const res = await syncToGoogleSheets(record);
      if (res.synced) successCount++;
    }

    setSyncStatus(`Berhasil sinkronisasi ${successCount} data ke Google Sheets! Data lama otomatis di-update tanpa duplikat.`);
    setTimeout(() => setSyncStatus(null), 5000);
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1240px', margin: '0 auto', paddingBottom: '60px' }}>
      
      {/* Header & Sub-Tab Switcher */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '22px' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Audit & Pembukuan Kasir
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '4px 0 0 0' }}>
            Rekapitulasi penjualan shift dan buku audit pengeluaran kas kecil (petty cash) Bara Coffee.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="action-header-group" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button 
            onClick={onRefreshData}
            className="btn btn-secondary"
            style={{ fontSize: '0.84rem' }}
            title="Refresh dari database"
          >
            <RefreshCw size={15} />
            <span>Refresh</span>
          </button>

          {currentSubTab === 'sales' ? (
            <>
              <button 
                onClick={handleExportSalesCSV}
                className="btn btn-secondary"
                style={{ fontSize: '0.84rem' }}
              >
                <Download size={15} />
                <span>Ekspor Rekap Omset</span>
              </button>

              <button 
                onClick={handleSyncAllToSheets}
                disabled={isSyncingAll}
                className="btn btn-primary"
                style={{ fontSize: '0.84rem' }}
              >
                <FileSpreadsheet size={15} />
                <span>{isSyncingAll ? 'Menyinkronkan...' : 'Sync Google Sheets (Anti-Duplikat)'}</span>
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={handleExportExpenseCSV}
                className="btn btn-secondary"
                style={{ fontSize: '0.84rem' }}
              >
                <Download size={15} />
                <span>Ekspor Buku Pengeluaran</span>
              </button>

              <button 
                onClick={() => setIsPrintLedgerOpen(true)}
                className="btn btn-primary"
                style={{ fontSize: '0.84rem' }}
              >
                <Printer size={15} />
                <span>Cetak Rekap Buku Kas</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Sync Status Banner */}
      {syncStatus && (
        <div className="glass-card animate-fade-in" style={{ padding: '12px 18px', marginBottom: '18px', borderColor: 'var(--success)', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem' }}>
          <CheckCircle2 size={18} />
          <span>{syncStatus}</span>
        </div>
      )}

      {/* SUB-TAB NAVIGATOR */}
      <div className="subtab-container" style={{ 
        display: 'flex', 
        gap: '8px', 
        marginBottom: '22px', 
        borderBottom: '1px solid var(--border-subtle)',
        paddingBottom: '12px' 
      }}>
        <button
          onClick={() => setCurrentSubTab('sales')}
          className={`btn ${currentSubTab === 'sales' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ 
            fontSize: '0.88rem', 
            fontWeight: currentSubTab === 'sales' ? 700 : 500,
            padding: '8px 16px',
            borderRadius: '10px'
          }}
        >
          <Layers size={16} />
          <span>Rekap Penjualan ({filteredSales.length})</span>
        </button>

        <button
          onClick={() => setCurrentSubTab('petty_cash')}
          className={`btn ${currentSubTab === 'petty_cash' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ 
            fontSize: '0.88rem', 
            fontWeight: currentSubTab === 'petty_cash' ? 700 : 500,
            padding: '8px 16px',
            borderRadius: '10px',
            position: 'relative'
          }}
        >
          <Receipt size={16} />
          <span>Buku Kas Pengeluaran</span>
          <span style={{ 
            fontSize: '0.72rem', 
            background: currentSubTab === 'petty_cash' ? 'rgba(0, 0, 0, 0.25)' : 'rgba(239, 68, 68, 0.2)',
            color: currentSubTab === 'petty_cash' ? '#ffffff' : '#f87171',
            padding: '2px 7px',
            borderRadius: '10px',
            fontWeight: 700,
            marginLeft: '4px'
          }}>
            {allExpenses.length} Nota
          </span>
        </button>

        <button
          onClick={() => setCurrentSubTab('daily_combined')}
          className={`btn ${currentSubTab === 'daily_combined' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ 
            fontSize: '0.88rem', 
            fontWeight: currentSubTab === 'daily_combined' ? 700 : 500,
            padding: '8px 16px',
            borderRadius: '10px',
            background: currentSubTab === 'daily_combined' ? 'linear-gradient(135deg, #d97706 0%, #b45309 100%)' : undefined,
            borderColor: currentSubTab === 'daily_combined' ? '#f59e0b' : undefined
          }}
        >
          <Calendar size={16} />
          <span>Rekap Seharian (Pagi + Malam)</span>
          <span style={{ 
            fontSize: '0.72rem', 
            background: currentSubTab === 'daily_combined' ? 'rgba(0, 0, 0, 0.3)' : 'rgba(245, 158, 11, 0.2)',
            color: currentSubTab === 'daily_combined' ? '#ffffff' : '#fbbf24',
            padding: '2px 7px',
            borderRadius: '10px',
            fontWeight: 700,
            marginLeft: '4px'
          }}>
            {dailyCombinedList.length} Hari
          </span>
        </button>
      </div>

      {/* Banner Panduan Koreksi Input untuk Kru & Tim */}
      <div style={{
        background: 'rgba(79, 70, 229, 0.05)',
        border: '1px solid rgba(79, 70, 229, 0.16)',
        borderRadius: 'var(--radius-md)',
        padding: '10px 14px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontSize: '0.8rem',
        color: 'var(--text-secondary)'
      }}>
        <Sparkles size={16} color="var(--burgundy-primary)" style={{ flexShrink: 0 }} />
        <span>
          <strong>Pemeriksaan & Koreksi Data:</strong> Kru dan kasir dapat memeriksa detail transaksi serta audit kas shift. Bila ada kesalahan input nominal atau shift, Anda dapat menghapus data terkait lalu menginput ulang pada menu <strong>Input Omset</strong>.
        </span>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: REKAPITULASI PENJUALAN SHIFT                                      */}
      {/* ========================================================================= */}
      {currentSubTab === 'sales' && (
        <div className="animate-fade-in">
          {/* Search & Shift Filter Bar */}
          <div className="glass-card" style={{ padding: '14px 18px', marginBottom: '20px', display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', flex: '1', minWidth: '220px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                placeholder="Cari kasir, tanggal (YYYY-MM-DD), atau catatan..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '38px', fontSize: '0.88rem' }}
              />
            </div>

            {/* Shift Filter Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Filter Shift:</span>
              <select 
                value={selectedShift}
                onChange={(e) => setSelectedShift(e.target.value)}
                className="form-select"
                style={{ width: 'auto', padding: '8px 12px', fontSize: '0.85rem' }}
              >
                {SHIFTS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Main Records Table */}
          <div className="mobile-table-hint">👉 Geser tabel ke samping untuk melihat detail rekonsiliasi</div>
          <div className="glass-card" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', fontSize: '0.76rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '12px 14px', textAlign: 'left' }}>Tanggal & Shift</th>
                    <th style={{ padding: '12px 14px', textAlign: 'left' }}>Kasir</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Gross Sales</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Diskon</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Net Sales</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Penerimaan (Cash / QRIS / EDC)</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Kas Fisik Laci</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center' }}>Audit Laci</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.length === 0 ? (
                    <tr>
                      <td colSpan="9" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Tidak ada data penjualan yang cocok dengan filter.
                      </td>
                    </tr>
                  ) : (
                    filteredSales.map((record) => {
                      const shiftBadge = getShiftBadge(record.shift);
                      const diff = Number(record.cash_difference) || 0;
                      const pettyCount = record.petty_cash_items?.length || 0;

                      return (
                        <tr 
                          key={record.id}
                          style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.2s' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(217, 155, 67, 0.04)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          {/* Tanggal & Shift */}
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatDateID(record.entry_date)}</div>
                            <span className={`badge ${shiftBadge.color}`} style={{ marginTop: '4px', fontSize: '0.7rem' }}>
                              {shiftBadge.icon} {record.shift}
                            </span>
                          </td>

                          {/* Kasir */}
                          <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{record.cashier_name}</span>
                            {record.notes && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {record.notes}
                              </div>
                            )}
                          </td>

                          {/* Gross */}
                          <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                            {formatIDR(record.gross_sales)}
                          </td>

                          {/* Diskon */}
                          <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {Number(record.discounts) > 0 ? `-${formatIDR(record.discounts)}` : '-'}
                          </td>

                          {/* Net */}
                          <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--gold-light)', fontFamily: 'var(--font-mono)' }}>
                            {formatIDR(record.net_sales)}
                          </td>

                          {/* Breakdown */}
                          <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: '0.78rem' }}>
                            <div style={{ color: 'var(--success)' }}>Cash: {formatIDR(record.payment_cash)}</div>
                            <div style={{ color: 'var(--gold-light)' }}>QRIS: {formatIDR(record.payment_qris)}</div>
                            <div style={{ color: 'var(--info)' }}>EDC: {formatIDR(record.payment_edc)}</div>
                            {Number(record.payment_delivery) > 0 && (
                              <div style={{ color: 'var(--warning)' }}>Delivery: {formatIDR(record.payment_delivery)}</div>
                            )}
                          </td>

                          {/* Kas Fisik */}
                          <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                            <div>{formatIDR(record.actual_cash)}</div>
                            {pettyCount > 0 && (
                              <span style={{ fontSize: '0.72rem', color: 'var(--danger)' }}>
                                Kas Kecil: -{formatIDR(record.petty_cash_out)}
                              </span>
                            )}
                          </td>

                          {/* Audit */}
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            {diff === 0 ? (
                              <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>✓ Pas</span>
                            ) : diff > 0 ? (
                              <span className="badge badge-warning" style={{ fontSize: '0.72rem' }}>+{formatIDR(diff)}</span>
                            ) : (
                              <span className="badge badge-danger" style={{ fontSize: '0.72rem' }}>-{formatIDR(Math.abs(diff))}</span>
                            )}
                          </td>

                          {/* Aksi */}
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              <button
                                onClick={() => onSelectRecord(record)}
                                className="btn btn-secondary"
                                style={{ padding: '6px 8px', fontSize: '0.75rem' }}
                                title="Lihat Detail Struk & Kas Kecil"
                              >
                                <Eye size={14} />
                              </button>
                              
                              <button
                                onClick={() => {
                                  if (confirm(`Hapus catatan omset tanggal ${record.entry_date} (${record.shift})?`)) {
                                    onDeleteRecord(record.id);
                                  }
                                }}
                                className="btn btn-secondary"
                                style={{ padding: '6px 8px', fontSize: '0.75rem', color: 'var(--danger)' }}
                                title="Hapus Data"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: BUKU KAS PENGELUARAN (PETTY CASH DETAIL TABLE)                    */}
      {/* ========================================================================= */}
      {currentSubTab === 'petty_cash' && (
        <div className="animate-fade-in">
          
          {/* Top 4 KPI Metrics for Expenses */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '22px' }}>
            
            {/* Card 1: Total Pengeluaran */}
            <div className="glass-card" style={{ padding: '18px 20px', borderLeft: '4px solid var(--danger)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                  Total Kas Keluar (Filter)
                </span>
                <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TrendingDown size={18} color="var(--danger)" />
                </div>
              </div>
              <h3 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--danger)', margin: '8px 0 2px 0', fontFamily: 'var(--font-mono)' }}>
                -{formatIDR(expenseStats.totalAmount)}
              </h3>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                Dari {expenseStats.count} nota pengeluaran tercatat
              </span>
            </div>

            {/* Card 2: Jumlah Nota / Item */}
            <div className="glass-card" style={{ padding: '18px 20px', borderLeft: '4px solid var(--gold-light)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                  Item / Nota Pengeluaran
                </span>
                <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'var(--gold-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Receipt size={18} color="var(--gold-light)" />
                </div>
              </div>
              <h3 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--gold-light)', margin: '8px 0 2px 0' }}>
                {expenseStats.count} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Transaksi</span>
              </h3>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                Diaudit langsung saat pergantian shift
              </span>
            </div>

            {/* Card 3: Rata-rata per Nota */}
            <div className="glass-card" style={{ padding: '18px 20px', borderLeft: '4px solid var(--info)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                  Rata-rata per Nota
                </span>
                <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Coins size={18} color="var(--info)" />
                </div>
              </div>
              <h3 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', margin: '8px 0 2px 0', fontFamily: 'var(--font-mono)' }}>
                {formatIDR(expenseStats.avg)}
              </h3>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                Rata-rata biaya belanja per struk
              </span>
            </div>

            {/* Card 4: Kategori Terbesar */}
            <div className="glass-card" style={{ padding: '18px 20px', borderLeft: '4px solid var(--warning)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                  Kategori Terbanyak
                </span>
                <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Tag size={18} color="var(--warning)" />
                </div>
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--warning)', margin: '8px 0 2px 0', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {expenseStats.topCat}
              </h3>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                {formatIDR(expenseStats.topCatAmount)} ({expenseStats.topCatPercent}% dari total)
              </span>
            </div>

          </div>

          {/* Interactive Category Filter Pills */}
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '16px' }}>
            {allCategories.map(cat => {
              const isSelected = expenseCategory === cat;
              const badgeInfo = getExpenseCategoryBadge(cat);
              const count = cat === 'Semua' ? allExpenses.length : allExpenses.filter(e => e.category === cat).length;
              
              return (
                <button
                  key={cat}
                  onClick={() => setExpenseCategory(cat)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s',
                    background: isSelected ? 'var(--gold-glow)' : 'rgba(255, 255, 255, 0.04)',
                    border: isSelected ? '1px solid var(--gold-light)' : '1px solid var(--border-subtle)',
                    color: isSelected ? 'var(--gold-light)' : 'var(--text-secondary)'
                  }}
                >
                  <span>{cat === 'Semua' ? '📂' : badgeInfo.icon}</span>
                  <span>{cat}</span>
                  <span style={{ 
                    fontSize: '0.7rem', 
                    padding: '1px 6px', 
                    borderRadius: '10px', 
                    background: isSelected ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.08)',
                    color: isSelected ? 'var(--gold-light)' : 'var(--text-muted)'
                  }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search, Shift, Month Filter Bar */}
          <div className="glass-card" style={{ padding: '14px 18px', marginBottom: '20px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            
            {/* Search Input */}
            <div style={{ position: 'relative', flex: '1', minWidth: '220px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                placeholder="Cari nama barang, PIC kasir, tanggal, atau catatan..."
                value={expenseSearch}
                onChange={(e) => setExpenseSearch(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '38px', fontSize: '0.88rem' }}
              />
            </div>

            {/* Shift Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Shift:</span>
              <select 
                value={expenseShift}
                onChange={(e) => setExpenseShift(e.target.value)}
                className="form-select"
                style={{ width: 'auto', padding: '8px 12px', fontSize: '0.84rem' }}
              >
                {SHIFTS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Month Dropdown */}
            {availableMonths.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Bulan:</span>
                <select 
                  value={expenseMonth}
                  onChange={(e) => setExpenseMonth(e.target.value)}
                  className="form-select"
                  style={{ width: 'auto', padding: '8px 12px', fontSize: '0.84rem' }}
                >
                  <option value="Semua">Semua Bulan</option>
                  {availableMonths.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Reset Filters button if any active */}
            {(expenseSearch || expenseCategory !== 'Semua' || expenseShift !== 'Semua' || expenseMonth !== 'Semua') && (
              <button
                onClick={() => {
                  setExpenseSearch('');
                  setExpenseCategory('Semua');
                  setExpenseShift('Semua');
                  setExpenseMonth('Semua');
                }}
                className="btn btn-secondary"
                style={{ padding: '8px 12px', fontSize: '0.8rem', color: 'var(--danger)' }}
                title="Reset Semua Filter"
              >
                <X size={14} />
                <span>Reset Filter</span>
              </button>
            )}
          </div>

          {/* Granular Petty Cash Detail Table */}
          <div className="mobile-table-hint">👉 Geser tabel ke samping untuk melihat seluruh rincian kas kecil</div>
          <div className="glass-card" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', fontSize: '0.76rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '12px 14px', textAlign: 'center', width: '50px' }}>No</th>
                    <th style={{ padding: '12px 14px', textAlign: 'left', width: '190px' }}>Tanggal & Shift</th>
                    <th style={{ padding: '12px 14px', textAlign: 'left', width: '150px' }}>PIC Kasir</th>
                    <th style={{ padding: '12px 14px', textAlign: 'left' }}>Nama Barang / Keperluan</th>
                    <th style={{ padding: '12px 14px', textAlign: 'left', width: '180px' }}>Kategori</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right', width: '140px' }}>Nominal</th>
                    <th style={{ padding: '12px 14px', textAlign: 'left', width: '180px' }}>Catatan Shift</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center', width: '100px' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <Receipt size={36} style={{ margin: '0 auto 12px auto', opacity: 0.3 }} />
                        <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                          Belum ada data pengeluaran kas kecil yang sesuai dengan filter
                        </div>
                        <p style={{ fontSize: '0.82rem', margin: '6px 0 0 0' }}>
                          Seluruh pengeluaran yang diinput oleh kasir di form omset akan tercatat otomatis di sini.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map((item, idx) => {
                      const catBadge = getExpenseCategoryBadge(item.category);

                      return (
                        <tr 
                          key={item.id}
                          style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.2s' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(217, 155, 67, 0.04)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          {/* No */}
                          <td style={{ padding: '12px 14px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            {idx + 1}
                          </td>

                          {/* Tanggal & Shift */}
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                              {formatDateID(item.date)}
                            </div>
                            <span className={`badge ${item.shiftBadge.color}`} style={{ marginTop: '3px', fontSize: '0.7rem' }}>
                              {item.shiftBadge.icon} {item.shift}
                            </span>
                          </td>

                          {/* PIC Kasir */}
                          <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                            {item.cashier_name}
                          </td>

                          {/* Nama Pengeluaran / Kebutuhan */}
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                              {item.item_name}
                            </div>
                            {item.isLegacy && (
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                (Rekap Kas Keluar Shift)
                              </span>
                            )}
                          </td>

                          {/* Kategori Badge */}
                          <td style={{ padding: '12px 14px' }}>
                            <span 
                              style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '5px',
                                padding: '4px 10px', 
                                borderRadius: '8px', 
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                background: catBadge.bg,
                                color: catBadge.textColor,
                                border: `1px solid ${catBadge.borderColor}`
                              }}
                            >
                              <span>{catBadge.icon}</span>
                              <span>{item.category}</span>
                            </span>
                          </td>

                          {/* Nominal */}
                          <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--danger)', fontSize: '0.92rem' }}>
                            -{formatIDR(item.amount)}
                          </td>

                          {/* Catatan Shift */}
                          <td style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            {item.shiftNotes || '-'}
                          </td>

                          {/* Aksi: Buka Struk Shift */}
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <button
                              onClick={() => onSelectRecord(item.originalRecord)}
                              className="btn btn-secondary"
                              style={{ padding: '5px 10px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              title="Buka Struk Lengkap Shift"
                            >
                              <Eye size={13} />
                              <span>Struk</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>

                {/* Table Footer with Grand Total */}
                {filteredExpenses.length > 0 && (
                  <tfoot>
                    <tr style={{ background: 'rgba(217, 155, 67, 0.08)', borderTop: '2px solid var(--border-hover)', fontWeight: 700 }}>
                      <td colSpan="5" style={{ padding: '14px', textAlign: 'right', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                        TOTAL PENGELUARAN KAS KECIL (PETTY CASH):
                      </td>
                      <td style={{ padding: '14px', textAlign: 'right', color: 'var(--danger)', fontSize: '1.05rem', fontFamily: 'var(--font-mono)' }}>
                        -{formatIDR(expenseStats.totalAmount)}
                      </td>
                      <td colSpan="2" style={{ padding: '14px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        {filteredExpenses.length} Nota Pengeluaran
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* VIEW 3: REKAP SEHARIAN (GABUNGAN SHIFT PAGI + MALAM)                     */}
      {/* ========================================================================= */}
      {currentSubTab === 'daily_combined' && (
        <div className="animate-fade-in">
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Calendar size={22} color='#f59e0b' />
              <span>Laporan Rekapitulasi Seharian Penuh (Shift Pagi & Malam)</span>
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
              Mengkonsolidasikan seluruh transaksi shift pagi dan shift malam dalam 1 baris tanggal untuk melihat total omset kotor, omset bersih, rincian pembayaran, serta kas keluar.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {dailyCombinedList.length === 0 ? (
              <div className="glass-card" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Belum ada data penjualan tercatat.
              </div>
            ) : (
              dailyCombinedList.map((dayGroup) => {
                const isExpanded = !!expandedDates[dayGroup.date];
                const cashierList = Array.from(dayGroup.cashiers).join(', ') || '-';
                const shiftList = Array.from(dayGroup.shifts).join(' & ') || '-';

                return (
                  <div key={dayGroup.date} className="glass-card" style={{ padding: '20px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', borderBottom: isExpanded ? '1px solid var(--border-subtle)' : 'none', paddingBottom: isExpanded ? '16px' : 0 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            {formatDateID(dayGroup.date)}
                          </span>
                          <span style={{
                            fontSize: '0.75rem',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: 'rgba(245, 158, 11, 0.15)',
                            color: '#fbbf24',
                            fontWeight: 700
                          }}>
                            {dayGroup.records.length} Shift Terinput ({shiftList})
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                          PIC Kasir: <strong>{cashierList}</strong>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>
                            Total Omset Seharian
                          </span>
                          <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fbbf24', fontFamily: 'var(--font-mono)' }}>
                            {formatIDR(dayGroup.totalNet)}
                          </span>
                        </div>

                        <button
                          onClick={() => handleSendDailyWhatsApp(dayGroup)}
                          className="btn btn-secondary"
                          style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', color: '#25D366', borderColor: 'rgba(37, 211, 102, 0.4)', background: 'rgba(37, 211, 102, 0.08)' }}
                          title="Kirim Rekap Seharian ke WhatsApp"
                        >
                          <MessageCircle size={14} />
                          <span>Kirim WA</span>
                        </button>

                        <button
                          onClick={() => setSelectedDayPrint(dayGroup)}
                          className="btn btn-secondary"
                          style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                          title="Cetak Rekap Seharian Lengkap"
                        >
                          <Printer size={14} />
                          <span>Cetak Rekap 1 Hari</span>
                        </button>

                        <button
                          onClick={() => toggleDateExpand(dayGroup.date)}
                          className="btn btn-secondary"
                          style={{ fontSize: '0.8rem', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          <span>{isExpanded ? 'Tutup Rincian' : 'Rincian Shift'}</span>
                        </button>
                      </div>
                    </div>

                    <div style={{
                      marginTop: '14px',
                      padding: '14px 18px',
                      borderRadius: '10px',
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                      gap: '12px',
                      fontSize: '0.8rem'
                    }}>
                      <div>
                        <span style={{ color: '#64748b', display: 'block', fontWeight: 600, fontSize: '0.75rem' }}>Tunai / Cash:</span>
                        <strong style={{ color: '#059669', fontFamily: 'var(--font-mono)', fontSize: '0.92rem' }}>{formatIDR(dayGroup.totalCash)}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', display: 'block', fontWeight: 600, fontSize: '0.75rem' }}>QRIS:</span>
                        <strong style={{ color: '#0284c7', fontFamily: 'var(--font-mono)', fontSize: '0.92rem' }}>{formatIDR(dayGroup.totalQris)}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', display: 'block', fontWeight: 600, fontSize: '0.75rem' }}>EDC / Debit:</span>
                        <strong style={{ color: '#4f46e5', fontFamily: 'var(--font-mono)', fontSize: '0.92rem' }}>{formatIDR(dayGroup.totalEdc)}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', display: 'block', fontWeight: 600, fontSize: '0.75rem' }}>Delivery Online:</span>
                        <strong style={{ color: '#ea580c', fontFamily: 'var(--font-mono)', fontSize: '0.92rem' }}>{formatIDR(dayGroup.totalDelivery)}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', display: 'block', fontWeight: 600, fontSize: '0.75rem' }}>Transfer:</span>
                        <strong style={{ color: '#9333ea', fontFamily: 'var(--font-mono)', fontSize: '0.92rem' }}>{formatIDR(dayGroup.totalTransfer)}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', display: 'block', fontWeight: 600, fontSize: '0.75rem' }}>Kas Keluar (Petty):</span>
                        <strong style={{ color: '#dc2626', fontFamily: 'var(--font-mono)', fontSize: '0.92rem' }}>-{formatIDR(dayGroup.totalPettyCash)}</strong>
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ marginTop: '16px' }}>
                        <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px' }}>
                          Breakdown Per Shift Masuk Pada Tanggal Ini:
                        </h4>
                        <div className="table-responsive" style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                            <thead>
                              <tr style={{ background: 'var(--bg-input)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                                <th style={{ padding: '8px 10px', textAlign: 'left' }}>Shift</th>
                                <th style={{ padding: '8px 10px', textAlign: 'left' }}>Kasir</th>
                                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Gross</th>
                                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Diskon</th>
                                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Net Sales</th>
                                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Cash</th>
                                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Non-Cash</th>
                                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Kas Kecil</th>
                                <th style={{ padding: '8px 10px', textAlign: 'center' }}>Aksi</th>
                              </tr>
                            </thead>
                            <tbody>
                              {dayGroup.records.map((r, idx) => {
                                const nonCash = (Number(r.payment_qris) || 0) + (Number(r.payment_edc) || 0) + (Number(r.payment_delivery) || 0) + (Number(r.payment_transfer) || 0);
                                return (
                                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                    <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--text-primary)' }}>{r.shift}</td>
                                    <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>{r.cashier_name}</td>
                                    <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatIDR(r.gross_sales)}</td>
                                    <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{formatIDR(r.discounts)}</td>
                                    <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--gold-light)' }}>{formatIDR(r.net_sales)}</td>
                                    <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--success)' }}>{formatIDR(r.payment_cash)}</td>
                                    <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatIDR(nonCash)}</td>
                                    <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--danger)' }}>-{formatIDR(r.petty_cash_out)}</td>
                                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                      <button onClick={() => onSelectRecord(r)} className="btn btn-secondary" style={{ padding: '3px 8px', fontSize: '0.72rem' }}>
                                        Lihat Struk
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* MODAL PRINT PREVIEW REKAP SEHARIAN PENUH (1 HARI) */}
      {selectedDayPrint && createPortal(
        <div className="print-modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh',
          background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1050, padding: '16px', overflowY: 'auto'
        }}>
          <div style={{ maxWidth: '760px', width: '100%', background: '#ffffff', color: '#111827', borderRadius: '12px', padding: '32px 36px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb', paddingBottom: '14px', marginBottom: '20px' }}>
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Pratinjau Cetak: Laporan Konsolidasi 1 Hari</h4>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button onClick={() => handleSendDailyWhatsApp(selectedDayPrint)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', background: '#25D366', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                  <MessageCircle size={15} /> Kirim ke WhatsApp
                </button>
                <button onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                  <Printer size={15} /> Cetak / PDF
                </button>
                <button onClick={() => setSelectedDayPrint(null)} style={{ padding: '7px 12px', borderRadius: '8px', background: '#f3f4f6', border: '1px solid #d1d5db', cursor: 'pointer' }}>
                  <X size={15} />
                </button>
              </div>
            </div>

            <div style={{ textAlign: 'center', borderBottom: '2px solid #111827', paddingBottom: '12px', marginBottom: '18px' }}>
              <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900 }}>KEDAI KOPI BARA</h2>
              <div style={{ fontSize: '0.85rem', color: '#4b5563', marginTop: '2px' }}>LAPORAN PENJUALAN SEHARIAN PENUH (GABUNGAN SHIFT PAGI & MALAM)</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#111827', marginTop: '4px' }}>Tanggal: {formatDateID(selectedDayPrint.date)}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', marginBottom: '20px', fontSize: '0.85rem' }}>
              <div><span style={{ color: '#64748b' }}>Total Gross Sales:</span><br /><strong style={{ fontSize: '1.05rem' }}>{formatIDR(selectedDayPrint.totalGross)}</strong></div>
              <div><span style={{ color: '#64748b' }}>Total Diskon / Promo:</span><br /><strong style={{ fontSize: '1.05rem', color: '#64748b' }}>-{formatIDR(selectedDayPrint.totalDiscounts)}</strong></div>
              <div><span style={{ color: '#64748b' }}>Omset Bersih (Net Sales):</span><br /><strong style={{ fontSize: '1.15rem', color: '#047857' }}>{formatIDR(selectedDayPrint.totalNet)}</strong></div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', marginBottom: '20px' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', textAlign: 'left' }}>
                  <th style={{ padding: '6px 8px' }}>Metode Pembayaran</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Total Penerimaan</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}><td style={{ padding: '6px 8px' }}>Uang Tunai (Cash)</td><td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{formatIDR(selectedDayPrint.totalCash)}</td></tr>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}><td style={{ padding: '6px 8px' }}>QRIS (BCA, GoPay, Shopee)</td><td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{formatIDR(selectedDayPrint.totalQris)}</td></tr>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}><td style={{ padding: '6px 8px' }}>Mesin EDC (Debit / Kredit)</td><td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{formatIDR(selectedDayPrint.totalEdc)}</td></tr>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}><td style={{ padding: '6px 8px' }}>Delivery Online (Grab, GoFood, Shopee)</td><td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{formatIDR(selectedDayPrint.totalDelivery)}</td></tr>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}><td style={{ padding: '6px 8px' }}>Transfer Bank Manual</td><td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{formatIDR(selectedDayPrint.totalTransfer)}</td></tr>
                <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#fef2f2' }}><td style={{ padding: '6px 8px', color: '#b91c1c' }}>Pengeluaran Kas Kecil Shift (Petty Cash)</td><td style={{ padding: '6px 8px', textAlign: 'right', color: '#b91c1c', fontWeight: 700 }}>-{formatIDR(selectedDayPrint.totalPettyCash)}</td></tr>
              </tbody>
            </table>

            <h5 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', fontWeight: 700 }}>Rincian Shift Kasir:</h5>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', marginBottom: '24px' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', textAlign: 'left' }}>
                  <th style={{ padding: '6px 8px' }}>Shift</th>
                  <th style={{ padding: '6px 8px' }}>Kasir PIC</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Net Sales</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Cash</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Non-Cash</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Kas Keluar</th>
                </tr>
              </thead>
              <tbody>
                {selectedDayPrint.records.map((r, i) => {
                  const nonCash = (Number(r.payment_qris) || 0) + (Number(r.payment_edc) || 0) + (Number(r.payment_delivery) || 0) + (Number(r.payment_transfer) || 0);
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '6px 8px', fontWeight: 600 }}>{r.shift}</td>
                      <td style={{ padding: '6px 8px' }}>{r.cashier_name}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{formatIDR(r.net_sales)}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>{formatIDR(r.payment_cash)}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>{formatIDR(nonCash)}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: '#b91c1c' }}>-{formatIDR(r.petty_cash_out)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#6b7280', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
              * Laporan konsolidasi harian Kedai Kopi Bara dibuat otomatis oleh sistem.
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL PRINT PREVIEW BUKU KAS PENGELUARAN (CLEAN WHITE SHEET)               */}
      {/* ========================================================================= */}
      {isPrintLedgerOpen && createPortal(
        <div className="print-modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1050,
          padding: '16px',
          overflowY: 'auto',
          boxSizing: 'border-box'
        }}>
          
          <div style={{
            background: '#ffffff',
            color: '#111827',
            width: '100%',
            maxWidth: '850px',
            maxHeight: '92vh',
            borderRadius: '12px',
            padding: '36px 40px',
            overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            position: 'relative',
            fontFamily: 'Inter, system-ui, sans-serif'
          }}>

            {/* Floating Action Bar (Hidden on print) */}
            <div className="no-print" style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: '24px',
              paddingBottom: '16px',
              borderBottom: '1px solid #e5e7eb'
            }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
                  Pratinjau Cetak: Buku Kas Pengeluaran (Petty Cash)
                </h4>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#6b7280' }}>
                  Halaman cetak diisolasi bersih tanpa elemen background aplikasi.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => window.print()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: '#2563eb',
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <Printer size={15} />
                  <span>Cetak / Simpan PDF</span>
                </button>

                <button
                  onClick={() => setIsPrintLedgerOpen(false)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    background: '#f3f4f6',
                    color: '#374151',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    border: '1px solid #d1d5db',
                    cursor: 'pointer'
                  }}
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* PRINTABLE CONTENT BODY */}
            <div>
              {/* Header Bara Coffee */}
              <div style={{ textAlign: 'center', borderBottom: '2px solid #111827', paddingBottom: '14px', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, letterSpacing: '0.05em', color: '#111827' }}>
                  KEDAI KOPI BARA
                </h2>
                <div style={{ fontSize: '0.85rem', color: '#4b5563', marginTop: '2px' }}>
                  LAPORAN REKAPITULASI BUKU KAS KECIL (PETTY CASH)
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '4px' }}>
                  Dicetak pada: {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} • Filter: {expenseCategory} ({expenseShift})
                </div>
              </div>

              {/* Summary Box */}
              <div style={{ display: 'flex', justifyContent: 'space-between', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 18px', marginBottom: '20px', fontSize: '0.85rem' }}>
                <div>
                  <span style={{ color: '#64748b' }}>Total Transaksi:</span> <strong>{filteredExpenses.length} Nota</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Kategori Terbanyak:</span> <strong>{expenseStats.topCat}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Total Pengeluaran:</span> <strong style={{ color: '#b91c1c' }}>-{formatIDR(expenseStats.totalAmount)}</strong>
                </div>
              </div>

              {/* Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', marginBottom: '24px' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1', textAlign: 'left', color: '#334155' }}>
                    <th style={{ padding: '8px', width: '35px', textAlign: 'center' }}>No</th>
                    <th style={{ padding: '8px', width: '110px' }}>Tanggal</th>
                    <th style={{ padding: '8px', width: '90px' }}>Shift</th>
                    <th style={{ padding: '8px', width: '110px' }}>PIC Kasir</th>
                    <th style={{ padding: '8px' }}>Nama Barang / Keperluan</th>
                    <th style={{ padding: '8px', width: '130px' }}>Kategori</th>
                    <th style={{ padding: '8px', width: '120px', textAlign: 'right' }}>Nominal</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '8px', textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                      <td style={{ padding: '8px' }}>{item.date}</td>
                      <td style={{ padding: '8px' }}>{item.shift}</td>
                      <td style={{ padding: '8px', fontWeight: 600 }}>{item.cashier_name}</td>
                      <td style={{ padding: '8px', fontWeight: 600 }}>{item.item_name}</td>
                      <td style={{ padding: '8px', color: '#475569' }}>{item.category}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#b91c1c', fontFamily: 'monospace' }}>
                        -{formatIDR(item.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#f8fafc', borderTop: '2px solid #0f172a', fontWeight: 700 }}>
                    <td colSpan="6" style={{ padding: '10px 8px', textAlign: 'right' }}>TOTAL PENGELUARAN KAS KECIL:</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', color: '#b91c1c', fontSize: '0.92rem', fontFamily: 'monospace' }}>
                      -{formatIDR(expenseStats.totalAmount)}
                    </td>
                  </tr>
                </tfoot>
              </table>

              {/* Catatan Dokumen Resmi Digital */}
              <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.74rem', color: '#64748b', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
                * Dokumen rekapitulasi buku kas kecil ini sah dan diverifikasi secara digital oleh Sistem Bara Coffee Coffee & Eatery tanpa memerlukan tanda tangan basah.
              </div>

            </div>

          </div>

        </div>,
        document.body
      )}

    </div>
  );
}
