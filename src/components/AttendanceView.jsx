import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Plus,
  Search,
  UserCheck,
  LogIn,
  LogOut,
  Sparkles,
  Coffee,
  CheckSquare,
  Square,
  ShieldCheck,
  ShieldAlert,
  FileText,
  Trash2,
  Edit3,
  Download,
  X,
  Info,
  ChevronRight,
  ArrowRight,
  Printer,
  Award,
  Trophy,
  Star,
  TrendingUp,
  Eye,
  User,
  Check,
  Percent,
  Camera,
  Upload,
  RefreshCw
} from 'lucide-react';
import { formatDateID } from '../lib/formatters';
import { getSupabaseClient, getSupabaseConfig } from '../lib/supabase';
import { getStaffList, ROLES } from '../lib/auth';
import {
  getAttendanceRecords,
  saveClockInRecord,
  updateClockOutRecord,
  saveLeaveRecord,
  deleteAttendanceRecord,
  syncPendingAttendance
} from '../lib/attendanceService';
import {
  getCustomShifts,
  getCustomPositions,
  DEFAULT_SHIFTS,
  DEFAULT_POSITIONS,
  evaluatePunctualityWithGrace,
  getStationFromRole,
  getAutoShiftForPosition,
  getStationForShift
} from '../lib/shiftConfigService';

export const DIVISION_SHIFTS = DEFAULT_SHIFTS;

export default function AttendanceView({ currentUser }) {
  const isOwner = currentUser?.role === ROLES.OWNER || currentUser?.role === ROLES.MANAGER;
  const [records, setRecords] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [availableShifts, setAvailableShifts] = useState(DEFAULT_SHIFTS);
  const [availablePositions, setAvailablePositions] = useState(DEFAULT_POSITIONS);
  const [loading, setLoading] = useState(true);

  // Live Clock
  const [currentTime, setCurrentTime] = useState(new Date());

  // Filter States
  const [filterDate, setFilterDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [filterShift, setFilterShift] = useState('Semua');
  const [filterStatus, setFilterStatus] = useState('Semua');
  const [searchStaff, setSearchStaff] = useState('');

  // Sub-Tab Switcher State: 'daily' (Presensi Harian) | 'appraisal' (Rapor Penilaian Bulanan Kru)
  const [attendanceSubTab, setAttendanceSubTab] = useState('daily');
  const [selectedAppraisalMonth, setSelectedAppraisalMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedAppraisalStaff, setSelectedAppraisalStaff] = useState(null);
  const [searchAppraisalStaff, setSearchAppraisalStaff] = useState('');
  const [filterAppraisalGrade, setFilterAppraisalGrade] = useState('Semua');
  const [sortAppraisalBy, setSortAppraisalBy] = useState('score_desc');

  // Modals
  const [showClockInModal, setShowClockInModal] = useState(false);
  const [showClockOutModal, setShowClockOutModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [selectedRecordDetail, setSelectedRecordDetail] = useState(null);

  // Form Clock In
  const [inStaffName, setInStaffName] = useState(currentUser?.name || '');
  const [inShift, setInShift] = useState('barista_pagi');
  const [inPosition, setInPosition] = useState(currentUser?.position || 'Barista');
  const [inLateReason, setInLateReason] = useState('');
  const [inNotes, setInNotes] = useState('');
  const [inSelfie, setInSelfie] = useState(null);
  const [outSelfie, setOutSelfie] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = React.useRef(null);
  const streamRef = React.useRef(null);
  const [inChecklist, setInChecklist] = useState({
    uniform: true,
    grooming: true,
    healthy: true
  });

  // Form Clock Out
  const [outRecordId, setOutRecordId] = useState(null);
  const [outTime, setOutTime] = useState('');
  const [outOvertime, setOutOvertime] = useState(0);
  const [outHandover, setOutHandover] = useState('');
  const [outChecklist, setOutChecklist] = useState({
    cashReconciled: true,
    equipmentClean: true,
    chillerStockChecked: true
  });

  // Form Leave / Izin / Sakit
  const [leaveStaffName, setLeaveStaffName] = useState(currentUser?.name || '');
  const [leaveDate, setLeaveDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [leaveType, setLeaveType] = useState('Sakit'); // 'Sakit', 'Izin', 'Cuti', 'Alpa'
  const [leaveNotes, setLeaveNotes] = useState('');

  const supabase = getSupabaseClient();
  const todayStr = new Date().toISOString().split('T')[0];

  const [isLive, setIsLive] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState(null);
  const [supabaseError, setSupabaseError] = useState(null);

  const unsyncedRecords = useMemo(() => {
    return records.filter(r => String(r.id).startsWith('att-'));
  }, [records]);

  const handleSyncPending = async () => {
    setIsSyncing(true);
    setSyncStatusMsg('Menyinkronkan data presensi ke sistem cloud...');
    try {
      const res = await syncPendingAttendance();
      if (res.syncedCount > 0) {
        setSyncStatusMsg(`✓ Sukses menyinkronkan ${res.syncedCount} catatan presensi!`);
        await loadData();
      } else if (res.totalAttempted === 0) {
        setSyncStatusMsg('Semua catatan presensi sudah tersimpan dan tersinkronkan.');
      } else {
        setSyncStatusMsg(`⚠️ Sinkronisasi belum berhasil: ${res.errors?.[0] || 'Coba beberapa saat lagi'}`);
      }
    } catch (e) {
      setSyncStatusMsg(`⚠️ Gagal sinkronisasi: ${e.message}`);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatusMsg(null), 5000);
    }
  };

  // Update Live Clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load Real Staff and Attendance Records from Supabase
  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Load Staff, Shifts, & Positions
      const [staff, customShifts, customPositions] = await Promise.all([
        getStaffList(),
        getCustomShifts(),
        getCustomPositions()
      ]);
      const validStaff = staff || [];
      const validShifts = (customShifts && customShifts.length > 0) ? customShifts : DEFAULT_SHIFTS;
      const validPositions = (customPositions && customPositions.length > 0) ? customPositions : DEFAULT_POSITIONS;

      setStaffList(validStaff);
      setAvailableShifts(validShifts);
      setAvailablePositions(validPositions);

      // Inisialisasi default station & jam divisi otomatis sesuai role pengguna / staf pertama
      const activeStaff = validStaff.find(s => s.name === currentUser?.name);
      const userRole = activeStaff?.position || currentUser?.position || (validStaff[0]?.position) || 'Barista';
      const autoStation = getStationFromRole(userRole, validPositions);
      const autoShift = getAutoShiftForPosition(autoStation, validShifts, new Date());
      setInPosition(autoStation);
      if (autoShift?.id) setInShift(autoShift.id);

      // 2. Load Attendance from Supabase & Service
      const attRes = await getAttendanceRecords();
      setRecords(attRes.data || []);
      setIsLive(Boolean(attRes.isLive));
      setSupabaseError(attRes.error || null);
    } catch (err) {
      console.warn('Gagal memuat absensi:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [supabase]);

  // Current User's Active Status Today
  const userTodayRecord = useMemo(() => {
    return records.find(r =>
      (r.staff_name === currentUser?.name || r.name === currentUser?.name) &&
      (r.entry_date === todayStr || r.date === todayStr)
    );
  }, [records, currentUser, todayStr]);

  const isOnDuty = userTodayRecord && (userTodayRecord.clock_out === '-' || !userTodayRecord.clock_out || userTodayRecord.clockOut === '-');

  // Helper: Format Jam & Menit
  const formatTimeHM = (dateObj) => {
    return `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
  };

  // Helper: Hitung Durasi Kerja
  const calculateWorkDuration = (startStr, endStr) => {
    if (!startStr || !endStr || endStr === '-') return '-';
    try {
      const [startH, startM] = startStr.split(':').map(Number);
      const [endH, endM] = endStr.split(':').map(Number);
      let diffMinutes = (endH * 60 + endM) - (startH * 60 + startM);
      if (diffMinutes < 0) diffMinutes += 24 * 60; // Melewati tengah malam
      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;
      return `${hours} Jam ${minutes} Menit`;
    } catch (e) {
      return '-';
    }
  };

  // Shift yang dipilih saat Clock-In
  const selectedShiftObj = useMemo(() => {
    return availableShifts.find(s => s.id === inShift) || availableShifts[0] || DEFAULT_SHIFTS[0];
  }, [inShift, availableShifts]);

  // Evaluasi ketepatan waktu otomatis secara live (mempertimbangkan grace period)
  const punctuality = useMemo(() => {
    return evaluatePunctualityWithGrace(selectedShiftObj?.startTime, currentTime, selectedShiftObj?.gracePeriod || 5);
  }, [selectedShiftObj, currentTime]);

  // Open Modal Clock In (Otomatis sinkronkan station sesuai role, dan jam divisi auto sesuai waktu)
  const handleOpenClockIn = (presetStaffName = null) => {
    let targetName = presetStaffName || '';
    if (!targetName) {
      if (currentUser?.name && (staffList.some(s => s.name === currentUser.name) || !isOwner)) {
        targetName = currentUser.name;
      } else if (staffList.length > 0) {
        targetName = staffList[0].name;
      } else {
        targetName = currentUser?.name || '';
      }
    }

    const matched = staffList.find(s => s.name === targetName);
    let targetRole = matched?.position || (targetName === currentUser?.name ? currentUser?.position : null) || 'Barista';

    // 1. Station otomatis terisi sesuai role staf
    const autoStation = getStationFromRole(targetRole, availablePositions);

    // 2. Jam divisi otomatis terisi sesuai station/role & jam saat ini
    const autoShift = getAutoShiftForPosition(autoStation, availableShifts, new Date());

    setInStaffName(targetName);
    setInPosition(autoStation);
    setInShift(autoShift?.id || availableShifts[0]?.id || 'barista_pagi');
    setInLateReason('');
    setInNotes('');
    setShowClockInModal(true);
  };

  // Handler saat Owner memilih nama staf berbeda -> Otomatis isi station & jam divisi
  const handleStaffChange = (selectedName) => {
    setInStaffName(selectedName);
    const matched = staffList.find(s => s.name === selectedName);
    const staffRole = matched?.position || 'Barista';

    // Otomatis isi station sesuai role
    const autoStation = getStationFromRole(staffRole, availablePositions);
    setInPosition(autoStation);

    // Jam divisi pun otomatis menyesuaikan
    const autoShift = getAutoShiftForPosition(autoStation, availableShifts, new Date());
    if (autoShift?.id) {
      setInShift(autoShift.id);
    }
  };

  // Handler saat Station / Posisi diganti manual -> Otomatis sinkronkan jam divisi
  const handlePositionChange = (newPos) => {
    setInPosition(newPos);
    const autoShift = getAutoShiftForPosition(newPos, availableShifts, new Date());
    if (autoShift?.id) {
      setInShift(autoShift.id);
    }
  };

  // Handler saat Shift & Divisi dipilih manual -> Otomatis sesuaikan station jika berbeda divisi
  const handleShiftChange = (newShiftId) => {
    setInShift(newShiftId);
    const targetShift = availableShifts.find(s => s.id === newShiftId);
    if (targetShift) {
      const matchingStation = getStationForShift(targetShift, availableShifts, availablePositions);
      if (matchingStation) {
        setInPosition(matchingStation);
      }
    }
  };

  // Open Modal Clock Out
  const handleOpenClockOut = (recordToClose = null) => {
    const target = recordToClose || userTodayRecord;
    if (!target) {
      alert('Tidak ada sesi shift aktif untuk di-clock out.');
      return;
    }
    setOutRecordId(target.id);
    setOutTime(formatTimeHM(currentTime));
    setOutOvertime(0);
    setOutHandover('');
    setShowClockOutModal(true);
  };

  // Submit Clock In (Waktu tercatat otomatis dari jam sistem saat ini)
    // Kamera Selfie Live Stream
  const startCamera = async () => {
    try {
      setCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.warn('Kamera tidak dapat diakses langsung:', err);
      alert('Tidak dapat mengakses kamera perangkat secara langsung. Silakan gunakan tombol Upload Foto sebagai alternatif.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const captureSelfie = (targetSetter) => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = 360;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, 360, 360);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    targetSetter(dataUrl);
    stopCamera();
  };

  const handleFileSelfie = (e, targetSetter) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      targetSetter(event.target.result);
    };
    reader.readAsDataURL(file);
  };
const handleClockInSubmit = async (e) => {
    e.preventDefault();

    // VALIDASI MANDATORY SELFIE LANGSUNG (ANTI-CHEAT)
    if (!inSelfie) {
      alert('⚠️ FOTO SELFIE WAJIB DIAMBIL!\n\nKru wajib mengambil foto selfie wajah langsung di tempat kerja melalui kamera sebelum dapat melakukan absensi masuk shift.');
      if (!cameraActive) startCamera();
      return;
    }

    // Validasi alasan keterlambatan jika terdeteksi terlambat
    if (punctuality.isLate && !inLateReason.trim()) {
      alert(`⚠️ Anda terdeteksi terlambat ${punctuality.lateMinutes} menit dari jadwal shift (${selectedShiftObj.startTime} WIB).\n\nMohon isi kolom "Alasan Keterlambatan" sebelum mengonfirmasi absensi.`);
      return;
    }

    const finalTime = formatTimeHM(currentTime); // Jam masuk otomatis dari waktu real-time

    // Cek duplikasi absensi hari ini untuk staf yang sama
    const alreadyExists = records.some(r =>
      (r.staff_name === inStaffName || r.name === inStaffName) &&
      (r.entry_date === todayStr || r.date === todayStr)
    );

    if (alreadyExists && !confirm(`Staf ${inStaffName} sudah memiliki catatan absensi hari ini. Tetap tambahkan sesi shift baru?`)) {
      return;
    }

    const newRecord = {
      entry_date: todayStr,
      staff_name: inStaffName,
      position: inPosition,
      shift: selectedShiftObj.label,
      schedule_in: selectedShiftObj.startTime,
      schedule_out: selectedShiftObj.endTime,
      clock_in: finalTime,
      clock_out: '-',
      work_duration: '-',
      status: punctuality.isLate ? 'Terlambat' : 'Hadir',
      late_minutes: punctuality.isLate ? Number(punctuality.lateMinutes) : 0,
      late_reason: punctuality.isLate ? inLateReason.trim() : null,
      overtime_hours: 0,
      handover_notes: '',
      photo_url: inSelfie || null,
      notes: punctuality.isLate
        ? `Terlambat ${punctuality.lateMinutes} menit. Alasan: ${inLateReason.trim()}`
        : (inNotes.trim() || `Masuk tepat waktu (${selectedShiftObj.shortName})`)
    };

    const res = await saveClockInRecord(newRecord, selectedShiftObj);
    const finalSaved = res.data || saved;

    const updated = [finalSaved, ...records.filter(r => r.id !== finalSaved.id)];
    setRecords(updated);
    setShowClockInModal(false);
    stopCamera();
    setInSelfie(null);

    if (res.source === 'supabase') {
      alert(`✓ Berhasil Clock-In pada jam ${finalTime} (${selectedShiftObj.shortName})!\nData berhasil tersimpan ke sistem cloud.\nStatus: ${punctuality.isLate ? `⚠️ Terlambat ${punctuality.lateMinutes} menit` : '✓ Tepat Waktu'}. Selamat bertugas.`);
    } else {
      const hint = res.error ? `\n(${res.error})` : '';
      alert(`✓ Clock-In jam ${finalTime} (${selectedShiftObj.shortName}) berhasil dicatat.${hint}\nData tersimpan di perangkat dan otomatis disinkronkan ke sistem.`);
    }
  };

  // Submit Clock Out (Waktu keluar tercatat otomatis dari jam sistem saat ini)
  const handleClockOutSubmit = async (e) => {
    e.preventDefault();

    // VALIDASI MANDATORY SELFIE PULANG/CLOSING (ANTI-CHEAT)
    if (!outSelfie) {
      alert('⚠️ FOTO BUKTI CLOSING / PULANG WAJIB DIAMBIL!\n\nKru wajib mengambil foto selfie closing langsung sebelum menyelesaikan shift kerja.');
      if (!cameraActive) startCamera();
      return;
    }
    const finalOut = formatTimeHM(currentTime); // Jam keluar otomatis tercatat
    const targetRecord = records.find(r => r.id === outRecordId);
    if (!targetRecord) return;

    const startIn = targetRecord.clock_in || targetRecord.clockIn || '08:00';
    const duration = calculateWorkDuration(startIn, finalOut);

    const updates = {
      clock_out: finalOut,
      work_duration: duration,
      overtime_hours: Number(outOvertime) || 0,
      handover_notes: outHandover.trim() || 'Shift selesai & closing area aman.'
    };

    const res = await updateClockOutRecord(targetRecord, updates);
    const updatedRecord = res.data || { ...targetRecord, ...updates, clockOut: finalOut };

    const updated = records.map(r => r.id === targetRecord.id ? updatedRecord : r);
    setRecords(updated);
    setShowClockOutModal(false);
    stopCamera();
    setOutSelfie(null);

    if (res.source === 'supabase') {
      alert(`✓ Berhasil Clock-Out pada jam ${finalOut}!\nData terupdate di sistem cloud.\nTotal Durasi Kerja: ${duration}.\nTerima kasih atas dedikasi dan kerja keras hari ini.`);
    } else {
      alert(`✓ Berhasil Clock-Out pada jam ${finalOut}!\nTotal Durasi Kerja: ${duration}.\nData tersimpan dan tersinkronisasi.`);
    }
  };

  // Submit Izin / Sakit
  const handleLeaveSubmit = async (e) => {
    e.preventDefault();
    if (!leaveStaffName) {
      alert('Pilih nama staf.');
      return;
    }

    const newLeave = {
      entry_date: leaveDate,
      staff_name: leaveStaffName,
      position: 'Kru',
      shift: 'Non-Shift',
      clock_in: '-',
      clock_out: '-',
      work_duration: '-',
      status: leaveType,
      late_minutes: 0,
      overtime_hours: 0,
      handover_notes: '',
      notes: leaveNotes.trim() || `Status: ${leaveType}`
    };

    let saved = { ...newLeave, id: `att-${Date.now()}`, created_at: new Date().toISOString() };

    const res = await saveLeaveRecord(newLeave);
    const finalSaved = res.data || saved;

    const updated = [finalSaved, ...records.filter(r => r.id !== finalSaved.id)];
    setRecords(updated);
    setShowLeaveModal(false);
    setLeaveNotes('');

    alert(`✓ Catatan ${leaveType} untuk ${leaveStaffName} berhasil disimpan.`);
  };

  // Delete Record (Owner only)
  const handleDeleteRecord = async (id, staffName) => {
    if (!confirm(`Hapus catatan absensi ${staffName}?`)) return;
    await deleteAttendanceRecord(id);
    const updated = records.filter(r => r.id !== id);
    setRecords(updated);
    if (selectedRecordDetail?.id === id) setSelectedRecordDetail(null);
    alert(`Catatan absensi ${staffName} berhasil dihapus.`);
  };

  // Export CSV
  const handleExportCSV = () => {
    if (records.length === 0) {
      alert('Tidak ada data absensi untuk diekspor.');
      return;
    }

    const headers = ['Tanggal', 'Nama Staf', 'Posisi', 'Shift', 'Jam Masuk', 'Jam Keluar', 'Durasi Kerja', 'Status', 'Menit Terlambat', 'Lembur (Jam)', 'Catatan Serah Terima / Handover', 'Catatan'];
    const rows = records.map(r => [
      `"${r.entry_date || r.date || ''}"`,
      `"${r.staff_name || r.name || ''}"`,
      `"${r.position || 'Kru'}"`,
      `"${r.shift || ''}"`,
      `"${r.clock_in || r.clockIn || '-'}"`,
      `"${r.clock_out || r.clockOut || '-'}"`,
      `"${r.work_duration || '-'}"`,
      `"${r.status || 'Hadir'}"`,
      r.late_minutes || 0,
      r.overtime_hours || 0,
      `"${(r.handover_notes || '').replace(/"/g, '""')}"`,
      `"${(r.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `baracoffee_absensi_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered Records
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const recDate = r.entry_date || r.date || '';
      const recStaff = (r.staff_name || r.name || '').toLowerCase();
      const recShift = r.shift || '';
      const recStatus = r.status || 'Hadir';

      const matchDate = !filterDate || recDate === filterDate;
      const matchShift = filterShift === 'Semua' || recShift === filterShift;
      const matchStatus = filterStatus === 'Semua' || recStatus === filterStatus;
      const matchSearch = !searchStaff || recStaff.includes(searchStaff.toLowerCase());

      return matchDate && matchShift && matchStatus && matchSearch;
    });
  }, [records, filterDate, filterShift, filterStatus, searchStaff]);

  // Statistics for today
  const todayRecords = useMemo(() => {
    return records.filter(r => (r.entry_date === todayStr || r.date === todayStr));
  }, [records, todayStr]);

  const stats = useMemo(() => {
    const present = todayRecords.filter(r => r.status === 'Hadir' || r.status === 'Terlambat').length;
    const onDuty = todayRecords.filter(r => (r.clock_out === '-' || !r.clock_out || r.clockOut === '-')).length;
    const late = todayRecords.filter(r => r.status === 'Terlambat' || Number(r.late_minutes) > 0).length;
    const leave = todayRecords.filter(r => ['Sakit', 'Izin', 'Cuti', 'Alpa'].includes(r.status)).length;
    const totalOT = todayRecords.reduce((acc, r) => acc + (Number(r.overtime_hours) || 0), 0);
    return { present, onDuty, late, leave, totalOT };
  }, [todayRecords]);

  // Helper format bulan
  const formatMonthTitle = (monthStr) => {
    if (!monthStr) return 'Bulan Ini';
    try {
      const [year, month] = monthStr.split('-');
      const d = new Date(Number(year), Number(month) - 1, 1);
      return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    } catch (e) {
      return monthStr;
    }
  };

  // Cek apakah ada data simulasi demo
  const hasDemoData = useMemo(() => {
    return records.some(r => String(r.id).startsWith('sim-') || r.is_demo);
  }, [records]);

  // Kalkulasi Rapor Penilaian Bulanan Kru
  const monthlyAppraisalData = useMemo(() => {
    const monthPrefix = selectedAppraisalMonth || new Date().toISOString().slice(0, 7);
    const monthRecords = records.filter(r => {
      const d = r.entry_date || r.date || '';
      return d.startsWith(monthPrefix);
    });

    const uniqueNames = Array.from(new Set([
      ...staffList.map(s => s.name),
      ...monthRecords.map(r => r.staff_name || r.name).filter(Boolean)
    ]));

    const staffReports = uniqueNames.map(name => {
      const staffInfo = staffList.find(s => s.name === name);
      const staffRecs = monthRecords.filter(r => (r.staff_name || r.name) === name);

      const position = staffInfo?.position || staffRecs[0]?.position || 'Kru';
      const totalShift = staffRecs.length;
      const totalHadir = staffRecs.filter(r => r.status === 'Hadir' || r.status === 'Terlambat').length;
      const totalOnTime = staffRecs.filter(r => r.status === 'Hadir' && (!r.late_minutes || Number(r.late_minutes) === 0)).length;
      const totalLate = staffRecs.filter(r => r.status === 'Terlambat' || Number(r.late_minutes) > 0).length;
      const totalLateMinutes = staffRecs.reduce((sum, r) => sum + (Number(r.late_minutes) || 0), 0);
      const totalOvertimeHours = staffRecs.reduce((sum, r) => sum + (Number(r.overtime_hours) || 0), 0);
      const totalSakit = staffRecs.filter(r => r.status === 'Sakit').length;
      const totalIzin = staffRecs.filter(r => r.status === 'Izin' || r.status === 'Cuti').length;
      const totalAlpa = staffRecs.filter(r => r.status === 'Alpa').length;

      const punctualityRate = totalHadir > 0 ? Math.round((totalOnTime / totalHadir) * 100) : 100;

      let score = 0;
      if (totalShift > 0) {
        const attendanceScore = (totalHadir / Math.max(totalShift, 1)) * 50;
        const punctualityScore = (totalOnTime / Math.max(totalHadir, 1)) * 40;
        const overtimeBonus = Math.min(10, totalOvertimeHours * 2);
        const latePenalty = Math.min(15, Math.floor(totalLateMinutes / 20));
        const alpaPenalty = totalAlpa * 15;

        score = Math.max(0, Math.min(100, Math.round(attendanceScore + punctualityScore + overtimeBonus - latePenalty - alpaPenalty)));
      }

      let grade = 'B';
      let gradeBadge = 'badge-primary';
      let statusDesc = 'Baik & Disiplin';
      let recommendation = 'Kinerja memuaskan, pertahankan ritme kerja.';

      if (totalShift === 0) {
        grade = '-';
        gradeBadge = 'badge-secondary';
        statusDesc = 'Belum Ada Shift';
        recommendation = 'Belum ada catatan presensi di periode bulan ini.';
      } else if (score >= 90) {
        grade = 'A';
        gradeBadge = 'badge-success';
        statusDesc = 'Sangat Teladan & Disiplin ⭐';
        recommendation = 'Kandidat Employee of the Month & Layak Bonus Disiplin Penuh.';
      } else if (score >= 75) {
        grade = 'B';
        gradeBadge = 'badge-primary';
        statusDesc = 'Baik & Konsisten 👍';
        recommendation = 'Kinerja baik, tingkatkan ketepatan waktu untuk meraih Grade A.';
      } else if (score >= 60) {
        grade = 'C';
        gradeBadge = 'badge-warning';
        statusDesc = 'Perlu Evaluasi Waktu ⚠️';
        recommendation = 'Perlu pembinaan terkait ketepatan waktu masuk shift.';
      } else {
        grade = 'D';
        gradeBadge = 'badge-danger';
        statusDesc = 'Peringatan Disiplin 🚨';
        recommendation = 'Perlu evaluasi komitmen kerja dan konseling operasional.';
      }

      return {
        name,
        position,
        totalShift,
        totalHadir,
        totalOnTime,
        totalLate,
        totalLateMinutes,
        totalOvertimeHours,
        totalSakit,
        totalIzin,
        totalAlpa,
        punctualityRate,
        score,
        grade,
        gradeBadge,
        statusDesc,
        recommendation,
        records: staffRecs
      };
    });

    const totalCafeShifts = monthRecords.length;
    const totalCafeHadir = monthRecords.filter(r => r.status === 'Hadir' || r.status === 'Terlambat').length;
    const totalCafeOnTime = monthRecords.filter(r => r.status === 'Hadir' && (!r.late_minutes || Number(r.late_minutes) === 0)).length;
    const totalCafeLate = monthRecords.filter(r => r.status === 'Terlambat' || Number(r.late_minutes) > 0).length;
    const totalCafeOT = monthRecords.reduce((sum, r) => sum + (Number(r.overtime_hours) || 0), 0);
    const cafePunctualityRate = totalCafeHadir > 0 ? Math.round((totalCafeOnTime / totalCafeHadir) * 100) : 100;

    const activeStaff = staffReports.filter(s => s.totalShift > 0);
    const sorted = [...activeStaff].sort((a, b) => b.score - a.score || b.punctualityRate - a.punctualityRate);
    const topPerformer = sorted.length > 0 ? sorted[0] : null;

    return {
      monthRecords,
      staffReports,
      totalCafeShifts,
      totalCafeHadir,
      totalCafeOnTime,
      totalCafeLate,
      totalCafeOT,
      cafePunctualityRate,
      topPerformer
    };
  }, [records, staffList, selectedAppraisalMonth]);

  // Filter & Urutan Rapor Kru
  const filteredStaffAppraisals = useMemo(() => {
    let list = monthlyAppraisalData.staffReports;

    if (searchAppraisalStaff) {
      const q = searchAppraisalStaff.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.position.toLowerCase().includes(q));
    }

    if (filterAppraisalGrade !== 'Semua') {
      list = list.filter(s => s.grade === filterAppraisalGrade);
    }

    return [...list].sort((a, b) => {
      if (sortAppraisalBy === 'score_desc') return b.score - a.score;
      if (sortAppraisalBy === 'score_asc') return a.score - b.score;
      if (sortAppraisalBy === 'punctuality_desc') return b.punctualityRate - a.punctualityRate;
      if (sortAppraisalBy === 'late_desc') return b.totalLateMinutes - a.totalLateMinutes;
      if (sortAppraisalBy === 'ot_desc') return b.totalOvertimeHours - a.totalOvertimeHours;
      if (sortAppraisalBy === 'name_asc') return a.name.localeCompare(b.name);
      return 0;
    });
  }, [monthlyAppraisalData.staffReports, searchAppraisalStaff, filterAppraisalGrade, sortAppraisalBy]);

  // Export CSV Rapor Penilaian Bulanan
  const handleExportAppraisalCSV = () => {
    if (monthlyAppraisalData.staffReports.length === 0) {
      alert('Tidak ada data penilaian untuk diekspor.');
      return;
    }

    const headers = [
      'Periode',
      'Nama Staf',
      'Posisi / Role',
      'Total Shift',
      'Hadir (Shift)',
      'Tepat Waktu (On-Time)',
      'Terlambat (Kali)',
      'Akumulasi Telat (Menit)',
      'Total Lembur (Jam)',
      'Izin / Sakit / Cuti',
      'Alpa (Tanpa Keterangan)',
      'Disiplin Waktu (%)',
      'Skor Kinerja (0-100)',
      'Grade',
      'Status Kinerja',
      'Rekomendasi Manajerial'
    ];

    const rows = monthlyAppraisalData.staffReports.map(s => [
      `"${selectedAppraisalMonth}"`,
      `"${s.name}"`,
      `"${s.position}"`,
      s.totalShift,
      s.totalHadir,
      s.totalOnTime,
      s.totalLate,
      s.totalLateMinutes,
      s.totalOvertimeHours,
      s.totalSakit + s.totalIzin,
      s.totalAlpa,
      `"${s.punctualityRate}%"`,
      s.score,
      `"${s.grade}"`,
      `"${s.statusDesc}"`,
      `"${s.recommendation}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `rapor_penilaian_kru_${selectedAppraisalMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Generate Data Simulasi Presensi September 2026
  const handleGenerateDemoData = async () => {
    if (!confirm('Buat data simulasi absensi September 2026 untuk seluruh kru?\n\nData simulasi ini dibuat dari tanggal 1 s/d 28 September 2026 agar Anda dapat langsung melihat hasil rapor dan penilaian bulanan kru secara lengkap.')) {
      return;
    }

    const demoStaffList = staffList.length > 0 ? staffList : [
      { name: 'Rian Pratama', position: 'Baker' },
      { name: 'Siti Rahma', position: 'Kitchen / Cook' },
      { name: 'Fajar Nugraha', position: 'Barista' },
      { name: 'Dina Lestari', position: 'Kasir' }
    ];

    const newDemoRecords = [];
    const reasons = [
      'Macet jam berangkat kerja',
      'Hujan lebat di jalan',
      'Ban motor bocor',
      'Antrean SPBU padat',
      'Kendala transportasi umum'
    ];

    for (let day = 1; day <= 28; day++) {
      const dayStr = String(day).padStart(2, '0');
      const dateStr = `2026-09-${dayStr}`;

      demoStaffList.forEach((staff, staffIdx) => {
        if ((day + staffIdx) % 7 === 0) return; // Libur mingguan

        const station = staff.position || 'Barista';
        let shiftObj = availableShifts[0];
        if (station.toLowerCase().includes('bak')) {
          shiftObj = availableShifts.find(s => s.id.includes('bak')) || availableShifts[0];
        } else if (station.toLowerCase().includes('cook') || station.toLowerCase().includes('kitch')) {
          shiftObj = availableShifts.find(s => s.id.includes('kitch')) || availableShifts[0];
        } else {
          shiftObj = (day % 2 === 0)
            ? (availableShifts.find(s => s.id.includes('sore')) || availableShifts[0])
            : (availableShifts.find(s => s.id.includes('pagi')) || availableShifts[0]);
        }

        const isLateDay = (day * 3 + staffIdx) % 11 === 0;
        const lateMinutes = isLateDay ? (10 + (day % 20)) : 0;
        const status = isLateDay ? 'Terlambat' : 'Hadir';
        const lateReason = isLateDay ? reasons[(day + staffIdx) % reasons.length] : null;

        const [shH, shM] = (shiftObj.startTime || '07:00').split(':').map(Number);
        const [ehH, ehM] = (shiftObj.endTime || '15:00').split(':').map(Number);

        const inMinutesTotal = shH * 60 + shM + (isLateDay ? lateMinutes : -5);
        const inH = Math.floor(inMinutesTotal / 60);
        const inM = inMinutesTotal % 60;
        const clockIn = `${String(inH).padStart(2, '0')}:${String(inM).padStart(2, '0')}`;

        const isOvertime = day % 6 === 0;
        const overtimeHours = isOvertime ? 1.5 : 0;
        const outMinutesTotal = ehH * 60 + ehM + (isOvertime ? 90 : 0);
        const outH = Math.floor(outMinutesTotal / 60);
        const outM = outMinutesTotal % 60;
        const clockOut = `${String(outH).padStart(2, '0')}:${String(outM).padStart(2, '0')}`;

        newDemoRecords.push({
          id: `sim-${dateStr}-${staff.name.replace(/\s+/g, '_')}`,
          entry_date: dateStr,
          staff_name: staff.name,
          position: station,
          shift: shiftObj.label,
          schedule_in: shiftObj.startTime,
          schedule_out: shiftObj.endTime,
          clock_in: clockIn,
          clock_out: clockOut,
          work_duration: '8 Jam 0 Menit',
          status,
          late_minutes: lateMinutes,
          late_reason: lateReason,
          overtime_hours: overtimeHours,
          handover_notes: 'Area bar & peralatan bersih, stok chiller aman.',
          notes: isLateDay ? `Terlambat ${lateMinutes} menit. Alasan: ${lateReason}` : `Hadir tepat waktu (${shiftObj.shortName})`,
          is_demo: true,
          created_at: `${dateStr}T10:00:00.000Z`
        });
      });
    }

    const nonDemo = records.filter(r => !String(r.id).startsWith('sim-'));
    const combined = [...newDemoRecords, ...nonDemo];

    setRecords(combined);
    localStorage.setItem('baracoffee_real_attendance', JSON.stringify(combined));
    setSelectedAppraisalMonth('2026-09');
    setAttendanceSubTab('appraisal');
    alert(`✓ Sukses membuat ${newDemoRecords.length} data riwayat presensi simulasi September 2026!\nSekarang Anda dapat mengecek Rapor Penilaian Kinerja Bulanan Kru.`);
  };

  const handleClearDemoData = async () => {
    if (!confirm('Hapus seluruh data simulasi presensi (ID berawalan sim-)? Data riil yang di-clock-in tidak akan terhapus.')) return;
    const nonDemo = records.filter(r => !String(r.id).startsWith('sim-'));
    setRecords(nonDemo);
    localStorage.setItem('baracoffee_real_attendance', JSON.stringify(nonDemo));
    alert('✓ Seluruh data simulasi presensi berhasil dibersihkan.');
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '60px' }}>

      {/* Top Banner: Live Clock & Quick Action */}
      <div className="glass-card" style={{
        padding: '24px',
        marginBottom: '24px',
        background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.07) 0%, rgba(255, 255, 255, 0.98) 100%)',
        border: '1px solid var(--border-hover)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>

          {/* Left: Clock & Date */}
          <div style={{ flex: '1 1 300px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <span className="badge badge-primary" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Terminal Presensi Digital
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>• Bara Coffee Cafe</span>
            </div>

            <div>
              <h1 className="live-clock-time" style={{
                fontSize: '2.5rem',
                fontWeight: 900,
                color: 'var(--burgundy-primary)',
                fontFamily: 'var(--font-mono)',
                margin: 0,
                letterSpacing: '0.02em',
                lineHeight: 1.1
              }}>
                {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </h1>
              <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', fontWeight: 600, marginTop: '4px' }}>
                {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>

            {/* Current Staff Status Badge */}
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                Akun: <strong style={{ color: 'var(--text-primary)' }}>{currentUser?.name}</strong> ({currentUser?.position || (isOwner ? 'Owner' : 'Kru')})
              </div>

              {isOnDuty ? (
                <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--success)', display: 'inline-block', boxShadow: '0 0 6px rgba(13, 148, 136, 0.4)' }}></span>
                  Sedang On-Duty ({userTodayRecord.shift} sejak {userTodayRecord.clock_in || userTodayRecord.clockIn})
                </span>
              ) : userTodayRecord ? (
                <span className="badge badge-primary">
                  ✓ Shift Selesai ({userTodayRecord.clock_in} - {userTodayRecord.clock_out})
                </span>
              ) : (
                <span className="badge badge-warning">
                  Belum Presensi Masuk
                </span>
              )}
            </div>
          </div>

          {/* Right: Action Buttons */}
          <div className="attendance-hero-actions" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {!isOnDuty ? (
              <button
                onClick={() => handleOpenClockIn()}
                className="btn btn-primary"
                style={{ padding: '12px 20px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: 'var(--shadow-gold)' }}
              >
                <LogIn size={18} />
                <span>Mulai Shift (Clock-In)</span>
              </button>
            ) : (
              <>
                <button
                  onClick={() => handleOpenClockOut()}
                  className="btn btn-secondary"
                  style={{ padding: '12px 20px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px', borderColor: 'var(--gold-primary)', color: 'var(--gold-light)' }}
                >
                  <LogOut size={18} />
                  <span>Selesaikan Shift (Clock-Out)</span>
                </button>
                {isOwner && (
                  <button
                    onClick={() => handleOpenClockIn()}
                    className="btn btn-primary"
                    style={{ padding: '12px 18px', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: 'var(--shadow-gold)' }}
                  >
                    <LogIn size={18} />
                    <span>+ Presensi Kru (Clock-In)</span>
                  </button>
                )}
              </>
            )}

            <button
              onClick={() => setShowLeaveModal(true)}
              className="btn btn-secondary"
              style={{ padding: '12px 16px', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <FileText size={16} />
              <span>Catat Izin / Sakit</span>
            </button>
          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-NAVIGASI: 1. Presensi Harian & Terminal | 2. Rapor Penilaian Bulanan Kru */}
      {/* ========================================================================= */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '22px' }}>

        {/* Tab Buttons */}
        <div className="subtab-container" style={{ display: 'flex', gap: '8px', background: 'var(--bg-surface)', padding: '6px', borderRadius: '12px', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}>
          <button
            onClick={() => setAttendanceSubTab('daily')}
            className={`btn ${attendanceSubTab === 'daily' ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              padding: '8px 18px',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderRadius: '9px',
              border: attendanceSubTab === 'daily' ? 'none' : 'transparent',
              boxShadow: attendanceSubTab === 'daily' ? 'var(--shadow-sm)' : 'none'
            }}
          >
            <Clock size={16} />
            <span>Presensi Harian & Terminal</span>
          </button>

          <button
            onClick={() => setAttendanceSubTab('appraisal')}
            className={`btn ${attendanceSubTab === 'appraisal' ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              padding: '8px 18px',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderRadius: '9px',
              border: attendanceSubTab === 'appraisal' ? 'none' : 'transparent',
              boxShadow: attendanceSubTab === 'appraisal' ? 'var(--shadow-sm)' : 'none'
            }}
          >
            <Award size={16} />
            <span>Rapor Penilaian Kinerja Kru</span>
            <span className="badge badge-primary badge-hide-mobile" style={{ fontSize: '0.68rem', padding: '2px 7px' }}>Evaluasi Akhir Bulan</span>
          </button>
        </div>

        {/* Action Controls for Appraisal Mode */}
        {attendanceSubTab === 'appraisal' && (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Periode Month Input */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--bg-card)',
              padding: '5px 12px',
              borderRadius: '10px',
              border: '1px solid var(--border-subtle)'
            }}>
              <Calendar size={15} color="var(--gold-light)" />
              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>Periode:</span>
              <input
                type="month"
                value={selectedAppraisalMonth}
                onChange={(e) => setSelectedAppraisalMonth(e.target.value)}
                className="form-input"
                style={{ padding: '3px 8px', fontSize: '0.82rem', width: '135px', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontWeight: 700 }}
              />
            </div>

            <button
              onClick={handleExportAppraisalCSV}
              className="btn btn-secondary"
              style={{ padding: '7px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Download Hasil Rekap Penilaian Bulanan Kru ke format CSV / Excel"
            >
              <Download size={14} />
              <span>Export Rapor (CSV)</span>
            </button>

            {hasDemoData ? (
              <button
                onClick={handleClearDemoData}
                className="btn btn-secondary"
                style={{ padding: '7px 12px', fontSize: '0.78rem', color: 'var(--danger)', borderColor: 'rgba(231,111,81,0.3)', display: 'flex', alignItems: 'center', gap: '5px' }}
                title="Hapus data riwayat simulasi demo"
              >
                <Trash2 size={13} />
                <span>Hapus Demo</span>
              </button>
            ) : (
              <button
                onClick={handleGenerateDemoData}
                className="btn btn-secondary"
                style={{ padding: '7px 14px', fontSize: '0.8rem', color: 'var(--gold-light)', borderColor: 'rgba(217,155,67,0.4)', display: 'flex', alignItems: 'center', gap: '6px' }}
                title="Buat data simulasi absensi September 2026 untuk menguji coba fitur rapor kinerja"
              >
                <Sparkles size={14} />
                <span>⚡ Simulasi September 2026</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* KONDISIONAL 1: VIEW PRESENSI HARIAN (DAILY TERMINAL & LOGS)              */}
      {/* ========================================================================= */}
      {attendanceSubTab === 'daily' && (
        <>
          {/* KPI Statistic Cards (Today) */}
          <div className="attendance-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '14px', marginBottom: '24px' }}>

            <div className="glass-card" style={{ padding: '16px 18px', borderLeft: '4px solid var(--success)' }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Hadir Hari Ini
              </span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '4px' }}>
                <h3 style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--success)', margin: 0 }}>
                  {stats.present}
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Orang</span>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '16px 18px', borderLeft: '4px solid var(--burgundy-primary)' }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Sedang On-Duty
              </span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '4px' }}>
                <h3 style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--burgundy-primary)', margin: 0 }}>
                  {stats.onDuty}
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Aktif di Bar/Kasir</span>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '16px 18px', borderLeft: '4px solid var(--warning)' }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Terlambat
              </span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '4px' }}>
                <h3 style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--warning)', margin: 0 }}>
                  {stats.late}
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Perlu Review</span>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '16px 18px', borderLeft: '4px solid var(--info)' }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Izin / Sakit
              </span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '4px' }}>
                <h3 style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--info)', margin: 0 }}>
                  {stats.leave}
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Orang</span>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '16px 18px', borderLeft: '4px solid #D97706' }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Total Jam Lembur
              </span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '4px' }}>
                <h3 style={{ fontSize: '1.7rem', fontWeight: 800, color: '#B45309', margin: 0 }}>
                  {stats.totalOT}
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Jam Hari Ini</span>
              </div>
            </div>

          </div>

          {/* Main Table: Attendance Records */}
          <div className="glass-card" style={{ overflow: 'hidden' }}>

            {/* Table Filter Header */}
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>

              {/* Unsynced Banner if any local records need pushing */}
              {unsyncedRecords.length > 0 && (
                <div style={{
                  marginBottom: '14px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: 'rgba(217, 119, 6, 0.08)',
                  border: '1px solid rgba(217, 119, 6, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: '#B45309' }}>
                    <AlertCircle size={16} />
                    <span>Ada <strong>{unsyncedRecords.length}</strong> catatan presensi offline yang siap disinkronkan.</span>
                  </div>
                  <button
                    onClick={handleSyncPending}
                    disabled={isSyncing}
                    className="btn btn-primary"
                    style={{ padding: '6px 14px', fontSize: '0.78rem', background: 'var(--burgundy-primary)', borderColor: 'var(--burgundy-primary)' }}
                  >
                    {isSyncing ? '⏳ Menyinkronkan...' : '☁️ Sinkronkan Sekarang'}
                  </button>
                </div>
              )}

              {syncStatusMsg && (
                <div style={{
                  marginBottom: '14px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: 'rgba(13, 148, 136, 0.1)',
                  border: '1px solid rgba(13, 148, 136, 0.3)',
                  fontSize: '0.8rem',
                  color: 'var(--text-primary)'
                }}>
                  {syncStatusMsg}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Calendar size={18} color="var(--burgundy-primary)" />
                      <span>Log Presensi Shift & Kehadiran Kru</span>
                    </h3>
                    {isLive ? (
                      <span style={{ fontSize: '0.72rem', padding: '3px 9px', borderRadius: '12px', background: 'rgba(13, 148, 136, 0.12)', color: 'var(--success)', border: '1px solid rgba(13, 148, 136, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                        <CheckCircle2 size={12} /> Sistem Online
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.72rem', padding: '3px 9px', borderRadius: '12px', background: 'rgba(217, 119, 6, 0.12)', color: '#B45309', border: '1px solid rgba(217, 119, 6, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                        <AlertCircle size={12} /> Mode Offline
                      </span>
                    )}
                  </div>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Klik pada baris absensi untuk melihat rincian serah terima shift & closing checklist.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {unsyncedRecords.length > 0 && (
                    <button
                      onClick={handleSyncPending}
                      disabled={isSyncing}
                      className="btn btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px', color: '#B45309', borderColor: 'rgba(217, 119, 6, 0.4)' }}
                      title="Sinkronkan data presensi offline ke cloud"
                    >
                      <span>☁️ Sync ({unsyncedRecords.length})</span>
                    </button>
                  )}

                  <button
                    onClick={handleExportCSV}
                    className="btn btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Download size={14} />
                    <span>Export CSV</span>
                  </button>

                  <button
                    onClick={loadData}
                    className="btn btn-secondary"
                    style={{ padding: '6px 10px', fontSize: '0.78rem' }}
                    title="Perbarui Data Presensi"
                  >
                    🔄 Refresh
                  </button>
                </div>
              </div>

              {/* Filter Bar */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>

                {/* Filter Tanggal */}
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Tanggal Presensi:</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="date"
                      value={filterDate}
                      onChange={(e) => setFilterDate(e.target.value)}
                      className="form-input"
                      style={{ padding: '6px 10px', fontSize: '0.82rem' }}
                    />
                    {filterDate && (
                      <button
                        onClick={() => setFilterDate('')}
                        className="btn btn-secondary"
                        style={{ padding: '6px 8px', fontSize: '0.72rem' }}
                        title="Tampilkan Semua Tanggal"
                      >
                        Semua
                      </button>
                    )}
                  </div>
                </div>

                {/* Filter Shift */}
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Shift Kerja:</label>
                  <select
                    value={filterShift}
                    onChange={(e) => setFilterShift(e.target.value)}
                    className="form-input"
                    style={{ padding: '6px 10px', fontSize: '0.82rem' }}
                  >
                    <option value="Semua">Semua Shift</option>
                    <option value="Shift Pagi">Shift Pagi</option>
                    <option value="Shift Sore">Shift Sore</option>
                    <option value="Full Day">Full Day</option>
                    <option value="Split Shift">Split Shift</option>
                    <option value="Non-Shift">Non-Shift (Izin/Sakit)</option>
                  </select>
                </div>

                {/* Filter Status */}
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Status Kehadiran:</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="form-input"
                    style={{ padding: '6px 10px', fontSize: '0.82rem' }}
                  >
                    <option value="Semua">Semua Status</option>
                    <option value="Hadir">Hadir Tepat Waktu</option>
                    <option value="Terlambat">Terlambat</option>
                    <option value="Sakit">Sakit</option>
                    <option value="Izin">Izin</option>
                    <option value="Cuti">Cuti</option>
                  </select>
                </div>

                {/* Search Staf */}
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Cari Nama Staf:</label>
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      placeholder="Ketik nama staf..."
                      value={searchStaff}
                      onChange={(e) => setSearchStaff(e.target.value)}
                      className="form-input"
                      style={{ paddingLeft: '32px', padding: '6px 10px 6px 32px', fontSize: '0.82rem' }}
                    />
                  </div>
                </div>

              </div>
            </div>

            {/* Table Content */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <th style={{ padding: '12px 14px', textAlign: 'left' }}>Tanggal</th>
                    <th style={{ padding: '12px 14px', textAlign: 'left' }}>Nama Staf & Posisi</th>
                    <th style={{ padding: '12px 14px', textAlign: 'left' }}>Shift</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center' }}>Jam Masuk</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center' }}>Jam Keluar</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center' }}>Durasi Kerja</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center' }}>Status</th>
                    <th style={{ padding: '12px 14px', textAlign: 'left' }}>Catatan / Handover</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan="9" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>📋</div>
                        <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Belum ada data absensi yang sesuai filter.</div>
                        <p style={{ fontSize: '0.78rem', margin: '4px 0 0 0' }}>
                          Kru dapat menekan tombol <strong>"Mulai Shift (Clock-In)"</strong> untuk memulai presensi kerja.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map(r => {
                      const staffName = r.staff_name || r.name;
                      const pos = r.position || 'Kru';
                      const clockIn = r.clock_in || r.clockIn || '-';
                      const clockOut = r.clock_out || r.clockOut || '-';
                      const isOn = clockOut === '-' || !clockOut;
                      const duration = r.work_duration || calculateWorkDuration(clockIn, clockOut);

                      return (
                        <tr
                          key={r.id}
                          onClick={() => setSelectedRecordDetail(r)}
                          style={{
                            borderBottom: '1px solid var(--border-subtle)',
                            cursor: 'pointer',
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(217, 155, 67, 0.04)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          {/* Tanggal */}
                          <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                            {formatDateID(r.entry_date || r.date)}
                          </td>

                          {/* Nama & Posisi */}
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{staffName}</div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{pos}</span>
                          </td>

                          {/* Shift */}
                          <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                            <span style={{
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              color: r.shift?.includes('Pagi') ? 'var(--gold-light)' : r.shift?.includes('Sore') ? 'var(--info)' : 'var(--text-secondary)'
                            }}>
                              {r.shift}
                            </span>
                          </td>

                          {/* Jam Masuk */}
                          <td style={{ padding: '12px 14px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--success)' }}>
                            {clockIn}
                          </td>

                          {/* Jam Keluar */}
                          <td style={{ padding: '12px 14px', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                            {isOn ? (
                              <span className="badge badge-success" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                                🟢 On Duty
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-primary)' }}>{clockOut}</span>
                            )}
                          </td>

                          {/* Durasi */}
                          <td style={{ padding: '12px 14px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                            {duration}
                            {Number(r.overtime_hours) > 0 && (
                              <div style={{ color: '#f72585', fontSize: '0.7rem', fontWeight: 600 }}>
                                +{r.overtime_hours} Jam Lembur
                              </div>
                            )}
                          </td>

                          {/* Status */}
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <span className={`badge ${r.status === 'Hadir' ? 'badge-success' :
                                r.status === 'Terlambat' ? 'badge-warning' :
                                  r.status === 'Sakit' ? 'badge-info' : 'badge-danger'
                              }`} style={{ fontSize: '0.7rem' }}>
                              {r.status}
                              {r.late_minutes > 0 ? ` (+${r.late_minutes}m)` : ''}
                            </span>
                          </td>

                          {/* Catatan / Handover */}
                          <td style={{ padding: '12px 14px', maxWidth: '200px' }}>
                            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {r.handover_notes || r.notes || '-'}
                            </div>
                          </td>

                          {/* Aksi */}
                          <td style={{ padding: '12px 14px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                              {isOn && (
                                <button
                                  onClick={() => handleOpenClockOut(r)}
                                  className="btn btn-secondary"
                                  style={{ padding: '4px 8px', fontSize: '0.7rem', color: 'var(--gold-light)' }}
                                  title="Clock-out Staf Ini"
                                >
                                  <LogOut size={12} />
                                </button>
                              )}

                              <button
                                onClick={() => setSelectedRecordDetail(r)}
                                className="btn btn-secondary"
                                style={{ padding: '4px 8px', fontSize: '0.7rem' }}
                                title="Lihat Detail Absensi"
                              >
                                <Info size={12} />
                              </button>

                              {isOwner && (
                                <button
                                  onClick={() => handleDeleteRecord(r.id, staffName)}
                                  className="btn btn-secondary"
                                  style={{ padding: '4px 8px', fontSize: '0.7rem', color: 'var(--danger)' }}
                                  title="Hapus Record"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          </td>

                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* KONDISIONAL 2: VIEW RAPOR & PENILAIAN KINERJA BULANAN KRU                */}
      {/* ========================================================================= */}
      {attendanceSubTab === 'appraisal' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>

          {/* Monthly Highlight KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>

            {/* Card 1: Punctuality Rate */}
            <div className="glass-card" style={{ padding: '18px 20px', borderLeft: '4px solid var(--success)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                  Tingkat Disiplin Tim (On-Time)
                </span>
                <CheckCircle2 size={18} color="var(--success)" />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
                <h3 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0, fontFamily: 'var(--font-mono)' }}>
                  {monthlyAppraisalData.cafePunctualityRate}%
                </h3>
                <span style={{ fontSize: '0.78rem', color: monthlyAppraisalData.cafePunctualityRate >= 90 ? 'var(--success)' : 'var(--warning)', fontWeight: 600 }}>
                  {monthlyAppraisalData.cafePunctualityRate >= 90 ? '✓ Sangat Baik' : '⚠️ Perlu Evaluasi'}
                </span>
              </div>
              <div style={{ marginTop: '10px', width: '100%', height: '6px', background: 'rgba(0, 0, 0, 0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  width: `${monthlyAppraisalData.cafePunctualityRate}%`,
                  height: '100%',
                  background: monthlyAppraisalData.cafePunctualityRate >= 90 ? 'var(--success)' : 'var(--warning)',
                  borderRadius: '4px'
                }}></div>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                {monthlyAppraisalData.totalCafeOnTime} Shift Tepat Waktu • {monthlyAppraisalData.totalCafeLate} Keterlambatan
              </div>
            </div>

            {/* Card 2: Total Shifts */}
            <div className="glass-card" style={{ padding: '18px 20px', borderLeft: '4px solid var(--burgundy-primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                  Total Shift Dijalankan
                </span>
                <Calendar size={18} color="var(--burgundy-primary)" />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
                <h3 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--burgundy-primary)', margin: 0, fontFamily: 'var(--font-mono)' }}>
                  {monthlyAppraisalData.totalCafeShifts}
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Shift Kerja</span>
              </div>
              <p style={{ margin: '14px 0 0 0', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                Periode: <strong>{formatMonthTitle(selectedAppraisalMonth)}</strong> ({monthlyAppraisalData.totalCafeHadir} Sesi Hadir)
              </p>
            </div>

            {/* Card 3: Total Overtime */}
            <div className="glass-card" style={{ padding: '18px 20px', borderLeft: '4px solid #D97706' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                  Akumulasi Lembur (Overtime)
                </span>
                <TrendingUp size={18} color="#D97706" />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
                <h3 style={{ fontSize: '2rem', fontWeight: 900, color: '#B45309', margin: 0, fontFamily: 'var(--font-mono)' }}>
                  +{monthlyAppraisalData.totalCafeOT}
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Jam Kerja</span>
              </div>
              <p style={{ margin: '14px 0 0 0', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                Dedikasi jam tambahan operasional cafe di luar shift normal.
              </p>
            </div>

            {/* Card 4: Top Performer (Employee of the Month) */}
            <div className="glass-card" style={{
              padding: '18px 20px',
              borderLeft: '4px solid #D97706',
              background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.08) 0%, rgba(255, 255, 255, 0.98) 100%)',
              border: '1px solid rgba(217, 119, 6, 0.25)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.74rem', color: '#B45309', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em' }}>
                  👑 Kru Teladan Bulan Ini
                </span>
                <Trophy size={18} color="#D97706" />
              </div>
              {monthlyAppraisalData.topPerformer ? (
                <div style={{ marginTop: '8px' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                    {monthlyAppraisalData.topPerformer.name}
                  </div>
                  <span style={{ fontSize: '0.76rem', color: '#B45309', display: 'block', marginBottom: '6px' }}>
                    {monthlyAppraisalData.topPerformer.position} • Skor: <strong>{monthlyAppraisalData.topPerformer.score}/100</strong> (Grade {monthlyAppraisalData.topPerformer.grade})
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--success)' }}>
                    <Check size={13} />
                    <span>Ketepatan Waktu: {monthlyAppraisalData.topPerformer.punctualityRate}% On-Time</span>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: '12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Belum ada data presensi kru di bulan ini.
                </div>
              )}
            </div>

          </div>

          {/* Main Card: Crew Performance Scorecard Table */}
          <div className="glass-card" style={{ overflow: 'hidden' }}>

            {/* Table Header & Controls */}
            <div style={{ padding: '20px 22px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Award size={20} color="var(--burgundy-primary)" />
                    <span>Rapor Evaluasi Kinerja & Kedisiplinan Kru — {formatMonthTitle(selectedAppraisalMonth)}</span>
                  </h3>
                  <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Penilaian terukur otomatis berdasarkan kehadiran, ketepatan waktu masuk, akumulasi menit keterlambatan, dan dedikasi lembur.
                  </p>
                </div>

                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', background: 'var(--bg-surface)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  Total Kru Dinilai: <strong style={{ color: 'var(--burgundy-primary)' }}>{filteredStaffAppraisals.length} Orang</strong>
                </div>
              </div>

              {/* Filter Bar */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>

                {/* Search Kru */}
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Cari Kru / Posisi:</label>
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      placeholder="Ketik nama kru..."
                      value={searchAppraisalStaff}
                      onChange={(e) => setSearchAppraisalStaff(e.target.value)}
                      className="form-input"
                      style={{ paddingLeft: '32px', fontSize: '0.82rem' }}
                    />
                  </div>
                </div>

                {/* Filter Grade */}
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Filter Grade Kinerja:</label>
                  <select
                    value={filterAppraisalGrade}
                    onChange={(e) => setFilterAppraisalGrade(e.target.value)}
                    className="form-input"
                    style={{ fontSize: '0.82rem' }}
                  >
                    <option value="Semua">Semua Grade</option>
                    <option value="A">Grade A (Sangat Teladan ≥ 90)</option>
                    <option value="B">Grade B (Baik & Konsisten 75-89)</option>
                    <option value="C">Grade C (Perlu Evaluasi 60-74)</option>
                    <option value="D">Grade D (Peringatan &lt; 60)</option>
                  </select>
                </div>

                {/* Sort Dropdown */}
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Urutkan Data:</label>
                  <select
                    value={sortAppraisalBy}
                    onChange={(e) => setSortAppraisalBy(e.target.value)}
                    className="form-input"
                    style={{ fontSize: '0.82rem' }}
                  >
                    <option value="score_desc">🏆 Skor Kinerja Tertinggi</option>
                    <option value="score_asc">Skor Kinerja Terendah</option>
                    <option value="punctuality_desc">⚡ Paling Disiplin (% On-Time)</option>
                    <option value="late_desc">⚠️ Menit Telat Terbanyak</option>
                    <option value="ot_desc">🔥 Jam Lembur Terbanyak</option>
                    <option value="name_asc">Nama Staf (A - Z)</option>
                  </select>
                </div>

              </div>
            </div>

            {/* Table List of Crew */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-input)', color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <th style={{ padding: '12px 14px', textAlign: 'center', width: '60px' }}>Rank</th>
                    <th style={{ padding: '12px 14px', textAlign: 'left' }}>Kru & Posisi</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center' }}>Skor & Grade</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center' }}>Hadir</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center' }}>Disiplin Waktu</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center' }}>Keterlambatan</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center' }}>Lembur</th>
                    <th style={{ padding: '12px 14px', textAlign: 'left' }}>Status & Rekomendasi</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStaffAppraisals.length === 0 ? (
                    <tr>
                      <td colSpan="9" style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                          <Calendar size={36} color="var(--gold-light)" opacity={0.6} />
                          <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            Belum Ada Data Penilaian di Bulan Ini
                          </span>
                          <p style={{ margin: 0, fontSize: '0.8rem', maxWidth: '440px', color: 'var(--text-muted)' }}>
                            Data penilaian otomatis terkumpul saat kru melakukan presensi. Untuk menguji coba fitur rapor evaluasi ini, Anda bisa mengklik tombol di bawah:
                          </p>
                          <button
                            onClick={handleGenerateDemoData}
                            className="btn btn-primary"
                            style={{ marginTop: '6px', padding: '8px 18px', fontSize: '0.84rem' }}
                          >
                            <Sparkles size={14} />
                            <span>Muat Data Simulasi September 2026</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredStaffAppraisals.map((staff, idx) => {
                      const isTop1 = idx === 0 && staff.score > 0;
                      const isTop2 = idx === 1 && staff.score > 0;
                      const isTop3 = idx === 2 && staff.score > 0;

                      return (
                        <tr
                          key={staff.name}
                          style={{
                            borderBottom: '1px solid var(--border-subtle)',
                            transition: 'background 0.2s',
                            background: isTop1 ? 'rgba(255, 209, 102, 0.04)' : 'transparent'
                          }}
                          className="table-row-hover"
                        >
                          {/* Rank */}
                          <td style={{ padding: '14px', textAlign: 'center' }}>
                            {isTop1 ? (
                              <span style={{ fontSize: '1.1rem' }} title="Peringkat 1">🥇</span>
                            ) : isTop2 ? (
                              <span style={{ fontSize: '1.1rem' }} title="Peringkat 2">🥈</span>
                            ) : isTop3 ? (
                              <span style={{ fontSize: '1.1rem' }} title="Peringkat 3">🥉</span>
                            ) : (
                              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                #{idx + 1}
                              </span>
                            )}
                          </td>

                          {/* Kru & Posisi */}
                          <td style={{ padding: '14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '10px',
                                background: isTop1 ? 'var(--gold-glow)' : 'rgba(255,255,255,0.06)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                                color: isTop1 ? 'var(--gold-light)' : 'var(--text-secondary)',
                                border: `1px solid ${isTop1 ? 'var(--gold-primary)' : 'var(--border-subtle)'}`
                              }}>
                                {staff.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.88rem' }}>
                                  {staff.name}
                                </div>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                  {staff.position}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Skor & Grade */}
                          <td style={{ padding: '14px', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                              <span className={`badge ${staff.gradeBadge}`} style={{ fontSize: '0.78rem', fontWeight: 800, padding: '3px 10px' }}>
                                Grade {staff.grade}
                              </span>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {staff.score} <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>/ 100</span>
                              </span>
                            </div>
                          </td>

                          {/* Hadir */}
                          <td style={{ padding: '14px', textAlign: 'center' }}>
                            <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                              {staff.totalHadir}
                            </strong>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>
                              dari {staff.totalShift} Shift
                            </span>
                          </td>

                          {/* Disiplin Waktu (% On-Time) */}
                          <td style={{ padding: '14px', textAlign: 'center' }}>
                            <span style={{
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 800,
                              color: staff.punctualityRate >= 90 ? 'var(--success)' : staff.punctualityRate >= 75 ? 'var(--gold-light)' : 'var(--warning)',
                              fontSize: '0.9rem'
                            }}>
                              {staff.punctualityRate}%
                            </span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>
                              {staff.totalOnTime}x Tepat Waktu
                            </span>
                          </td>

                          {/* Keterlambatan */}
                          <td style={{ padding: '14px', textAlign: 'center' }}>
                            {staff.totalLate > 0 ? (
                              <div>
                                <span style={{ color: 'var(--warning)', fontWeight: 700 }}>
                                  {staff.totalLate}x
                                </span>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>
                                  ({staff.totalLateMinutes} Menit)
                                </span>
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: 'var(--success)' }}>
                                ✓ 0 Telat
                              </span>
                            )}
                          </td>

                          {/* Lembur */}
                          <td style={{ padding: '14px', textAlign: 'center' }}>
                            {staff.totalOvertimeHours > 0 ? (
                              <span style={{ color: '#f72585', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                                +{staff.totalOvertimeHours} Jam
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>-</span>
                            )}
                          </td>

                          {/* Status & Rekomendasi */}
                          <td style={{ padding: '14px', maxWidth: '240px' }}>
                            <div style={{ fontWeight: 600, fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                              {staff.statusDesc}
                            </div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px', lineHeight: '1.3' }}>
                              {staff.recommendation}
                            </span>
                          </td>

                          {/* Aksi */}
                          <td style={{ padding: '14px', textAlign: 'center' }}>
                            <button
                              onClick={() => setSelectedAppraisalStaff(staff)}
                              className="btn btn-secondary"
                              style={{ padding: '5px 12px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                              title="Lihat & Cetak Rapor Kinerja Lengkap"
                            >
                              <FileText size={13} color="var(--gold-light)" />
                              <span>Rapor</span>
                            </button>
                          </td>

                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: CLOCK-IN DETAIL (MULAI SHIFT)                                    */}
      {/* ========================================================================= */}
      {showClockInModal && createPortal(
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          width: '100vw', height: '100vh',
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
          <div className="modal-container glass-card animate-fade-in" style={{
            maxWidth: '520px',
            width: '100%',
            margin: 'auto',
            maxHeight: 'min(90vh, calc(100vh - 32px))',
            overflowY: 'auto',
            boxSizing: 'border-box',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-hover)',
            borderRadius: 'var(--radius-lg)',
            padding: '26px',
            boxShadow: '0 20px 60px rgba(79, 70, 229, 0.15)',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(13, 148, 136, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <LogIn size={20} color="var(--success)" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>Presensi Masuk Shift (Clock-In)</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Bara Coffee Coffee & Eatery • {todayStr}</span>
                </div>
              </div>
              <button onClick={() => setShowClockInModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleClockInSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Foto Selfie Absensi Masuk */}
              <div className="form-group" style={{ margin: 0, padding: "12px", background: "var(--bg-input)", borderRadius: "12px", border: "1px solid var(--border-subtle)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <label className="form-label" style={{ margin: 0, display: "flex", alignItems: "center", gap: "6px", fontSize: "0.84rem", fontWeight: 700 }}>
                    <Camera size={16} color="#4F46E5" />
                    <span>Foto Selfie Masuk Shift <span style={{ color: "#ef4444" }}>*Wajib</span></span>
                  </label>
                  {inSelfie && (
                    <span style={{ fontSize: "0.74rem", color: "#10b981", fontWeight: 700 }}>✓ Foto Terpasang</span>
                  )}
                </div>

                {cameraActive ? (
                  <div style={{ textAlign: "center", marginBottom: "10px" }}>
                    <div style={{ width: "100%", maxWidth: "280px", height: "220px", margin: "0 auto", background: "#000", borderRadius: "12px", overflow: "hidden" }}>
                      <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                    <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginTop: "10px" }}>
                      <button type="button" onClick={() => captureSelfie(setInSelfie)} className="btn btn-primary" style={{ padding: "6px 14px", fontSize: "0.82rem" }}>
                        Ambil Foto
                      </button>
                      <button type="button" onClick={stopCamera} className="btn btn-secondary" style={{ padding: "6px 14px", fontSize: "0.82rem" }}>
                        Batal
                      </button>
                    </div>
                  </div>
                ) : inSelfie ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <img src={inSelfie} alt="Selfie Masuk" style={{ width: "64px", height: "64px", borderRadius: "10px", objectFit: "cover", border: "2px solid #4F46E5" }} />
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button type="button" onClick={startCamera} className="btn btn-secondary" style={{ padding: "5px 10px", fontSize: "0.78rem" }}>
                        Foto Ulang
                      </button>
                      <button type="button" onClick={() => setInSelfie(null)} className="btn btn-ghost" style={{ color: "#ef4444", padding: "5px 10px", fontSize: "0.78rem" }}>
                        Hapus
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "12px", border: "1.5px dashed #4F46E5", borderRadius: "10px", background: "#EEF2FF" }}>
                    <p style={{ margin: "0 0 8px 0", fontSize: "0.8rem", color: "#4338CA", fontWeight: 700 }}>
                      Wajib ambil foto selfie wajah langsung via kamera perangkat di outlet
                    </p>
                    <button type="button" onClick={startCamera} className="btn btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 16px", fontSize: "0.84rem", fontWeight: 700 }}>
                      <Camera size={16} /> Buka Kamera Selfie Langsung
                    </button>
                  </div>
                )}
              </div>

              {/* Nama Staf */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="form-label" style={{ margin: 0 }}>Nama Staf:</label>
                  {!isOwner ? (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Akun Login</span>
                  ) : (
                    <span style={{ fontSize: '0.72rem', color: 'var(--burgundy-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Sparkles size={12} /> Auto-Sync Aktif
                    </span>
                  )}
                </div>
                {isOwner ? (
                  <select
                    value={inStaffName}
                    onChange={(e) => handleStaffChange(e.target.value)}
                    className="form-input"
                    required
                  >
                    {!staffList.some(s => s.name === currentUser?.name) && currentUser?.name && (
                      <option value={currentUser.name}>{currentUser.name} ({currentUser.position || 'Owner'})</option>
                    )}
                    {staffList.map(s => (
                      <option key={s.id || s.name} value={s.name}>{s.name} ({s.position || 'Kru'})</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={inStaffName}
                    disabled
                    className="form-input"
                    style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', fontWeight: 600, border: '1px solid var(--border-subtle)' }}
                  />
                )}
                {/* Banner Otomatis Sesuai Role Staf */}
                {(() => {
                  const currentStaff = staffList.find(s => s.name === inStaffName);
                  const staffRole = currentStaff?.position || currentUser?.position || 'Kru';
                  return (
                    <div style={{
                      marginTop: '6px',
                      fontSize: '0.73rem',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'rgba(79, 70, 229, 0.06)',
                      padding: '5px 10px',
                      borderRadius: '6px',
                      border: '1px solid rgba(79, 70, 229, 0.15)'
                    }}>
                      <Sparkles size={13} color="var(--burgundy-primary)" />
                      <span>Role terdeteksi: <strong style={{ color: 'var(--burgundy-primary)' }}>{staffRole}</strong> • Station & jam divisi disinkronkan otomatis</span>
                    </div>
                  );
                })()}
              </div>

              {/* Station & Shift Divisi */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className="form-label" style={{ margin: 0 }}>Station / Posisi:</label>
                    <span style={{ fontSize: '0.68rem', color: 'var(--success)', fontWeight: 600 }}>⚡ Auto Role</span>
                  </div>
                  <select
                    value={inPosition}
                    onChange={(e) => handlePositionChange(e.target.value)}
                    className="form-input"
                    required
                  >
                    {availablePositions.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className="form-label" style={{ margin: 0 }}>Pilih Shift & Divisi:</label>
                    <span style={{ fontSize: '0.68rem', color: 'var(--burgundy-primary)', fontWeight: 600 }}>⏰ Auto Jam</span>
                  </div>
                  <select
                    value={inShift}
                    onChange={(e) => handleShiftChange(e.target.value)}
                    className="form-input"
                    required
                  >
                    {Array.from(new Set(availableShifts.map(s => s.division))).map(divName => {
                      const divShifts = availableShifts.filter(s => s.division === divName);
                      if (divShifts.length === 0) return null;
                      return (
                        <optgroup key={divName} label={divName}>
                          {divShifts.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.label}
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Live Real-time Clock Card (Terkunci Otomatis, Tidak Bisa Diedit Manual) */}
              <div style={{
                background: 'var(--bg-input)',
                padding: '14px 16px',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${punctuality.isLate ? 'rgba(231, 111, 81, 0.4)' : 'rgba(46, 196, 182, 0.4)'}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Clock size={16} color={punctuality.isLate ? 'var(--warning)' : 'var(--success)'} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Waktu Clock-In Otomatis:
                    </span>
                  </div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', background: 'var(--bg-surface)', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                    🔒 Terkunci Otomatis
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--burgundy-primary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.02em' }}>
                      {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginLeft: '6px' }}>WIB</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                        Divisi: <strong style={{ color: 'var(--burgundy-primary)' }}>{selectedShiftObj.division}</strong> ({selectedShiftObj.shortName})
                      </span>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                        Jadwal Jam Divisi: <strong style={{ color: 'var(--burgundy-primary)' }}>{selectedShiftObj.startTime} – {selectedShiftObj.endTime} WIB</strong>
                      </span>
                    </div>
                  </div>

                  {/* Status Otomatis */}
                  <div>
                    {punctuality.isLate ? (
                      <span className="badge badge-warning" style={{ fontSize: '0.78rem', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        ⚠️ Terlambat {punctuality.lateMinutes} Menit
                      </span>
                    ) : (
                      <span className="badge badge-success" style={{ fontSize: '0.78rem', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        ✓ Tepat Waktu (On-Time)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Jika Terdeteksi Terlambat: WAJIB Berikan Alasan */}
              {punctuality.isLate && (
                <div style={{
                  background: 'rgba(231, 111, 81, 0.12)',
                  padding: '14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(231, 111, 81, 0.35)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--warning)', fontWeight: 700, fontSize: '0.82rem' }}>
                    <ShieldAlert size={16} />
                    <span>Perhatian: Anda Terlambat Masuk Shift ({punctuality.lateMinutes} Menit Lewat)</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                    Waktu clock-in melewati jadwal resmi shift (<strong>{selectedShiftObj.startTime} WIB</strong>). Sistem mewajibkan Anda untuk mengisi alasan keterlambatan berikut sebelum menyimpan absensi.
                  </p>
                  <label className="form-label" style={{ margin: '4px 0 0 0', color: 'var(--text-primary)', fontSize: '0.78rem' }}>
                    <span>Alasan Keterlambatan (Wajib Diisi):</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Contoh: Macet parah jalan protokol / ban motor bocor di perjalanan..."
                    value={inLateReason}
                    onChange={(e) => setInLateReason(e.target.value)}
                    className="form-input"
                    style={{ background: 'var(--bg-input)', borderColor: 'rgba(231, 111, 81, 0.5)', fontSize: '0.85rem' }}
                    required
                  />
                </div>
              )}

              {/* Checklist Kesiapan Shift */}
              <div style={{ background: 'var(--bg-input)', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--burgundy-primary)', display: 'block', marginBottom: '8px' }}>
                  Checklist Kesiapan Kerja & Grooming:
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={inChecklist.uniform}
                      onChange={(e) => setInChecklist({ ...inChecklist, uniform: e.target.checked })}
                    />
                    <span>Seragam & Apron bersih terpakai rapi</span>
                  </label>
                  <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={inChecklist.grooming}
                      onChange={(e) => setInChecklist({ ...inChecklist, grooming: e.target.checked })}
                    />
                    <span>Kuku bersih, rambut rapi, standar hygiene cafe</span>
                  </label>
                  <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={inChecklist.healthy}
                      onChange={(e) => setInChecklist({ ...inChecklist, healthy: e.target.checked })}
                    />
                    <span>Kondisi tubuh sehat & siap bertugas melayani pelanggan</span>
                  </label>
                </div>
              </div>

              {/* Catatan Awal Shift */}
              {!punctuality.isLate && (
                <div className="form-group">
                  <label className="form-label">
                    <span>Catatan Awal Shift (Opsional):</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Misal: Kondisi bar bersih, suhu chiller aman..."
                    value={inNotes}
                    onChange={(e) => setInNotes(e.target.value)}
                    className="form-input"
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowClockInModal(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 2, padding: '11px', justifyContent: 'center' }}
                >
                  <LogIn size={16} />
                  <span>Konfirmasi Masuk Shift</span>
                </button>
              </div>

            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CLOCK-OUT DETAIL & HANDOVER SHIFT                                */}
      {/* ========================================================================= */}
      {showClockOutModal && createPortal(
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          width: '100vw', height: '100vh',
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
          <div className="modal-container glass-card animate-fade-in" style={{
            maxWidth: '520px',
            width: '100%',
            margin: 'auto',
            maxHeight: 'min(90vh, calc(100vh - 32px))',
            overflowY: 'auto',
            boxSizing: 'border-box',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-hover)',
            borderRadius: 'var(--radius-lg)',
            padding: '26px',
            boxShadow: '0 20px 60px rgba(79, 70, 229, 0.15)',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(225, 29, 72, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <LogOut size={20} color="var(--danger)" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>Presensi Selesai Shift (Clock-Out)</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Closing Shift & Serah Terima Operasional</span>
                </div>
              </div>
              <button onClick={() => setShowClockOutModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleClockOutSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Foto Selfie Absensi Pulang */}
              <div className="form-group" style={{ margin: 0, padding: "12px", background: "var(--bg-input)", borderRadius: "12px", border: "1px solid var(--border-subtle)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <label className="form-label" style={{ margin: 0, display: "flex", alignItems: "center", gap: "6px", fontSize: "0.84rem", fontWeight: 700 }}>
                    <Camera size={16} color="#4F46E5" />
                    <span>Foto Bukti Closing / Pulang <span style={{ color: "#ef4444" }}>*Wajib</span></span>
                  </label>
                  {outSelfie && (
                    <span style={{ fontSize: "0.74rem", color: "#10b981", fontWeight: 700 }}>✓ Foto Terpasang</span>
                  )}
                </div>

                {cameraActive ? (
                  <div style={{ textAlign: "center", marginBottom: "10px" }}>
                    <div style={{ width: "100%", maxWidth: "280px", height: "220px", margin: "0 auto", background: "#000", borderRadius: "12px", overflow: "hidden" }}>
                      <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                    <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginTop: "10px" }}>
                      <button type="button" onClick={() => captureSelfie(setOutSelfie)} className="btn btn-primary" style={{ padding: "6px 14px", fontSize: "0.82rem" }}>
                        Ambil Foto Closing
                      </button>
                      <button type="button" onClick={stopCamera} className="btn btn-secondary" style={{ padding: "6px 14px", fontSize: "0.82rem" }}>
                        Batal
                      </button>
                    </div>
                  </div>
                ) : outSelfie ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <img src={outSelfie} alt="Selfie Pulang" style={{ width: "64px", height: "64px", borderRadius: "10px", objectFit: "cover", border: "2px solid #4F46E5" }} />
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button type="button" onClick={startCamera} className="btn btn-secondary" style={{ padding: "5px 10px", fontSize: "0.78rem" }}>
                        Foto Ulang
                      </button>
                      <button type="button" onClick={() => setOutSelfie(null)} className="btn btn-ghost" style={{ color: "#ef4444", padding: "5px 10px", fontSize: "0.78rem" }}>
                        Hapus
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "12px", border: "1.5px dashed #4F46E5", borderRadius: "10px", background: "#EEF2FF" }}>
                    <p style={{ margin: "0 0 8px 0", fontSize: "0.8rem", color: "#4338CA", fontWeight: 700 }}>
                      Wajib ambil foto bukti closing / pulang shift secara langsung di outlet
                    </p>
                    <button type="button" onClick={startCamera} className="btn btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 16px", fontSize: "0.84rem", fontWeight: 700 }}>
                      <Camera size={16} /> Buka Kamera Selfie Closing
                    </button>
                  </div>
                )}
              </div>

              {/* Ringkasan Jam Masuk & Jam Keluar Otomatis */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: 'var(--bg-input)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Jam Masuk Shift:</span>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--success)', fontFamily: 'var(--font-mono)' }}>
                    {records.find(r => r.id === outRecordId)?.clock_in || records.find(r => r.id === outRecordId)?.clockIn || '-'}
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    {records.find(r => r.id === outRecordId)?.shift || 'Shift'}
                  </span>
                </div>

                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Jam Keluar (Realtime):</span>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--burgundy-primary)', fontFamily: 'var(--font-mono)' }}>
                    {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    🔒 Terkunci Otomatis
                  </span>
                </div>
              </div>

              {/* Durasi Kerja Otomatis */}
              <div style={{ background: 'rgba(79, 70, 229, 0.06)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Estimasi Durasi Kerja:</span>
                <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {calculateWorkDuration(records.find(r => r.id === outRecordId)?.clock_in || '08:00', formatTimeHM(currentTime))}
                </strong>
              </div>

              {/* Lembur / Overtime */}
              <div className="form-group">
                <label className="form-label">
                  <span>Jam Lembur Tambahan (Overtime):</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Di luar durasi normal shift</span>
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="12"
                  value={outOvertime}
                  onChange={(e) => setOutOvertime(e.target.value)}
                  className="form-input"
                  placeholder="0 jika tidak ada lembur"
                />
              </div>

              {/* Checklist Closing Shift */}
              <div style={{ background: 'var(--bg-input)', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--burgundy-primary)', display: 'block', marginBottom: '8px' }}>
                  Closing & Handover Checklist:
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={outChecklist.cashReconciled}
                      onChange={(e) => setOutChecklist({ ...outChecklist, cashReconciled: e.target.checked })}
                    />
                    <span>Uang kas laci dihitung & balance dengan form omset</span>
                  </label>
                  <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={outChecklist.equipmentClean}
                      onChange={(e) => setOutChecklist({ ...outChecklist, equipmentClean: e.target.checked })}
                    />
                    <span>Mesin espresso dibersihkan / backflush & grinder disikat</span>
                  </label>
                  <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={outChecklist.chillerStockChecked}
                      onChange={(e) => setOutChecklist({ ...outChecklist, chillerStockChecked: e.target.checked })}
                    />
                    <span>Stok display & chiller sudah dicek untuk shift berikutnya</span>
                  </label>
                </div>
              </div>

              {/* Catatan Serah Terima / Pesan untuk Shift Berikutnya */}
              <div className="form-group">
                <label className="form-label">
                  <span>Catatan Serah Terima (Handover Shift):</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Pesan untuk kasir / barista shift berikutnya</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Misal: Susu sisa 2 pouch di chiller, biji kopi House Blend perlu roasting ulang, uang kecil di laci Rp 200.000..."
                  value={outHandover}
                  onChange={(e) => setOutHandover(e.target.value)}
                  className="form-input"
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowClockOutModal(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 2, padding: '11px', justifyContent: 'center' }}
                >
                  <CheckCircle2 size={16} />
                  <span>Selesaikan & Simpan Clock-Out</span>
                </button>
              </div>

            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CATAT IZIN / SAKIT / CUTI                                        */}
      {/* ========================================================================= */}
      {showLeaveModal && createPortal(
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          width: '100vw', height: '100vh',
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
          <div className="modal-container glass-card animate-fade-in" style={{
            maxWidth: '480px',
            width: '100%',
            margin: 'auto',
            maxHeight: 'min(90vh, calc(100vh - 32px))',
            overflowY: 'auto',
            boxSizing: 'border-box',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-hover)',
            borderRadius: 'var(--radius-lg)',
            padding: '26px',
            boxShadow: '0 20px 60px rgba(79, 70, 229, 0.15)',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(13, 148, 136, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={20} color="var(--success)" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>Pencatatan Izin / Sakit Staf</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Dokumentasi ketidakhadiran kerja</span>
                </div>
              </div>
              <button onClick={() => setShowLeaveModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleLeaveSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

              <div className="form-group">
                <label className="form-label">Nama Staf:</label>
                {isOwner ? (
                  <select
                    value={leaveStaffName}
                    onChange={(e) => setLeaveStaffName(e.target.value)}
                    className="form-input"
                    required
                  >
                    {staffList.map(s => (
                      <option key={s.id} value={s.name}>{s.name} ({s.position || 'Kru'})</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={leaveStaffName}
                    disabled
                    className="form-input"
                    style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', fontWeight: 600, border: '1px solid var(--border-subtle)' }}
                  />
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label className="form-label">Tanggal Tidak Hadir:</label>
                  <input
                    type="date"
                    value={leaveDate}
                    onChange={(e) => setLeaveDate(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Jenis Ketidakhadiran:</label>
                  <select
                    value={leaveType}
                    onChange={(e) => setLeaveType(e.target.value)}
                    className="form-input"
                  >
                    <option value="Sakit">Sakit</option>
                    <option value="Izin">Izin</option>
                    <option value="Cuti">Cuti</option>
                    <option value="Alpa">Alpa / Tanpa Keterangan</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Keterangan / Alasan:</label>
                <textarea
                  rows={3}
                  placeholder="Misal: Sakit flu demam, sudah ada surat dokter..."
                  value={leaveNotes}
                  onChange={(e) => setLeaveNotes(e.target.value)}
                  className="form-input"
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowLeaveModal(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 2, padding: '11px', justifyContent: 'center' }}
                >
                  <CheckCircle2 size={16} />
                  <span>Simpan Catatan Izin</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: POPUP RINCIAN DETAIL & SLIP PRESENSI SHIFT                      */}
      {/* ========================================================================= */}
      {selectedRecordDetail && (() => {
        const staffName = selectedRecordDetail.staff_name || selectedRecordDetail.name;
        const position = selectedRecordDetail.position || 'Kru';
        const dateStr = formatDateID(selectedRecordDetail.entry_date || selectedRecordDetail.date);
        const clockIn = selectedRecordDetail.clock_in || selectedRecordDetail.clockIn || '-';
        const clockOut = selectedRecordDetail.clock_out || selectedRecordDetail.clockOut || '-';
        const duration = selectedRecordDetail.work_duration || calculateWorkDuration(clockIn, clockOut);

        return createPortal(
          <div className="modal-overlay print-modal-overlay" style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            width: '100vw', height: '100vh',
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
            <div className="modal-container printable-document animate-fade-in" style={{
              maxWidth: '560px',
              width: '100%',
              margin: 'auto',
              maxHeight: 'min(92vh, calc(100vh - 32px))',
              overflowY: 'auto',
              boxSizing: 'border-box',
              background: '#ffffff',
              color: '#1a1a1a',
              borderRadius: '14px',
              padding: '32px 36px',
              boxShadow: '0 20px 60px rgba(79, 70, 229, 0.18)',
              fontFamily: 'var(--font-sans)',
              position: 'relative'
            }}>

              {/* Close Button top-right */}
              <button 
                onClick={() => setSelectedRecordDetail(null)} 
                className="no-print"
                style={{ 
                  position: 'absolute', top: '16px', right: '16px', 
                  background: 'rgba(79, 70, 229, 0.08)', border: 'none', 
                  color: '#4F46E5', cursor: 'pointer', 
                  width: '32px', height: '32px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
                title="Tutup Modal"
              >
                <X size={18} />
              </button>

              {/* Slip Header */}
              <div style={{ textAlign: 'center', borderBottom: '3px double #4F46E5', paddingBottom: '14px', marginBottom: '16px' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <Coffee size={22} color="#4F46E5" />
                  <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900, color: '#4F46E5', fontFamily: 'var(--font-display)' }}>
                    KEDAI KOPI BARA
                  </h2>
                </div>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.74rem', color: '#666', fontWeight: 600, letterSpacing: '0.04em' }}>
                  BUKTI PRESENSI KERJA & SERAH TERIMA SHIFT
                </p>
                <div style={{ marginTop: '6px', display: 'inline-block', background: '#FAF7F2', padding: '3px 12px', borderRadius: '16px', border: '1px solid #E8DFD8' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#4F46E5' }}>
                    {selectedRecordDetail.shift} • {dateStr}
                  </span>
                </div>
              </div>

                            {/* Foto Selfie Presensi */ }
              {(selectedRecordDetail.photo_url || selectedRecordDetail.photo_out_url) && (
                <div style={{ display: "flex", gap: "12px", padding: "12px", background: "#FAF7F2", borderRadius: "8px", border: "1px solid #E8DFD8", marginBottom: "16px" }}>
                  {selectedRecordDetail.photo_url && (
                    <div>
                      <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#666", display: "block", marginBottom: "4px" }}>Foto Masuk Shift:</span>
                      <img src={selectedRecordDetail.photo_url} alt="Foto Masuk" style={{ width: "90px", height: "90px", borderRadius: "8px", objectFit: "cover", border: "2px solid #4F46E5" }} />
                    </div>
                  )}
                  {selectedRecordDetail.photo_out_url && (
                    <div>
                      <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#666", display: "block", marginBottom: "4px" }}>Foto Pulang Shift:</span>
                      <img src={selectedRecordDetail.photo_out_url} alt="Foto Pulang" style={{ width: "90px", height: "90px", borderRadius: "8px", objectFit: "cover", border: "2px solid #10b981" }} />
                    </div>
                  )}
                </div>
              )}

              {/* Staf & Posisi Meta */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.84rem', background: '#FAF7F2', border: '1px solid #E8DFD8', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px' }}>
                <div>Nama Staf: <strong>{staffName}</strong></div>
                <div>Posisi: <strong>{position}</strong></div>
                <div>Status: <strong style={{ color: selectedRecordDetail.status === 'Terlambat' ? '#c53030' : '#0d7a5f' }}>{selectedRecordDetail.status}</strong></div>
                <div>ID Presensi: <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.76rem' }}>{selectedRecordDetail.id?.slice(0, 8).toUpperCase() || 'PRES'}</span></div>
              </div>

              {/* Jam Masuk & Jam Keluar */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px', textAlign: 'center' }}>
                <div style={{ background: '#f2faf7', border: '1px solid #b7e4d7', padding: '10px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.72rem', color: '#0d7a5f', fontWeight: 700, display: 'block', textTransform: 'uppercase' }}>Clock-In (Masuk)</span>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0d7a5f', fontFamily: 'var(--font-mono)' }}>
                    {clockIn}
                  </div>
                </div>

                <div style={{ background: '#f8f8f8', border: '1px solid #ddd', padding: '10px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.72rem', color: '#555', fontWeight: 700, display: 'block', textTransform: 'uppercase' }}>Clock-Out (Keluar)</span>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#222', fontFamily: 'var(--font-mono)' }}>
                    {clockOut}
                  </div>
                </div>
              </div>

              {/* Rincian Waktu & Lembur */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.84rem', marginBottom: '16px', borderBottom: '1px solid #eee', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Durasi Efektif Kerja:</span>
                  <strong>{duration}</strong>
                </div>

                {Number(selectedRecordDetail.overtime_hours) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#B45309' }}>
                    <span>Jam Lembur (Overtime):</span>
                    <strong>+{selectedRecordDetail.overtime_hours} Jam</strong>
                  </div>
                )}

                {Number(selectedRecordDetail.late_minutes) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#c53030' }}>
                    <span>Keterlambatan:</span>
                    <strong>+{selectedRecordDetail.late_minutes} Menit</strong>
                  </div>
                )}
              </div>

              {/* Alasan Keterlambatan jika ada */}
              {selectedRecordDetail.late_reason && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 12px', borderRadius: '6px', marginBottom: '14px', fontSize: '0.82rem' }}>
                  <span style={{ fontWeight: 700, color: '#991b1b', display: 'block', marginBottom: '2px' }}>
                    Alasan Keterlambatan:
                  </span>
                  <span style={{ color: '#450a0a', fontStyle: 'italic' }}>
                    "{selectedRecordDetail.late_reason}"
                  </span>
                </div>
              )}

              {/* Catatan Serah Terima / Handover */}
              <div style={{ marginBottom: '20px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#555', display: 'block', marginBottom: '4px' }}>
                  Catatan Serah Terima (Handover Shift):
                </span>
                <div style={{ background: '#FAF7F2', border: '1px solid #E8DFD8', padding: '10px 12px', borderRadius: '6px', color: '#333', fontSize: '0.82rem', lineHeight: '1.4' }}>
                  {selectedRecordDetail.handover_notes || selectedRecordDetail.notes || 'Tidak ada catatan serah terima shift khusus.'}
                </div>
              </div>

              {/* Catatan Dokumen Resmi Digital */}
              <div style={{ textAlign: 'center', fontSize: '0.74rem', color: '#666', marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '10px' }}>
                * Dokumen rekap presensi shift ini tercatat otomatis oleh Sistem Bara Coffee Coffee & Eatery dan sah secara digital tanpa tanda tangan basah.
              </div>

              {/* Action Buttons (Hidden when printed) */}
              <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px', borderTop: '1px solid #e0dbd1', paddingTop: '14px' }}>
                <button
                  onClick={() => window.print()}
                  className="btn btn-secondary"
                  style={{ color: '#1a1a1a', background: '#FAF7F2', border: '1px solid #E8DFD8', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Printer size={15} color="#4F46E5" />
                  <span>Cetak Bukti Presensi</span>
                </button>
                <button
                  onClick={() => setSelectedRecordDetail(null)}
                  className="btn btn-primary"
                  style={{ fontSize: '0.84rem', padding: '8px 18px' }}
                >
                  Tutup
                </button>
              </div>

            </div>
          </div>,
          document.body
        );
      })()}

      {/* ========================================================================= */}
      {/* MODAL 5: POPUP SLIP RAPOR & PENILAIAN KINERJA BULANAN KRU RESMI          */}
      {/* ========================================================================= */}
      {selectedAppraisalStaff && (() => {
        const staff = selectedAppraisalStaff;
        const monthTitle = formatMonthTitle(selectedAppraisalMonth);

        // Filter riwayat terlambat
        const lateRecords = (staff.records || []).filter(r => r.status === 'Terlambat' || Number(r.late_minutes) > 0);

        return createPortal(
          <div className="modal-overlay print-modal-overlay" style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            width: '100vw', height: '100vh',
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
            <div className="modal-container printable-document animate-fade-in" style={{
              maxWidth: '640px',
              width: '100%',
              margin: 'auto',
              maxHeight: 'min(92vh, calc(100vh - 32px))',
              overflowY: 'auto',
              boxSizing: 'border-box',
              background: '#ffffff',
              color: '#1a1a1a',
              borderRadius: '14px',
              padding: '34px 38px',
              boxShadow: '0 20px 60px rgba(79, 70, 229, 0.18)',
              fontFamily: 'var(--font-sans)',
              position: 'relative'
            }}>

              {/* Close Button top-right */}
              <button 
                onClick={() => setSelectedAppraisalStaff(null)} 
                className="no-print"
                style={{ 
                  position: 'absolute', top: '16px', right: '16px', 
                  background: 'rgba(79, 70, 229, 0.08)', border: 'none', 
                  color: '#4F46E5', cursor: 'pointer', 
                  width: '32px', height: '32px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
                title="Tutup Modal"
              >
                <X size={18} />
              </button>

              {/* Slip Header */}
              <div style={{ textAlign: 'center', borderBottom: '3px double #4F46E5', paddingBottom: '14px', marginBottom: '16px' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <Coffee size={22} color="#4F46E5" />
                  <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900, color: '#4F46E5', fontFamily: 'var(--font-display)' }}>
                    KEDAI KOPI BARA
                  </h2>
                </div>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.74rem', color: '#666', fontWeight: 700, letterSpacing: '0.04em' }}>
                  LEMBAR RAPOR & PENILAIAN KINERJA BULANAN KRU
                </p>
                <div style={{ marginTop: '6px', display: 'inline-block', background: '#FAF7F2', padding: '3px 14px', borderRadius: '16px', border: '1px solid #E8DFD8' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#4F46E5' }}>
                    Periode Penilaian: {monthTitle}
                  </span>
                </div>
              </div>

              {/* Data Staf & Grade Box */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '12px', background: '#FAF7F2', border: '1px solid #E8DFD8', padding: '14px', borderRadius: '10px', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontSize: '0.78rem', color: '#666' }}>Nama Karyawan:</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#1a1510' }}>{staff.name}</div>
                  <div style={{ fontSize: '0.8rem', color: '#4F46E5', fontWeight: 700, marginTop: '2px' }}>
                    Posisi / Station: {staff.position}
                  </div>
                </div>

                <div style={{ textAlign: 'right', borderLeft: '1px solid #e0d5c5', paddingLeft: '14px' }}>
                  <div style={{ fontSize: '0.72rem', color: '#666', textTransform: 'uppercase', fontWeight: 700 }}>Hasil Evaluasi:</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: staff.score >= 90 ? '#0d7a5f' : staff.score >= 75 ? '#4F46E5' : '#c53030' }}>
                    GRADE {staff.grade}
                  </div>
                  <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#444' }}>
                    Skor: {staff.score} / 100
                  </span>
                </div>
              </div>

              {/* Matriks 4 KPI Utama */}
              <div className="appraisal-kpi-matriks" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px', textAlign: 'center' }}>

                <div style={{ background: '#f2faf7', border: '1px solid #b7e4d7', padding: '10px 6px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.68rem', color: '#0d7a5f', fontWeight: 700, display: 'block' }}>SHIFT HADIR</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0d7a5f', fontFamily: 'var(--font-mono)' }}>
                    {staff.totalHadir}
                  </div>
                  <span style={{ fontSize: '0.68rem', color: '#555' }}>/ {staff.totalShift} Sesi</span>
                </div>

                <div style={{ background: 'rgba(79, 70, 229, 0.06)', border: '1px solid rgba(79, 70, 229, 0.18)', padding: '10px 6px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.68rem', color: '#4F46E5', fontWeight: 700, display: 'block' }}>DISIPLIN ON-TIME</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#4F46E5', fontFamily: 'var(--font-mono)' }}>
                    {staff.punctualityRate}%
                  </div>
                  <span style={{ fontSize: '0.68rem', color: '#555' }}>{staff.totalOnTime} Tepat</span>
                </div>

                <div style={{ background: staff.totalLate > 0 ? '#fef2f2' : '#f8f8f8', border: `1px solid ${staff.totalLate > 0 ? '#fecaca' : '#ddd'}`, padding: '10px 6px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.68rem', color: staff.totalLate > 0 ? '#991b1b' : '#666', fontWeight: 700, display: 'block' }}>KETERLAMBATAN</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: staff.totalLate > 0 ? '#991b1b' : '#333', fontFamily: 'var(--font-mono)' }}>
                    {staff.totalLate}x
                  </div>
                  <span style={{ fontSize: '0.68rem', color: '#555' }}>{staff.totalLateMinutes} Menit</span>
                </div>

                <div style={{ background: '#fdf2f8', border: '1px solid #fbcfe8', padding: '10px 6px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.68rem', color: '#B45309', fontWeight: 700, display: 'block' }}>JAM LEMBUR</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#B45309', fontFamily: 'var(--font-mono)' }}>
                    +{staff.totalOvertimeHours}
                  </div>
                  <span style={{ fontSize: '0.68rem', color: '#555' }}>Jam Kerja</span>
                </div>

              </div>

              {/* Rincian Catatan Keterlambatan */}
              <div style={{ marginBottom: '16px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#333', display: 'block', marginBottom: '6px' }}>
                  Catatan Keterlambatan & Alasan Staf Bulan Ini:
                </span>
                {lateRecords.length > 0 ? (
                  <div style={{ border: '1px solid #e5dfd7', borderRadius: '8px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                      <thead>
                        <tr style={{ background: '#FAF7F2', borderBottom: '1px solid #E8DFD8', textAlign: 'left', color: '#4F46E5' }}>
                          <th style={{ padding: '6px 10px' }}>Tanggal</th>
                          <th style={{ padding: '6px 10px' }}>Masuk</th>
                          <th style={{ padding: '6px 10px', textAlign: 'center' }}>Telat</th>
                          <th style={{ padding: '6px 10px' }}>Alasan Keterlambatan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lateRecords.map((r, i) => (
                          <tr key={i} style={{ borderBottom: i < lateRecords.length - 1 ? '1px solid #eee' : 'none' }}>
                            <td style={{ padding: '6px 10px' }}>{r.entry_date || r.date}</td>
                            <td style={{ padding: '6px 10px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{r.clock_in || r.clockIn}</td>
                            <td style={{ padding: '6px 10px', textAlign: 'center', color: '#c53030', fontWeight: 700 }}>+{r.late_minutes}m</td>
                            <td style={{ padding: '6px 10px', fontStyle: 'italic', color: '#555' }}>"{r.late_reason || r.notes || '-'}"</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ background: '#f2faf7', border: '1px solid #b7e4d7', padding: '10px 14px', borderRadius: '8px', fontSize: '0.8rem', color: '#0d7a5f', fontWeight: 600 }}>
                    ✓ Sempurna! Kru ini memiliki rekor 100% disiplin tanpa ada keterlambatan di bulan ini.
                  </div>
                )}
              </div>

              {/* Rekomendasi Manajerial & Bonus */}
              <div style={{ background: '#FAF7F2', border: '1px solid #E8DFD8', padding: '12px 14px', borderRadius: '8px', marginBottom: '20px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#4F46E5', display: 'block', marginBottom: '2px' }}>
                  Catatan Evaluasi Manajerial & Rekomendasi Bonus:
                </span>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#333', lineHeight: '1.4' }}>
                  Status: <strong>{staff.statusDesc}</strong>. {staff.recommendation}
                </p>
              </div>

              {/* Catatan Dokumen Resmi Digital */}
              <div style={{ textAlign: 'center', fontSize: '0.74rem', color: '#666', marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '10px' }}>
                * Rapor evaluasi kinerja ini diterbitkan otomatis oleh Sistem Bara Coffee Coffee & Eatery dan sah secara digital tanpa tanda tangan basah.
              </div>

              {/* Action Buttons (Hidden when printed) */}
              <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px', borderTop: '1px solid #e0dbd1', paddingTop: '14px' }}>
                <button
                  onClick={() => window.print()}
                  className="btn btn-secondary"
                  style={{ color: '#1a1a1a', background: '#FAF7F2', border: '1px solid #E8DFD8', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Printer size={15} color="#4F46E5" />
                  <span>Cetak Rapor Penilaian Kru</span>
                </button>
                <button
                  onClick={() => setSelectedAppraisalStaff(null)}
                  className="btn btn-primary"
                  style={{ fontSize: '0.84rem', padding: '8px 18px' }}
                >
                  Tutup
                </button>
              </div>

            </div>
          </div>,
          document.body
        );
      })()}

    </div>
  );
}
