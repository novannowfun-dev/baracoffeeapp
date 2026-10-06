import { getSupabaseClient } from './supabase';

const STORAGE_KEY_SHIFTS = 'baracoffee_custom_shifts';
const STORAGE_KEY_POSITIONS = 'baracoffee_custom_positions';

export const DEFAULT_POSITIONS = [
  'Barista',
  'Baker',
  'Kasir',
  'Kitchen / Cook',
  'Pastry Chef',
  'Supervisor / Manager',
  'Steward / Runner'
];

export const DEFAULT_SHIFTS = [
  // ☕ Divisi Barista & Kasir (Front of House)
  { 
    id: 'barista_pagi', 
    division: '☕ Barista & Kasir (FOH)', 
    label: 'Barista / Kasir — Shift Pagi (07:00 – 15:00)', 
    shortName: 'Shift Pagi (FOH)', 
    startTime: '07:00', 
    endTime: '15:00',
    gracePeriod: 5,
    icon: '☀️' 
  },
  { 
    id: 'barista_sore', 
    division: '☕ Barista & Kasir (FOH)', 
    label: 'Barista / Kasir — Shift Sore / Closing (15:00 – 23:00)', 
    shortName: 'Shift Sore (FOH)', 
    startTime: '15:00', 
    endTime: '23:00',
    gracePeriod: 5,
    icon: '🌙' 
  },
  
  // 🥐 Divisi Bakery & Pastry (Kitchen Produksi)
  { 
    id: 'bakery_subuh', 
    division: '🥐 Bakery & Pastry (Produksi)', 
    label: 'Bakery — Shift Subuh / Proofing & Oven (05:30 – 13:30)', 
    shortName: 'Bakery Subuh', 
    startTime: '05:30', 
    endTime: '13:30',
    gracePeriod: 5,
    icon: '🥐' 
  },
  { 
    id: 'bakery_siang', 
    division: '🥐 Bakery & Pastry (Produksi)', 
    label: 'Bakery — Shift Siang / Dough & Restock (12:00 – 20:00)', 
    shortName: 'Bakery Siang', 
    startTime: '12:00', 
    endTime: '20:00',
    gracePeriod: 5,
    icon: '🥖' 
  },

  // 🍳 Divisi Kitchen & Cook
  { 
    id: 'kitchen_pagi', 
    division: '🍳 Kitchen & Cook (Hot Food)', 
    label: 'Kitchen — Shift Pagi (08:00 – 16:00)', 
    shortName: 'Kitchen Pagi', 
    startTime: '08:00', 
    endTime: '16:00',
    gracePeriod: 5,
    icon: '🍳' 
  },
  { 
    id: 'kitchen_sore', 
    division: '🍳 Kitchen & Cook (Hot Food)', 
    label: 'Kitchen — Shift Sore / Closing (14:00 – 22:00)', 
    shortName: 'Kitchen Sore', 
    startTime: '14:00', 
    endTime: '22:00',
    gracePeriod: 5,
    icon: '🔥' 
  },

  // ⚡ Fleksibel & Middle
  { 
    id: 'middle_shift', 
    division: '⚡ Umum & Fleksibel', 
    label: 'Middle Shift / Peak Hours (11:00 – 19:00)', 
    shortName: 'Middle Shift', 
    startTime: '11:00', 
    endTime: '19:00',
    gracePeriod: 5,
    icon: '⚡' 
  },
  { 
    id: 'full_day', 
    division: '⚡ Umum & Fleksibel', 
    label: 'Full Day (08:00 – 20:00)', 
    shortName: 'Full Day', 
    startTime: '08:00', 
    endTime: '20:00',
    gracePeriod: 5,
    icon: '⭐' 
  }
];

/**
 * Mengambil daftar Role / Posisi kustom dari Supabase / LocalStorage
 */
export async function getCustomPositions() {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('cafe_positions')
        .select('*')
        .order('title', { ascending: true });

      if (!error && data && data.length > 0) {
        const titles = data.map(d => d.title);
        localStorage.setItem(STORAGE_KEY_POSITIONS, JSON.stringify(titles));
        return titles;
      }

      // Jika tabel di Supabase masih kosong, seed DEFAULT_POSITIONS ke Supabase
      if (!error && data && data.length === 0) {
        saveCustomPositions(DEFAULT_POSITIONS);
        return DEFAULT_POSITIONS;
      }
    } catch (err) {
      console.warn('Gagal fetch cafe_positions dari Supabase:', err);
    }
  }

  const saved = localStorage.getItem(STORAGE_KEY_POSITIONS);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (e) {}
  }

  return DEFAULT_POSITIONS;
}

/**
 * Menyimpan daftar Role / Posisi kustom ke Supabase & LocalStorage
 */
export async function saveCustomPositions(positions) {
  const cleanList = Array.from(new Set(positions.filter(p => p && p.trim()).map(p => p.trim())));
  localStorage.setItem(STORAGE_KEY_POSITIONS, JSON.stringify(cleanList));

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      // Hapus yang lama lalu masukkan yang baru agar sinkron saat ada posisi yang dihapus
      await supabase.from('cafe_positions').delete().neq('id', 'keep_all');
      const rows = cleanList.map(title => ({
        id: `pos-${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        title
      }));
      if (rows.length > 0) {
        const { error } = await supabase.from('cafe_positions').upsert(rows);
        if (error) {
          console.warn('Gagal upsert cafe_positions ke Supabase:', error.message);
        }
      }
    } catch (err) {
      console.warn('Gagal simpan cafe_positions ke Supabase:', err);
    }
  }

  return cleanList;
}

/**
 * Mengambil Master Jadwal Shift dari Supabase / LocalStorage
 */
export async function getCustomShifts() {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('cafe_shifts')
        .select('*')
        .order('sort_order', { ascending: true });

      if (!error && data && data.length > 0) {
        const formatted = data.map(d => ({
          id: d.id,
          division: d.division,
          label: d.label,
          shortName: d.short_name,
          startTime: d.start_time,
          endTime: d.end_time,
          gracePeriod: Number(d.grace_period_minutes) || 5,
          icon: d.icon || '⏰'
        }));
        localStorage.setItem(STORAGE_KEY_SHIFTS, JSON.stringify(formatted));
        return formatted;
      }

      // Jika tabel di Supabase masih kosong, seed DEFAULT_SHIFTS ke Supabase
      if (!error && data && data.length === 0) {
        saveCustomShifts(DEFAULT_SHIFTS);
        return DEFAULT_SHIFTS;
      }
    } catch (err) {
      console.warn('Gagal fetch cafe_shifts dari Supabase:', err);
    }
  }

  const saved = localStorage.getItem(STORAGE_KEY_SHIFTS);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (e) {}
  }

  return DEFAULT_SHIFTS;
}

/**
 * Menyimpan Master Jadwal Shift ke Supabase & LocalStorage
 */
export async function saveCustomShifts(shifts) {
  localStorage.setItem(STORAGE_KEY_SHIFTS, JSON.stringify(shifts));

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      // Hapus yang lama dari Supabase agar sinkron 100% jika ada shift yang dihapus oleh Owner
      await supabase.from('cafe_shifts').delete().neq('id', 'keep_all');

      const rows = shifts.map((s, index) => ({
        id: s.id,
        division: s.division,
        label: s.label,
        short_name: s.shortName,
        start_time: s.startTime,
        end_time: s.endTime,
        grace_period_minutes: Number(s.gracePeriod) || 5,
        sort_order: index,
        icon: s.icon || '⏰'
      }));

      if (rows.length > 0) {
        const { error } = await supabase.from('cafe_shifts').upsert(rows);
        if (error) {
          console.warn('Gagal upsert cafe_shifts ke Supabase:', error.message);
        }
      }
    } catch (err) {
      console.warn('Gagal simpan cafe_shifts ke Supabase:', err);
    }
  }

  return shifts;
}

/**
 * Helper evaluasi keterlambatan berdasarkan shift dinamis
 */
export function evaluatePunctualityWithGrace(scheduleStartTime, actualDate = new Date(), graceMinutes = 5) {
  if (!scheduleStartTime) return { isLate: false, lateMinutes: 0, status: 'Hadir' };
  
  const [schedH, schedM] = scheduleStartTime.split(':').map(Number);
  const curH = actualDate.getHours();
  const curM = actualDate.getMinutes();

  const schedTotal = schedH * 60 + schedM;
  const curTotal = curH * 60 + curM;

  const diff = curTotal - schedTotal;

  // Lewat batas grace period dianggap terlambat
  if (diff > graceMinutes) {
    return {
      isLate: true,
      lateMinutes: diff,
      status: 'Terlambat'
    };
  }

  return {
    isLate: false,
    lateMinutes: 0,
    status: 'Hadir'
  };
}

/**
 * Memetakan role / jabatan staf ke Station / Posisi yang ada di cafe
 */
export function getStationFromRole(roleOrPos, availablePositions = DEFAULT_POSITIONS) {
  if (!roleOrPos) return availablePositions[0] || 'Barista';
  const str = String(roleOrPos).toLowerCase().trim();

  // 1. Cek exact match terhadap availablePositions
  const exact = availablePositions.find(p => p.toLowerCase() === str);
  if (exact) return exact;

  // 2. Pemetaan berdasarkan kata kunci umum
  if (str.includes('bak') || str.includes('roti')) {
    return availablePositions.find(p => p.toLowerCase().includes('bak')) || 'Baker';
  }
  if (str.includes('pastry')) {
    return availablePositions.find(p => p.toLowerCase().includes('pastry')) || 
           availablePositions.find(p => p.toLowerCase().includes('bak')) || 'Pastry Chef';
  }
  if (str.includes('cook') || str.includes('kitch') || str.includes('dapur') || str.includes('masak') || str.includes('chef')) {
    return availablePositions.find(p => p.toLowerCase().includes('cook') || p.toLowerCase().includes('kitch')) || 'Kitchen / Cook';
  }
  if (str.includes('kasir') || str.includes('cashier')) {
    return availablePositions.find(p => p.toLowerCase().includes('kasir')) || 'Kasir';
  }
  if (str.includes('barista') || str.includes('bar') || str.includes('kopi') || str.includes('coffee')) {
    return availablePositions.find(p => p.toLowerCase().includes('barista')) || 'Barista';
  }
  if (str.includes('manag') || str.includes('spv') || str.includes('supervis') || str.includes('owner') || str.includes('head')) {
    return availablePositions.find(p => p.toLowerCase().includes('manag') || p.toLowerCase().includes('supervis')) || 'Supervisor / Manager';
  }
  if (str.includes('steward') || str.includes('runner') || str.includes('clean') || str.includes('cuci')) {
    return availablePositions.find(p => p.toLowerCase().includes('steward') || p.toLowerCase().includes('runner')) || 'Steward / Runner';
  }

  // 3. Cek apakah ada bagian dari availablePositions yang cocok
  const partial = availablePositions.find(p => p.toLowerCase().includes(str) || str.includes(p.toLowerCase()));
  if (partial) return partial;

  return availablePositions[0] || 'Barista';
}

/**
 * Mencari shift & jam divisi otomatis yang paling sesuai berdasarkan station/role dan waktu saat ini
 */
export function getAutoShiftForPosition(positionOrRole, availableShifts = DEFAULT_SHIFTS, currentTime = new Date()) {
  if (!availableShifts || availableShifts.length === 0) return DEFAULT_SHIFTS[0];

  const pos = String(positionOrRole || '').toLowerCase().trim();
  
  // Filter kandidat shift divisi yang sesuai
  let candidateShifts = [];

  if (pos.includes('bak') || pos.includes('pastry') || pos.includes('roti')) {
    candidateShifts = availableShifts.filter(s => 
      s.division?.toLowerCase().includes('bak') || 
      s.division?.toLowerCase().includes('pastry') || 
      s.division?.toLowerCase().includes('produksi') ||
      s.id?.toLowerCase().includes('bak')
    );
  } else if (pos.includes('cook') || pos.includes('kitch') || pos.includes('dapur') || pos.includes('masak')) {
    candidateShifts = availableShifts.filter(s => 
      s.division?.toLowerCase().includes('cook') || 
      s.division?.toLowerCase().includes('kitch') || 
      s.division?.toLowerCase().includes('food') ||
      s.id?.toLowerCase().includes('kitch')
    );
  } else if (pos.includes('barista') || pos.includes('kasir') || pos.includes('cashier')) {
    candidateShifts = availableShifts.filter(s => 
      s.division?.toLowerCase().includes('barista') || 
      s.division?.toLowerCase().includes('kasir') || 
      s.division?.toLowerCase().includes('foh') ||
      s.id?.toLowerCase().includes('barista')
    );
  }

  // Jika tidak ada shift divisi spesifik (misal Supervisor/Umum), coba cari divisi Umum/Fleksibel atau gunakan seluruh shift
  if (candidateShifts.length === 0) {
    const generalShifts = availableShifts.filter(s => 
      s.division?.toLowerCase().includes('umum') || 
      s.division?.toLowerCase().includes('fleksibel')
    );
    candidateShifts = generalShifts.length > 0 ? generalShifts : availableShifts;
  }

  // Pilih shift dari kandidat yang paling relevan dengan waktu saat ini
  const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();

  let bestShift = candidateShifts[0];
  let minDiff = Infinity;

  candidateShifts.forEach(shift => {
    if (!shift.startTime) return;
    const [h, m] = shift.startTime.split(':').map(Number);
    const shiftMinutes = (h || 0) * 60 + (m || 0);

    const rawDiff = Math.abs(currentMinutes - shiftMinutes);
    const circularDiff = Math.min(rawDiff, 1440 - rawDiff);

    if (circularDiff < minDiff) {
      minDiff = circularDiff;
      bestShift = shift;
    }
  });

  return bestShift || availableShifts[0];
}

/**
 * Mencari Station / Posisi otomatis berdasarkan Shift yang dipilih
 */
export function getStationForShift(shiftObjOrId, availableShifts = DEFAULT_SHIFTS, availablePositions = DEFAULT_POSITIONS) {
  const shiftObj = typeof shiftObjOrId === 'object' && shiftObjOrId !== null
    ? shiftObjOrId 
    : availableShifts.find(s => s.id === shiftObjOrId);
  if (!shiftObj) return availablePositions[0] || 'Barista';

  const div = String(shiftObj.division || '').toLowerCase();
  const id = String(shiftObj.id || '').toLowerCase();
  const label = String(shiftObj.label || '').toLowerCase();

  if (div.includes('bak') || div.includes('pastry') || div.includes('produksi') || id.includes('bak') || label.includes('bak')) {
    return availablePositions.find(p => p.toLowerCase().includes('bak')) || 
           availablePositions.find(p => p.toLowerCase().includes('pastry')) || 'Baker';
  }
  if (div.includes('cook') || div.includes('kitch') || div.includes('food') || id.includes('kitch') || label.includes('kitch')) {
    return availablePositions.find(p => p.toLowerCase().includes('cook') || p.toLowerCase().includes('kitch')) || 'Kitchen / Cook';
  }
  if (div.includes('kasir') || label.includes('kasir')) {
    return availablePositions.find(p => p.toLowerCase().includes('kasir')) || 'Kasir';
  }
  if (div.includes('barista') || div.includes('foh') || id.includes('barista') || label.includes('barista')) {
    return availablePositions.find(p => p.toLowerCase().includes('barista')) || 'Barista';
  }

  return availablePositions[0] || 'Barista';
}
