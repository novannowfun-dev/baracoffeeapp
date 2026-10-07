import React, { useState, useEffect, useRef } from 'react';
import { 
  Coffee, 
  PlusCircle, 
  LayoutDashboard, 
  History, 
  Settings, 
  Database, 
  FileSpreadsheet, 
  CheckCircle2, 
  Lock, 
  ShieldCheck, 
  User, 
  ChevronDown, 
  LogOut,
  Clock,
  DollarSign,
  Receipt,
  TrendingUp,
  Menu,
  X,
  KeyRound,
  Edit
} from 'lucide-react';
import ProfileModal from './ProfileModal';
import { getSupabaseConfig } from '../lib/supabase';
import { getSheetsWebhookUrl } from '../lib/sheetsSync';
import { ROLES, setCurrentUser, logoutUser } from '../lib/auth';
import { getActiveOutlet, setActiveOutlet, subscribeOutletChange } from '../lib/outletContext';
import { Boxes, CreditCard } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, currentUser, onRequirePin, onUserChange, onLogout }) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [currentOutlet, setCurrentOutlet] = useState(getActiveOutlet());

  useEffect(() => {
    return subscribeOutletChange((o) => setCurrentOutlet(o));
  }, []);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const dropdownRef = useRef(null);

  const supabaseConfig = getSupabaseConfig();
  const sheetsUrl = getSheetsWebhookUrl();

  const isSupabaseConfigured = Boolean(supabaseConfig.url && supabaseConfig.key);
  const isSheetsConfigured = Boolean(sheetsUrl);

  const isOwner = currentUser?.role === ROLES.OWNER || currentUser?.role === ROLES.MANAGER;
  const userInitial = (currentUser?.name || 'U').trim().charAt(0).toUpperCase();

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    if (!isDropdownOpen) return;

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDropdownOpen]);

  const handleTabClick = (tab) => {
    // Tab yang terproteksi khusus Owner (Pengaturan & Laba Rugi P&L):
    if ((tab === 'settings' || tab === 'pnl') && !isOwner) {
      onRequirePin(tab);
      return;
    }

    setActiveTab(tab);
  };

  const handleLogoutClick = () => {
    logoutUser();
    setIsDropdownOpen(false);
    onLogout();
  };

  return (
    <>
      <header className="navbar-container">
        <div className="navbar-inner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          
          {/* Bagian Kiri: Tombol Menu Hamburger + Logo Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {/* Tombol Hamburger Drawer (Posisi Kiri Standar UI Modern) */}
            <button
              onClick={() => setIsDrawerOpen(true)}
              aria-label="Buka Menu Navigasi"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-hover)',
                background: 'var(--bg-input)',
                color: 'var(--burgundy-primary)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: 'var(--shadow-sm)',
                padding: 0
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--burgundy-primary)';
                e.currentTarget.style.background = 'var(--bg-card)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-hover)';
                e.currentTarget.style.background = 'var(--bg-input)';
              }}
              title="Buka Menu Navigasi"
            >
              <Menu size={20} />
            </button>

            {/* Brand Logo & Name (Klik -> Dashboard) */}
            <div className="navbar-brand" onClick={() => handleTabClick('dashboard')}>
              <div className="brand-logo-wrapper">
                <img 
                  src="/logo.svg" 
                  alt="Bara Coffee Logo" 
                  className="brand-logo-img"
                />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h1 style={{ fontSize: '1.12rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
                    BARA COFFEE
                  </h1>
                  <span className="brand-badge">
                    Kedai & Gerobak
                  </span>
                </div>
                <p className="brand-subtitle">
                  Sales • Absensi • Payroll
                </p>
              </div>
            </div>
          </div>

          {/* Bagian Kanan: Indikator Halaman Aktif + Avatar Profil */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Badge Penunjuk Halaman yang Sedang Dibuka */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '20px',
              background: 'var(--burgundy-subtle)',
              border: '1px solid rgba(79, 70, 229, 0.2)',
              fontSize: '0.82rem',
              fontWeight: 700,
              color: 'var(--burgundy-primary)'
            }}>
              <span style={{ fontSize: '0.65rem' }}>●</span>
              <span>
                {activeTab === 'dashboard' && 'Dashboard'}
                {activeTab === 'input' && 'Input Omset'}
                {activeTab === 'attendance' && 'Absensi Shift'}
                {activeTab === 'kasirpro' && 'KasirPro POS'}
                {activeTab === 'history' && 'Riwayat & Kas'}
                {activeTab === 'payroll' && (isOwner ? 'Payroll' : 'Slip Gaji')}
                {activeTab === 'pnl' && 'Laba Rugi (P&L)'}
                {activeTab === 'stock' && 'Stok Bahan'}
                {activeTab === 'kasbon' && 'Kasbon Kru'}
                {activeTab === 'settings' && 'Pengaturan'}
              </span>
            </div>
          
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              aria-label="Menu Profil Akun"
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                border: `2px solid ${isDropdownOpen ? 'var(--burgundy-primary)' : 'var(--border-hover)'}`,
                background: isOwner 
                  ? 'linear-gradient(135deg, #4F46E5 0%, #3730A3 100%)' 
                  : 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.98rem',
                cursor: 'pointer',
                boxShadow: isDropdownOpen ? '0 0 0 3px rgba(79, 70, 229, 0.25)' : '0 2px 8px rgba(79, 70, 229, 0.2)',
                transition: 'all 0.2s ease',
                padding: 0
              }}
              title={`Akun: ${currentUser?.name || 'Kru'} (${isOwner ? 'Owner' : currentUser?.position || 'Kru'})`}
            >
              {/* Inisial Nama Pengguna */}
              <span>{userInitial}</span>

              {/* Status Online Indicator Dot */}
              <span style={{
                position: 'absolute',
                bottom: '-1px',
                right: '-1px',
                width: '11px',
                height: '11px',
                borderRadius: '50%',
                background: '#10B981',
                border: '2px solid var(--bg-card)',
                boxShadow: '0 0 0 1px rgba(0,0,0,0.05)'
              }} />
            </button>

            {/* Popover Minimalis Profil & Logout */}
            {isDropdownOpen && (
              <div 
                className="glass-card animate-fade-in"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 10px)',
                  width: '260px',
                  padding: '18px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-hover)',
                  borderRadius: '16px',
                  zIndex: 200,
                  boxShadow: '0 16px 45px rgba(79, 70, 229, 0.16)'
                }}
              >
                {/* Header Info Akun */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                  <div style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '50%',
                    background: isOwner 
                      ? 'linear-gradient(135deg, #4F46E5 0%, #3730A3 100%)' 
                      : 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900,
                    fontSize: '1.2rem',
                    flexShrink: 0,
                    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)'
                  }}>
                    {userInitial}
                  </div>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{
                      fontWeight: 800,
                      fontSize: '0.98rem',
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {currentUser?.name || 'Kru Cafe'}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: isOwner ? 'var(--burgundy-primary)' : 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>
                      {isOwner ? 'Owner / Manajemen' : (currentUser?.position || 'Kru Shift')}
                    </div>
                  </div>
                </div>

                {/* Sesi Status Banner */}
                <div style={{
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  fontSize: '0.72rem',
                  color: '#059669',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginBottom: '14px'
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
                  <span>Sesi Login Aktif • Bara Coffee</span>
                </div>

                {/* Divider Line */}
                <div style={{ borderTop: '1px solid var(--border-subtle)', marginBottom: '10px' }} />

                {/* Tombol Edit Profil & Ganti PIN */}
                <button
                  type="button"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    setIsProfileModalOpen(true);
                  }}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '10px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    marginBottom: '8px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--burgundy-primary)';
                    e.currentTarget.style.color = 'var(--burgundy-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                >
                  <KeyRound size={15} color="var(--burgundy-primary)" />
                  <span>Edit Profil & Ganti PIN</span>
                </button>

                {/* Tombol Logout Bersih */}
                <button
                  onClick={handleLogoutClick}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '10px',
                    background: 'rgba(225, 29, 72, 0.08)',
                    border: '1px solid rgba(225, 29, 72, 0.2)',
                    color: 'var(--danger)',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(225, 29, 72, 0.15)';
                    e.currentTarget.style.borderColor = 'rgba(225, 29, 72, 0.35)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(225, 29, 72, 0.08)';
                    e.currentTarget.style.borderColor = 'rgba(225, 29, 72, 0.2)';
                  }}
                >
                  <LogOut size={15} />
                  <span>Keluar (Logout)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>

    {/* SLIDE-OUT APP DRAWER / SIDEBAR (MINIMALIST MENU) */}
    {isDrawerOpen && (
      <div 
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1000,
          display: 'flex'
        }}
      >
        {/* Backdrop gelap transparan */}
        <div 
          onClick={() => setIsDrawerOpen(false)}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)'
          }}
        />

        {/* Panel Sidebar Drawer Slide-in */}
        <aside 
          className="animate-fade-in"
          style={{
            position: 'relative',
            width: '320px',
            maxWidth: '85vw',
            height: '100%',
            background: 'var(--bg-card)',
            borderRight: '1px solid var(--border-hover)',
            boxShadow: '10px 0 40px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1001,
            overflowY: 'auto'
          }}
        >
          {/* Header Drawer */}
          <div style={{
            padding: '20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-input)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img 
                src="/logo.svg" 
                alt="Logo" 
                style={{ width: '32px', height: '32px', borderRadius: '8px' }}
              />
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  BARA COFFEE
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Navigasi Utama Kedai & Gerobak
                </span>
              </div>
            </div>

            <button 
              onClick={() => setIsDrawerOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* List Menu Items */}
          <div style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
            
            <div style={{ padding: '4px 12px 6px', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Operasional Harian
            </div>

            <button
              onClick={() => { handleTabClick('input'); setIsDrawerOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: activeTab === 'input' ? 'var(--gold-glow)' : 'transparent',
                color: activeTab === 'input' ? 'var(--gold-light)' : 'var(--text-primary)',
                fontWeight: activeTab === 'input' ? 700 : 500,
                fontSize: '0.92rem',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease'
              }}
            >
              <PlusCircle size={18} color={activeTab === 'input' ? 'var(--gold-light)' : 'var(--text-secondary)'} />
              <span>Input Omset Shift</span>
            </button>

            <button
              onClick={() => { handleTabClick('attendance'); setIsDrawerOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: activeTab === 'attendance' ? 'var(--gold-glow)' : 'transparent',
                color: activeTab === 'attendance' ? 'var(--gold-light)' : 'var(--text-primary)',
                fontWeight: activeTab === 'attendance' ? 700 : 500,
                fontSize: '0.92rem',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease'
              }}
            >
              <Clock size={18} color={activeTab === 'attendance' ? 'var(--gold-light)' : 'var(--text-secondary)'} />
              <span>Absensi Shift Kru</span>
            </button>

            <div style={{ margin: '10px 0 4px', padding: '4px 12px 6px', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
              POS & Laporan Penjualan
            </div>

            <button
              onClick={() => { handleTabClick('dashboard'); setIsDrawerOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: activeTab === 'dashboard' ? 'var(--gold-glow)' : 'transparent',
                color: activeTab === 'dashboard' ? 'var(--gold-light)' : 'var(--text-primary)',
                fontWeight: activeTab === 'dashboard' ? 700 : 500,
                fontSize: '0.92rem',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease'
              }}
            >
              <LayoutDashboard size={18} color={activeTab === 'dashboard' ? 'var(--gold-light)' : 'var(--text-secondary)'} />
              <span>Dashboard Analitik</span>
            </button>

            <button
              onClick={() => { handleTabClick('kasirpro'); setIsDrawerOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: activeTab === 'kasirpro' ? 'rgba(79, 70, 229, 0.12)' : 'transparent',
                color: activeTab === 'kasirpro' ? '#4F46E5' : 'var(--text-primary)',
                fontWeight: activeTab === 'kasirpro' ? 700 : 500,
                fontSize: '0.92rem',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Receipt size={18} color="#4F46E5" />
                <span>KasirPro POS Toko</span>
              </div>
              <span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '10px', background: 'rgba(79, 70, 229, 0.15)', color: '#4F46E5', fontWeight: 700 }}>
                API
              </span>
            </button>

            <div style={{ margin: '10px 0 4px', padding: '4px 12px 6px', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
              Operasional Bara Coffee
            </div>

            <button
              onClick={() => { handleTabClick('stock'); setIsDrawerOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: activeTab === 'stock' ? 'var(--gold-glow)' : 'transparent',
                color: activeTab === 'stock' ? 'var(--gold-light)' : 'var(--text-primary)',
                fontWeight: activeTab === 'stock' ? 700 : 500,
                fontSize: '0.92rem',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease'
              }}
            >
              <Boxes size={18} color={activeTab === 'stock' ? 'var(--gold-light)' : 'var(--text-secondary)'} />
              <span>Stok & Mutasi Bahan</span>
            </button>

            <button
              onClick={() => { handleTabClick('kasbon'); setIsDrawerOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: activeTab === 'kasbon' ? 'var(--gold-glow)' : 'transparent',
                color: activeTab === 'kasbon' ? 'var(--gold-light)' : 'var(--text-primary)',
                fontWeight: activeTab === 'kasbon' ? 700 : 500,
                fontSize: '0.92rem',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease'
              }}
            >
              <CreditCard size={18} color={activeTab === 'kasbon' ? 'var(--gold-light)' : 'var(--text-secondary)'} />
              <span>Kasbon & Cicilan Kru</span>
            </button>

            <button
              onClick={() => { handleTabClick('history'); setIsDrawerOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: activeTab === 'history' ? 'var(--gold-glow)' : 'transparent',
                color: activeTab === 'history' ? 'var(--gold-light)' : 'var(--text-primary)',
                fontWeight: activeTab === 'history' ? 700 : 500,
                fontSize: '0.92rem',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease'
              }}
            >
              <History size={18} color={activeTab === 'history' ? 'var(--gold-light)' : 'var(--text-secondary)'} />
              <span>Riwayat Transaksi & Kas</span>
            </button>

            <div style={{ margin: '10px 0 4px', padding: '4px 12px 6px', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
              Keuangan & Sistem
            </div>

            <button
              onClick={() => { handleTabClick('payroll'); setIsDrawerOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: activeTab === 'payroll' ? 'var(--gold-glow)' : 'transparent',
                color: activeTab === 'payroll' ? 'var(--gold-light)' : 'var(--text-primary)',
                fontWeight: activeTab === 'payroll' ? 700 : 500,
                fontSize: '0.92rem',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease'
              }}
            >
              <DollarSign size={18} color={activeTab === 'payroll' ? 'var(--gold-light)' : 'var(--text-secondary)'} />
              <span>{isOwner ? 'Gaji & Payroll Kru' : 'Slip Gaji Saya'}</span>
            </button>

            <button
              onClick={() => { handleTabClick('pnl'); setIsDrawerOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: activeTab === 'pnl' ? 'var(--gold-glow)' : 'transparent',
                color: activeTab === 'pnl' ? 'var(--gold-light)' : 'var(--text-primary)',
                fontWeight: activeTab === 'pnl' ? 700 : 500,
                fontSize: '0.92rem',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <TrendingUp size={18} color={activeTab === 'pnl' ? 'var(--gold-light)' : 'var(--text-secondary)'} />
                <span>Laba Rugi (P&L)</span>
              </div>
              {!isOwner && <Lock size={13} style={{ opacity: 0.6 }} />}
            </button>

            <button
              onClick={() => { handleTabClick('settings'); setIsDrawerOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: activeTab === 'settings' ? 'var(--gold-glow)' : 'transparent',
                color: activeTab === 'settings' ? 'var(--gold-light)' : 'var(--text-primary)',
                fontWeight: activeTab === 'settings' ? 700 : 500,
                fontSize: '0.92rem',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Settings size={18} color={activeTab === 'settings' ? 'var(--gold-light)' : 'var(--text-secondary)'} />
                <span>Pengaturan Sistem</span>
              </div>
              {!isOwner && <Lock size={13} style={{ opacity: 0.6 }} />}
            </button>

          </div>

          {/* Footer Drawer (Info Akun Ringkas) */}
          <div style={{
            padding: '16px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-input)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                background: isOwner ? 'var(--burgundy-primary)' : 'var(--info)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.85rem'
              }}>
                {userInitial}
              </div>
              <div>
                <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {currentUser?.name || 'Kru'}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {isOwner ? 'Owner / Manager' : (currentUser?.position || 'Kru')}
                </div>
              </div>
            </div>

            <button
              onClick={handleLogoutClick}
              title="Keluar"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--danger)',
                cursor: 'pointer',
                padding: '6px'
              }}
            >
              <LogOut size={16} />
            </button>
          </div>

        </aside>
      </div>
    )}

    {/* MOBILE BOTTOM NAVIGATION DOCK (VISIBLE ON MOBILE ONLY) */}
    <nav className="navbar-mobile-dock no-print">
      <button
        onClick={() => handleTabClick('input')}
        className={`mobile-dock-btn ${activeTab === 'input' ? 'active' : ''}`}
      >
        <PlusCircle size={20} />
        <span>Input</span>
      </button>

      <button
        onClick={() => handleTabClick('attendance')}
        className={`mobile-dock-btn ${activeTab === 'attendance' ? 'active' : ''}`}
      >
        <Clock size={20} />
        <span>Absen</span>
      </button>

      <button
        onClick={() => handleTabClick('dashboard')}
        className={`mobile-dock-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
      >
        <LayoutDashboard size={20} />
        <span>Dashboard</span>
      </button>

      <button
        onClick={() => handleTabClick('kasirpro')}
        className={`mobile-dock-btn ${activeTab === 'kasirpro' ? 'active' : ''}`}
      >
        <Receipt size={20} />
        <span>KasirPro</span>
      </button>

      <button
        onClick={() => handleTabClick('history')}
        className={`mobile-dock-btn ${activeTab === 'history' ? 'active' : ''}`}
      >
        <History size={20} />
        <span>Riwayat</span>
      </button>

      <button
        onClick={() => handleTabClick('payroll')}
        className={`mobile-dock-btn ${activeTab === 'payroll' ? 'active' : ''}`}
      >
        <DollarSign size={20} />
        <span>{isOwner ? 'Payroll' : 'Gaji'}</span>
      </button>

      <button
        onClick={() => handleTabClick('settings')}
        className={`mobile-dock-btn ${activeTab === 'settings' ? 'active' : ''}`}
      >
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Settings size={20} />
          {!isOwner && <Lock size={9} style={{ position: 'absolute', top: -2, right: -6, color: 'var(--gold-light)' }} />}
        </div>
        <span>Setelan</span>
      </button>
    </nav>

    {/* Modal Edit Profil & Ganti PIN Pengguna Aktif */}
    {isProfileModalOpen && (
      <ProfileModal 
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentUser={currentUser}
        onProfileUpdated={(updated) => {
          if (onUserChange) {
            onUserChange(updated);
          }
        }}
      />
    )}
  </>
  );
}
