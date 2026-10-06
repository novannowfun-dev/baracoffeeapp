/**
 * Format angka menjadi format Rupiah Indonesia (e.g., Rp 1.500.000)
 */
export function formatIDR(amount) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(num);
}

/**
 * Format tanggal standar lokal (e.g., Minggu, 27 September 2026)
 */
export function formatDateID(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(date);
}

/**
 * Return badge class untuk 4 tipe shift Doubledrip
 */
export function getShiftBadge(shift) {
  switch (shift) {
    case 'Shift Pagi':
      return {
        label: 'Shift Pagi',
        color: 'badge-gold',
        icon: '☀️',
        hours: '07:00 - 15:00'
      };
    case 'Shift Malam':
    case 'Shift Sore':
      return {
        label: 'Shift Malam',
        color: 'badge-info',
        icon: '🌙',
        hours: '15:00 - 23:00'
      };
    case 'Full Day':
      return {
        label: 'Full Day',
        color: 'badge-success',
        icon: '⭐',
        hours: '07:00 - 23:00'
      };
    case 'Split Shift':
      return {
        label: 'Split Shift',
        color: 'badge-warning',
        icon: '⚡',
        hours: 'Pagi & Malam'
      };
    default:
      return {
        label: shift || 'General',
        color: 'badge-gold',
        icon: '☕',
        hours: '-'
      };
  }
}

/**
 * Konversi angka Rupiah ke format terbilang dalam bahasa Indonesia
 * Contoh: 1500000 -> "Satu Juta Lima Ratus Ribu Rupiah"
 */
export function terbilangIDR(n) {
  const angka = Math.floor(Math.abs(Number(n) || 0));
  if (angka === 0) return 'Nol Rupiah';

  const huruf = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];

  function toWords(num) {
    if (num < 12) return huruf[num];
    if (num < 20) return toWords(num - 10) + ' Belas';
    if (num < 100) return toWords(Math.floor(num / 10)) + ' Puluh' + (num % 10 !== 0 ? ' ' + toWords(num % 10) : '');
    if (num < 200) return 'Seratus' + (num - 100 !== 0 ? ' ' + toWords(num - 100) : '');
    if (num < 1000) return toWords(Math.floor(num / 100)) + ' Ratus' + (num % 100 !== 0 ? ' ' + toWords(num % 100) : '');
    if (num < 2000) return 'Seribu' + (num - 1000 !== 0 ? ' ' + toWords(num - 1000) : '');
    if (num < 1000000) return toWords(Math.floor(num / 1000)) + ' Ribu' + (num % 1000 !== 0 ? ' ' + toWords(num % 1000) : '');
    if (num < 1000000000) return toWords(Math.floor(num / 1000000)) + ' Juta' + (num % 1000000 !== 0 ? ' ' + toWords(num % 1000000) : '');
    if (num < 1000000000000) return toWords(Math.floor(num / 1000000000)) + ' Miliar' + (num % 1000000000 !== 0 ? ' ' + toWords(num % 1000000000) : '');
    return '';
  }

  return `${toWords(angka).trim()} Rupiah`;
}

/**
 * Return styling and icon untuk kategori pengeluaran kas kecil (petty cash)
 */
export function getExpenseCategoryBadge(category) {
  switch (category) {
    case 'Es Batu / Air':
      return { 
        label: 'Es Batu / Air', 
        color: 'badge-info', 
        icon: '🧊',
        borderColor: 'rgba(56, 189, 248, 0.4)',
        bg: 'rgba(56, 189, 248, 0.12)',
        textColor: '#38bdf8'
      };
    case 'Bahan Baku Darurat':
      return { 
        label: 'Bahan Baku Darurat', 
        color: 'badge-warning', 
        icon: '🛒',
        borderColor: 'rgba(245, 158, 11, 0.4)',
        bg: 'rgba(245, 158, 11, 0.12)',
        textColor: '#fbbf24'
      };
    case 'Operasional Kasir':
      return { 
        label: 'Operasional Kasir', 
        color: 'badge-gold', 
        icon: '🧾',
        borderColor: 'rgba(217, 155, 67, 0.4)',
        bg: 'rgba(217, 155, 67, 0.12)',
        textColor: 'var(--gold-light)'
      };
    case 'Gas / Listrik':
      return { 
        label: 'Gas / Listrik', 
        color: 'badge-danger', 
        icon: '⚡',
        borderColor: 'rgba(239, 68, 68, 0.4)',
        bg: 'rgba(239, 68, 68, 0.12)',
        textColor: '#f87171'
      };
    default:
      return { 
        label: category || 'Lain-lain', 
        color: 'badge-secondary', 
        icon: '📦',
        borderColor: 'rgba(148, 163, 184, 0.3)',
        bg: 'rgba(148, 163, 184, 0.12)',
        textColor: '#cbd5e1'
      };
  }
}

export function formatRupiah(amount) {
  return formatIDR(amount);
}