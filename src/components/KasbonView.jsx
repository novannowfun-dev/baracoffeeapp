import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  CreditCard, Plus, RefreshCw, CheckCircle2, 
  Search, Users, ArrowDownRight, ArrowUpRight, ShieldCheck, 
  Trash2, X, Wallet, CheckCircle, AlertTriangle 
} from 'lucide-react';
import { getKasbonList, addKasbonRecord, deleteKasbonRecord, computeStaffKasbonSummary } from '../lib/kasbonService';
import { getStaffList } from '../lib/auth';
import { formatRupiah } from '../lib/formatters';

export default function KasbonView({ currentUser, activeOutlet }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [staffList, setStaffList] = useState([]);
  const [activeTab, setActiveTab] = useState('summary');
  const [searchTerm, setSearchTerm] = useState('');
  const [outletFilter, setOutletFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [form, setForm] = useState({
    staff_name: '',
    outlet: activeOutlet || 'kedai',
    type: 'kasbon', // 'kasbon', 'pinjaman', or 'cicilan'
    tenor_months: '12',
    amount: '',
    notes: '',
    entry_date: new Date().toISOString().split('T')[0]
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [kData, sData] = await Promise.all([getKasbonList(), getStaffList()]);
      setRecords(kData || []);
      setStaffList(sData || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const summaries = useMemo(() => computeStaffKasbonSummary(records), [records]);

  const stats = useMemo(() => {
    const totalOutstanding = summaries.reduce((acc, s) => acc + (s.sisaHutang > 0 ? s.sisaHutang : 0), 0);
    const totalPinjamanAll = records.filter(r => r.type === 'kasbon' || r.type === 'pinjaman').reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
    const totalCicilanAll = records.filter(r => r.type === 'cicilan').reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
    const totalKruBerhutang = summaries.filter(s => s.sisaHutang > 0).length;
    return { totalOutstanding, totalPinjamanAll, totalCicilanAll, totalKruBerhutang };
  }, [summaries, records]);

  const filteredSummaries = useMemo(() => {
    return summaries.filter(s => {
      const matchSearch = !searchTerm || s.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === 'ALL' || (statusFilter === 'unpaid' ? s.sisaHutang > 0 : s.sisaHutang <= 0);
      return matchSearch && matchStatus;
    });
  }, [summaries, searchTerm, statusFilter]);

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const searchLower = searchTerm.toLowerCase();
      const matchSearch = !searchTerm || 
        r.staff_name.toLowerCase().includes(searchLower) ||
        (r.notes && r.notes.toLowerCase().includes(searchLower));
      const isGerobak = String(r.outlet || '').toLowerCase().includes('gerobak');
      const matchOutlet = outletFilter === 'ALL' || (outletFilter === 'gerobak' ? isGerobak : !isGerobak);
      return matchSearch && matchOutlet;
    });
  }, [records, searchTerm, outletFilter]);

  const handleDelete = async (recId, name, amt, type) => {
    if (!confirm('Hapus transaksi ' + (type === 'kasbon' ? 'kasbon' : type === 'pinjaman' ? 'pinjaman berjangka' : 'cicilan') + ' ' + formatRupiah(amt) + ' atas nama ' + name + '? Saldo hutang akan dihitung ulang.')) return;
    try {
      await deleteKasbonRecord(recId);
      await loadData();
      setFeedback({ type: 'success', msg: 'Transaksi berhasil dihapus.' });
    } catch (err) {
      alert('Gagal menghapus: ' + err.message);
    }
  };

  const handleQuickPay = (staffName, sisaHutang) => {
    setForm({
      staff_name: staffName,
      outlet: activeOutlet || 'kedai',
      type: 'cicilan',
      amount: sisaHutang > 0 ? sisaHutang : '',
      notes: 'Pelunasan Kasbon',
      entry_date: new Date().toISOString().split('T')[0]
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.staff_name || !form.amount || Number(form.amount) <= 0) {
      alert('Nama kru dan nominal wajib diisi!');
      return;
    }

    setSubmitting(true);
    try {
      const numAmt = Number(form.amount) || 0;
      const tenor = (form.type === 'pinjaman') ? (Number(form.tenor_months) || 12) : 1;
      const monthly = (form.type === 'pinjaman') ? Math.round(numAmt / tenor) : numAmt;
      const saved = await addKasbonRecord({
        ...form,
        amount: numAmt,
        tenor_months: tenor,
        monthly_installment: monthly,
        approved_by: currentUser?.name || 'Owner'
      });

      if (saved.tableMissing) {
        setFeedback({ 
          type: 'warning', 
          msg: `Tersimpan di aplikasi! Namun tabel 'staff_kasbon' belum ada di Supabase. Jalankan query SQL di supabase_schema.sql.` 
        });
      } else if (saved.supabaseWarning) {
        setFeedback({ 
          type: 'warning', 
          msg: `Tersimpan secara lokal. Catatan Supabase: ${saved.supabaseWarning}` 
        });
      } else {
        const jenisTxt = form.type === 'pinjaman' ? 'Pinjaman Berjangka' : form.type === 'kasbon' ? 'Kasbon Singkat' : 'Cicilan';
        setFeedback({ type: 'success', msg: `Berhasil mencatat ${jenisTxt} untuk ${form.staff_name}` });
      }

      setShowModal(false);
      setForm({
        staff_name: '',
        outlet: activeOutlet || 'kedai',
        type: 'kasbon',
        tenor_months: '12',
        amount: '',
        notes: '',
        entry_date: new Date().toISOString().split('T')[0]
      });
      await loadData();
    } catch (err) {
      setFeedback({ type: 'error', msg: 'Gagal mencatat kasbon: ' + err.message });
    } finally {
      setSubmitting(false);
    }
  };

    return (
    <div className='view-container'>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '22px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)' }}>
              <CreditCard size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Kasbon & Cicilan Kru
                </h2>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: '#EEF2FF', color: '#4338CA', border: '1px solid #C7D2FE' }}>
                  Kedai & Gerobak
                </span>
              </div>
              <p style={{ margin: '3px 0 0 0', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                Pencatatan pinjaman darurat dan pelunasan cicilan operasional kru Bara Coffee
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button type='button' className='btn btn-secondary' onClick={loadData} style={{ height: '40px', padding: '0 14px' }} title='Refresh Data'>
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span>Segarkan</span>
          </button>

          <button type='button' className='btn btn-primary' onClick={() => {
            setForm({ staff_name: '', outlet: activeOutlet || 'kedai', type: 'kasbon', amount: '', notes: '', entry_date: new Date().toISOString().split('T')[0] });
            setShowModal(true);
          }} style={{ height: '40px', padding: '0 16px' }}>
            <Plus size={16} />
            <span>Catat Kasbon / Cicilan</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className={'alert-banner alert-' + feedback.type} style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} />
            <span>{feedback.msg}</span>
          </div>
          <button onClick={() => setFeedback(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>✕</button>
        </div>
      )}

      {/* KPI Stats Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        <div className='glass-card' style={{ padding: '16px 20px', borderLeft: '4px solid #ef4444' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Sisa Kasbon Aktif</span>
          <h3 style={{ margin: '6px 0 0 0', fontSize: '1.5rem', fontWeight: 800, color: '#DC2626' }}>
            {formatRupiah(stats.totalOutstanding)}
          </h3>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
            Dari {stats.totalKruBerhutang} kru yang masih memiliki sisa hutang
          </span>
        </div>

        <div className='glass-card' style={{ padding: '16px 20px', borderLeft: '4px solid #4F46E5' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Akumulasi Pinjaman</span>
          <h3 style={{ margin: '6px 0 0 0', fontSize: '1.5rem', fontWeight: 800, color: '#1E293B' }}>
            {formatRupiah(stats.totalPinjamanAll)}
          </h3>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
            Total seluruh kasbon yang pernah dikeluarkan
          </span>
        </div>

        <div className='glass-card' style={{ padding: '16px 20px', borderLeft: '4px solid #10b981' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Sudah Terbayar / Cicil</span>
          <h3 style={{ margin: '6px 0 0 0', fontSize: '1.5rem', fontWeight: 800, color: '#059669' }}>
            {formatRupiah(stats.totalCicilanAll)}
          </h3>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
            Total dana kasbon yang sudah dikembalikan
          </span>
        </div>

        <div className='glass-card' style={{ padding: '16px 20px', borderLeft: '4px solid #6366F1' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Kru Berkasbon</span>
          <h3 style={{ margin: '6px 0 0 0', fontSize: '1.5rem', fontWeight: 800, color: '#4338CA' }}>
            {stats.totalKruBerhutang} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Orang</span>
          </h3>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
            Dari total {summaries.length} kru terdaftar
          </span>
        </div>
      </div>

      {/* Main Container */ }
      <div className='glass-card' style={{ padding: '22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '18px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-input)', padding: '5px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
            <button type='button' className={'btn ' + (activeTab === 'summary' ? 'btn-primary' : 'btn-ghost')} style={{ fontSize: '0.84rem', padding: '6px 14px', borderRadius: '8px' }} onClick={() => setActiveTab('summary')}>
              <Users size={15} />
              <span>Rekap per Kru</span>
            </button>
            <button type='button' className={'btn ' + (activeTab === 'history' ? 'btn-primary' : 'btn-ghost')} style={{ fontSize: '0.84rem', padding: '6px 14px', borderRadius: '8px' }} onClick={() => setActiveTab('history')}>
              <CreditCard size={15} />
              <span>Jurnal Transaksi ({records.length})</span>
            </button>
          </div>

          <div style={{ display: 'flex', gap: '10px', flex: '1', maxWidth: '420px', minWidth: '260px' }}>
            <div style={{ position: 'relative', flex: '1' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input type='text' className='form-input' style={{ paddingLeft: '36px', margin: 0, height: '38px', fontSize: '0.86rem' }} placeholder='Cari nama kru atau catatan...' value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>

            {activeTab === 'summary' ? (
              <select className='form-input' style={{ width: 'auto', minWidth: '130px', margin: 0, height: '38px', fontSize: '0.84rem' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value='ALL'>Semua Status</option>
                <option value='unpaid'>Belum Lunas</option>
                <option value='paid'>Lunas</option>
              </select>
            ) : (
              <select className='form-input' style={{ width: 'auto', minWidth: '130px', margin: 0, height: '38px', fontSize: '0.84rem' }} value={outletFilter} onChange={e => setOutletFilter(e.target.value)}>
                <option value='ALL'>Semua Outlet</option>
                <option value='kedai'>Kedai Utama</option>
                <option value='gerobak'>Gerobak Bara</option>
              </select>
            )}
          </div>
        </div>

        {/* TAB 1: REKAP PER KRU */}
        {activeTab === 'summary' && (
          <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-input)', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '12px 14px' }}>Nama Kru</th>
                  <th style={{ padding: '12px 14px' }}>Total Pinjaman</th>
                  <th style={{ padding: '12px 14px' }}>Sudah Dicicil</th>
                  <th style={{ padding: '12px 14px' }}>Sisa Hutang Kasbon</th>
                  <th style={{ padding: '12px 14px' }}>Status & Progress Pinjaman</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredSummaries.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      <Users size={36} style={{ margin: '0 auto 8px auto', opacity: 0.3 }} />
                      <div>Belum ada data rekapan kasbon kru.</div>
                    </td>
                  </tr>
                ) : (
                  filteredSummaries.map((s, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)', background: s.sisaHutang > 0 ? 'rgba(239, 68, 68, 0.02)' : 'transparent' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#EEF2FF', color: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 800 }}>
                            {s.name.charAt(0).toUpperCase()}
                          </span>
                          <span>{s.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', color: '#475569', fontWeight: 600 }}>{formatRupiah(s.totalPinjaman)}</td>
                      <td style={{ padding: '12px 14px', color: '#059669', fontWeight: 600 }}>{formatRupiah(s.totalCicilan)}</td>
                      <td style={{ padding: '12px 14px', fontWeight: 800, fontSize: '0.94rem', color: s.sisaHutang > 0 ? '#DC2626' : '#059669' }}>
                        {formatRupiah(s.sisaHutang)}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        {s.sisaHutang > 0 ? (
                          <div>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 9px', borderRadius: '12px', fontSize: '0.74rem', fontWeight: 800, background: 'rgba(239, 68, 68, 0.12)', color: '#DC2626' }}>
                              <AlertTriangle size={12} /> Belum Lunas
                            </span>
                            {s.activeLoan && (
                              <div style={{ marginTop: '4px', fontSize: '0.72rem', color: '#4f46e5', fontWeight: 700 }}>
                                Cicilan ke-{s.paidInstallmentCount} dari {s.activeLoan.tenor_months} bln
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 9px', borderRadius: '12px', fontSize: '0.74rem', fontWeight: 800, background: 'rgba(16, 185, 129, 0.12)', color: '#059669' }}>
                            <CheckCircle size={12} /> Lunas
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        {s.sisaHutang > 0 ? (
                          <button type='button' onClick={() => handleQuickPay(s.name, s.sisaHutang)} className='btn btn-ghost' style={{ padding: '5px 12px', borderRadius: '8px', background: '#EEF2FF', color: '#4338CA', fontSize: '0.78rem', fontWeight: 700 }}>
                            + Bayar Cicilan
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: JURNAL TRANSAKSI */}
        {activeTab === 'history' && (
          <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-input)', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '12px 14px' }}>Tanggal</th>
                  <th style={{ padding: '12px 14px' }}>Nama Kru</th>
                  <th style={{ padding: '12px 14px' }}>Outlet</th>
                  <th style={{ padding: '12px 14px' }}>Jenis Transaksi</th>
                  <th style={{ padding: '12px 14px' }}>Nominal</th>
                  <th style={{ padding: '12px 14px' }}>Keterangan</th>
                  <th style={{ padding: '12px 14px' }}>Disetujui Oleh</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      Belum ada riwayat transaksi kasbon.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((r) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>{r.entry_date}</td>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-primary)' }}>{r.staff_name}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 700, background: r.outlet === 'gerobak' ? '#FEF3C7' : '#EEF2FF', color: r.outlet === 'gerobak' ? '#B45309' : '#4338CA' }}>
                          {r.outlet === 'gerobak' ? 'Gerobak Bara' : 'Kedai Utama'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '4px', 
                          padding: '3px 8px', 
                          borderRadius: '10px', 
                          fontSize: '0.74rem', 
                          fontWeight: 800, 
                          background: r.type === 'pinjaman' 
                            ? 'rgba(79, 70, 229, 0.12)' 
                            : (r.type === 'kasbon' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)'), 
                          color: r.type === 'pinjaman' 
                            ? '#4F46E5' 
                            : (r.type === 'kasbon' ? '#DC2626' : '#059669') 
                        }}>
                          {r.type === 'cicilan' ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                          {r.type === 'pinjaman' ? `PINJAMAN (${r.tenor_months || 12} BLN)` : (r.type === 'kasbon' ? 'PINJAM (KASBON)' : 'BAYAR (CICILAN)')}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 800, color: (r.type === 'kasbon' || r.type === 'pinjaman') ? '#DC2626' : '#059669' }}>
                        {formatRupiah(r.amount)}
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>{r.notes || '-'}</td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>{r.approved_by || 'Owner'}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <button type='button' onClick={() => handleDelete(r.id, r.staff_name, r.amount, r.type)} className='btn btn-ghost' style={{ padding: '4px 8px', color: '#94A3B8' }} title='Hapus baris transaksi' onMouseOver={e => e.currentTarget.style.color = '#ef4444'} onMouseOut={e => e.currentTarget.style.color = '#94A3B8'}>
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* POPUP MODAL INPUT KASBON / CICILAN VIA CREATEPORTAL */}
      {showModal && createPortal(
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '16px'
        }}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: '20px',
            border: '1px solid var(--border-hover)',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.25)',
            maxWidth: '460px',
            width: '100%',
            padding: '24px',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Wallet size={20} color='#4F46E5' />
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {form.type === 'kasbon' ? 'Form Kasbon Kru (Pinjam)' : 'Form Pembayaran Cicilan'}
                </h3>
              </div>
              <button type='button' className='btn btn-ghost' onClick={() => setShowModal(false)} style={{ padding: '4px 8px', borderRadius: '50%' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className='form-group' style={{ margin: 0 }}>
                <label className='form-label'>Jenis Transaksi</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: '6px' }}>
                  <button type='button' onClick={() => setForm({ ...form, type: 'kasbon' })} className={'btn ' + (form.type === 'kasbon' ? 'btn-primary' : 'btn-secondary')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '8px 4px', borderRadius: '8px', fontWeight: 700, fontSize: '0.78rem' }}>
                    <ArrowDownRight size={14} />
                    <span>Kasbon Singkat</span>
                  </button>
                  <button type='button' onClick={() => setForm({ ...form, type: 'pinjaman' })} className={'btn ' + (form.type === 'pinjaman' ? 'btn-primary' : 'btn-secondary')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '8px 4px', borderRadius: '8px', fontWeight: 700, fontSize: '0.78rem', background: form.type === 'pinjaman' ? 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)' : undefined }}>
                    <Wallet size={14} />
                    <span>Pinjaman Berjangka</span>
                  </button>
                  <button type='button' onClick={() => setForm({ ...form, type: 'cicilan' })} className={'btn ' + (form.type === 'cicilan' ? 'btn-primary' : 'btn-secondary')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '8px 4px', borderRadius: '8px', fontWeight: 700, fontSize: '0.78rem' }}>
                    <ArrowUpRight size={14} />
                    <span>Cicilan (Bayar)</span>
                  </button>
                </div>
              </div>

              <div className='form-group' style={{ margin: 0 }}>
                <label className='form-label'>Nama Kru</label>
                {staffList.length > 0 ? (
                  <select className='form-input' required value={form.staff_name} onChange={e => setForm({ ...form, staff_name: e.target.value })}>
                    <option value=''>-- Pilih Kru Bara Coffee --</option>
                    {staffList.map((s, idx) => (
                      <option key={idx} value={s.name}>{s.name} ({s.position || 'Kru'})</option>
                    ))}
                  </select>
                ) : (
                  <input type='text' required className='form-input' placeholder='Ketik nama kru...' value={form.staff_name} onChange={e => setForm({ ...form, staff_name: e.target.value })} />
                )}
              </div>

              <div className='form-group' style={{ margin: 0 }}>
                <label className='form-label'>Unit / Outlet</label>
                <select className='form-input' value={form.outlet} onChange={e => setForm({ ...form, outlet: e.target.value })}>
                  <option value='kedai'>Kedai Utama</option>
                  <option value='gerobak'>Gerobak Bara</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
                <div className='form-group' style={{ margin: 0 }}>
                  <label className='form-label'>Nominal (Rp)</label>
                  <input type='number' required step='1000' min='1000' className='form-input' placeholder='Contoh: 5000000' value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
                </div>
                <div className='form-group' style={{ margin: 0 }}>
                  <label className='form-label'>Tanggal</label>
                  <input type='date' required className='form-input' value={form.entry_date} onChange={e => setForm({ ...form, entry_date: e.target.value })} />
                </div>
              </div>

              {form.type === 'pinjaman' && (
                <div style={{ padding: '12px 14px', borderRadius: '8px', background: 'rgba(79, 70, 229, 0.08)', border: '1px solid rgba(79, 70, 229, 0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--burgundy-primary)' }}>Durasi Cicilan (Tenor Bulan):</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Misal: 12 Bulan (1 Tahun)</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '8px' }}>
                    {['3', '6', '10', '12'].map(t => (
                      <button
                        key={t}
                        type='button'
                        onClick={() => setForm({ ...form, tenor_months: t })}
                        className={'btn ' + (form.tenor_months === t ? 'btn-primary' : 'btn-secondary')}
                        style={{ fontSize: '0.75rem', padding: '6px' }}
                      >
                        {t} Bulan
                      </button>
                    ))}
                  </div>
                  {Number(form.amount) > 0 && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Potongan Otomatis Gaji: <strong style={{ color: 'var(--burgundy-primary)' }}>{formatRupiah(Math.round(Number(form.amount) / (Number(form.tenor_months) || 12)))}</strong> / bulan
                    </div>
                  )}
                </div>
              )}

              <div className='form-group' style={{ margin: 0 }}>
                <label className='form-label'>Keterangan / Keperluan</label>
                <input type='text' className='form-input' placeholder='Contoh: Keperluan darurat keluarga / Potong gaji' value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                <button type='button' className='btn btn-secondary' onClick={() => setShowModal(false)}>Batal</button>
                <button type='submit' disabled={submitting} className='btn btn-primary'>
                  {submitting ? 'Menyimpan...' : (form.type === 'kasbon' ? 'Simpan Kasbon' : 'Simpan Pembayaran')}
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