import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Lock, ShieldCheck, X, AlertCircle, KeyRound } from 'lucide-react';
import { getOwnerPin, setCurrentUser, ROLES } from '../lib/auth';

export default function PinModal({ isOpen, onClose, onSuccess, targetActionName = 'Akses Menu Owner' }) {
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleVerify = (e) => {
    e?.preventDefault();
    const correctPin = getOwnerPin();

    if (pin.trim() === correctPin.trim()) {
      setErrorMsg('');
      setPin('');
      // Set active user as Owner
      setCurrentUser({
        id: 'usr-owner',
        name: 'Owner Bara Coffee',
        role: ROLES.OWNER
      });
      onSuccess();
    } else {
      setErrorMsg('PIN yang Anda masukkan salah. (Default: 8888)');
      setPin('');
    }
  };

  const handleQuickKey = (num) => {
    if (pin.length < 6) {
      const nextPin = pin + num;
      setPin(nextPin);
      if (nextPin.length === getOwnerPin().length) {
        if (nextPin === getOwnerPin()) {
          setCurrentUser({
            id: 'usr-owner',
            name: 'Owner Bara Coffee',
            role: ROLES.OWNER
          });
          onSuccess();
        } else {
          setErrorMsg('PIN salah. Coba lagi.');
          setPin('');
        }
      }
    }
  };

  return createPortal(
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '16px',
      overflowY: 'auto',
      boxSizing: 'border-box'
    }}>
      <div className="glass-card animate-fade-in" style={{
        maxWidth: '380px',
        width: '100%',
        margin: 'auto',
        maxHeight: 'min(90vh, calc(100vh - 32px))',
        overflowY: 'auto',
        boxSizing: 'border-box',
        padding: '28px',
        textAlign: 'center',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        position: 'relative',
        boxShadow: '0 25px 70px rgba(79, 70, 229, 0.15)'
      }}>
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer'
          }}
        >
          <X size={18} />
        </button>

        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'var(--burgundy-subtle)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px auto'
        }}>
          <Lock size={26} color="var(--burgundy-primary)" />
        </div>

        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
          PIN Keamanan Owner
        </h3>
        
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
          Masukkan PIN Owner untuk mengakses {targetActionName}.
        </p>

        {/* PIN Dots Display */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}>
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              style={{
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                background: idx < pin.length ? 'var(--gold-light)' : 'var(--bg-input)',
                border: `1.5px solid ${idx < pin.length ? 'var(--gold-primary)' : 'var(--border-subtle)'}`,
                transition: 'all 0.2s ease'
              }}
            />
          ))}
        </div>

        {errorMsg && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: 'var(--danger)', fontSize: '0.8rem', marginBottom: '16px' }}>
            <AlertCircle size={14} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Keypad */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '18px' }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleQuickKey(digit)}
              style={{
                padding: '12px',
                fontSize: '1.2rem',
                fontWeight: 700,
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)'
              }}
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPin('')}
            style={{
              padding: '12px',
              fontSize: '0.8rem',
              fontWeight: 600,
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-card)',
              color: 'var(--danger)',
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer'
            }}
          >
            Hapus
          </button>
          <button
            type="button"
            onClick={() => handleQuickKey('0')}
            style={{
              padding: '12px',
              fontSize: '1.2rem',
              fontWeight: 700,
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)'
            }}
          >
            0
          </button>
          <button
            type="button"
            onClick={handleVerify}
            style={{
              padding: '12px',
              fontSize: '0.82rem',
              fontWeight: 700,
              borderRadius: 'var(--radius-md)',
              background: 'var(--gold-glow)',
              color: 'var(--gold-light)',
              border: '1px solid var(--border-hover)',
              cursor: 'pointer'
            }}
          >
            OK
          </button>
        </div>

        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          PIN Default: <code>8888</code> (Dapat diubah di menu Pengaturan)
        </div>

      </div>
    </div>,
    document.body
  );
}
