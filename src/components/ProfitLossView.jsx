import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShoppingBag, 
  Receipt, 
  Plus, 
  Trash2, 
  Edit3, 
  Calendar, 
  Download, 
  Printer, 
  ShieldAlert, 
  Lock, 
  CheckCircle2, 
  PieChart, 
  FileText, 
  Coffee, 
  Box, 
  Zap, 
  Wrench, 
  Building2, 
  Tag, 
  Info, 
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Filter
} from 'lucide-react';
import { formatIDR, formatDateID } from '../lib/formatters';
import { ROLES } from '../lib/auth';
import { getDailySalesRecords } from '../lib/storage';
import { getSupabaseClient } from '../lib/supabase';
import { 
  getOwnerExpenses, 
  addOwnerExpense, 
  updateOwnerExpense, 
  deleteOwnerExpense, 
  calculateProfitAndLoss, 
  EXPENSE_CATEGORIES, 
  PAYMENT_METHODS 
} from '../lib/ownerExpenseService';

export default function ProfitLossView({ currentUser, onRequirePin }) {
  const isOwner = currentUser?.role === ROLES.OWNER || currentUser?.role === ROLES.MANAGER;

  // Active view inside P&L module: 'statement' (Laporan P&L) vs 'expenses' (Daftar Belanjaan Owner)
  const [activeSubTab, setActiveSubTab] = useState('statement');

  // Filter Periode
  const [periodPreset, setPeriodPreset] = useState('this_month'); // 'today', 'this_week', 'this_month', 'last_month', 'custom'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Data states
  const [salesRecords, setSalesRecords] = useState([]);
  const [ownerExpenses, setOwnerExpenses] = useState([]);
  const [payrollRecords, setPayrollRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [formData, setFormData] = useState({
    expense_date: new Date().toISOString().split('T')[0],
    title: '',
    category: 'cogs_ingredients',
    category_type: 'cogs',
    amount: '',
    payment_method: 'Transfer Bank / BCA / Mandiri',
    vendor: '',
    notes: ''
  });
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Search & Filter for Expense List
  const [expenseFilterCategory, setExpenseFilterCategory] = useState('all');
  const [expenseSearch, setExpenseSearch] = useState('');

  // Initialize date range based on preset
  useEffect(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();

    if (periodPreset === 'today') {
      const todayStr = today.toISOString().split('T')[0];
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (periodPreset === 'this_week') {
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Senin
      const mon = new Date(today.setDate(diff));
      setStartDate(mon.toISOString().split('T')[0]);
      setEndDate(new Date().toISOString().split('T')[0]);
    } else if (periodPreset === 'this_month') {
      const firstDay = new Date(y, m, 1);
      const lastDay = new Date(y, m + 1, 0);
      setStartDate(firstDay.toISOString().split('T')[0]);
      setEndDate(lastDay.toISOString().split('T')[0]);
    } else if (periodPreset === 'last_month') {
      const firstDay = new Date(y, m - 1, 1);
      const lastDay = new Date(y, m, 0);
      setStartDate(firstDay.toISOString().split('T')[0]);
      setEndDate(lastDay.toISOString().split('T')[0]);
    }
  }, [periodPreset]);

  // Load all financial sources
  const loadFinancialData = async () => {
    setLoading(true);
    try {
      // 1. Sales Records
      const salesRes = await getDailySalesRecords();
      setSalesRecords(salesRes.data || []);

      // 2. Owner Expenses
      const expRes = await getOwnerExpenses();
      setOwnerExpenses(expRes.data || []);

      // 3. Payroll Records
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const { data: payData } = await supabase
            .from('payroll_records')
            .select('*');
          if (payData) setPayrollRecords(payData);
        } catch (err) {
          console.warn('Error fetching payroll for PnL:', err);
        }
      } else {
        const savedPayroll = localStorage.getItem('baracoffee_real_payroll');
        if (savedPayroll) {
          try { setPayrollRecords(JSON.parse(savedPayroll)); } catch (e) {}
        }
      }
    } catch (err) {
      console.error('Failed to load financial data for PnL:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOwner) {
      loadFinancialData();
    }
  }, [isOwner]);

  // Calculate P&L metrics with current filter
  const pnlReport = useMemo(() => {
    return calculateProfitAndLoss({
      salesRecords,
      ownerExpenses,
      payrollRecords,
      filterStartDate: startDate,
      filterEndDate: endDate
    });
  }, [salesRecords, ownerExpenses, payrollRecords, startDate, endDate]);

  // Handle Form open / edit
  const handleOpenAdd = () => {
    setEditingExpense(null);
    setFormData({
      expense_date: new Date().toISOString().split('T')[0],
      title: '',
      category: 'cogs_ingredients',
      category_type: 'cogs',
      amount: '',
      payment_method: 'Transfer Bank / BCA / Mandiri',
      vendor: '',
      notes: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingExpense(item);
    setFormData({
      expense_date: item.expense_date,
      title: item.title,
      category: item.category,
      category_type: item.category_type || (item.category?.startsWith('cogs_') ? 'cogs' : 'opex'),
      amount: item.amount,
      payment_method: item.payment_method || 'Transfer Bank / BCA / Mandiri',
      vendor: item.vendor || '',
      notes: item.notes || ''
    });
    setIsModalOpen(true);
  };

  const handleCategoryChange = (e) => {
    const selectedCatId = e.target.value;
    const catObj = EXPENSE_CATEGORIES.find(c => c.id === selectedCatId);
    setFormData(prev => ({
      ...prev,
      category: selectedCatId,
      category_type: catObj?.type || 'opex'
    }));
  };

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.amount) {
      alert('Mohon isi nama belanjaan dan jumlah nominal.');
      return;
    }

    setFormSubmitting(true);
    try {
      if (editingExpense) {
        await updateOwnerExpense(editingExpense.id, {
          ...formData,
          amount: Number(formData.amount)
        });
      } else {
        await addOwnerExpense({
          ...formData,
          created_by: currentUser?.name || 'Owner'
        });
      }
      setIsModalOpen(false);
      await loadFinancialData();
    } catch (err) {
      alert('Gagal menyimpan pengeluaran: ' + err.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id, title) => {
    if (window.confirm(`Yakin ingin menghapus catatan belanjaan "${title}"?`)) {
      await deleteOwnerExpense(id);
      await loadFinancialData();
    }
  };

  // Filtered expense list for Tab 2
  const filteredExpenseList = useMemo(() => {
    return ownerExpenses.filter(item => {
      // Date filter
      if (startDate && item.expense_date < startDate) return false;
      if (endDate && item.expense_date > endDate) return false;

      // Category filter
      if (expenseFilterCategory !== 'all') {
        if (expenseFilterCategory === 'cogs' && item.category_type !== 'cogs') return false;
        if (expenseFilterCategory === 'opex' && item.category_type !== 'opex') return false;
        if (expenseFilterCategory.startsWith('cat_') && item.category !== expenseFilterCategory.replace('cat_', '')) return false;
      }

      // Search keyword
      if (expenseSearch.trim()) {
        const query = expenseSearch.toLowerCase();
        const matchTitle = item.title?.toLowerCase().includes(query);
        const matchVendor = item.vendor?.toLowerCase().includes(query);
        const matchNotes = item.notes?.toLowerCase().includes(query);
        if (!matchTitle && !matchVendor && !matchNotes) return false;
      }

      return true;
    });
  }, [ownerExpenses, startDate, endDate, expenseFilterCategory, expenseSearch]);

  // JIKA BUKAN OWNER: TAMPILKAN LAYAR TERKUNCI DENGAN TOMBOL PIN
  if (!isOwner) {
    return (
      <div className="container" style={{ padding: '60px 20px', maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
        <div className="glass-card animate-fade-in" style={{ padding: '40px 24px', borderRadius: '24px', border: '1px solid rgba(79, 70, 229, 0.25)', boxShadow: '0 20px 50px rgba(0,0,0,0.1)' }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'rgba(79, 70, 229, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            color: 'var(--burgundy-primary)'
          }}>
            <Lock size={42} />
          </div>
          
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Akses Terkunci Khusus Owner
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '28px' }}>
            Halaman Laporan Laba Rugi (Profit & Loss) dan Rekap Belanja Modal Kafe bersifat rahasia keuangan internal. Hanya akun berwenang Owner atau Manajemen yang dapat mengakses.
          </p>

          <button
            onClick={() => onRequirePin && onRequirePin('pnl')}
            className="btn btn-primary"
            style={{
              padding: '12px 28px',
              fontSize: '1rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              borderRadius: '12px'
            }}
          >
            <ShieldAlert size={20} />
            <span>Masukkan PIN Master Owner</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '24px 16px', maxWidth: '1240px', margin: '0 auto' }}>
      
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              display: 'inline-flex',
              padding: '6px 12px',
              borderRadius: '20px',
              background: 'rgba(79, 70, 229, 0.12)',
              color: 'var(--burgundy-primary)',
              fontSize: '0.78rem',
              fontWeight: 800,
              letterSpacing: '0.5px'
            }}>
              👑 OWNER EXCLUSIVE
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Bara Coffee Coffee & Eatery</span>
          </div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--text-primary)', margin: '6px 0 2px', letterSpacing: '-0.02em' }}>
            Profit & Loss (P&L) & Belanjaan Owner
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>
            Laporan kalkulasi laba bersih riil menggabungkan omset kasir, HPP belanja bahan, kas kecil, dan payroll kru.
          </p>
        </div>

        {/* Action Button: Tambah Belanjaan Owner */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => window.print()}
            className="btn btn-outline no-print"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px' }}
          >
            <Printer size={16} />
            <span>Cetak PDF</span>
          </button>
          
          <button
            onClick={handleOpenAdd}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', fontWeight: 700 }}
          >
            <Plus size={18} />
            <span>Catat Belanjaan Owner</span>
          </button>
        </div>
      </div>

      {/* FILTER PERIODE & TABS */}
      <div className="glass-card" style={{ padding: '16px 20px', marginBottom: '24px', borderRadius: '16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          
          {/* Sub Tab Switcher: Laporan P&L vs Rekap Belanjaan */}
          <div style={{ display: 'flex', background: 'var(--bg-input)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
            <button
              onClick={() => setActiveSubTab('statement')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 18px',
                borderRadius: '8px',
                border: 'none',
                background: activeSubTab === 'statement' ? 'var(--burgundy-primary)' : 'transparent',
                color: activeSubTab === 'statement' ? '#fff' : 'var(--text-secondary)',
                fontWeight: activeSubTab === 'statement' ? 700 : 500,
                fontSize: '0.88rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <TrendingUp size={16} />
              <span>Laporan Laba Rugi</span>
            </button>
            <button
              onClick={() => setActiveSubTab('expenses')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 18px',
                borderRadius: '8px',
                border: 'none',
                background: activeSubTab === 'expenses' ? 'var(--burgundy-primary)' : 'transparent',
                color: activeSubTab === 'expenses' ? '#fff' : 'var(--text-secondary)',
                fontWeight: activeSubTab === 'expenses' ? 700 : 500,
                fontSize: '0.88rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <ShoppingBag size={16} />
              <span>Daftar Belanjaan Owner ({ownerExpenses.length})</span>
            </button>
          </div>

          {/* Quick Period Presets */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-input)', padding: '4px', borderRadius: '10px' }}>
              {[
                { id: 'today', label: 'Hari Ini' },
                { id: 'this_week', label: '7 Hari' },
                { id: 'this_month', label: 'Bulan Ini' },
                { id: 'last_month', label: 'Bulan Lalu' },
                { id: 'custom', label: 'Kustom' }
              ].map(preset => (
                <button
                  key={preset.id}
                  onClick={() => setPeriodPreset(preset.id)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    fontWeight: periodPreset === preset.id ? 700 : 500,
                    borderRadius: '6px',
                    border: 'none',
                    background: periodPreset === preset.id ? 'var(--bg-card)' : 'transparent',
                    color: periodPreset === preset.id ? 'var(--burgundy-primary)' : 'var(--text-muted)',
                    boxShadow: periodPreset === preset.id ? 'var(--shadow-sm)' : 'none',
                    cursor: 'pointer'
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Custom Range Picker */}
            {periodPreset === 'custom' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)}
                  className="form-control"
                  style={{ padding: '6px 10px', fontSize: '0.82rem', width: '135px' }}
                />
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>s/d</span>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)}
                  className="form-control"
                  style={{ padding: '6px 10px', fontSize: '0.82rem', width: '135px' }}
                />
              </div>
            )}
          </div>

        </div>
      </div>

      {/* KPI CARDS (RINGKASAN EKSEKUTIF P&L) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '16px',
        marginBottom: '28px'
      }}>
        {/* 1. TOTAL NET REVENUE */}
        <div className="glass-card" style={{ padding: '20px', borderRadius: '16px', borderLeft: '4px solid #10B981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Omset Bersih (Net Revenue)
            </span>
            <div style={{ padding: '6px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', color: '#10B981' }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: '8px' }}>
            {formatIDR(pnlReport.revenue.netSales)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Dari {pnlReport.period.transactionCount} shift / transaksi
          </div>
        </div>

        {/* 2. TOTAL COGS (HPP BAHAN & PACKAGING) */}
        <div className="glass-card" style={{ padding: '20px', borderRadius: '16px', borderLeft: '4px solid #F59E0B' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Total HPP / COGS
            </span>
            <div style={{ padding: '6px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B' }}>
              <ShoppingBag size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: '8px' }}>
            {formatIDR(pnlReport.cogs.total)}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#F59E0B', marginTop: '4px', fontWeight: 600 }}>
            {pnlReport.cogs.ratioToSales.toFixed(1)}% dari Omset Bersih
          </div>
        </div>

        {/* 3. TOTAL BEBAN OPERASIONAL (OPEX) */}
        <div className="glass-card" style={{ padding: '20px', borderRadius: '16px', borderLeft: '4px solid #EF4444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Beban Operasional (OPEX)
            </span>
            <div style={{ padding: '6px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444' }}>
              <Receipt size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: '8px' }}>
            {formatIDR(pnlReport.opex.total)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Kasir: {formatIDR(pnlReport.opex.pettyCashKasir)} • Kru: {formatIDR(pnlReport.opex.payrollKru)}
          </div>
        </div>

        {/* 4. LABA BERSIH AKHIR (NET PROFIT) */}
        <div className="glass-card" style={{
          padding: '20px',
          borderRadius: '16px',
          borderLeft: `4px solid ${pnlReport.netProfit.isProfitable ? '#10B981' : '#E11D48'}`,
          background: pnlReport.netProfit.isProfitable 
            ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, var(--bg-card) 100%)' 
            : 'linear-gradient(135deg, rgba(225, 29, 72, 0.08) 0%, var(--bg-card) 100%)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: pnlReport.netProfit.isProfitable ? '#10B981' : '#E11D48', textTransform: 'uppercase' }}>
              {pnlReport.netProfit.isProfitable ? '✨ Laba Bersih (Net Profit)' : '⚠️ Rugi Bersih (Net Loss)'}
            </span>
            <div style={{
              padding: '6px',
              borderRadius: '8px',
              background: pnlReport.netProfit.isProfitable ? 'rgba(16, 185, 129, 0.2)' : 'rgba(225, 29, 72, 0.2)',
              color: pnlReport.netProfit.isProfitable ? '#10B981' : '#E11D48'
            }}>
              {pnlReport.netProfit.isProfitable ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
            </div>
          </div>
          <div style={{
            fontSize: '1.75rem',
            fontWeight: 900,
            color: pnlReport.netProfit.isProfitable ? '#059669' : '#E11D48',
            marginTop: '8px'
          }}>
            {formatIDR(pnlReport.netProfit.amount)}
          </div>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: pnlReport.netProfit.isProfitable ? '#059669' : '#E11D48', marginTop: '4px' }}>
            Net Profit Margin: {pnlReport.netProfit.marginPercent.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* VIEW 1: STATEMENT / LAPORAN LABA RUGI LENGKAP */}
      {activeSubTab === 'statement' && (
        <div className="glass-card" style={{ padding: '28px', borderRadius: '20px', marginBottom: '32px' }}>
          
          <div style={{ borderBottom: '2px solid var(--border-subtle)', paddingBottom: '16px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Laporan Laba Rugi Komprehensif
              </h2>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Periode: {formatDateID(startDate)} s/d {formatDateID(endDate)}
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{
                display: 'inline-block',
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: 700,
                background: pnlReport.netProfit.isProfitable ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: pnlReport.netProfit.isProfitable ? '#059669' : '#dc2626'
              }}>
                Status: {pnlReport.netProfit.isProfitable ? 'PROFITABLE (UNTUNG)' : 'DEFICIT (RUGI)'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* 1. PENDAPATAN (REVENUE) */}
            <div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: 'rgba(16, 185, 129, 0.08)',
                borderRadius: '8px',
                fontWeight: 800,
                fontSize: '0.98rem',
                color: '#065f46'
              }}>
                <span>1. PENDAPATAN OPERASIONAL (REVENUE)</span>
                <span>{formatIDR(pnlReport.revenue.netSales)}</span>
              </div>
              <div style={{ padding: '8px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.88rem', borderBottom: '1px dashed var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Penjualan Kotor (Gross Sales)</span>
                  <span style={{ fontWeight: 600 }}>{formatIDR(pnlReport.revenue.grossSales)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.88rem', borderBottom: '1px dashed var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Diskon & Promo Pelanggan</span>
                  <span style={{ color: 'var(--danger)', fontWeight: 600 }}>- {formatIDR(pnlReport.revenue.discounts)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  <span>Total Pendapatan Bersih (Net Sales)</span>
                  <span>{formatIDR(pnlReport.revenue.netSales)}</span>
                </div>
              </div>
            </div>

            {/* 2. BEBAN POKOK PENJUALAN (HPP / COGS) */}
            <div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: 'rgba(245, 158, 11, 0.08)',
                borderRadius: '8px',
                fontWeight: 800,
                fontSize: '0.98rem',
                color: '#92400e'
              }}>
                <span>2. BEBAN POKOK PENJUALAN (COGS / HPP)</span>
                <span>- {formatIDR(pnlReport.cogs.total)}</span>
              </div>
              <div style={{ padding: '8px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.88rem', borderBottom: '1px dashed var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>☕ Bahan Baku Kafe (Biji Kopi, Susu, Sirup, Butter, Adonan)</span>
                  <span style={{ fontWeight: 600 }}>{formatIDR(pnlReport.cogs.ingredients)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.88rem', borderBottom: '1px dashed var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>📦 Packaging & Kemasan (Paper Cup, Box Pastry, Sedotan)</span>
                  <span style={{ fontWeight: 600 }}>{formatIDR(pnlReport.cogs.packaging)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '0.9rem', fontWeight: 700, color: '#b45309' }}>
                  <span>Total HPP (COGS)</span>
                  <span>{formatIDR(pnlReport.cogs.total)}</span>
                </div>
              </div>
            </div>

            {/* LABA KOTOR (GROSS PROFIT) */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '14px 18px',
              borderRadius: '12px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-hover)'
            }}>
              <div>
                <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                  LABA KOTOR (GROSS PROFIT)
                </span>
                <span style={{ marginLeft: '12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Margin: {pnlReport.grossProfit.marginPercent.toFixed(1)}%
                </span>
              </div>
              <span style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--burgundy-primary)' }}>
                {formatIDR(pnlReport.grossProfit.amount)}
              </span>
            </div>

            {/* 3. BEBAN OPERASIONAL (OPEX) */}
            <div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: 'rgba(239, 68, 68, 0.08)',
                borderRadius: '8px',
                fontWeight: 800,
                fontSize: '0.98rem',
                color: '#991b1b'
              }}>
                <span>3. BIAYA & BEBAN OPERASIONAL (OPEX)</span>
                <span>- {formatIDR(pnlReport.opex.total)}</span>
              </div>
              <div style={{ padding: '8px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.88rem', borderBottom: '1px dashed var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>💵 Kas Kecil Kasir / Petty Cash (Es Batu, Operasional Harian)</span>
                  <span style={{ fontWeight: 600 }}>{formatIDR(pnlReport.opex.pettyCashKasir)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.88rem', borderBottom: '1px dashed var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>👥 Beban Gaji & Payroll Kru</span>
                  <span style={{ fontWeight: 600 }}>{formatIDR(pnlReport.opex.payrollKru)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.88rem', borderBottom: '1px dashed var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>⚡ Utilitas Toko (Listrik PLN, Air PDAM, Gas, Wi-Fi)</span>
                  <span style={{ fontWeight: 600 }}>{formatIDR(pnlReport.opex.utilities)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.88rem', borderBottom: '1px dashed var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>🔧 Perawatan & Maintenance Alat (Servis Mesin Kopi, Grinder, AC)</span>
                  <span style={{ fontWeight: 600 }}>{formatIDR(pnlReport.opex.maintenance)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.88rem', borderBottom: '1px dashed var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>📢 Marketing & Promosi Toko</span>
                  <span style={{ fontWeight: 600 }}>{formatIDR(pnlReport.opex.marketing)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.88rem', borderBottom: '1px dashed var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>🏢 Sewa Lokasi & Perizinan</span>
                  <span style={{ fontWeight: 600 }}>{formatIDR(pnlReport.opex.rent)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.88rem', borderBottom: '1px dashed var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>🧹 Perlengkapan Kebersihan & Toko</span>
                  <span style={{ fontWeight: 600 }}>{formatIDR(pnlReport.opex.supplies)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.88rem', borderBottom: '1px dashed var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>📝 Pengeluaran Tak Terduga / Lain-lain</span>
                  <span style={{ fontWeight: 600 }}>{formatIDR(pnlReport.opex.other)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '0.9rem', fontWeight: 700, color: '#dc2626' }}>
                  <span>Total Beban Operasional (OPEX)</span>
                  <span>{formatIDR(pnlReport.opex.total)}</span>
                </div>
              </div>
            </div>

            {/* HASIL AKHIR: NET PROFIT (LABA BERSIH) */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '20px 24px',
              borderRadius: '16px',
              background: pnlReport.netProfit.isProfitable 
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0.05) 100%)' 
                : 'linear-gradient(135deg, rgba(225, 29, 72, 0.15) 0%, rgba(225, 29, 72, 0.05) 100%)',
              border: `2px solid ${pnlReport.netProfit.isProfitable ? '#10B981' : '#E11D48'}`
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                  {pnlReport.netProfit.isProfitable ? 'LABA BERSIH AKHIR (NET PROFIT)' : 'RUGI BERSIH AKHIR (NET LOSS)'}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Formula: Laba Kotor ({formatIDR(pnlReport.grossProfit.amount)}) - Beban OPEX ({formatIDR(pnlReport.opex.total)})
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontSize: '2rem',
                  fontWeight: 900,
                  color: pnlReport.netProfit.isProfitable ? '#059669' : '#dc2626',
                  letterSpacing: '-0.02em'
                }}>
                  {formatIDR(pnlReport.netProfit.amount)}
                </div>
                <span style={{
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  color: pnlReport.netProfit.isProfitable ? '#059669' : '#dc2626'
                }}>
                  Margin: {pnlReport.netProfit.marginPercent.toFixed(1)}% dari Omset
                </span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* VIEW 2: REKAP BELANJAAN OWNER (EXPENSE TRACKER TABLE) */}
      {activeSubTab === 'expenses' && (
        <div className="glass-card" style={{ padding: '24px', borderRadius: '20px' }}>
          
          {/* Header & Filter Controls */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Buku Catatan Belanjaan Owner
              </h2>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Daftar nota belanja bahan baku (HPP), packaging, servis alat, dan utilitas kafe
              </span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
              {/* Category Filter */}
              <select
                value={expenseFilterCategory}
                onChange={(e) => setExpenseFilterCategory(e.target.value)}
                className="form-control"
                style={{ padding: '8px 12px', fontSize: '0.85rem' }}
              >
                <option value="all">Semua Kategori</option>
                <option value="cogs">📦 Hanya HPP (Bahan & Kemasan)</option>
                <option value="opex">⚙️ Hanya Biaya Operasional (OPEX)</option>
                {EXPENSE_CATEGORIES.map(cat => (
                  <option key={cat.id} value={`cat_${cat.id}`}>
                    {cat.icon} {cat.label}
                  </option>
                ))}
              </select>

              {/* Search Box */}
              <input
                type="text"
                placeholder="Cari belanjaan, toko / vendor..."
                value={expenseSearch}
                onChange={(e) => setExpenseSearch(e.target.value)}
                className="form-control"
                style={{ padding: '8px 12px', fontSize: '0.85rem', width: '220px' }}
              />
            </div>
          </div>

          {/* Table of Expenses */}
          {filteredExpenseList.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <ShoppingBag size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
              <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>Belum ada catatan belanjaan di periode ini.</p>
              <button 
                onClick={handleOpenAdd}
                className="btn btn-outline"
                style={{ marginTop: '8px', fontSize: '0.85rem' }}
              >
                + Tambah Belanjaan Pertama
              </button>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-hover)', color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'left' }}>
                    <th style={{ padding: '12px 10px' }}>TANGGAL</th>
                    <th style={{ padding: '12px 10px' }}>NAMA BELANJAAN</th>
                    <th style={{ padding: '12px 10px' }}>KATEGORI</th>
                    <th style={{ padding: '12px 10px' }}>VENDOR / TOKO</th>
                    <th style={{ padding: '12px 10px' }}>PEMBAYARAN</th>
                    <th style={{ padding: '12px 10px', textAlign: 'right' }}>NOMINAL</th>
                    <th style={{ padding: '12px 10px', textAlign: 'center' }}>AKSI</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenseList.map((item) => {
                    const catObj = EXPENSE_CATEGORIES.find(c => c.id === item.category);
                    const isCogs = item.category_type === 'cogs';

                    return (
                      <tr 
                        key={item.id}
                        style={{ borderBottom: '1px solid var(--border-subtle)', fontSize: '0.88rem' }}
                      >
                        <td style={{ padding: '14px 10px', whiteSpace: 'nowrap', fontWeight: 600 }}>
                          {formatDateID(item.expense_date)}
                        </td>
                        <td style={{ padding: '14px 10px' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                            {item.title}
                          </div>
                          {item.notes && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {item.notes}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '14px 10px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background: isCogs ? 'rgba(245, 158, 11, 0.12)' : 'rgba(79, 70, 229, 0.1)',
                            color: isCogs ? '#b45309' : 'var(--burgundy-primary)'
                          }}>
                            <span>{catObj?.icon || '📝'}</span>
                            <span>{isCogs ? 'HPP' : 'OPEX'}</span>
                          </span>
                        </td>
                        <td style={{ padding: '14px 10px', color: 'var(--text-secondary)' }}>
                          {item.vendor || '-'}
                        </td>
                        <td style={{ padding: '14px 10px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {item.payment_method}
                        </td>
                        <td style={{ padding: '14px 10px', textAlign: 'right', fontWeight: 800, color: 'var(--text-primary)' }}>
                          {formatIDR(item.amount)}
                        </td>
                        <td style={{ padding: '14px 10px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                            <button
                              onClick={() => handleOpenEdit(item)}
                              title="Edit"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--burgundy-primary)',
                                cursor: 'pointer',
                                padding: '4px'
                              }}
                            >
                              <Edit3 size={15} />
                            </button>
                            <button
                              onClick={() => handleDeleteExpense(item.id, item.title)}
                              title="Hapus"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--danger)',
                                cursor: 'pointer',
                                padding: '4px'
                              }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

        </div>
      )}

      {/* MODAL INPUT / EDIT BELANJAAN OWNER */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div className="glass-card animate-fade-in" style={{
            background: 'var(--bg-card)',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '540px',
            padding: '28px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
            border: '1px solid var(--border-hover)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {editingExpense ? 'Edit Catatan Belanjaan' : 'Catat Belanjaan Owner'}
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Otomatis masuk ke kalkulasi COGS / Beban Laba Rugi
                </span>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'transparent', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveExpense} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700 }}>Tanggal Belanja *</label>
                  <input
                    type="date"
                    required
                    value={formData.expense_date}
                    onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                    className="form-control"
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700 }}>Nominal Biaya (Rp) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="Contoh: 1500000"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="form-control"
                  />
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700 }}>Nama Belanjaan / Item *</label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Beli Susu Greenfields 2 Karton + Syrup Monin"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="form-control"
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700 }}>Kategori Pos Pengeluaran *</label>
                <select
                  value={formData.category}
                  onChange={handleCategoryChange}
                  className="form-control"
                >
                  {EXPENSE_CATEGORIES.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} [{cat.type.toUpperCase()}] {cat.label}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '0.74rem', color: formData.category_type === 'cogs' ? '#b45309' : 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  {formData.category_type === 'cogs' 
                    ? '📦 Terhitung sebagai HPP (Beban Pokok Penjualan) mengurangi Laba Kotor' 
                    : '⚡ Terhitung sebagai Beban Operasional (OPEX) mengurangi Laba Bersih'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700 }}>Kanal Pembayaran</label>
                  <select
                    value={formData.payment_method}
                    onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                    className="form-control"
                  >
                    {PAYMENT_METHODS.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700 }}>Nama Toko / Vendor</label>
                  <input
                    type="text"
                    placeholder="Misal: Toko Bahan Kue Maju"
                    value={formData.vendor}
                    onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                    className="form-control"
                  />
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700 }}>Catatan Tambahan (Opsional)</label>
                <textarea
                  rows="2"
                  placeholder="Keterangan nomor nota, kuantiti barang, dsb"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="form-control"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-outline"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="btn btn-primary"
                  style={{ minWidth: '130px' }}
                >
                  {formSubmitting ? 'Menyimpan...' : (editingExpense ? 'Simpan Perubahan' : 'Catat Belanjaan')}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
