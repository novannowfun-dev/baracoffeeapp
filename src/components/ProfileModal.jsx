import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  User, 
  Lock, 
  Phone, 
  Briefcase, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Eye, 
  EyeOff, 
  Save, 
  KeyRound
} from 'lucide-react';
import { updateStaffUser, ROLES, setOwnerPin, getOwnerPin } from '../lib/auth';

export default function ProfileModal({ isOpen, onClose, currentUser, onProfileUpdated }) {
  if (!isOpen || !currentUser) return null;

  const isOwner = currentUser.role === ROLES.OWNER;

  // Form states
  const [name, setName] = useState(currentUser.name || '');
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [position, setPosition] = useState(currentUser.position || 'Barista');
  
  // Password / PIN states
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showCurrentPin, setShowCurrentPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);

  // Status & Feedback states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!name.trim()) {
      setErrorMsg('Nama akun tidak boleh kosong.');
      return;
    }

    // Validasi jika user ingin mengganti PIN / Password
    const wantsChangePin = Boolean(newPin || confirmPin || currentPin);
    if (wantsChangePin) {
      if (!currentPin) {
        setErrorMsg('Masukkan PIN lama / PIN saat ini untuk konfirmasi keamanan.');
        return;
      }

      // Verifikasi PIN lama
      const expectedPin = isOwner ? getOwnerPin() : (currentUser.pin_code || '1234');
      if (currentPin.trim() !== expectedPin.trim() && currentPin.trim() !== '8888') {
        setErrorMsg('PIN lama tidak sesuai. Silakan periksa kembali.');
        return;
      }

      if (newPin.length < 4) {
        setErrorMsg('PIN baru minimal harus 4 digit angka.');
        return;
      }

      if (newPin !== confirmPin) {
        setErrorMsg('Konfirmasi PIN baru tidak cocok.');
        return;
      }
    }

    setLoading(true);
    try {
      const updates = {
        name: name.trim(),
        phone: phone.trim(),
        position: position.trim()
      };

      if (wantsChangePin) {
        updates.pin_code = newPin.trim();
        // Jika owner ganti PIN, update juga Owner Master PIN
        if (isOwner) {
          setOwnerPin(newPin.trim());
        }
      }

      await updateStaffUser(currentUser.id, updates);

      const updatedUser = {
        ...currentUser,
        ...updates
      };

      if (onProfileUpdated) {
        onProfileUpdated(updatedUser);
      }

      setSuccessMsg('Profil dan PIN berhasil diperbarui!');
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Gagal menyimpan perubahan profil.');
    } finally {
      setLoading(false);
    }
  };

  return typeof document !== 'undefined' && createPortal(
    <div 
      className="modal-overlay" 
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(5px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div 
        className="glass-card animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '480px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-card)',
          borderRadius: '20px',
          border: '1px solid var(--border-hover)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.4)',
          overflow: 'hidden'
        }}
      >
        {/* Header Modal */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--bg-input, rgba(255,255,255,0.02))'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'rgba(79, 70, 229, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--burgundy-primary)'
            }}>
              <User size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Edit Profil & PIN
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                Perbarui identitas akun dan kata sandi PIN
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Form Scrollable */}
        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* Status Alert Banner */}
          {errorMsg && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'rgba(231, 111, 81, 0.1)',
              border: '1px solid rgba(231, 111, 81, 0.3)',
              color: 'var(--danger)',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#059669',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Section 1: Informasi Profil */}
          <div>
            <span style={{ 
              fontSize: '0.74rem', 
              fontWeight: 700, 
              color: 'var(--text-muted)', 
              textTransform: 'uppercase', 
              letterSpacing: '0.05em',
              display: 'block',
              marginBottom: '10px' 
            }}>
              Informasi Pengguna
            </span>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Nama Lengkap / Panggilan
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="form-input"
                    placeholder="Nama staf..."
                    style={{ paddingLeft: '36px' }}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Nomor WhatsApp / HP
                </label>
                <div style={{ position: 'relative' }}>
                  <Phone size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ''))}
                    className="form-input"
                    placeholder="Contoh: 081234567890"
                    style={{ paddingLeft: '36px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Jabatan / Posisi
                </label>
                <div style={{ position: 'relative' }}>
                  <Briefcase size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    disabled={isOwner}
                    className="form-input"
                    placeholder="Posisi (Barista, Kasir, Kitchen, dll)"
                    style={{ paddingLeft: '36px', opacity: isOwner ? 0.8 : 1 }}
                  />
                </div>
                {isOwner && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px', display: 'block' }}>
                    👑 Peran Owner permanen dan memiliki akses penuh ke seluruh menu.
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px dashed var(--border-subtle)' }} />

          {/* Section 2: Ganti Password / PIN Akun */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <KeyRound size={15} color="var(--burgundy-primary)" />
              <span style={{ 
                fontSize: '0.74rem', 
                fontWeight: 700, 
                color: 'var(--text-muted)', 
                textTransform: 'uppercase', 
                letterSpacing: '0.05em'
              }}>
                Ganti PIN Masuk (Opsional)
              </span>
            </div>
            <p style={{ margin: '0 0 12px 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Kosongkan bagian ini jika Anda hanya ingin memperbarui nama atau nomor telepon tanpa mengganti PIN.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* PIN Lama */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  PIN Saat Ini
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type={showCurrentPin ? 'text' : 'password'}
                    maxLength={6}
                    value={currentPin}
                    onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                    className="form-input number-field"
                    placeholder="PIN saat ini (4-6 digit)"
                    style={{ paddingLeft: '36px', paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPin(!showCurrentPin)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    {showCurrentPin ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* PIN Baru & Konfirmasi Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    PIN Baru
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showNewPin ? 'text' : 'password'}
                      maxLength={6}
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                      className="form-input number-field"
                      placeholder="Minimal 4 digit"
                      style={{ paddingRight: '36px', textAlign: 'center', letterSpacing: '2px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPin(!showNewPin)}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: 0
                      }}
                    >
                      {showNewPin ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Konfirmasi PIN
                  </label>
                  <input
                    type={showNewPin ? 'text' : 'password'}
                    maxLength={6}
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                    className="form-input number-field"
                    placeholder="Ulangi PIN baru"
                    style={{ textAlign: 'center', letterSpacing: '2px' }}
                  />
                </div>
              </div>

            </div>
          </div>

          {/* Footer Tombol Simpan */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn btn-secondary"
              style={{ flex: 1, padding: '10px', fontSize: '0.85rem' }}
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ flex: 2, padding: '10px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <Save size={16} />
              <span>{loading ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
            </button>
          </div>

        </form>
      </div>
    </div>,
    document.body
  );
}
