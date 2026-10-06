import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import AuthScreen from './components/AuthScreen';
import DailySalesForm from './components/DailySalesForm';
import AttendanceView from './components/AttendanceView';
import DashboardView from './components/DashboardView';
import KasirProView from './components/KasirProView';
import HistoryView from './components/HistoryView';
import PayrollView from './components/PayrollView';
import ProfitLossView from './components/ProfitLossView';
import SettingsView from './components/SettingsView';
import SalesDetailModal from './components/SalesDetailModal';
import PinModal from './components/PinModal';
import StockView from './components/StockView';
import KasbonView from './components/KasbonView';
import WhatsAppReportModal from './components/WhatsAppReportModal';
import { getActiveOutlet, setActiveOutlet, subscribeOutletChange } from './lib/outletContext';
import { getDailySalesRecords, deleteDailySalesRecord } from './lib/storage';
import { 
  getCurrentUser, 
  setCurrentUser, 
  logoutUser, 
  isSessionExpired, 
  recordUserActivity, 
  getSessionTimeoutMinutes, 
  ROLES 
} from './lib/auth';
import { syncKasirProApiKeyFromCloud } from './lib/kasirProService';
import { 



  getRouteFromHash, 
  navigateRoute, 
  isOwnerTab, 
  getAccessibleTab 
} from './lib/router';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px 20px', maxWidth: '600px', margin: '50px auto', background: '#fff', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <h3 style={{ color: '#ef4444', marginBottom: '10px' }}>Terjadi Kendala Tampilan</h3>
          <p style={{ color: '#64748B', fontSize: '0.9rem', marginBottom: '20px' }}>{this.state.error?.message || 'Gagal memuat komponen'}</p>
          <button onClick={() => { localStorage.removeItem('baracoffee_active_tab'); window.location.hash = '#/dashboard'; window.location.reload(); }} className='btn btn-primary'>
            Reset ke Dashboard
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}


export default function App() {
  // Clean legacy tab fallback
  if (typeof window !== 'undefined') {
    if (window.location.hash.includes('assets') || localStorage.getItem('baracoffee_active_tab') === 'assets') {
      localStorage.setItem('baracoffee_active_tab', 'dashboard');
      window.location.hash = '#/dashboard';
    }
  }
  const [currentUser, setCurrentUserState] = useState(() => getCurrentUser());
  
  // Inisialisasi rute aktif langsung dari URL hash (misal: #/attendance, #/payroll, dsb)
  const [activeTab, setActiveTabState] = useState(() => {
    const route = getRouteFromHash();
    return getAccessibleTab(route.tab, getCurrentUser());
  });
  
  const [historySubTab, setHistorySubTab] = useState(() => {
    const route = getRouteFromHash();
    return route.subTab || 'sales';
  });

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecordForModal, setSelectedRecordForModal] = useState(null);
  const [activeOutlet, setActiveOutletState] = useState(() => getActiveOutlet());
  const [waModalRecord, setWaModalRecord] = useState(null);

  useEffect(() => {
    return subscribeOutletChange((outlet) => {
      setActiveOutletState(outlet);
    });
  }, []);
  const [timeoutNotice, setTimeoutNotice] = useState(null);

  // Security PIN State
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinTargetTab, setPinTargetTab] = useState('dashboard');

  // Handler pergantian tab dengan sinkronisasi URL hash
  const handleTabChange = useCallback((newTab, newSubTab = null) => {
    const isOwner = currentUser?.role === ROLES.OWNER || currentUser?.role === ROLES.MANAGER;
    if (isOwnerTab(newTab) && !isOwner) {
      setPinTargetTab(newTab);
      setIsPinModalOpen(true);
      return;
    }

    setActiveTabState(newTab);
    if (newSubTab) setHistorySubTab(newSubTab);
    navigateRoute(newTab, newSubTab);
  }, [currentUser]);

  // Listener event HashChange (saat tombol Back/Forward browser ditekan atau URL diubah)
  useEffect(() => {
    const handleHashChange = () => {
      const route = getRouteFromHash();
      const isOwner = currentUser?.role === ROLES.OWNER || currentUser?.role === ROLES.MANAGER;

      if (isOwnerTab(route.tab) && !isOwner) {
        setPinTargetTab(route.tab);
        setIsPinModalOpen(true);
        return;
      }

      setActiveTabState(route.tab);
      if (route.subTab) {
        setHistorySubTab(route.subTab);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [currentUser]);

  // Sinkronkan URL hash saat aplikasi pertama kali dimuat
  useEffect(() => {
    if (currentUser) {
      const route = getRouteFromHash();
      const valid = getAccessibleTab(route.tab, currentUser);
      navigateRoute(valid, route.subTab);
    }
  }, [currentUser]);

  // Auto-Logout Watcher: Pantau inaktivitas pengguna
  useEffect(() => {
    if (!currentUser) return;

    recordUserActivity();
    let lastRecordTime = Date.now();

    const handleUserInteraction = () => {
      const now = Date.now();
      // Throttle pembaruan waktu aktivitas (maksimal tiap 5 detik)
      if (now - lastRecordTime > 5000) {
        lastRecordTime = now;
        recordUserActivity();
      }
    };

    const verifySessionActivity = () => {
      if (isSessionExpired(currentUser)) {
        const isOwner = currentUser.role === ROLES.OWNER || currentUser.role === ROLES.MANAGER;
        const roleLabel = isOwner ? 'Owner / Manajer' : 'Akun';
        const minutes = getSessionTimeoutMinutes();

        logoutUser();
        setCurrentUserState(null);
        setTimeoutNotice(`Sesi login ${roleLabel} telah otomatis berakhir karena tidak ada aktivitas selama ${minutes} menit demi keamanan cafe.`);
      }
    };

    const interactionEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    interactionEvents.forEach(evt => window.addEventListener(evt, handleUserInteraction, { passive: true }));

    // Cek timeout berkala setiap 5 detik
    const timer = setInterval(verifySessionActivity, 5000);

    // Cek seketika saat tab kembali dibuka / difokuskan
    window.addEventListener('focus', verifySessionActivity);
    document.addEventListener('visibilitychange', verifySessionActivity);

    return () => {
      interactionEvents.forEach(evt => window.removeEventListener(evt, handleUserInteraction));
      clearInterval(timer);
      window.removeEventListener('focus', verifySessionActivity);
      document.removeEventListener('visibilitychange', verifySessionActivity);
    };
  }, [currentUser]);

  // Load records from Supabase / localStorage
  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getDailySalesRecords();
      setRecords(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Sinkronisasi konfigurasi cloud (seperti API Key KasirPro) agar langsung aktif di HP/device baru
    syncKasirProApiKeyFromCloud();

    if (currentUser) {
      loadRecords();
    }
  }, [currentUser, loadRecords]);

  // Handler simpan sukses
  const handleSaveSuccess = (newRecord) => {
    setRecords(prev => [newRecord, ...prev.filter(r => r.id !== newRecord.id)]);
  };

  // Handler hapus
  const handleDeleteRecord = async (id) => {
    await deleteDailySalesRecord(id);
    setRecords(prev => prev.filter(r => r.id !== id));
  };

  // Handler saat Kru klik tab terkunci
  const handleRequirePin = (targetTab) => {
    setPinTargetTab(targetTab);
    setIsPinModalOpen(true);
  };

  // Handler saat PIN berhasil diverifikasi
  const handlePinSuccess = () => {
    const ownerUser = {
      id: 'usr-owner',
      name: 'Owner Bara Coffee',
      role: ROLES.OWNER,
      position: 'Owner'
    };
    setCurrentUser(ownerUser);
    setCurrentUserState(ownerUser);
    setIsPinModalOpen(false);
    handleTabChange(pinTargetTab);
  };

  // 1. JIKA BELUM LOGIN: TAMPILKAN LOGIN & REGISTRASI KRU MANDIRI
  if (!currentUser) {
    return (
      <AuthScreen 
        timeoutNotification={timeoutNotice}
        onClearTimeoutNotification={() => setTimeoutNotice(null)}
        onLoginSuccess={(user) => {
          setTimeoutNotice(null);
          setCurrentUserState(user);
          const currentHash = getRouteFromHash();
          const targetTab = getAccessibleTab(currentHash.tab, user);
          handleTabChange(targetTab, currentHash.subTab);
        }} 
      />
    );
  }

  // 2. JIKA SUDAH LOGIN: TAMPILKAN PORTAL UTAMA CAFE
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Top Navbar dengan Role Switcher & Logout */}
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={handleTabChange}
        currentUser={currentUser}
        onRequirePin={handleRequirePin}
        onUserChange={(updatedUser) => {
          setCurrentUserState(updatedUser);
        }}
        onLogout={() => {
          logoutUser();
          setCurrentUserState(null);
          setTimeoutNotice(null);
        }}
      />

      {/* Main Content Area */}
              {/* Banner Pengingat Absensi Masuk untuk Kru yang Login */}
        {currentUser && currentUser.role !== ROLES.OWNER && !records.some(r => (r.staff_name === currentUser.name || r.name === currentUser.name) && (r.entry_date === new Date().toISOString().split('T')[0] || r.date === new Date().toISOString().split('T')[0])) && activeTab !== 'attendance' && (
          <div style={{ maxWidth: '1280px', margin: '12px auto 0 auto', padding: '0 20px' }}>
            <div style={{ background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)', border: '1px solid #F59E0B', borderRadius: '14px', padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.12)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.3rem' }}>📸</span>
                <div>
                  <strong style={{ color: '#92400E', fontSize: '0.92rem' }}>Halo {currentUser.name}, Anda belum presensi masuk hari ini!</strong>
                  <p style={{ margin: '2px 0 0 0', color: '#B45309', fontSize: '0.8rem' }}>Harap ambil foto selfie dan clock-in sebelum memulai transaksi shift.</p>
                </div>
              </div>
              <button onClick={() => handleTabChange('attendance')} className='btn btn-primary' style={{ background: '#D97706', borderColor: '#B45309', padding: '8px 16px', fontSize: '0.84rem', fontWeight: 700 }}>
                Ambil Selfie Presensi Sekarang →
              </button>
            </div>
          </div>
        )}
      <main className="app-main-content">
        <ErrorBoundary>
        
        {/* Tab 1: Input Omset */}
        {activeTab === 'input' && (
          <DailySalesForm 
            onSaveSuccess={(rec) => {
              handleSaveSuccess(rec);
              setWaModalRecord(rec);
            }} 
            currentUser={currentUser}
            activeOutlet={activeOutlet}
            onSelectRecord={(rec) => setSelectedRecordForModal(rec)}
          />
        )}

        {/* Tab 2: Absensi Shift Kru */}
        {activeTab === 'attendance' && (
          <AttendanceView 
            currentUser={currentUser} 
          />
        )}

        {/* Tab 3: Dashboard Eksekutif (Owner) */}
                {activeTab === 'stock' && (
          <StockView 
            currentUser={currentUser}
            activeOutlet={activeOutlet}
          />
        )}

        {activeTab === 'kasbon' && (
          <KasbonView 
            currentUser={currentUser}
            activeOutlet={activeOutlet}
          />
        )}

        
        {activeTab === 'dashboard' && (
          <DashboardView 
            records={records}
            onNavigateToInput={() => handleTabChange('input')}
            onSelectRecord={(rec) => setSelectedRecordForModal(rec)}
            onNavigateToExpenses={() => {
              handleTabChange('history', 'petty_cash');
            }}
            onNavigateToKasirPro={() => handleTabChange('kasirpro')}
          />
        )}

        {/* Tab 4: KasirPro POS Live Monitor */}
        {activeTab === 'kasirpro' && (
          <KasirProView 
            onNavigateToSettings={() => handleTabChange('settings')}
            onNavigateToInput={() => handleTabChange('input')}
          />
        )}

        {/* Tab 5: Riwayat Omset & Buku Pengeluaran */}
        {activeTab === 'history' && (
          <HistoryView 
            records={records}
            onDeleteRecord={handleDeleteRecord}
            onSelectRecord={(rec) => setSelectedRecordForModal(rec)}
            onRefreshData={loadRecords}
            activeSubTab={historySubTab}
            onSubTabChange={(sub) => handleTabChange('history', sub)}
            currentUser={currentUser}
          />
        )}

        {/* Tab 5: Payroll & Slip Gaji */}
        {activeTab === 'payroll' && (
          <PayrollView 
            currentUser={currentUser} 
          />
        )}

        {/* Tab 6: Laporan Laba Rugi & Rekap Belanjaan Owner (P&L) */}
        {activeTab === 'pnl' && (
          <ProfitLossView 
            currentUser={currentUser}
            onRequirePin={handleRequirePin}
          />
        )}

        {/* Tab 7: Pengaturan (Owner) */}
        {activeTab === 'settings' && (
          <SettingsView onReloadData={loadRecords} />
        )}
              </ErrorBoundary>
      </main>

      {/* Detail Modal */}
            {/* WhatsApp Report Modal (Bara Quick WA Summary) */}
      <WhatsAppReportModal 
        isOpen={Boolean(waModalRecord)}
        onClose={() => setWaModalRecord(null)}
        record={waModalRecord}
        activeOutlet={activeOutlet}
      />

      {selectedRecordForModal && (
        <SalesDetailModal 
          record={selectedRecordForModal} 
          onClose={() => setSelectedRecordForModal(null)} 
          onDelete={async (recordId) => {
            await handleDeleteRecord(recordId);
            setSelectedRecordForModal(null);
          }}
        />
      )}

      {/* Security PIN Modal */}
      <PinModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onSuccess={handlePinSuccess}
        targetActionName={pinTargetTab === 'settings' ? 'Pengaturan Sistem' : 'Akses Khusus Owner'}
      />

            {/* Footer */}
      <footer className="app-footer no-print" style={{
        borderTop: '1px solid #E2E8F0',
        padding: '16px 24px',
        fontSize: '0.82rem',
        color: '#64748B',
        background: '#FFFFFF',
        boxShadow: '0 -2px 10px rgba(15, 23, 42, 0.03)'
      }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#4F46E5' }}></span>
            <strong style={{ color: '#1E293B' }}>Bara Coffee & Eatery</strong>
            <span style={{ color: '#CBD5E1' }}>•</span>
            <span style={{ color: '#64748B' }}>Daily Sales, Stock & Kru Portal</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Login sebagai:</span>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '999px',
              background: currentUser?.role === ROLES.OWNER ? '#EEF2FF' : '#F1F5F9',
              border: `1px solid ${currentUser?.role === ROLES.OWNER ? '#C7D2FE' : '#E2E8F0'}`,
              color: currentUser?.role === ROLES.OWNER ? '#4338CA' : '#334155',
              fontWeight: 600
            }}>
              <span>{currentUser?.role === ROLES.OWNER ? '👑' : '👤'}</span>
              <span>{currentUser?.name}</span>
              <span style={{ fontSize: '0.75rem', opacity: 0.75, fontWeight: 500 }}>
                ({currentUser?.role === ROLES.OWNER ? 'Owner' : (currentUser?.position || 'Kru')})
              </span>
            </span>
          </div>
        </div>
      </footer>

    </div>
  );
}
