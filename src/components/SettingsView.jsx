import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Database, 
  FileSpreadsheet, 
  Key, 
  Link2, 
  CheckCircle2, 
  AlertCircle, 
  Save, 
  RotateCcw, 
  Copy, 
  ExternalLink,
  BookOpen,
  Code,
  Users,
  UserPlus,
  Trash2,
  Lock,
  ShieldCheck,
  Target,
  Award,
  TrendingUp,
  Gift,
  Sparkles,
  Percent,
  Trophy,
  Clock,
  Plus,
  Edit,
  Check,
  X,
  Receipt,
  KeyRound
} from 'lucide-react';
import { formatIDR } from '../lib/formatters';
import { getSupabaseConfig, saveSupabaseConfig, testSupabaseConnection } from '../lib/supabase';
import { getSheetsWebhookUrl, saveSheetsWebhookUrl, testGoogleSheetsWebhook } from '../lib/sheetsSync';
import { purgeDemoRecords, clearAllLocalRecords } from '../lib/storage';
import { getTargetConfig, saveTargetConfig } from '../lib/targetService';
import { 
  getCustomPositions, 
  saveCustomPositions, 
  getCustomShifts, 
  saveCustomShifts, 
  DEFAULT_POSITIONS, 
  DEFAULT_SHIFTS 
} from '../lib/shiftConfigService';
import { 
  getStaffList, 
  addStaffUser, 
  updateStaffUser,
  deleteStaffUser, 
  getOwnerPin, 
  setOwnerPin, 
  getSessionTimeoutMinutes,
  setSessionTimeoutMinutes,
  getSessionTimeoutScope,
  setSessionTimeoutScope,
  ROLES 
} from '../lib/auth';
import ProfileModal from './ProfileModal';
import { 
  getKasirProApiKey, 
  saveKasirProApiKey, 
  testKasirProConnection 
} from '../lib/kasirProService';

export default function SettingsView({ onReloadData }) {
  // Staff edit modal state
  const [editingStaff, setEditingStaff] = useState(null);
  // KasirPro states
  const [kasirProKey, setKasirProKey] = useState(() => getKasirProApiKey());
  const [isTestingKasirPro, setIsTestingKasirPro] = useState(false);
  const [kasirProTestMsg, setKasirProTestMsg] = useState(null);

  // Supabase states
  const initialSupabase = getSupabaseConfig();
  const [supabaseUrl, setSupabaseUrl] = useState(initialSupabase.url);
  const [supabaseKey, setSupabaseKey] = useState(initialSupabase.key);
  const [isTestingSupabase, setIsTestingSupabase] = useState(false);
  const [supabaseTestMsg, setSupabaseTestMsg] = useState(null);

  // Sheets states
  const [sheetsUrl, setSheetsUrl] = useState(getSheetsWebhookUrl());
  const [isTestingSheets, setIsTestingSheets] = useState(false);
  const [sheetsTestMsg, setSheetsTestMsg] = useState(null);

  // Staff & User Management states
  const [staffList, setStaffList] = useState([]);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState(ROLES.KRU);
  const [ownerPinInput, setOwnerPinInput] = useState(getOwnerPin());
  const [pinSuccessMsg, setPinSuccessMsg] = useState(null);
  const [sessionTimeout, setSessionTimeout] = useState(() => getSessionTimeoutMinutes());
  const [sessionScope, setSessionScope] = useState(() => getSessionTimeoutScope());
  const [timeoutSuccessMsg, setTimeoutSuccessMsg] = useState(null);

  // Target Omset Bulanan & Bonus Kru states
  const [monthlyTarget, setMonthlyTarget] = useState(45000000);
  const [bonusPercentPerStaff, setBonusPercentPerStaff] = useState(1.0);
  const [targetNotes, setTargetNotes] = useState('Goals bersama seluruh kru Bara Coffee. Tembus target bulanan = bonus 1% omset untuk setiap kru!');
  const [targetSaveMsg, setTargetSaveMsg] = useState(null);
  const [isSavingTarget, setIsSavingTarget] = useState(false);

  // Custom Positions State
  const [positions, setPositions] = useState([]);
  const [newPositionInput, setNewPositionInput] = useState('');
  const [posSuccessMsg, setPosSuccessMsg] = useState(null);

  // Custom Shifts State
  const [shifts, setShifts] = useState([]);
  const [editingShiftId, setEditingShiftId] = useState(null);
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editGrace, setEditGrace] = useState(5);
  const [shiftSuccessMsg, setShiftSuccessMsg] = useState(null);

  // New Shift Modal State
  const [showAddShiftModal, setShowAddShiftModal] = useState(false);
  const [newShiftDivision, setNewShiftDivision] = useState('☕ Barista & Kasir (FOH)');
  const [newShiftName, setNewShiftName] = useState('');
  const [newShiftStart, setNewShiftStart] = useState('07:00');
  const [newShiftEnd, setNewShiftEnd] = useState('15:00');
  const [newShiftGrace, setNewShiftGrace] = useState(5);

  // Tab Kategori Pengaturan
  const [activeCategoryTab, setActiveCategoryTab] = useState('integrasi'); // 'integrasi' | 'staff' | 'shifts' | 'target' | 'system'

  useEffect(() => {
    getStaffList().then(list => setStaffList(list));
    getCustomPositions().then(list => setPositions(list || DEFAULT_POSITIONS));
    getCustomShifts().then(list => setShifts(list || DEFAULT_SHIFTS));
    getTargetConfig().then(cfg => {
      if (cfg) {
        setMonthlyTarget(cfg.monthly_target || 45000000);
        setBonusPercentPerStaff(cfg.bonus_percent_per_staff || 1.0);
        setTargetNotes(cfg.notes || 'Goals bersama seluruh kru Bara Coffee. Tembus target bulanan = bonus 1% omset untuk setiap kru!');
      }
    });
  }, []);

  const handleSaveSupabase = () => {
    saveSupabaseConfig(supabaseUrl, supabaseKey);
    purgeDemoRecords();
    if (onReloadData) onReloadData();
    setSupabaseTestMsg({ success: true, message: 'Konfigurasi cloud database berhasil disimpan! Sistem siap digunakan.' });
    setTimeout(() => setSupabaseTestMsg(null), 4000);
  };

  const handleTestSupabase = async () => {
    setIsTestingSupabase(true);
    setSupabaseTestMsg(null);
    const res = await testSupabaseConnection(supabaseUrl, supabaseKey);
    setIsTestingSupabase(false);
    setSupabaseTestMsg(res);
  };

  const handleSaveSheets = () => {
    saveSheetsWebhookUrl(sheetsUrl);
    purgeDemoRecords();
    if (onReloadData) onReloadData();
    setSheetsTestMsg({ success: true, message: 'Google Sheets Webhook berhasil disimpan! Data demo dibersihkan, mode live aktif.' });
    setTimeout(() => setSheetsTestMsg(null), 4000);
  };

  const handleTestSheets = async () => {
    setIsTestingSheets(true);
    setSheetsTestMsg(null);
    const res = await testGoogleSheetsWebhook(sheetsUrl);
    setIsTestingSheets(false);
    setSheetsTestMsg(res);
  };

  const handleSaveKasirPro = async () => {
    await saveKasirProApiKey(kasirProKey);
    setKasirProTestMsg({ 
      success: true, 
      message: 'API Key KasirPro berhasil disimpan dan disinkronkan ke Cloud! Seluruh device (HP/Laptop) otomatis terhubung.' 
    });
    setTimeout(() => setKasirProTestMsg(null), 4000);
  };

  const handleTestKasirPro = async () => {
    setIsTestingKasirPro(true);
    setKasirProTestMsg(null);
    const res = await testKasirProConnection(kasirProKey);
    setIsTestingKasirPro(false);
    if (res.success) {
      setKasirProTestMsg({
        success: true,
        message: `Terhubung ke Toko: ${res.data.toko?.nama || 'KasirPro'} (${res.data.lisensi || 'MAX/Unlimited'}). Mode: ${res.data.mode || 'Read-Only'}.`
      });
    } else {
      setKasirProTestMsg({
        success: false,
        message: res.error || 'Gagal terhubung ke KasirPro.'
      });
    }
  };

  // Staff actions
  const handleAddStaff = async (e) => {
    e.preventDefault();
    if (!newStaffName.trim()) return;

    const created = await addStaffUser({
      name: newStaffName.trim(),
      role: newStaffRole
    });

    setStaffList(prev => [...prev, created]);
    setNewStaffName('');
    alert(`Staff "${created.name}" berhasil didaftarkan sebagai ${created.role === ROLES.KRU ? 'Kru / Kasir' : 'Manager'}!`);
  };

  const handleDeleteStaff = async (id, name) => {
    if (confirm(`Hapus hak akses staff "${name}"?`)) {
      await deleteStaffUser(id);
      setStaffList(prev => prev.filter(u => u.id !== id));
    }
  };

  const handleSavePin = () => {
    if (ownerPinInput.length < 4) {
      alert('PIN minimal 4 digit angka.');
      return;
    }
    setOwnerPin(ownerPinInput);
    setPinSuccessMsg('PIN Master Owner berhasil diperbarui!');
    setTimeout(() => setPinSuccessMsg(null), 3000);
  };

  const handleSaveTimeout = () => {
    setSessionTimeoutMinutes(sessionTimeout);
    setSessionTimeoutScope(sessionScope);
    const scopeLabel = sessionScope === 'owner_only' ? 'Khusus Owner & Manajer' : 'Semua Akun (Termasuk Kru)';
    const timeLabel = sessionTimeout === 0 ? 'Nonaktif' : `${sessionTimeout} menit`;
    setTimeoutSuccessMsg(`Batas waktu sesi berhasil disimpan: ${timeLabel} (${scopeLabel})!`);
    setTimeout(() => setTimeoutSuccessMsg(null), 4000);
  };

  // Posisi Handlers
  const handleAddPosition = async (e) => {
    e.preventDefault();
    if (!newPositionInput.trim()) return;
    const title = newPositionInput.trim();
    if (positions.includes(title)) {
      alert(`Posisi "${title}" sudah terdaftar.`);
      return;
    }
    const updated = [...positions, title];
    setPositions(updated);
    setNewPositionInput('');
    await saveCustomPositions(updated);
    setPosSuccessMsg(`Posisi "${title}" berhasil ditambahkan!`);
    setTimeout(() => setPosSuccessMsg(null), 3000);
  };

  const handleDeletePosition = async (posToDelete) => {
    if (positions.length <= 1) {
      alert('Minimal harus ada 1 posisi terdaftar.');
      return;
    }
    if (confirm(`Hapus posisi "${posToDelete}" dari daftar pilihan cafe?`)) {
      const updated = positions.filter(p => p !== posToDelete);
      setPositions(updated);
      await saveCustomPositions(updated);
    }
  };

  // Shift Handlers
  const handleStartEditShift = (shift) => {
    setEditingShiftId(shift.id);
    setEditStartTime(shift.startTime);
    setEditEndTime(shift.endTime);
    setEditGrace(shift.gracePeriod || 5);
  };

  const handleSaveShiftEdit = async (shiftId) => {
    const updated = shifts.map(s => {
      if (s.id === shiftId) {
        return {
          ...s,
          startTime: editStartTime,
          endTime: editEndTime,
          gracePeriod: Number(editGrace) || 5,
          label: `${s.shortName} (${editStartTime} – ${editEndTime})`
        };
      }
      return s;
    });
    setShifts(updated);
    setEditingShiftId(null);
    await saveCustomShifts(updated);
    setShiftSuccessMsg('Jadwal shift berhasil diperbarui!');
    setTimeout(() => setShiftSuccessMsg(null), 3000);
  };

  const handleAddNewShift = async (e) => {
    e.preventDefault();
    if (!newShiftName.trim()) return;
    const newShift = {
      id: `shift_${Date.now()}`,
      division: newShiftDivision,
      label: `${newShiftName.trim()} (${newShiftStart} – ${newShiftEnd})`,
      shortName: newShiftName.trim(),
      startTime: newShiftStart,
      endTime: newShiftEnd,
      gracePeriod: Number(newShiftGrace) || 5,
      icon: '⏰'
    };
    const updated = [...shifts, newShift];
    setShifts(updated);
    setShowAddShiftModal(false);
    setNewShiftName('');
    await saveCustomShifts(updated);
    setShiftSuccessMsg(`Shift "${newShift.shortName}" berhasil ditambahkan!`);
    setTimeout(() => setShiftSuccessMsg(null), 3000);
  };

  const handleDeleteShift = async (shiftId, shiftName) => {
    if (shifts.length <= 1) {
      alert('Minimal harus ada 1 shift aktif.');
      return;
    }
    if (confirm(`Hapus shift "${shiftName}"?`)) {
      const updated = shifts.filter(s => s.id !== shiftId);
      setShifts(updated);
      await saveCustomShifts(updated);
    }
  };

  const handleResetShifts = async () => {
    if (confirm('Kembalikan seluruh jadwal shift ke standar bawaan Bara Coffee?')) {
      setShifts(DEFAULT_SHIFTS);
      await saveCustomShifts(DEFAULT_SHIFTS);
      setShiftSuccessMsg('Jadwal shift di-reset ke standar bawaan!');
      setTimeout(() => setShiftSuccessMsg(null), 3000);
    }
  };

  const handleSaveTarget = async (e) => {
    e.preventDefault();
    setIsSavingTarget(true);
    try {
      await saveTargetConfig({
        monthly_target: Number(monthlyTarget),
        bonus_percent_per_staff: Number(bonusPercentPerStaff),
        notes: targetNotes
      });
      setTargetSaveMsg({ success: true, message: 'Target Omset Bulanan & Bonus Kru berhasil disimpan ke cloud!' });
      if (onReloadData) onReloadData();
    } catch (err) {
      setTargetSaveMsg({ success: false, message: `Gagal simpan target: ${err.message}` });
    } finally {
      setIsSavingTarget(false);
      setTimeout(() => setTargetSaveMsg(null), 4000);
    }
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1100px', margin: '0 auto', paddingBottom: '60px' }}>
      
      {/* Header Title & Subtitle */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
          Pengaturan Bara Coffee
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '4px 0 0 0' }}>
          Pusat kendali integrasi POS, cloud, manajemen staf, jadwal kerja shift, dan target penjualan.
        </p>
      </div>

      {/* Grid Layout: Sidebar Menu di Kiri, Konten di Kanan */}
      <div className="settings-layout-grid">
        {/* Kolom Sidebar Navigasi */}
        <aside className="settings-sidebar-nav" style={{
          position: 'sticky',
          top: '85px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          background: 'var(--bg-card)',
          padding: '12px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div className="settings-sidebar-header" style={{ padding: '8px 12px 10px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Menu Pengaturan
            </span>
          </div>

          <button
            type="button"
            className="settings-sidebar-btn"
            onClick={() => setActiveCategoryTab('integrasi')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '11px 14px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: activeCategoryTab === 'integrasi' ? 'var(--gold-glow)' : 'transparent',
              color: activeCategoryTab === 'integrasi' ? 'var(--gold-light)' : 'var(--text-secondary)',
              fontWeight: activeCategoryTab === 'integrasi' ? 700 : 500,
              fontSize: '0.88rem',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.18s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Receipt size={17} />
              <span>Integrasi & Cloud</span>
            </div>
            {kasirProKey && (
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--success)' }} title="POS Terhubung" />
            )}
          </button>

          <button
            type="button"
            className="settings-sidebar-btn"
            onClick={() => setActiveCategoryTab('staff')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '11px 14px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: activeCategoryTab === 'staff' ? 'var(--gold-glow)' : 'transparent',
              color: activeCategoryTab === 'staff' ? 'var(--gold-light)' : 'var(--text-secondary)',
              fontWeight: activeCategoryTab === 'staff' ? 700 : 500,
              fontSize: '0.88rem',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.18s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Users size={17} />
              <span>Staf & Hak Akses</span>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{staffList.length}</span>
          </button>

          <button
            type="button"
            className="settings-sidebar-btn"
            onClick={() => setActiveCategoryTab('shifts')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '11px 14px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: activeCategoryTab === 'shifts' ? 'var(--gold-glow)' : 'transparent',
              color: activeCategoryTab === 'shifts' ? 'var(--gold-light)' : 'var(--text-secondary)',
              fontWeight: activeCategoryTab === 'shifts' ? 700 : 500,
              fontSize: '0.88rem',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.18s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Clock size={17} />
              <span>Jadwal Shift & Jam</span>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{shifts.length}</span>
          </button>

          <button
            type="button"
            className="settings-sidebar-btn"
            onClick={() => setActiveCategoryTab('target')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '11px 14px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: activeCategoryTab === 'target' ? 'var(--gold-glow)' : 'transparent',
              color: activeCategoryTab === 'target' ? 'var(--gold-light)' : 'var(--text-secondary)',
              fontWeight: activeCategoryTab === 'target' ? 700 : 500,
              fontSize: '0.88rem',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.18s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Trophy size={17} />
              <span>Target & Bonus Kru</span>
            </div>
          </button>

          <button
            type="button"
            className="settings-sidebar-btn"
            onClick={() => setActiveCategoryTab('system')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '11px 14px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: activeCategoryTab === 'system' ? 'var(--gold-glow)' : 'transparent',
              color: activeCategoryTab === 'system' ? 'var(--gold-light)' : 'var(--text-secondary)',
              fontWeight: activeCategoryTab === 'system' ? 700 : 500,
              fontSize: '0.88rem',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.18s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <BookOpen size={17} />
              <span>Panduan & Cache</span>
            </div>
          </button>
        </aside>

        {/* Kolom Konten Pengaturan di Kanan */}
        <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Section 1: User Management & Role Access (Owner vs Kru) */}
        {activeCategoryTab === 'staff' && (
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'var(--gold-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={20} color="var(--gold-light)" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Hak Akses Pengguna (Owner vs Kru)
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                Bedakan siapa yang boleh melihat omset eksekutif dan siapa yang bertugas input shift kasir.
              </p>
            </div>
          </div>

          {/* Matrix Peran */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '12px',
            marginBottom: '20px'
          }}>
            <div style={{ background: 'var(--bg-input)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: 'var(--gold-light)', fontSize: '0.88rem' }}>
                <ShieldCheck size={16} /> 👑 Peran: OWNER / MANAGER
              </div>
              <ul style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', paddingLeft: '16px', marginTop: '6px', lineHeight: 1.5 }}>
                <li>Akses penuh: Dashboard omset & profit</li>
                <li>Lihat seluruh riwayat & audit selisih kas</li>
                <li>Hapus/koreksi entri transaksi</li>
                <li>Akses pengaturan database & ganti PIN</li>
              </ul>
            </div>

            <div style={{ background: 'var(--bg-input)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: 'var(--info)', fontSize: '0.88rem' }}>
                <Lock size={16} /> ☕ Peran: KRU / KASIR / BARISTA
              </div>
              <ul style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', paddingLeft: '16px', marginTop: '6px', lineHeight: 1.5 }}>
                <li>Hanya bisa membuka formulir <strong>Input Omset</strong></li>
                <li>Input penerimaan tunai, QRIS, EDC, petty cash</li>
                <li>Cetak struk rekap pergantian shift</li>
                <li><strong>Terkunci:</strong> Dashboard, laporan keuangan, & pengaturan butuh PIN Owner</li>
              </ul>
            </div>
          </div>

          {/* Pengaturan PIN Master Owner */}
          <div style={{ background: 'var(--bg-input)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-hover)', marginBottom: '22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.92rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Lock size={15} color="var(--gold-light)" />
                  <span>PIN Master Owner (Default: <code>8888</code>)</span>
                </h4>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  Digunakan untuk membuka dashboard saat tablet sedang dalam Mode Kasir.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input 
                  type="text"
                  maxLength={6}
                  value={ownerPinInput}
                  onChange={(e) => setOwnerPinInput(e.target.value.replace(/\D/g, ''))}
                  className="form-input number-field"
                  style={{ width: '100px', textAlign: 'center', padding: '6px 10px', fontSize: '1rem' }}
                />
                <button onClick={handleSavePin} className="btn btn-primary" style={{ padding: '7px 14px', fontSize: '0.8rem' }}>
                  Simpan PIN
                </button>
              </div>
            </div>
            {pinSuccessMsg && (
              <div style={{ marginTop: '8px', fontSize: '0.78rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={13} /> <span>{pinSuccessMsg}</span>
              </div>
            )}
          </div>

          {/* Pengaturan Batas Waktu Sesi (Auto-Logout Timeout) */}
          <div style={{ background: 'var(--bg-input)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-hover)', marginBottom: '22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ flex: 1, minWidth: '220px' }}>
                <h4 style={{ margin: 0, fontSize: '0.92rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={15} color="var(--gold-light)" />
                  <span>Batas Waktu Sesi & Auto-Logout Otomatis</span>
                </h4>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  Mencegah akun Owner tertinggal dalam keadaan login. Sistem akan otomatis logout saat tidak ada aktivitas di layar.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  value={sessionTimeout}
                  onChange={(e) => setSessionTimeout(Number(e.target.value))}
                  className="form-input"
                  style={{ padding: '7px 12px', fontSize: '0.82rem', minWidth: '150px' }}
                >
                  <option value={5}>⏱️ 5 Menit (Ketat / POS Ramai)</option>
                  <option value={10}>⏱️ 10 Menit</option>
                  <option value={15}>⏱️ 15 Menit (Rekomendasi)</option>
                  <option value={30}>⏱️ 30 Menit</option>
                  <option value={60}>⏱️ 60 Menit (1 Jam)</option>
                  <option value={0}>🚫 Nonaktif (Jangan Logout)</option>
                </select>

                <select
                  value={sessionScope}
                  onChange={(e) => setSessionScope(e.target.value)}
                  className="form-input"
                  style={{ padding: '7px 12px', fontSize: '0.82rem', minWidth: '160px' }}
                >
                  <option value="owner_only">Khusus Owner & Manajer</option>
                  <option value="all">Semua Akun (Termasuk Kru)</option>
                </select>

                <button onClick={handleSaveTimeout} className="btn btn-primary" style={{ padding: '7px 14px', fontSize: '0.8rem' }}>
                  Simpan Timeout
                </button>
              </div>
            </div>
            {timeoutSuccessMsg && (
              <div style={{ marginTop: '8px', fontSize: '0.78rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={13} /> <span>{timeoutSuccessMsg}</span>
              </div>
            )}
          </div>

          {/* Daftar Staff Aktif & Form Tambah */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Daftar Staf & Kasir Terdaftar ({staffList.length} Orang)
              </h4>
              <span style={{ fontSize: '0.75rem', color: supabaseUrl ? 'var(--success)' : 'var(--warning)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={13} />
                <span>{supabaseUrl ? 'Tersimpan & Sinkron ke Cloud Database' : 'Tersimpan di Penyimpanan Perangkat'}</span>
              </span>
            </div>

            {/* Form Tambah Staff Baru */}
            <form onSubmit={handleAddStaff} style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <input 
                type="text"
                placeholder="Nama staf baru (mis: Dewi Lestari)..."
                value={newStaffName}
                onChange={(e) => setNewStaffName(e.target.value)}
                className="form-input"
                style={{ flex: 2, minWidth: '200px' }}
                required
              />
              <select
                value={newStaffRole}
                onChange={(e) => setNewStaffRole(e.target.value)}
                className="form-select"
                style={{ flex: 1, minWidth: '140px' }}
              >
                <option value={ROLES.KRU}>Kru / Kasir</option>
                <option value={ROLES.MANAGER}>Manager</option>
              </select>
              <button type="submit" className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
                <UserPlus size={15} />
                <span>Tambah Staf</span>
              </button>
            </form>

            {/* List Staff Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '8px 10px' }}>Nama</th>
                    <th style={{ padding: '8px 10px' }}>Peran</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>Status Kasir</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {staffList.map((user) => {
                    const isOwnerRole = user.role === ROLES.OWNER;
                    const isManager = user.role === ROLES.MANAGER;
                    const isActive = user.is_active !== false;

                    return (
                      <tr key={user.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '10px', fontWeight: 600, color: isActive ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {user.name}
                        </td>
                        <td style={{ padding: '10px' }}>
                          <span className={`badge ${isOwnerRole ? 'badge-gold' : isManager ? 'badge-warning' : 'badge-info'}`} style={{ fontSize: '0.72rem' }}>
                            {isOwnerRole ? '👑 Owner' : isManager ? '💼 Manager' : '☕ Kru / Kasir'}
                          </span>
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          {isOwnerRole ? (
                            <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>Permanen</span>
                          ) : (
                            <button
                              type="button"
                              onClick={async () => {
                                await updateStaffUser(user.id, { is_active: !isActive });
                                setStaffList(prev => prev.map(u => u.id === user.id ? { ...u, is_active: !isActive } : u));
                              }}
                              className={`badge ${isActive ? 'badge-success' : 'badge-danger'}`}
                              style={{ cursor: 'pointer', border: 'none', fontSize: '0.7rem', padding: '4px 8px' }}
                              title="Klik untuk ubah status aktif/nonaktif"
                            >
                              {isActive ? '✓ Aktif Bekerja' : '✕ Nonaktif (Resign)'}
                            </button>
                          )}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => setEditingStaff(user)}
                              style={{ 
                                background: 'var(--bg-input)', 
                                border: '1px solid var(--border-subtle)', 
                                color: 'var(--burgundy-primary)', 
                                cursor: 'pointer', 
                                padding: '5px 8px',
                                borderRadius: '6px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.74rem',
                                fontWeight: 600
                              }}
                              title="Edit Profil & Ganti PIN"
                            >
                              <Edit size={13} />
                              <span>Edit / PIN</span>
                            </button>

                            {!isOwnerRole && (
                              <button
                                type="button"
                                onClick={() => handleDeleteStaff(user.id, user.name)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '4px' }}
                                title="Hapus Staff dari Database"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          </div>

          {/* Modal Edit Profil & PIN Staf */}
          {editingStaff && (
            <ProfileModal
              isOpen={Boolean(editingStaff)}
              onClose={() => setEditingStaff(null)}
              currentUser={editingStaff}
              onProfileUpdated={(updated) => {
                setStaffList(prev => prev.map(u => u.id === updated.id ? { ...u, ...updated } : u));
                setEditingStaff(null);
                if (onReloadData) onReloadData();
              }}
            />
          )}

        </div>
        )}

        {/* Section: Kustomisasi Role / Posisi & Master Jadwal Shift */}
        {activeCategoryTab === 'shifts' && (
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(58, 134, 255, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(58, 134, 255, 0.3)' }}>
                <Clock size={22} color="var(--info)" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.18rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Kustomisasi Role/Posisi & Master Jadwal Shift
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                  Atur daftar divisi/posisi kerja serta jam masuk & selesai untuk masing-masing shift cafe.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={handleResetShifts}
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                title="Kembalikan shift ke template default"
              >
                <RotateCcw size={14} />
                <span>Reset Standar</span>
              </button>
              <button
                type="button"
                onClick={() => setShowAddShiftModal(true)}
                className="btn btn-primary"
                style={{ fontSize: '0.8rem', padding: '6px 14px' }}
              >
                <Plus size={14} />
                <span>Tambah Shift Baru</span>
              </button>
            </div>
          </div>

          {/* Feedback Messages */}
          {posSuccessMsg && (
            <div style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(46, 196, 182, 0.12)', border: '1px solid rgba(46, 196, 182, 0.3)', color: 'var(--success)', fontSize: '0.82rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={15} />
              <span>{posSuccessMsg}</span>
            </div>
          )}
          {shiftSuccessMsg && (
            <div style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(46, 196, 182, 0.12)', border: '1px solid rgba(46, 196, 182, 0.3)', color: 'var(--success)', fontSize: '0.82rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={15} />
              <span>{shiftSuccessMsg}</span>
            </div>
          )}

          {/* SUB-BAGIAN 1: DAFTAR ROLE & POSISI KRU */}
          <div style={{ background: 'var(--bg-input)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--gold-light)' }}>
                  1. Daftar Posisi / Job Title Cafe:
                </h4>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Pilihan posisi ini akan muncul di form pendaftaran kru dan form absensi.
                </span>
              </div>
            </div>

            {/* Chips List */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
              {positions.map((pos) => (
                <div
                  key={pos}
                  style={{
                    background: 'rgba(217, 155, 67, 0.12)',
                    border: '1px solid var(--border-hover)',
                    borderRadius: '20px',
                    padding: '4px 12px',
                    fontSize: '0.82rem',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{pos}</span>
                  {positions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeletePosition(pos)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                      title={`Hapus ${pos}`}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Add New Position Form */}
            <form onSubmit={handleAddPosition} style={{ display: 'flex', gap: '8px', maxWidth: '420px' }}>
              <input
                type="text"
                placeholder="Ketik nama posisi baru (misal: Head Barista)..."
                value={newPositionInput}
                onChange={(e) => setNewPositionInput(e.target.value)}
                className="form-input"
                style={{ fontSize: '0.82rem', padding: '6px 12px' }}
              />
              <button type="submit" className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '6px 14px', whiteSpace: 'nowrap' }}>
                <Plus size={14} />
                <span>Tambah Posisi</span>
              </button>
            </form>
          </div>

          {/* SUB-BAGIAN 2: MASTER JADWAL SHIFT & WAKTU */}
          <div>
            <div style={{ marginBottom: '12px' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--gold-light)' }}>
                2. Master Jadwal Shift & Jam Kerja:
              </h4>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Ubah jam mulai & selesai shift di bawah ini. Sistem absensi otomatis menggunakan jadwal ini untuk mendeteksi keterlambatan.
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-input)', color: 'var(--text-muted)', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Divisi / Kategori</th>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Nama Shift</th>
                    <th style={{ padding: '10px', textAlign: 'center' }}>Jam Mulai</th>
                    <th style={{ padding: '10px', textAlign: 'center' }}>Jam Selesai</th>
                    <th style={{ padding: '10px', textAlign: 'center' }}>Toleransi Telat</th>
                    <th style={{ padding: '10px', textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {shifts.map((s) => {
                    const isEditing = editingShiftId === s.id;

                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        {/* Divisi */}
                        <td style={{ padding: '10px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                          {s.division}
                        </td>

                        {/* Nama Shift */}
                        <td style={{ padding: '10px' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{s.shortName}</div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{s.label}</span>
                        </td>

                        {/* Jam Mulai */}
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          {isEditing ? (
                            <input
                              type="time"
                              value={editStartTime}
                              onChange={(e) => setEditStartTime(e.target.value)}
                              className="form-input"
                              style={{ width: '100px', margin: '0 auto', fontSize: '0.85rem', padding: '4px' }}
                            />
                          ) : (
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--success)' }}>
                              {s.startTime} WIB
                            </span>
                          )}
                        </td>

                        {/* Jam Selesai */}
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          {isEditing ? (
                            <input
                              type="time"
                              value={editEndTime}
                              onChange={(e) => setEditEndTime(e.target.value)}
                              className="form-input"
                              style={{ width: '100px', margin: '0 auto', fontSize: '0.85rem', padding: '4px' }}
                            />
                          ) : (
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--gold-light)' }}>
                              {s.endTime} WIB
                            </span>
                          )}
                        </td>

                        {/* Toleransi Keterlambatan */}
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          {isEditing ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                              <input
                                type="number"
                                min="0"
                                max="60"
                                value={editGrace}
                                onChange={(e) => setEditGrace(e.target.value)}
                                className="form-input"
                                style={{ width: '60px', fontSize: '0.85rem', padding: '4px', textAlign: 'center' }}
                              />
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>menit</span>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              {s.gracePeriod || 5} Menit
                            </span>
                          )}
                        </td>

                        {/* Aksi */}
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          {isEditing ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                              <button
                                type="button"
                                onClick={() => handleSaveShiftEdit(s.id)}
                                className="btn btn-primary"
                                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                title="Simpan Perubahan Jam"
                              >
                                <Check size={14} />
                                <span>Simpan</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingShiftId(null)}
                                className="btn btn-secondary"
                                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                title="Batal"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                              <button
                                type="button"
                                onClick={() => handleStartEditShift(s)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--gold-light)', cursor: 'pointer', padding: '4px' }}
                                title="Ubah Jam Shift"
                              >
                                <Edit size={15} />
                              </button>
                              {shifts.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteShift(s.id, s.shortName)}
                                  style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '4px' }}
                                  title="Hapus Shift"
                                >
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </div>
                          )}
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
        )}

        {/* Section 2: Goals Omset Bulanan & Bonus Kru (Collective Goals) */}
        {activeCategoryTab === 'target' && (
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--gold-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-hover)' }}>
              <Trophy size={22} color="var(--gold-light)" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.18rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Goals Omset Bulanan & Bonus Kru (Collective Team Target)
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Target bersama seluruh kru Bara Coffee per bulan. Saat total omset mencapai/melewati target, setiap kru berhak atas 1% bonus omset.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveTarget} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
              
              {/* Target Omset Bulanan */}
              <div className="form-group">
                <label className="form-label">
                  <span>🎯 Nominal Target Bulanan Cafe:</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--gold-light)' }}>Goals Seluruh Tim</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gold-light)', fontWeight: 800, fontSize: '0.95rem' }}>Rp</span>
                  <input 
                    type="number"
                    min="1000000"
                    step="1000000"
                    value={monthlyTarget}
                    onChange={(e) => setMonthlyTarget(Number(e.target.value))}
                    className="form-input"
                    style={{ paddingLeft: '42px', fontWeight: 800, color: 'var(--gold-light)', fontSize: '1.05rem', fontFamily: 'var(--font-mono)' }}
                    required
                  />
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Setara Rp {Math.round(monthlyTarget / 30).toLocaleString('id-ID')} / hari (rata-rata 30 hari).
                </span>
              </div>

              {/* Persentase Bonus per Kru */}
              <div className="form-group">
                <label className="form-label">
                  <span>🎁 Persentase Bonus per Kru (% dari Omset):</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Eligible saat target pass</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="number"
                    min="0.1"
                    max="10"
                    step="0.1"
                    value={bonusPercentPerStaff}
                    onChange={(e) => setBonusPercentPerStaff(Number(e.target.value))}
                    className="form-input"
                    style={{ paddingRight: '36px', fontWeight: 700, fontSize: '1.05rem' }}
                    required
                  />
                  <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: 700 }}>%</span>
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Default: 1.0% dari total net omset bulanan untuk masing-masing kru.
                </span>
              </div>

            </div>

            {/* Simulasi Interaktif & Penjelasan */}
            <div style={{ background: 'var(--bg-input)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--gold-light)', fontWeight: 700, fontSize: '0.88rem' }}>
                <Sparkles size={16} />
                <span>Simulasi Kelayakan & Perhitungan Bonus:</span>
              </div>

              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.5', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <p style={{ margin: 0 }}>
                  • <strong>Kondisi Lolos (Pass Target):</strong> Total omset bulan ini harus mencapai minimal <strong>Rp {Number(monthlyTarget).toLocaleString('id-ID')}</strong>. Jika belum mencapai target, bonus omset belum aktif.
                </p>
                <p style={{ margin: 0 }}>
                  • <strong>Contoh Saat Target Tembus:</strong> Jika total omset di akhir bulan mencapai <strong>Rp {(monthlyTarget + 5000000).toLocaleString('id-ID')}</strong>, maka seluruh kru yang aktif bekerja berhak menerima bonus:
                </p>
                <div style={{ background: 'rgba(46, 196, 182, 0.1)', border: '1px solid rgba(46, 196, 182, 0.3)', padding: '10px 14px', borderRadius: '8px', color: 'var(--success)', fontWeight: 600, marginTop: '2px' }}>
                  💰 Rp {(monthlyTarget + 5000000).toLocaleString('id-ID')} × {bonusPercentPerStaff}% = <strong style={{ fontSize: '1rem', color: '#2ec4b6' }}>Rp {Math.round((monthlyTarget + 5000000) * (bonusPercentPerStaff / 100)).toLocaleString('id-ID')} / kru</strong> langsung di slip gaji masing-masing!
                </div>
              </div>
            </div>

            {/* Pesan Motivasi untuk Kru */}
            <div className="form-group">
              <label className="form-label">
                <span>Pesan Motivasi untuk Seluruh Kru (Tampil di Terminal & Dashboard):</span>
              </label>
              <input 
                type="text"
                placeholder="Misal: Goals kita bulan ini 45 Juta! Tembus target = bonus 1% omset untuk semua kru. Semangat team!"
                value={targetNotes}
                onChange={(e) => setTargetNotes(e.target.value)}
                className="form-input"
              />
            </div>

            {/* Feedback Message */}
            {targetSaveMsg && (
              <div style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.84rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: targetSaveMsg.success ? 'rgba(46, 196, 182, 0.1)' : 'rgba(231, 111, 81, 0.1)',
                border: `1px solid ${targetSaveMsg.success ? 'rgba(46, 196, 182, 0.3)' : 'rgba(231, 111, 81, 0.3)'}`,
                color: targetSaveMsg.success ? 'var(--success)' : 'var(--danger)'
              }}>
                {targetSaveMsg.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <span>{targetSaveMsg.message}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                type="submit" 
                disabled={isSavingTarget}
                className="btn btn-primary"
                style={{ padding: '10px 22px', fontSize: '0.9rem' }}
              >
                <Save size={16} />
                <span>{isSavingTarget ? 'Menyimpan...' : 'Simpan Goals Bulanan & Bonus Kru'}</span>
              </button>
            </div>

          </form>
        </div>
        )}

        {/* Section 3: Supabase & Sheets & KasirPro (Kategori Integrasi) */}
        {activeCategoryTab === 'integrasi' && (
          <>
            {/* Supabase Configuration */}
            <div className="glass-card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(13, 148, 136, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Database size={20} color="var(--success)" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Integrasi Basis Data Cloud
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                Layanan cloud terpusat untuk penyimpanan permanen transaksi omset, absensi, dan nota kas kecil.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '16px' }}>
            <div className="form-group">
              <label className="form-label">
                <span>Server URL / Endpoint Cloud</span>
              </label>
              <input 
                type="text"
                placeholder="https://xyzabcdefghijklm.supabase.co"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <span>API Access Key (Public)</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Kunci akses publik yang aman</span>
              </label>
              <input 
                type="password"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={supabaseKey}
                onChange={(e) => setSupabaseKey(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          {/* Test Response Message */}
          {supabaseTestMsg && (
            <div style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              marginBottom: '16px',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              background: supabaseTestMsg.success ? 'rgba(46, 196, 182, 0.1)' : 'rgba(231, 111, 81, 0.1)',
              border: `1px solid ${supabaseTestMsg.success ? 'rgba(46, 196, 182, 0.3)' : 'rgba(231, 111, 81, 0.3)'}`,
              color: supabaseTestMsg.success ? 'var(--success)' : 'var(--danger)'
            }}>
              {supabaseTestMsg.success ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span>{supabaseTestMsg.message}</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button 
              type="button" 
              onClick={handleSaveSupabase}
              className="btn btn-primary"
              style={{ fontSize: '0.86rem' }}
            >
              <Save size={15} />
              <span>Simpan Konfigurasi Cloud</span>
            </button>

            <button 
              type="button" 
              onClick={handleTestSupabase}
              disabled={isTestingSupabase || !supabaseUrl}
              className="btn btn-secondary"
              style={{ fontSize: '0.86rem' }}
            >
              {isTestingSupabase ? 'Mengetes...' : 'Test Koneksi Cloud'}
            </button>
          </div>
        </div>

        {/* Section 3: Google Sheets Webhook Configuration */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(72, 202, 228, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileSpreadsheet size={20} color="var(--info)" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Pencadangan Spreadsheet Otomatis
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                Setiap kali kasir mencatat omset shift, salinan data otomatis terkirim ke spreadsheet rekapan Owner.
              </p>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label">
              <span>Webhook URL Spreadsheet</span>
              <a href="https://sheets.new" target="_blank" rel="noreferrer" style={{ color: 'var(--gold-light)', fontSize: '0.75rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                Buka Google Sheets Baru <ExternalLink size={12} />
              </a>
            </label>
            <input 
              type="text"
              placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
              value={sheetsUrl}
              onChange={(e) => setSheetsUrl(e.target.value)}
              className="form-input"
            />
            {sheetsUrl && sheetsUrl.endsWith('/dev') && (
              <div style={{ marginTop: '6px', fontSize: '0.8rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertCircle size={14} />
                <span>Peringatan: URL ini berakhiran <strong>/dev</strong>. Google Apps Script hanya menerima data via URL Production yang berakhiran <strong>/exec</strong>!</span>
              </div>
            )}
            {sheetsUrl && (
              <div style={{ marginTop: '6px' }}>
                <a 
                  href={sheetsUrl} 
                  target="_blank" 
                  rel="noreferrer" 
                  style={{ color: 'var(--info)', fontSize: '0.8rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                >
                  <ExternalLink size={13} />
                  <span>Uji Buka Webhook URL di Tab Baru (Harus muncul tulisan "BARA COFFEE WEBHOOK AKTIF")</span>
                </a>
              </div>
            )}
          </div>

          {/* Test Response Message */}
          {sheetsTestMsg && (
            <div style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              marginBottom: '16px',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              background: sheetsTestMsg.success ? 'rgba(72, 202, 228, 0.1)' : 'rgba(231, 111, 81, 0.1)',
              border: `1px solid ${sheetsTestMsg.success ? 'rgba(72, 202, 228, 0.3)' : 'rgba(231, 111, 81, 0.3)'}`,
              color: sheetsTestMsg.success ? 'var(--info)' : 'var(--danger)'
            }}>
              {sheetsTestMsg.success ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span>{sheetsTestMsg.message}</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '18px' }}>
            <button 
              type="button" 
              onClick={handleSaveSheets}
              className="btn btn-primary"
              style={{ fontSize: '0.86rem' }}
            >
              <Save size={15} />
              <span>Simpan URL Webhook</span>
            </button>

            <button 
              type="button" 
              onClick={handleTestSheets}
              disabled={isTestingSheets || !sheetsUrl}
              className="btn btn-secondary"
              style={{ fontSize: '0.86rem' }}
            >
              {isTestingSheets ? 'Mengirim Test...' : 'Kirim Uji Coba Sinkronisasi'}
            </button>
          </div>

          {/* Troubleshooting Checklist Box */}
          <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', fontSize: '0.82rem' }}>
            <strong style={{ color: 'var(--burgundy-primary)', display: 'block', marginBottom: '6px' }}>
              💡 Petunjuk konfigurasi webhook spreadsheet:
            </strong>
            <ol style={{ paddingLeft: '18px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <li>
                <strong>Salin Kode Webhook:</strong> Salin kode dari file <code>google_apps_script.js</code> di proyek ke Apps Script spreadsheet Anda.
              </li>
              <li>
                <strong>Deploy Versi Baru:</strong> Di Apps Script, klik <em>Deploy → Manage deployments → Edit → Version: New version → Deploy</em>.
              </li>
              <li>
                <strong>Hak Akses:</strong> Pastikan opsi <em>Who has access</em> dipilih <strong>Anyone</strong> agar sistem dapat mengirimkan rekapitulasi.
              </li>
              <li>
                <strong>Format URL:</strong> Pastikan URL yang dimasukkan berakhiran <code>/exec</code>.
              </li>
            </ol>
          </div>
        </div>

        {/* Section 4: KasirPro POS API Configuration */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(207, 58, 74, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Receipt size={20} color="#cf3a4a" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Integrasi KasirPro API (POS Toko)
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                Tarik data omset riil, jumlah transaksi order, dan pantau penjualan langsung dari mesin kasir KasirPro.
              </p>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label">
              <span>KasirPro API Key (Token: <code>kp_live_...</code>)</span>
              <a href="https://backoffice.kasirpro.com" target="_blank" rel="noreferrer" style={{ color: 'var(--gold-light)', fontSize: '0.75rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                Buka Backoffice KasirPro <ExternalLink size={12} />
              </a>
            </label>
            <input 
              type="password"
              placeholder="kp_live_0123456789abcdef..."
              value={kasirProKey}
              onChange={(e) => setKasirProKey(e.target.value)}
              className="form-input"
              style={{ fontFamily: 'monospace' }}
            />
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
              Didapat dari: <strong>backoffice.kasirpro.com → API Akses</strong>. Pastikan memilih mode <em>Hanya Baca</em> dengan scope <code>laporan</code> & <code>transaksi</code>.
            </span>
          </div>

          {/* Test Response Message */}
          {kasirProTestMsg && (
            <div style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              marginBottom: '16px',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              background: kasirProTestMsg.success ? 'rgba(46, 196, 182, 0.1)' : 'rgba(231, 111, 81, 0.1)',
              border: `1px solid ${kasirProTestMsg.success ? 'rgba(46, 196, 182, 0.3)' : 'rgba(231, 111, 81, 0.3)'}`,
              color: kasirProTestMsg.success ? 'var(--success)' : 'var(--danger)'
            }}>
              {kasirProTestMsg.success ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span>{kasirProTestMsg.message}</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button 
              type="button" 
              onClick={handleSaveKasirPro}
              className="btn btn-primary"
              style={{ fontSize: '0.86rem' }}
            >
              <Save size={15} />
              <span>Simpan API Key KasirPro</span>
            </button>

            <button 
              type="button" 
              onClick={handleTestKasirPro}
              disabled={isTestingKasirPro || !kasirProKey}
              className="btn btn-secondary"
              style={{ fontSize: '0.86rem' }}
            >
              {isTestingKasirPro ? 'Mengetes Kunci...' : 'Test Koneksi KasirPro'}
            </button>
          </div>
        </div>
        </>
        )}

        {/* Section 4 & 5: File Skrip, Panduan Sistem, & Cache (Kategori System) */}
        {activeCategoryTab === 'system' && (
          <>
            <div className="glass-card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={18} color="var(--burgundy-primary)" />
            <span>Spesifikasi & Panduan Teknis Sistem</span>
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
            <div style={{ background: 'var(--bg-input)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontWeight: 700, color: 'var(--burgundy-primary)', marginBottom: '4px', fontSize: '0.9rem' }}>
                📄 supabase_schema.sql
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                Skema tabel basis data <code>daily_sales</code>, <code>petty_cash_items</code>, dan <code>cafe_users</code>.
              </p>
            </div>

            <div style={{ background: 'var(--bg-input)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontWeight: 700, color: 'var(--info)', marginBottom: '4px', fontSize: '0.9rem' }}>
                📊 google_apps_script.js
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                Skrip Apps Script otomatis untuk mencatat baris omset shift ke spreadsheet.
              </p>
            </div>

            <div style={{ background: 'var(--bg-input)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontWeight: 700, color: 'var(--success)', marginBottom: '4px', fontSize: '0.9rem' }}>
                📖 SETUP_TUTORIAL.md
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                Buku panduan operasional dan deployment sistem kasir Bara Coffee.
              </p>
            </div>
          </div>
        </div>

        {/* Section 5: Pembersihan Cache Browser */}
        <div className="glass-card" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Penyimpanan Cloud Terpadu Aktif
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              Aplikasi terhubung langsung ke database cloud Bara Coffee. Jika ingin menyegarkan cache lokal browser, klik tombol di kanan.
            </p>
          </div>

          <button 
            type="button" 
            onClick={() => {
              clearAllLocalRecords();
              purgeDemoRecords();
              if (onReloadData) onReloadData();
              alert('Cache lokal dibersihkan! Data diambil ulang langsung dari cloud.');
            }}
            className="btn btn-secondary"
            style={{ fontSize: '0.84rem', color: 'var(--warning)' }}
          >
            <RotateCcw size={15} />
            <span>Bersihkan Cache Lokal</span>
          </button>
        </div>
        </>
        )}

        </main>
      </div>

      {/* Modal Tambah Shift Baru */}
      {showAddShiftModal && createPortal(
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          width: '100vw', height: '100vh',
          background: 'rgba(0, 0, 0, 0.78)',
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
          <div className="glass-card animate-fade-in" style={{
            maxWidth: '480px',
            width: '100%',
            margin: 'auto',
            maxHeight: 'min(90vh, calc(100vh - 32px))',
            overflowY: 'auto',
            boxSizing: 'border-box',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            boxShadow: '0 25px 70px rgba(79, 70, 229, 0.15)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(58, 134, 255, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Clock size={18} color="var(--info)" />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)' }}>
                  Tambah Shift Baru
                </h3>
              </div>
              <button onClick={() => setShowAddShiftModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddNewShift} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              <div className="form-group">
                <label className="form-label">Divisi / Grup Shift:</label>
                <select 
                  value={newShiftDivision} 
                  onChange={(e) => setNewShiftDivision(e.target.value)}
                  className="form-input"
                  required
                >
                  <option value="☕ Barista & Kasir (FOH)">☕ Barista & Kasir (FOH)</option>
                  <option value="🥐 Bakery & Pastry (Produksi)">🥐 Bakery & Pastry (Produksi)</option>
                  <option value="🍳 Kitchen & Cook (Hot Food)">🍳 Kitchen & Cook (Hot Food)</option>
                  <option value="⚡ Umum & Fleksibel">⚡ Umum & Fleksibel</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Nama Shift:</label>
                <input 
                  type="text"
                  placeholder="Misal: Shift Malam Weekend, Baking Subuh 2..."
                  value={newShiftName}
                  onChange={(e) => setNewShiftName(e.target.value)}
                  className="form-input"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label className="form-label">Jam Mulai Masuk:</label>
                  <input 
                    type="time"
                    value={newShiftStart}
                    onChange={(e) => setNewShiftStart(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Jam Selesai Shift:</label>
                  <input 
                    type="time"
                    value={newShiftEnd}
                    onChange={(e) => setNewShiftEnd(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <span>Toleransi Keterlambatan (Grace Period):</span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input 
                    type="number"
                    min="0"
                    max="60"
                    value={newShiftGrace}
                    onChange={(e) => setNewShiftGrace(e.target.value)}
                    className="form-input"
                    style={{ width: '100px' }}
                    required
                  />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Menit setelah jam mulai</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button 
                  type="button" 
                  onClick={() => setShowAddShiftModal(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ flex: 1.5, justifyContent: 'center' }}
                >
                  <Plus size={16} />
                  <span>Simpan Shift</span>
                </button>
              </div>

            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
