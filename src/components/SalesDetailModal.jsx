import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Printer, 
  Calendar, 
  User, 
  Wallet, 
  Receipt, 
  CreditCard, 
  AlertTriangle, 
  CheckCircle2, 
  Coffee, 
  FileText,
  Clock,
  Trash2
} from 'lucide-react';
import { formatIDR, formatDateID, getShiftBadge, terbilangIDR } from '../lib/formatters';

export default function SalesDetailModal({ record, onClose, onDelete }) {
  if (!record) return null;

  const [activeViewMode, setActiveViewMode] = useState('app'); // 'app' | 'slip'
  const [paperFormat, setPaperFormat] = useState('voucher'); // 'voucher' | 'thermal'

  const badge = getShiftBadge(record.shift);
  const diff = Number(record.cash_difference) || 0;
  const items = record.petty_cash_items || [];

  const handlePrint = () => {
    setActiveViewMode('slip');
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const printTimeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  return createPortal(
    <div className="modal-overlay print-modal-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(28, 18, 20, 0.55)',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1050,
      padding: '16px',
      overflowY: 'auto',
      boxSizing: 'border-box'
    }}>
      
      {/* ========================================================================= */}
      {/* SCREEN VIEW: GLASS CARD INTERACTIVE                                      */}
      {/* ========================================================================= */}
      <div className={`modal-container animate-fade-in ${activeViewMode === 'slip' ? 'printable-document' : ''}`} style={{
        width: '100%',
        maxWidth: activeViewMode === 'slip' && paperFormat === 'thermal' ? '460px' : '720px',
        margin: 'auto',
        maxHeight: 'min(92vh, calc(100vh - 32px))',
        overflowY: 'auto',
        boxSizing: 'border-box',
        background: activeViewMode === 'slip' ? '#ffffff' : 'var(--bg-card)',
        color: activeViewMode === 'slip' ? '#1a1a1a' : 'var(--text-primary)',
        border: activeViewMode === 'slip' ? 'none' : '1px solid var(--border-subtle)',
        borderRadius: activeViewMode === 'slip' ? '12px' : 'var(--radius-lg)',
        padding: activeViewMode === 'slip' ? '32px 36px' : '26px',
        position: 'relative',
        boxShadow: '0 25px 70px rgba(79, 70, 229, 0.15)'
      }}>
        
        {/* Navigation & Mode Bar (Hidden when printed) */}
        <div className="no-print" style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '20px', 
          paddingBottom: '14px', 
          borderBottom: activeViewMode === 'slip' ? '1px solid #e5e0d8' : '1px solid var(--border-subtle)' 
        }}>
          {/* View Mode Toggle */}
          <div style={{ display: 'flex', gap: '6px', background: activeViewMode === 'slip' ? '#f0ede6' : 'var(--bg-input)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <button
              onClick={() => setActiveViewMode('app')}
              style={{
                border: 'none',
                background: activeViewMode === 'app' ? 'var(--burgundy-primary)' : 'transparent',
                color: activeViewMode === 'app' ? '#ffffff' : activeViewMode === 'slip' ? '#555' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '0.78rem',
                padding: '6px 14px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>📊 Mode Aplikasi</span>
            </button>
            <button
              onClick={() => setActiveViewMode('slip')}
              style={{
                border: 'none',
                background: activeViewMode === 'slip' ? 'var(--burgundy-primary)' : 'transparent',
                color: activeViewMode === 'slip' ? '#ffffff' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '0.78rem',
                padding: '6px 14px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Receipt size={14} />
              <span>🧾 Pratinjau Struk Cetak</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {activeViewMode === 'slip' && (
              <div style={{ display: 'flex', gap: '4px', fontSize: '0.74rem' }}>
                <button
                  onClick={() => setPaperFormat('voucher')}
                  style={{
                    border: '1px solid #dcd6cd',
                    background: paperFormat === 'voucher' ? '#8c5314' : '#fff',
                    color: paperFormat === 'voucher' ? '#fff' : '#666',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  Voucher / A4
                </button>
                <button
                  onClick={() => setPaperFormat('thermal')}
                  style={{
                    border: '1px solid #dcd6cd',
                    background: paperFormat === 'thermal' ? '#8c5314' : '#fff',
                    color: paperFormat === 'thermal' ? '#fff' : '#666',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  POS 80mm
                </button>
              </div>
            )}

            {/* Close Icon Button */}
            <button 
              onClick={onClose}
              style={{
                background: activeViewMode === 'slip' ? '#f0ede6' : 'var(--bg-card)',
                border: activeViewMode === 'slip' ? '1px solid #e0dbd1' : '1px solid var(--border-subtle)',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: activeViewMode === 'slip' ? '#333' : 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* VIEW A: INTERACTIVE APP MODE (DARK/GOLD CAFE LUXE)                      */}
        {/* ========================================================================= */}
        {activeViewMode === 'app' && (
          <div className="animate-fade-in">
            {/* Modal Header */}
            <div style={{ marginBottom: '20px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span className={`badge ${badge.color}`} style={{ fontSize: '0.8rem' }}>
                  {badge.icon} {record.shift}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  ({badge.hours})
                </span>
              </div>
              
              <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
                Laporan Shift — {formatDateID(record.entry_date)}
              </h2>
              
              <div style={{ display: 'flex', gap: '16px', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <User size={14} color="var(--gold-light)" /> Kasir: <strong>{record.cashier_name}</strong>
                </span>
                <span>ID: {record.id.slice(0, 8)}</span>
              </div>
            </div>

            {/* Section A: Omset & Net Sales */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' }}>
              <div style={{ background: 'var(--bg-input)', padding: '12px 16px', borderRadius: 'var(--radius-md)' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Gross Sales</span>
                <div style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {formatIDR(record.gross_sales)}
                </div>
                {Number(record.discounts) > 0 && (
                  <span style={{ fontSize: '0.74rem', color: 'var(--danger)' }}>Diskon: -{formatIDR(record.discounts)}</span>
                )}
              </div>

              <div style={{ background: 'var(--gold-glow)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-hover)' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--gold-light)', textTransform: 'uppercase', fontWeight: 700 }}>Net Sales</span>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--gold-light)', fontFamily: 'var(--font-mono)' }}>
                  {formatIDR(record.net_sales)}
                </div>
              </div>
            </div>

            {/* Section B: Rincian Kanal Pembayaran */}
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Rincian Penerimaan (Settlement)
              </h4>
              <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.86rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Uang Tunai (Cash):</span>
                  <strong style={{ color: 'var(--success)', fontFamily: 'var(--font-mono)' }}>{formatIDR(record.payment_cash)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>QRIS (BCA, E-Wallet):</span>
                  <strong style={{ color: 'var(--gold-light)', fontFamily: 'var(--font-mono)' }}>{formatIDR(record.payment_qris)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>EDC (Debit/Kredit):</span>
                  <strong style={{ color: 'var(--info)', fontFamily: 'var(--font-mono)' }}>{formatIDR(record.payment_edc)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Online Delivery:</span>
                  <strong style={{ color: 'var(--warning)', fontFamily: 'var(--font-mono)' }}>{formatIDR(record.payment_delivery)}</strong>
                </div>
                {Number(record.payment_transfer) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Transfer Bank:</span>
                    <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{formatIDR(record.payment_transfer)}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* Section C: Rekonsiliasi Kas Laci & Petty Cash */}
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Audit Kas Fisik Laci
              </h4>
              <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.86rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Modal Kas Awal:</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{formatIDR(record.opening_cash)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Kas Masuk Tunai:</span>
                  <span style={{ color: 'var(--success)', fontFamily: 'var(--font-mono)' }}>+{formatIDR(record.payment_cash)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Kas Keluar Darurat (Petty Cash):</span>
                  <span style={{ color: 'var(--danger)', fontFamily: 'var(--font-mono)' }}>-{formatIDR(record.petty_cash_out)}</span>
                </div>
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Uang Seharusnya di Laci:</span>
                  <strong style={{ fontFamily: 'var(--font-mono)' }}>{formatIDR(record.expected_cash)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Uang Fisik Dihitung Kasir:</span>
                  <strong style={{ color: 'var(--gold-light)', fontFamily: 'var(--font-mono)' }}>{formatIDR(record.actual_cash)}</strong>
                </div>
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600 }}>Selisih Kas:</span>
                  <div>
                    {diff === 0 ? (
                      <span className="badge badge-success">✓ Klop (Pas Rp 0)</span>
                    ) : diff > 0 ? (
                      <span className="badge badge-warning">+ Lebih {formatIDR(diff)}</span>
                    ) : (
                      <span className="badge badge-danger">- Kurang {formatIDR(Math.abs(diff))}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Section D: Rincian Kas Kecil */}
            {items.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Rincian Pengeluaran Kas Kecil ({items.length} Nota)
                </h4>
                <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', padding: '10px 14px' }}>
                  {items.map((it, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: idx < items.length - 1 ? '1px solid var(--border-subtle)' : 'none', fontSize: '0.84rem' }}>
                      <div>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{it.item_name}</span>
                        <span style={{ marginLeft: '8px', fontSize: '0.74rem', color: 'var(--text-muted)' }}>({it.category})</span>
                      </div>
                      <strong style={{ color: 'var(--danger)', fontFamily: 'var(--font-mono)' }}>-{formatIDR(it.amount)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section E: Catatan */}
            {record.notes && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Catatan Kasir:
                </h4>
                <p style={{ background: 'var(--bg-input)', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic', margin: 0 }}>
                  "{record.notes}"
                </p>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW B: OFFICIAL PRINTABLE SLIP / SETTLEMENT VOUCHER                     */}
        {/* ========================================================================= */}
        {activeViewMode === 'slip' && (
          <div className="animate-fade-in" style={{ fontFamily: 'var(--font-sans)', color: '#111111' }}>
            
            {/* Header */}
            <div style={{ textAlign: 'center', borderBottom: '3px double #222', paddingBottom: '14px', marginBottom: '16px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                <Coffee size={22} color="#8c5314" />
                <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900, color: '#1a1510', fontFamily: 'var(--font-display)' }}>
                  KEDAI KOPI BARA
                </h2>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.74rem', color: '#666', fontWeight: 600, letterSpacing: '0.04em' }}>
                REKONSILIASI PENJUALAN & AUDIT KASIR SHIFT
              </p>
            </div>

            {/* Shift & Cashier Meta */}
            <div style={{ display: 'grid', gridTemplateColumns: paperFormat === 'thermal' ? '1fr' : '1fr 1fr', gap: '6px', background: '#f8f7f5', border: '1px solid #e5dfd7', padding: '10px 14px', borderRadius: '6px', fontSize: '0.82rem', marginBottom: '16px' }}>
              <div>Tanggal: <strong>{formatDateID(record.entry_date)}</strong></div>
              <div>Shift Kerja: <strong>{record.shift}</strong></div>
              <div>Kasir PIC: <strong>{record.cashier_name}</strong></div>
              <div>Ref ID: <span style={{ fontFamily: 'var(--font-mono)' }}>{record.id.slice(0, 10).toUpperCase()}</span></div>
              <div>Waktu Cetak: <span>{formatDateID(new Date().toISOString().split('T')[0])} {printTimeStr} WIB</span></div>
              <div>Status Audit: <strong>{diff === 0 ? '✓ PAS / SEIMBANG' : diff > 0 ? `+ LEBIH ${formatIDR(diff)}` : `- KURANG ${formatIDR(Math.abs(diff))}`}</strong></div>
            </div>

            {/* 1. Ringkasan Penjualan */}
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontWeight: 800, fontSize: '0.84rem', borderBottom: '2px solid #333', paddingBottom: '3px', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
                <span>1. OMSET PENJUALAN (SALES)</span>
                <span style={{ fontSize: '0.74rem', color: '#666' }}>NOMINAL</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.84rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Gross Sales:</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{formatIDR(record.gross_sales)}</span>
                </div>
                {Number(record.discounts) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#c53030' }}>
                    <span>Diskon / Potongan:</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>-{formatIDR(record.discounts)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #ccc', paddingTop: '4px', fontWeight: 700, fontSize: '0.9rem' }}>
                  <span>Net Sales (Omset Bersih):</span>
                  <strong style={{ fontFamily: 'var(--font-mono)', color: '#8c5314' }}>{formatIDR(record.net_sales)}</strong>
                </div>
              </div>
            </div>

            {/* 2. Kanal Pembayaran (Settlement) */}
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontWeight: 800, fontSize: '0.84rem', borderBottom: '2px solid #333', paddingBottom: '3px', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
                <span>2. SETTLEMENT PEMBAYARAN</span>
                <span style={{ fontSize: '0.74rem', color: '#666' }}>STATUS</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Uang Tunai (Cash):</span>
                  <strong style={{ fontFamily: 'var(--font-mono)' }}>{formatIDR(record.payment_cash)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>QRIS (BCA / E-Wallet):</span>
                  <strong style={{ fontFamily: 'var(--font-mono)' }}>{formatIDR(record.payment_qris)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Mesin EDC (Debit/Kredit):</span>
                  <strong style={{ fontFamily: 'var(--font-mono)' }}>{formatIDR(record.payment_edc)}</strong>
                </div>
                {Number(record.payment_delivery) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Online Delivery (Grab/GoFood):</span>
                    <strong style={{ fontFamily: 'var(--font-mono)' }}>{formatIDR(record.payment_delivery)}</strong>
                  </div>
                )}
                {Number(record.payment_transfer) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Transfer Bank Langsung:</span>
                    <strong style={{ fontFamily: 'var(--font-mono)' }}>{formatIDR(record.payment_transfer)}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* 3. Rekonsiliasi Kas Laci Fisik */}
            <div style={{ marginBottom: '16px', background: '#faf8f5', border: '1px solid #dcd4c8', padding: '10px 14px', borderRadius: '6px' }}>
              <div style={{ fontWeight: 800, fontSize: '0.84rem', borderBottom: '1px solid #dcd4c8', paddingBottom: '4px', marginBottom: '6px', color: '#333' }}>
                3. AUDIT KAS FISIK LACI KASIR
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Modal Awal Laci:</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{formatIDR(record.opening_cash)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>(+) Kas Masuk Tunai:</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>+{formatIDR(record.payment_cash)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>(-) Kas Kecil Darurat (Petty Cash):</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: '#c53030' }}>-{formatIDR(record.petty_cash_out)}</span>
                </div>
                <div style={{ borderTop: '1px dashed #ccc', paddingTop: '4px', display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                  <span>Saldo Kas Seharusnya:</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{formatIDR(record.expected_cash)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                  <span>Uang Fisik Dihitung Kasir:</span>
                  <strong style={{ fontFamily: 'var(--font-mono)' }}>{formatIDR(record.actual_cash)}</strong>
                </div>
                <div style={{ borderTop: '1px solid #999', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 800 }}>SELISIH KAS:</span>
                  <strong style={{ 
                    fontFamily: 'var(--font-mono)', 
                    fontSize: '0.92rem', 
                    color: diff === 0 ? '#0d7a5f' : diff > 0 ? '#b26a00' : '#c53030' 
                  }}>
                    {diff === 0 ? 'Rp 0 (PAS / KLOP)' : diff > 0 ? `+${formatIDR(diff)} (LEBIH)` : `-${formatIDR(Math.abs(diff))} (KURANG)`}
                  </strong>
                </div>
              </div>
            </div>

            {/* 4. Rincian Kas Kecil (Jika Ada) */}
            {items.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontWeight: 800, fontSize: '0.82rem', borderBottom: '1px solid #333', paddingBottom: '3px', marginBottom: '6px' }}>
                  4. DAFTAR NOTA KAS KECIL ({items.length} ITEM)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.8rem' }}>
                  {items.map((it, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted #eee', paddingBottom: '2px' }}>
                      <span>{idx + 1}. {it.item_name} <span style={{ color: '#666', fontSize: '0.72rem' }}>({it.category})</span></span>
                      <strong style={{ fontFamily: 'var(--font-mono)', color: '#c53030' }}>-{formatIDR(it.amount)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 5. Catatan Kasir */}
            {record.notes && (
              <div style={{ marginBottom: '16px', fontSize: '0.8rem', background: '#f5f5f5', padding: '8px 12px', borderRadius: '4px' }}>
                <span style={{ fontWeight: 700, display: 'block', color: '#555' }}>Catatan Kasir:</span>
                <span style={{ fontStyle: 'italic', color: '#222' }}>"{record.notes}"</span>
              </div>
            )}

            <div style={{ textAlign: 'center', fontSize: '0.74rem', color: '#666', marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '10px' }}>
              * Laporan shift ini merupakan rekapitulasi audit resmi kasir Bara Coffee Coffee & Eatery yang sah secara digital tanpa tanda tangan basah.
            </div>

          </div>
        )}

        {/* Footer Actions (Hidden when printed) */}
        <div className="no-print" style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          paddingTop: '16px', 
          marginTop: '20px', 
          borderTop: activeViewMode === 'slip' ? '1px solid #e0dbd1' : '1px solid var(--border-subtle)' 
        }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button 
              onClick={() => setActiveViewMode(prev => prev === 'app' ? 'slip' : 'app')} 
              className="btn btn-secondary" 
              style={{ fontSize: '0.84rem' }}
            >
              {activeViewMode === 'app' ? '🧾 Lihat Format Struk Cetak' : '📊 Kembali ke Tampilan Aplikasi'}
            </button>

            {onDelete && (
              <button
                onClick={() => {
                  if (confirm(`Hapus catatan omset tanggal ${record.entry_date} (${record.shift}) ini untuk koreksi input?`)) {
                    onDelete(record.id);
                  }
                }}
                className="btn btn-secondary"
                style={{ fontSize: '0.84rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '6px' }}
                title="Hapus data ini jika ada kesalahan input"
              >
                <Trash2 size={15} />
                <span>Hapus & Koreksi</span>
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={handlePrint} 
              className="btn btn-secondary" 
              style={{ 
                fontSize: '0.84rem', 
                color: activeViewMode === 'slip' ? '#111' : 'var(--text-primary)', 
                background: activeViewMode === 'slip' ? '#FAF7F2' : 'var(--bg-card)',
                border: activeViewMode === 'slip' ? '1px solid #E8DFD8' : '1px solid var(--border-subtle)'
              }}
            >
              <Printer size={15} color="var(--burgundy-primary)" />
              <span>Cetak Struk / Laporan</span>
            </button>
            <button onClick={onClose} className="btn btn-primary" style={{ fontSize: '0.84rem', padding: '8px 18px' }}>
              Tutup
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}
