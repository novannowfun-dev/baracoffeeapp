import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Wallet, 
  CreditCard, 
  QrCode, 
  Truck, 
  AlertTriangle, 
  CheckCircle2, 
  Calendar, 
  PlusCircle,
  Filter,
  BarChart3,
  Target,
  Award,
  Gift,
  Sparkles,
  Flame,
  Trophy,
  ChevronRight,
  Receipt
} from 'lucide-react';
import { formatIDR, formatDateID, getShiftBadge } from '../lib/formatters';
import { 
  getTargetConfig, 
  calculateMonthlyTargetProgress, 
  triggerCelebrationConfetti 
} from '../lib/targetService';
import { getKasirProApiKey, fetchKasirProSalesSummary } from '../lib/kasirProService';

const SHIFT_FILTERS = ['Semua', 'Shift Pagi', 'Shift Malam'];

export default function DashboardView({ records, onNavigateToInput, onSelectRecord, onNavigateToExpenses, onNavigateToKasirPro, activeOutlet = 'semua' }) {
  const [selectedShift, setSelectedShift] = useState('Semua');
  const [targetConfig, setTargetConfig] = useState(null);
  const [kasirProToday, setKasirProToday] = useState(null);

  // Load KasirPro Today summary if key exists
  React.useEffect(() => {
    const key = getKasirProApiKey();
    if (key) {
      const today = new Date().toISOString().split('T')[0];
      fetchKasirProSalesSummary(today, today)
        .then(res => setKasirProToday(res))
        .catch(err => console.warn('KasirPro summary widget error:', err));
    }
  }, []);

  // Load target config
  React.useEffect(() => {
    getTargetConfig().then(cfg => setTargetConfig(cfg));
  }, []);

  // Hitung target bulanan bersama seluruh kru & bonus 1% per orang
  const monthlyProgress = useMemo(() => {
    return calculateMonthlyTargetProgress(records, targetConfig || undefined);
  }, [records, targetConfig]);

  // Filter records berdasarkan shift
  const [outletFilter, setOutletFilter] = useState('semua');

  const filteredRecords = useMemo(() => {
    let list = records;
    if (outletFilter !== 'semua') {
      list = list.filter(r => (r.outlet || 'kedai') === outletFilter);
    }
    if (selectedShift !== 'Semua') {
      list = list.filter(r => r.shift === selectedShift || (selectedShift === 'Shift Malam' && r.shift === 'Shift Sore'));
    }
    return list;
  }, [records, selectedShift, outletFilter]);

  // Kalkulasi Metrik Utama
  const metrics = useMemo(() => {
    let totalGross = 0;
    let totalNet = 0;
    let totalDiscount = 0;
    let totalCash = 0;
    let totalQris = 0;
    let totalEdc = 0;
    let totalDelivery = 0;
    let totalPettyCash = 0;
    let totalMismatchCount = 0;

    filteredRecords.forEach(r => {
      totalGross += Number(r.gross_sales) || 0;
      totalNet += Number(r.net_sales) || 0;
      totalDiscount += Number(r.discounts) || 0;
      totalCash += Number(r.payment_cash) || 0;
      totalQris += Number(r.payment_qris) || 0;
      totalEdc += Number(r.payment_edc) || 0;
      totalDelivery += Number(r.payment_delivery) || 0;
      totalPettyCash += Number(r.petty_cash_out) || 0;
      if (Math.abs(Number(r.cash_difference) || 0) > 0) {
        totalMismatchCount += 1;
      }
    });

    const totalDigital = totalQris + totalEdc + totalDelivery;

    return {
      totalGross,
      totalNet,
      totalDiscount,
      totalCash,
      totalQris,
      totalEdc,
      totalDelivery,
      totalDigital,
      totalPettyCash,
      totalMismatchCount,
      recordCount: filteredRecords.length
    };
  }, [filteredRecords]);

  // Persentase Kanal Pembayaran
  const paymentBreakdown = useMemo(() => {
    const total = metrics.totalNet || 1;
    return [
      { label: 'QRIS', amount: metrics.totalQris, pct: Math.round((metrics.totalQris / total) * 100), color: 'var(--gold-light)' },
      { label: 'Uang Tunai (Cash)', amount: metrics.totalCash, pct: Math.round((metrics.totalCash / total) * 100), color: 'var(--success)' },
      { label: 'Mesin EDC', amount: metrics.totalEdc, pct: Math.round((metrics.totalEdc / total) * 100), color: 'var(--info)' },
      { label: 'Online Delivery', amount: metrics.totalDelivery, pct: Math.round((metrics.totalDelivery / total) * 100), color: 'var(--warning)' },
    ];
  }, [metrics]);

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '60px' }}>
      
      {/* Top Bar: Title & Shift Filter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Ringkasan Eksekutif & Omset
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '4px 0 0 0' }}>
            Pantau performa penjualan, proporsi kanal pembayaran, dan audit kas fisik laci Bara Coffee.
          </p>
        </div>

        {/* Actions & Shift Filter Pill Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {onNavigateToExpenses && (
            <button
              onClick={onNavigateToExpenses}
              className="btn btn-secondary"
              style={{ fontSize: '0.82rem', padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Buka Buku Kas & Rincian Pengeluaran"
            >
              <Receipt size={14} color="var(--gold-light)" />
              <span>Buku Kas Pengeluaran</span>
            </button>
          )}

          <div className="subtab-container" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-surface)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            {SHIFT_FILTERS.map(shift => (
              <button
                key={shift}
                onClick={() => setSelectedShift(shift)}
                style={{
                  background: selectedShift === shift ? 'var(--gold-primary)' : 'transparent',
                  color: selectedShift === shift ? '#000' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {shift}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Live Mode Ready Banner when no records yet */}
      {records.length === 0 && (
        <div className="glass-card" style={{ padding: '18px 22px', marginBottom: '22px', background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.06) 0%, rgba(255, 255, 255, 0.98) 100%)', borderColor: 'var(--border-hover)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <CheckCircle2 size={24} color="var(--burgundy-primary)" />
            <div>
              <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--burgundy-primary)', fontWeight: 700 }}>
                Sistem Pembukuan Siap Digunakan
              </h4>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Belum ada transaksi tersimpan. Setiap input shift baru akan otomatis tercatat dan tersimpan rapi ke sistem cloud Bara Coffee.
              </p>
            </div>
          </div>
          <button onClick={onNavigateToInput} className="btn btn-primary" style={{ fontSize: '0.85rem', padding: '8px 16px' }}>
            <PlusCircle size={15} />
            <span>Mulai Input Omset Shift</span>
          </button>
        </div>
      )}

      {/* Live KasirPro POS Widget (Jika API Key Aktif) */}
      {kasirProToday && (
        <div className="glass-card" style={{
          padding: '16px 20px',
          marginBottom: '20px',
          background: 'linear-gradient(135deg, rgba(207, 58, 74, 0.08) 0%, rgba(255, 255, 255, 0.96) 100%)',
          border: '1px solid rgba(207, 58, 74, 0.25)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(207, 58, 74, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Receipt size={20} color="#cf3a4a" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h4 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  KasirPro POS — Live Hari Ini
                </h4>
                <span className="badge" style={{ background: 'rgba(207, 58, 74, 0.15)', color: '#cf3a4a', fontSize: '0.7rem' }}>
                  Live Sync
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Omset Hari Ini: <strong style={{ color: '#cf3a4a' }}>{formatIDR(kasirProToday.total?.omzet || 0)}</strong> ({kasirProToday.total?.trx || 0} nota transaksi)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onNavigateToKasirPro}
            className="btn btn-secondary"
            style={{ fontSize: '0.82rem', padding: '6px 14px', borderColor: 'rgba(207, 58, 74, 0.3)', color: '#cf3a4a' }}
          >
            <span>Buka KasirPro Monitor</span>
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Goals Omset Bulanan & Bonus Kru (Collective Team Target) Banner */}
      <div className="glass-card" style={{
        padding: '24px',
        marginBottom: '24px',
        background: monthlyProgress.isTargetPassed 
          ? 'linear-gradient(135deg, rgba(13, 148, 136, 0.12) 0%, rgba(255, 255, 255, 0.95) 100%)' 
          : 'linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, rgba(255, 255, 255, 0.95) 100%)',
        border: `1px solid ${monthlyProgress.isTargetPassed ? 'rgba(46, 196, 182, 0.45)' : 'var(--border-hover)'}`,
        borderRadius: 'var(--radius-lg)',
        boxShadow: monthlyProgress.isTargetPassed ? '0 12px 35px rgba(46, 196, 182, 0.18)' : 'none',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Top Header */}
        <div className="goals-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              minWidth: '42px',
              borderRadius: '12px',
              background: monthlyProgress.isTargetPassed ? 'rgba(13, 148, 136, 0.15)' : 'var(--burgundy-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `1px solid ${monthlyProgress.isTargetPassed ? 'var(--success)' : 'var(--border-hover)'}`
            }}>
              {monthlyProgress.isTargetPassed ? (
                <Trophy size={22} color="var(--success)" />
              ) : (
                <Target size={22} color="var(--burgundy-primary)" />
              )}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '1.12rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Goals Omset Tim
                </h3>
                <span className={`badge ${monthlyProgress.isTargetPassed ? 'badge-success' : 'badge-primary'}`} style={{ fontSize: '0.72rem' }}>
                  {monthlyProgress.milestone.badge}
                </span>
              </div>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {monthlyProgress.milestone.message}
              </p>
            </div>
          </div>

          {/* Time & Transaction Info */}
          <div className="goals-info-boxes" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ background: 'var(--bg-surface)', padding: '8px 14px', borderRadius: '10px', border: '1px solid var(--border-subtle)', textAlign: 'right' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Periode Bulan:</span>
              <strong style={{ fontSize: '0.88rem', color: 'var(--burgundy-primary)', fontWeight: 700 }}>
                Hari ke-{monthlyProgress.currentDay} • Sisa {monthlyProgress.daysRemaining} Hari
              </strong>
            </div>

            <div style={{ background: 'var(--bg-surface)', padding: '8px 14px', borderRadius: '10px', border: '1px solid var(--border-subtle)', textAlign: 'right' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Transaksi Tercatat:</span>
              <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                {monthlyProgress.totalTransactionsThisMonth} Shift
              </strong>
            </div>
          </div>
        </div>

        {/* Progress Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', alignItems: 'center' }}>
          
          {/* Left: Progress Bar & Target Numbers */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Net Omset Bulan Ini:</span>
                <div style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {formatIDR(monthlyProgress.totalMonthlyNet)}
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                    {' '} / {formatIDR(monthlyProgress.monthlyTarget)}
                  </span>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{ 
                  fontSize: '1.8rem', 
                  fontWeight: 900, 
                  color: monthlyProgress.isTargetPassed ? 'var(--success)' : 'var(--burgundy-primary)', 
                  fontFamily: 'var(--font-mono)' 
                }}>
                  {monthlyProgress.percentAchieved}%
                </span>
              </div>
            </div>

            {/* Dynamic Progress Bar */}
            <div style={{
              width: '100%',
              height: '16px',
              borderRadius: '10px',
              background: 'rgba(0, 0, 0, 0.08)',
              border: '1px solid var(--border-subtle)',
              overflow: 'hidden',
              position: 'relative'
            }}>
              <div style={{
                height: '100%',
                width: `${Math.min(100, Math.max(0, monthlyProgress.percentAchieved))}%`,
                background: monthlyProgress.isTargetPassed
                  ? 'linear-gradient(90deg, #0D9488 0%, #10B981 100%)'
                  : 'var(--gradient-burgundy)',
                borderRadius: '10px',
                transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
              }} />
            </div>

            {/* Pace & Run rate Info */}
            <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', flexWrap: 'wrap', gap: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>
                Rata-rata saat ini: ~{formatIDR(monthlyProgress.currentDailyAverage)}/hari
              </span>
              <span style={{ color: monthlyProgress.isTargetPassed ? 'var(--success)' : 'var(--warning)', fontWeight: 600 }}>
                {monthlyProgress.isTargetPassed 
                  ? `✓ TARGET PASS! Melebihi goals sebesar ${formatIDR(monthlyProgress.excess)}` 
                  : `Butuh ~${formatIDR(monthlyProgress.dailyAverageNeeded)}/hari untuk tembus 45 Juta`
                }
              </span>
            </div>
          </div>

          {/* Right: Bonus 1% Omset per Kru Box */}
          <div style={{
            background: monthlyProgress.isTargetPassed ? 'rgba(13, 148, 136, 0.08)' : 'rgba(255, 255, 255, 0.85)',
            padding: '18px 20px',
            borderRadius: 'var(--radius-md)',
            border: `1px solid ${monthlyProgress.isTargetPassed ? 'rgba(13, 148, 136, 0.3)' : 'var(--border-hover)'}`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.84rem', fontWeight: 800, color: monthlyProgress.isTargetPassed ? 'var(--success)' : 'var(--burgundy-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Gift size={16} />
                <span>Bonus Omset Kru ({monthlyProgress.bonusPercent}% dari Omset)</span>
              </span>
              <span className={`badge ${monthlyProgress.isTargetPassed ? 'badge-success' : 'badge-primary'}`} style={{ fontSize: '0.7rem' }}>
                {monthlyProgress.isTargetPassed ? 'Eligible ✓' : 'Terkunci'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div>
                <h4 style={{ 
                  fontSize: '1.75rem', 
                  fontWeight: 900, 
                  color: monthlyProgress.isTargetPassed ? 'var(--success)' : 'var(--text-primary)', 
                  margin: 0,
                  fontFamily: 'var(--font-mono)' 
                }}>
                  {formatIDR(monthlyProgress.isTargetPassed ? monthlyProgress.bonusPerStaff : Math.round(monthlyProgress.totalMonthlyNet * (monthlyProgress.bonusPercent / 100)))}
                </h4>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {monthlyProgress.isTargetPassed 
                    ? `Per kru aktif di slip gaji bulan ${monthlyProgress.monthName}!`
                    : `Terkumpul (Akan cair per kru saat omset ≥ ${formatIDR(monthlyProgress.monthlyTarget)})`
                  }
                </span>
              </div>

              {monthlyProgress.isTargetPassed && (
                <button 
                  onClick={triggerCelebrationConfetti}
                  className="btn btn-primary"
                  style={{ fontSize: '0.8rem', padding: '7px 14px', background: 'var(--success)', borderColor: 'var(--success)' }}
                >
                  <Sparkles size={14} />
                  <span>Rayakan Goals! 🎉</span>
                </button>
              )}
            </div>

            {targetConfig?.notes && (
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: '6px' }}>
                📢 <em>"{targetConfig.notes}"</em>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* KPI Cards Grid */}
      <div className="dashboard-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        
        {/* Card 1: Total Omset Bersih */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                Total Net Sales
              </span>
              <h3 style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--burgundy-primary)', margin: '6px 0 2px 0', fontFamily: 'var(--font-mono)' }}>
                {formatIDR(metrics.totalNet)}
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Dari {metrics.recordCount} entri shift tercatat
              </span>
            </div>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--burgundy-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={20} color="var(--burgundy-primary)" />
            </div>
          </div>
        </div>

        {/* Card 2: Cash In */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                Penerimaan Tunai (Cash)
              </span>
              <h3 style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--success)', margin: '6px 0 2px 0', fontFamily: 'var(--font-mono)' }}>
                {formatIDR(metrics.totalCash)}
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Uang fisik masuk ke laci kasir
              </span>
            </div>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wallet size={20} color="var(--success)" />
            </div>
          </div>
        </div>

        {/* Card 3: Digital Payments */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                Non-Tunai (QRIS/EDC/Apps)
              </span>
              <h3 style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--info)', margin: '6px 0 2px 0', fontFamily: 'var(--font-mono)' }}>
                {formatIDR(metrics.totalDigital)}
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                QRIS: {formatIDR(metrics.totalQris)}
              </span>
            </div>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--info-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <QrCode size={20} color="var(--info)" />
            </div>
          </div>
        </div>

        {/* Card 4: Audit Kas Laci */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                Audit Kas Fisik Laci
              </span>
              <h3 style={{ fontSize: '1.7rem', fontWeight: 800, color: metrics.totalMismatchCount === 0 ? 'var(--success)' : 'var(--danger)', margin: '6px 0 2px 0' }}>
                {metrics.totalMismatchCount === 0 ? '100% Klop' : `${metrics.totalMismatchCount} Selisih`}
              </h3>
              <div style={{ marginTop: '6px' }}>
                {onNavigateToExpenses ? (
                  <button
                    onClick={onNavigateToExpenses}
                    style={{
                      background: 'rgba(225, 29, 72, 0.08)',
                      border: '1px solid rgba(225, 29, 72, 0.25)',
                      color: 'var(--danger)',
                      padding: '4px 9px',
                      borderRadius: '6px',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.2s'
                    }}
                    title="Buka Buku Kas & Rincian Pengeluaran"
                  >
                    <span>💸 Petty Cash: -{formatIDR(metrics.totalPettyCash)}</span>
                    <ChevronRight size={12} />
                  </button>
                ) : (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Petty Cash: -{formatIDR(metrics.totalPettyCash)}
                  </span>
                )}
              </div>
            </div>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: metrics.totalMismatchCount === 0 ? 'var(--success-bg)' : 'var(--danger-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {metrics.totalMismatchCount === 0 ? (
                <CheckCircle2 size={20} color="var(--success)" />
              ) : (
                <AlertTriangle size={20} color="var(--danger)" />
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Middle Grid: Payment Distribution & Quick Action */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '28px' }}>
        
        {/* Payment Channels Breakdown */}
        <div className="glass-card" style={{ padding: '22px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart3 size={18} color="var(--burgundy-primary)" />
            <span>Distribusi Kanal Pembayaran</span>
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {paymentBreakdown.map((item, idx) => (
              <div key={idx}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{item.label}</span>
                  <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    {formatIDR(item.amount)} ({item.pct}%)
                  </span>
                </div>
                <div style={{ height: '8px', background: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div 
                    style={{
                      height: '100%',
                      width: `${item.pct}%`,
                      background: item.color,
                      borderRadius: '4px',
                      transition: 'width 0.4s ease'
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cafe Action Card */}
        <div className="glass-card" style={{ padding: '22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.06) 0%, rgba(255, 255, 255, 0.98) 100%)' }}>
          <div>
            <div className="badge badge-primary" style={{ marginBottom: '12px' }}>
              Shift Baru Cafe
            </div>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Ingin input omset shift baru?
            </h3>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '20px' }}>
              Pencatatan shift pagi, sore, full day, atau split shift dengan kalkulasi kas laci otomatis dan pembukuan terpadu secara real-time.
            </p>
          </div>

          <button 
            onClick={onNavigateToInput}
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px' }}
          >
            <PlusCircle size={18} />
            <span>Mulai Input Omset Shift</span>
          </button>
        </div>

      </div>

      {/* Recent Shift Entries Table Preview */}
      <div className="glass-card" style={{ padding: '22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Entri Omset Terakhir ({filteredRecords.slice(0, 5).length} data)
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Klik baris untuk melihat rincian nota kas kecil
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '10px 12px' }}>Tanggal & Shift</th>
                <th style={{ padding: '10px 12px' }}>Kasir</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Net Sales</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Cash Fisik</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>Kas Laci</th>
                <th style={{ padding: '10px 12px' }}>Catatan</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.slice(0, 5).map((r) => {
                const badge = getShiftBadge(r.shift);
                const diff = Number(r.cash_difference) || 0;

                return (
                  <tr 
                    key={r.id}
                    onClick={() => onSelectRecord(r)}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      transition: 'background 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(79, 70, 229, 0.04)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatDateID(r.entry_date)}</div>
                      <span className={`badge ${badge.color}`} style={{ marginTop: '4px', fontSize: '0.72rem' }}>
                        {badge.icon} {r.shift}
                      </span>
                    </td>
                    <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>
                      {r.cashier_name}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: 'var(--burgundy-primary)', fontFamily: 'var(--font-mono)' }}>
                      {formatIDR(r.net_sales)}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                      {formatIDR(r.actual_cash)}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      {diff === 0 ? (
                        <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>✓ Klop</span>
                      ) : diff > 0 ? (
                        <span className="badge badge-warning" style={{ fontSize: '0.72rem' }}>+{formatIDR(diff)}</span>
                      ) : (
                        <span className="badge badge-danger" style={{ fontSize: '0.72rem' }}>-{formatIDR(Math.abs(diff))}</span>
                      )}
                    </td>
                    <td style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '0.8rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.notes || '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
