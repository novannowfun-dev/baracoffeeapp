// WhatsApp Daily Report Generator for Bara Coffee
import { formatRupiah } from './formatters';

export function generateBaraWhatsAppReport({ 
  outletName = 'Kedai Utama',
  dateStr = new Date().toISOString().split('T')[0],
  shift = 'Pagi',
  cashier = 'Kru Bara',
  omset = {
    cash: 0,
    qris: 0,
    edc: 0,
    online: 0,
    transfer: 0,
    gross: 0,
    discount: 0,
    net: 0
  },
  cashDrawer = {
    opening: 0,
    pettyCash: 0,
    actual: 0,
    diff: 0
  },
  notes = ''
}) {
  const tglIndo = dateStr.split('-').reverse().join('/');
  
  let msg = `*REKAP OPERASIONAL BARA COFFEE*\n`;
  msg += `📍 Unit: *${outletName.toUpperCase()}*\n`;
  msg += `📅 Tanggal: ${tglIndo}\n`;
  msg += `⏰ Shift: ${shift.toUpperCase()} (Kasir: ${cashier})\n\n`;

  msg += `*📊 RINCIAN PENJUALAN / OMSET*\n`;
  msg += `• Tunai (Cash): ${formatRupiah(omset.cash)}\n`;
  msg += `• QRIS: ${formatRupiah(omset.qris)}\n`;
  msg += `• EDC / Debit: ${formatRupiah(omset.edc)}\n`;
  msg += `• Online / Delivery: ${formatRupiah(omset.online)}\n`;
  if (omset.transfer > 0) {
    msg += `• Transfer Bank: ${formatRupiah(omset.transfer)}\n`;
  }
  msg += `--------------------------------\n`;
  msg += `*TOTAL NET SALES: ${formatRupiah(omset.net || (omset.gross - omset.discount))}*\n\n`;

  msg += `*💵 REKONSILIASI KAS LACI*\n`;
  msg += `• Modal Awal: ${formatRupiah(cashDrawer.opening)}\n`;
  msg += `• Kas Masuk (Cash): ${formatRupiah(omset.cash)}\n`;
  msg += `• Pengeluaran (Petty Cash): ${formatRupiah(cashDrawer.pettyCash)}\n`;
  msg += `• Kas Fisik Akhir: ${formatRupiah(cashDrawer.actual)}\n`;
  
  const diff = cashDrawer.diff;
  if (diff === 0) {
    msg += `• Selisih: *Rp 0 (PAS / BALANCE ✅)*\n`;
  } else if (diff > 0) {
    msg += `• Selisih: *+${formatRupiah(diff)} (LEBIH)*\n`;
  } else {
    msg += `• Selisih: *-${formatRupiah(Math.abs(diff))} (KURANG ⚠️)*\n`;
  }

  if (notes) {
    msg += `\n*📝 Catatan:* ${notes}\n`;
  }

  msg += `\n_Dikirim otomatis via Sistem Operasional Bara Coffee App_`;
  return msg;
}