import { getSupabaseClient } from './supabase';
import confetti from 'canvas-confetti';

const STORAGE_KEY_TARGETS = 'baracoffee_monthly_target_config';

export const DEFAULT_TARGET_CONFIG = {
  id: 'current_target',
  monthly_target: 45000000,          // Rp 45.000.000 / bulan (Goals Tim Bersama)
  bonus_percent_per_staff: 1.0,     // 1% dari total omset untuk setiap kru saat target tembus
  notes: 'Goals bersama seluruh kru Bara Coffee Coffee & Eatery. Tembus target bulanan = bonus 1% omset untuk setiap kru!'
};

/**
 * Mengambil konfigurasi target bulanan dari Supabase / LocalStorage
 */
export async function getTargetConfig() {
  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('cafe_targets')
        .select('*')
        .eq('id', 'current_target')
        .single();

      if (!error && data) {
        const config = {
          ...DEFAULT_TARGET_CONFIG,
          ...data,
          monthly_target: Number(data.monthly_target || data.daily_target ? (data.monthly_target || (data.daily_target * 10)) : 45000000),
          bonus_percent_per_staff: Number(data.bonus_percent_per_staff || data.bonus_pool_value || 1.0),
          notes: data.notes || DEFAULT_TARGET_CONFIG.notes
        };
        localStorage.setItem(STORAGE_KEY_TARGETS, JSON.stringify(config));
        return config;
      }
    } catch (err) {
      console.warn('Gagal fetch cafe_targets dari Supabase:', err);
    }
  }

  // Fallback local storage
  const saved = localStorage.getItem(STORAGE_KEY_TARGETS);
  if (saved) {
    try {
      return { ...DEFAULT_TARGET_CONFIG, ...JSON.parse(saved) };
    } catch (e) {}
  }

  return DEFAULT_TARGET_CONFIG;
}

/**
 * Menyimpan konfigurasi target bulanan ke Supabase & LocalStorage
 */
export async function saveTargetConfig(config) {
  const supabase = getSupabaseClient();
  const cleanConfig = {
    id: 'current_target',
    monthly_target: Number(config.monthly_target) || DEFAULT_TARGET_CONFIG.monthly_target,
    bonus_percent_per_staff: Number(config.bonus_percent_per_staff) || DEFAULT_TARGET_CONFIG.bonus_percent_per_staff,
    notes: config.notes || DEFAULT_TARGET_CONFIG.notes,
    updated_at: new Date().toISOString()
  };

  localStorage.setItem(STORAGE_KEY_TARGETS, JSON.stringify(cleanConfig));

  if (supabase) {
    try {
      await supabase
        .from('cafe_targets')
        .upsert(cleanConfig, { onConflict: 'id' });
    } catch (err) {
      console.warn('Gagal simpan cafe_targets ke Supabase:', err);
    }
  }

  return cleanConfig;
}

/**
 * Menghitung progres pencapaian target bulanan dan estimasi bonus 1% per kru
 */
export function calculateMonthlyTargetProgress(records = [], targetConfig = DEFAULT_TARGET_CONFIG, selectedMonth = null) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed (8 = September)
  
  // Format prefix bulan berjalan: '2026-09'
  const currentMonthPrefix = selectedMonth || `${year}-${String(month + 1).padStart(2, '0')}`;
  
  // Total hari dalam bulan ini
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const currentDay = now.getDate();
  const daysRemaining = Math.max(0, daysInMonth - currentDay);
  const daysPassed = Math.max(1, currentDay);

  // Filter transaksi khusus bulan yang dipilih
  const monthRecords = records.filter(r => {
    const entryDate = r.entry_date || r.date || '';
    return entryDate.startsWith(currentMonthPrefix);
  });

  const totalMonthlyGross = monthRecords.reduce((acc, r) => acc + Number(r.gross_sales || 0), 0);
  const totalMonthlyNet = monthRecords.reduce((acc, r) => acc + Number(r.net_sales || 0), 0);
  
  const monthlyTarget = Number(targetConfig.monthly_target) || 45000000;
  const percentAchieved = monthlyTarget > 0 ? (totalMonthlyNet / monthlyTarget) * 100 : 0;
  
  const isTargetPassed = totalMonthlyNet >= monthlyTarget;
  const remainingGap = Math.max(0, monthlyTarget - totalMonthlyNet);
  const excess = Math.max(0, totalMonthlyNet - monthlyTarget);

  // Bonus 1% omset untuk setiap kru jika lolos target
  const bonusPercent = Number(targetConfig.bonus_percent_per_staff) || 1.0;
  const bonusPerStaff = isTargetPassed ? Math.round(totalMonthlyNet * (bonusPercent / 100)) : 0;

  // Run Rate: Rata-rata omset harian yang dibutuhkan untuk mencapai target di sisa hari
  const dailyAverageNeeded = daysRemaining > 0 ? Math.round(remainingGap / daysRemaining) : remainingGap;
  const currentDailyAverage = Math.round(totalMonthlyNet / daysPassed);

  // Milestone message & badges
  let milestone = {
    badge: 'Mulai Perjuangan Bulan Ini ☕',
    color: 'var(--text-muted)',
    message: `Target tim bulan ini: Rp ${(monthlyTarget / 1000000).toLocaleString('id-ID')} Juta. Setiap kru berhak atas ${bonusPercent}% bonus dari total omset jika target tercapai!`
  };

  if (percentAchieved >= 100) {
    milestone = {
      badge: '🎉 GOALS BULANAN TEMBUS! 🏆',
      color: 'var(--success)',
      message: `Luar biasa tim Bara Coffee! Target ${percentAchieved.toFixed(1)}% tercapai. Setiap kru eligible mendapatkan bonus ${bonusPercent}% omset (Rp ${bonusPerStaff.toLocaleString('id-ID')} / orang)!`
    };
  } else if (percentAchieved >= 80) {
    milestone = {
      badge: 'Sedikit Lagi Tembus 45 Juta! 🔥',
      color: 'var(--gold-light)',
      message: `Kurang ${(100 - percentAchieved).toFixed(1)}% lagi untuk mencapai goals! Butuh rata-rata Rp ${dailyAverageNeeded.toLocaleString('id-ID')}/hari di sisa ${daysRemaining} hari ini.`
    };
  } else if (percentAchieved >= 50) {
    milestone = {
      badge: 'Separuh Perjalanan Menuju Goals ⚡',
      color: 'var(--warning)',
      message: `Sudah 50%+ dari target bulanan. Pertahankan ritme penjualan dan dorong upsell pastry & beverage!`
    };
  }

  // Nama bulan bahasa Indonesia
  const monthName = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  return {
    currentMonthPrefix,
    monthName,
    totalMonthlyGross,
    totalMonthlyNet,
    monthlyTarget,
    percentAchieved: Math.round(percentAchieved * 10) / 10,
    isTargetPassed,
    remainingGap,
    excess,
    bonusPercent,
    bonusPerStaff,
    daysInMonth,
    currentDay,
    daysPassed,
    daysRemaining,
    dailyAverageNeeded,
    currentDailyAverage,
    milestone,
    totalTransactionsThisMonth: monthRecords.length
  };
}

/**
 * Efek Animasi Konfeti Emas saat Target Tembus
 */
export function triggerCelebrationConfetti() {
  try {
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#d99b43', '#f4a261', '#2ec4b6', '#ffd166', '#ffffff']
    });

    setTimeout(() => {
      confetti({
        particleCount: 80,
        angle: 60,
        spread: 60,
        origin: { x: 0 },
        colors: ['#d99b43', '#2ec4b6', '#ffffff']
      });
      confetti({
        particleCount: 80,
        angle: 120,
        spread: 60,
        origin: { x: 1 },
        colors: ['#d99b43', '#2ec4b6', '#ffffff']
      });
    }, 300);
  } catch (e) {
    console.log('Confetti effect triggered');
  }
}
