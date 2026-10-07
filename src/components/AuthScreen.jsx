import React, { useState, useEffect } from 'react';
import { 
  Coffee, 
  Lock, 
  User, 
  KeyRound, 
  UserPlus, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight,
  Briefcase,
  Phone,
  Sparkles,
  X
} from 'lucide-react';
import { 
  loginUser, 
  registerStaffUser, 
  getStaffList, 
  POSITIONS, 
  ROLES 
} from '../lib/auth';
import { getCustomPositions, DEFAULT_POSITIONS } from '../lib/shiftConfigService';

export default function AuthScreen({ onLoginSuccess, timeoutNotification, onClearTimeoutNotification }) {
  const [activeMode, setActiveMode] = useState('login'); // 'login' | 'register'
  const [staffList, setStaffList] = useState([]);
  
  // Login Form States
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Register Form States
  const [positionsList, setPositionsList] = useState(DEFAULT_POSITIONS);
  const [regName, setRegName] = useState('');
  const [regPosition, setRegPosition] = useState('Barista');
  const [regPin, setRegPin] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regError, setRegError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    getStaffList().then(list => {
      setStaffList(list || []);
      // Default identifier to first staff or Owner
      if (list && list.length > 0) {
        setLoginIdentifier(list[0].name);
      }
    });
    getCustomPositions().then(list => {
      if (list && list.length > 0) {
        setPositionsList(list);
        setRegPosition(list[0]);
      }
    });
  }, []);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!loginIdentifier.trim() || !loginPin.trim()) {
      setLoginError('Silakan pilih/isi nama staf dan PIN.');
      return;
    }

    setIsLoggingIn(true);
    setLoginError('');

    try {
      const res = await loginUser(loginIdentifier, loginPin);
      if (res.success) {
        onLoginSuccess(res.user);
      } else {
        setLoginError(res.message);
      }
    } catch (err) {
      setLoginError(`Gagal login: ${err.message}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!regName.trim() || !regPin.trim()) {
      setRegError('Nama lengkap dan PIN wajib diisi.');
      return;
    }

    if (regPin.trim().length < 4) {
      setRegError('PIN minimal 4 digit angka.');
      return;
    }

    setIsRegistering(true);
    setRegError('');

    try {
      const res = await registerStaffUser({
        name: regName,
        position: regPosition,
        pin: regPin,
        phone: regPhone
      });

      if (res.success) {
        onLoginSuccess(res.user);
      } else {
        setRegError(res.message);
      }
    } catch (err) {
      setRegError(`Gagal mendaftar: ${err.message}`);
    } finally {
      setIsRegistering(false);
    }
  };


  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      background: 'radial-gradient(circle at 50% 15%, rgba(79, 70, 229, 0.08) 0%, transparent 60%), var(--bg-deep)'
    }}>
      <div className="glass-card animate-fade-in" style={{
        maxWidth: '460px',
        width: '100%',
        padding: '34px 28px',
        border: '1px solid var(--border-subtle)',
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: '0 20px 50px rgba(79, 70, 229, 0.12)'
      }}>
        
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '26px' }}>
          <div style={{
            width: '76px',
            height: '76px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, #4F46E5 0%, #312E81 100%)',
            border: '2px solid rgba(250, 246, 242, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 14px auto',
            boxShadow: '0 8px 28px rgba(79, 70, 229, 0.35)',
            overflow: 'hidden'
          }}>
            <img 
              src="/logo.png" 
              alt="Bara Coffee Logo" 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            />
          </div>

          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
            BARA COFFEE
          </h1>
          <span style={{
            fontSize: '0.74rem',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'var(--text-primary)',
            fontWeight: 700,
            background: 'var(--burgundy-glow)',
            border: '1px solid rgba(79, 70, 229, 0.3)',
            padding: '3px 12px',
            borderRadius: '12px',
            display: 'inline-block',
            marginTop: '6px'
          }}>
            Bara Coffee & Eatery
          </span>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '8px' }}>
            Sistem Operasional: Kasir, Penjualan, Stok Logistik, Gerobak & Kru
          </p>
        </div>

        {/* Notifikasi Sesi Berakhir Otomatis */}
        {timeoutNotification && (
          <div style={{
            marginBottom: '18px',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px'
          }}>
            <Lock size={18} style={{ color: '#f87171', flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: '#fca5a5', fontSize: '0.86rem', marginBottom: '2px' }}>
                Sesi Anda Berakhir Otomatis
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {timeoutNotification}
              </div>
            </div>
            {onClearTimeoutNotification && (
              <button 
                onClick={onClearTimeoutNotification} 
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                title="Tutup Notifikasi"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {/* Tab Switcher: Login vs Register Kru */}
        <div style={{
          display: 'flex',
          background: 'var(--bg-input)',
          padding: '4px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '22px',
          border: '1px solid var(--border-subtle)'
        }}>
          <button
            type="button"
            onClick={() => { setActiveMode('login'); setLoginError(''); }}
            style={{
              flex: 1,
              padding: '9px',
              border: 'none',
              borderRadius: '8px',
              background: activeMode === 'login' ? 'linear-gradient(135deg, #6366F1, #4F46E5)' : 'transparent',
              color: activeMode === 'login' ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.86rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <KeyRound size={15} />
            <span>Masuk (Login)</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveMode('register'); setRegError(''); }}
            style={{
              flex: 1,
              padding: '9px',
              border: 'none',
              borderRadius: '8px',
              background: activeMode === 'register' ? 'linear-gradient(135deg, #6366F1, #4F46E5)' : 'transparent',
              color: activeMode === 'register' ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.86rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <UserPlus size={15} />
            <span>Daftar Kru Baru</span>
          </button>
        </div>

        {/* MODE 1: LOGIN FORM */}
        {activeMode === 'login' && (
          <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {loginError && (
              <div style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(231, 111, 81, 0.1)',
                border: '1px solid rgba(231, 111, 81, 0.3)',
                color: 'var(--danger)',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={16} />
                <span>{loginError}</span>
              </div>
            )}

            {/* Nama Staf Dropdown */}
            <div className="form-group">
              <label className="form-label">
                <span>Pilih Akun Pengguna:</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {staffList.length} Akun Terdaftar
                </span>
              </label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} />
                <select 
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  className="form-select"
                  style={{ paddingLeft: '38px', fontWeight: 600 }}
                  required
                >
                  <option value="">-- Pilih Akun Anda --</option>
                  {/* Group Owner / Manajemen */}
                  {staffList.filter(u => u.role === ROLES.OWNER || u.role === ROLES.MANAGER).length > 0 && (
                    <optgroup label="Owner & Manajemen">
                      {staffList.filter(u => u.role === ROLES.OWNER || u.role === ROLES.MANAGER).map((u) => (
                        <option key={u.id || u.name} value={u.name}>
                          {u.name} ({u.role === ROLES.OWNER ? 'Owner' : 'Manager'})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {/* Group Kru / Tim Operasional */}
                  {staffList.filter(u => u.role !== ROLES.OWNER && u.role !== ROLES.MANAGER).length > 0 && (
                    <optgroup label="Tim Kru & Staf">
                      {staffList.filter(u => u.role !== ROLES.OWNER && u.role !== ROLES.MANAGER).map((u) => (
                        <option key={u.id || u.name} value={u.name}>
                          {u.name} ({u.position || 'Kru'})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {/* Fallback jika list belum termuat */}
                  {staffList.length === 0 && (
                    <option value="Owner Bara Coffee">Owner Bara Coffee (Owner)</option>
                  )}
                </select>
              </div>
            </div>

            {/* PIN Keamanan */}
            <div className="form-group">
              <label className="form-label">
                <span>PIN Keamanan (Password):</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Masukkan 4 digit PIN akun Anda
                </span>
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="password"
                  placeholder="Masukkan 4 digit PIN..."
                  maxLength={8}
                  value={loginPin}
                  onChange={(e) => setLoginPin(e.target.value)}
                  className="form-input number-field"
                  style={{ paddingLeft: '38px', letterSpacing: '0.2em' }}
                  required
                />
              </div>
            </div>

            {/* Submit Button */}
            <button 
              type="submit" 
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', fontSize: '0.95rem', marginTop: '6px' }}
              disabled={isLoggingIn}
            >
              {isLoggingIn ? 'Memeriksa Kredensial...' : 'Masuk ke Aplikasi Bara Coffee'}
              <ArrowRight size={16} />
            </button>

          </form>
        )}

        {/* MODE 2: REGISTER KRU BARU */}
        {activeMode === 'register' && (
          <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            
            <div style={{ background: 'var(--gold-glow)', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-hover)', fontSize: '0.8rem', color: 'var(--gold-light)' }}>
              👋 <strong>Pendaftaran Kru Baru:</strong> Akun yang Anda buat langsung tersimpan ke database cafe dan siap digunakan untuk input omset & absensi.
            </div>

            {regError && (
              <div style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(231, 111, 81, 0.1)',
                border: '1px solid rgba(231, 111, 81, 0.3)',
                color: 'var(--danger)',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={16} />
                <span>{regError}</span>
              </div>
            )}

            {/* Nama Lengkap */}
            <div className="form-group">
              <label className="form-label">
                <span>Nama Lengkap Staf:</span>
              </label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="text"
                  placeholder="Contoh: Rina Wijaya"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: '38px' }}
                  required
                />
              </div>
            </div>

            {/* Posisi / Jabatan */}
            <div className="form-group">
              <label className="form-label">
                <span>Posisi / Tugas di Cafe:</span>
              </label>
              <div style={{ position: 'relative' }}>
                <Briefcase size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <select
                  value={regPosition}
                  onChange={(e) => setRegPosition(e.target.value)}
                  className="form-select"
                  style={{ paddingLeft: '38px' }}
                >
                  {positionsList.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Buat PIN */}
            <div className="form-group">
              <label className="form-label">
                <span>Buat 4 Digit PIN Pribadi:</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Digunakan untuk login shift</span>
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="password"
                  placeholder="Contoh: 5678"
                  maxLength={6}
                  value={regPin}
                  onChange={(e) => setRegPin(e.target.value.replace(/\D/g, ''))}
                  className="form-input number-field"
                  style={{ paddingLeft: '38px', letterSpacing: '0.2em' }}
                  required
                />
              </div>
            </div>

            {/* Nomor WhatsApp (Opsional) */}
            <div className="form-group">
              <label className="form-label">
                <span>No. WhatsApp (Opsional):</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Untuk slip gaji</span>
              </label>
              <div style={{ position: 'relative' }}>
                <Phone size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="tel"
                  placeholder="08xxxxxxxxxx"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: '38px' }}
                />
              </div>
            </div>

            {/* Tombol Buat Akun */}
            <button 
              type="submit" 
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', fontSize: '0.95rem', marginTop: '6px' }}
              disabled={isRegistering}
            >
              {isRegistering ? 'Mendaftarkan Akun ke Database...' : 'Daftar & Langsung Masuk'}
              <Sparkles size={16} />
            </button>

          </form>
        )}

      </div>
    </div>
  );
}
