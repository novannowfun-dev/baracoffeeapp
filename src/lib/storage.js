import { getSupabaseClient, getSupabaseConfig } from './supabase';
import { syncToGoogleSheets, getSheetsWebhookUrl } from './sheetsSync';

const LOCAL_STORAGE_KEY = 'baracoffee_daily_sales_records';

/**
 * Cek apakah aplikasi sudah terkoneksi dengan Supabase atau Google Sheets Webhook
 */
export function isConnectedToRemote() {
  const sb = getSupabaseConfig();
  const sheets = getSheetsWebhookUrl();
  return Boolean((sb.url && sb.key) || sheets);
}

/**
 * Hapus seluruh data cache lokal / sisa data demo
 */
export function purgeDemoRecords() {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const cleaned = parsed.filter(item => !String(item.id).startsWith('demo-'));
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cleaned));
      return cleaned;
    }
  } catch (err) {
    console.error('Error saat membersihkan demo data:', err);
  }
  return [];
}

/**
 * Ambil data penjualan harian murni real-time dari Supabase
 */
export async function getDailySalesRecords() {
  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('daily_sales')
        .select(`
          *,
          petty_cash_items (*)
        `)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (!error && data) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
        return { source: 'supabase', data, isLive: true };
      }
      if (error) {
        console.warn('Supabase daily_sales query error:', error.message);
      }
    } catch (err) {
      console.warn('Gagal koneksi ke Supabase, membaca offline cache:', err.message);
    }
  }

  const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return { source: 'local', data: parsed, isLive: false };
    } catch (e) {}
  }

  return { source: 'none', data: [], isLive: false };
}

/**
 * Simpan data penjualan harian ke Supabase & sync ke Google Sheets
 */
export async function saveDailySalesRecord(recordData) {
  const supabase = getSupabaseClient();
  let savedId = recordData.id || `rec-${Date.now()}`;
  let source = 'local';

  // 1. Simpan ke Supabase PostgreSQL
  if (supabase) {
    try {
      const { petty_cash_items, ...mainRecord } = recordData;
      
      const { data, error } = await supabase
        .from('daily_sales')
        .insert([{
          entry_date: mainRecord.entry_date,
          outlet: mainRecord.outlet || 'kedai',
          shift: mainRecord.shift,
          cashier_name: mainRecord.cashier_name,
          gross_sales: mainRecord.gross_sales,
          discounts: mainRecord.discounts,
          net_sales: mainRecord.net_sales,
          payment_cash: mainRecord.payment_cash,
          payment_qris: mainRecord.payment_qris,
          payment_edc: mainRecord.payment_edc,
          payment_delivery: mainRecord.payment_delivery,
          payment_transfer: mainRecord.payment_transfer,
          opening_cash: mainRecord.opening_cash,
          petty_cash_out: mainRecord.petty_cash_out,
          expected_cash: mainRecord.expected_cash,
          actual_cash: mainRecord.actual_cash,
          cash_difference: mainRecord.cash_difference,
          notes: mainRecord.notes
        }])
        .select();

      if (error) throw error;
      if (data && data[0]) {
        savedId = data[0].id;
        source = 'supabase';

        // Simpan rincian kas keluar
        if (petty_cash_items && petty_cash_items.length > 0) {
          const itemsToInsert = petty_cash_items.map(item => ({
            sales_id: savedId,
            outlet: mainRecord.outlet || 'kedai',
            item_name: item.item_name || item.name || item.description || 'Pengeluaran Kasir',
            amount: Number(item.amount) || 0,
            category: item.category || 'Operasional'
          }));

          const { error: itemError } = await supabase
            .from('petty_cash_items')
            .insert(itemsToInsert);

          if (itemError) {
            console.error('Gagal menyimpan rincian kas kecil ke Supabase:', itemError);
          }
        }
      }
    } catch (err) {
      console.error('Gagal menyimpan ke Supabase, menyimpan ke cache offline lokal:', err);
    }
  }

  // 2. Simpan atau perbarui cache LocalStorage
  const finalRecord = { ...recordData, id: savedId, outlet: recordData.outlet || 'kedai', created_at: new Date().toISOString() };
  try {
    const existingRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
    const existing = existingRaw ? JSON.parse(existingRaw) : [];
    const updated = [finalRecord, ...existing.filter(r => r.id !== savedId)];
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Error menyimpan ke localStorage:', err);
  }

  // 3. Sinkronisasi Otomatis ke Google Sheets (Async Webhook)
  let sheetsStatus = { synced: false, message: 'Google Sheets belum dikonfigurasi' };
  try {
    const sheetsResult = await syncToGoogleSheets(finalRecord);
    sheetsStatus = sheetsResult;

    // Sinkronisasi item pengeluaran ke buku kas jika ada rincian
    if (petty_cash_items && petty_cash_items.length > 0) {
      for (const item of petty_cash_items) {
        try {
          await syncExpenseToGoogleSheets({
            sales_id: savedId,
            entry_date: finalRecord.entry_date,
            shift: finalRecord.shift,
            cashier_name: finalRecord.cashier_name,
            item_name: item.item_name || item.name || item.description || 'Pengeluaran Kasir',
            category: item.category || 'Operasional',
            amount: Number(item.amount) || 0,
            notes: finalRecord.notes || ''
          });
        } catch (itemSyncErr) {
          console.warn('Gagal sync item kas kecil ke Google Sheets:', itemSyncErr);
        }
      }
    }
  } catch (err) {
    console.warn('Gagal sinkronisasi Google Sheets:', err.message);
    sheetsStatus = { synced: false, message: err.message };
  }

  return { success: true, source, id: savedId, sheetsStatus, record: finalRecord };
}

/**
 * Hapus data penjualan dari Supabase & LocalStorage
 */
export async function deleteDailySalesRecord(recordId) {
  const supabase = getSupabaseClient();
  let deletedFromSupabase = false;

  if (supabase) {
    try {
      const { error: itemsErr } = await supabase
        .from('petty_cash_items')
        .delete()
        .eq('sales_id', recordId);

      const { error } = await supabase
        .from('daily_sales')
        .delete()
        .eq('id', recordId);

      if (!error) deletedFromSupabase = true;
    } catch (err) {
      console.error('Error deleting from Supabase:', err);
    }
  }

  try {
    const existingRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (existingRaw) {
      const existing = JSON.parse(existingRaw);
      const updated = existing.filter(r => r.id !== recordId);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    }
  } catch (err) {
    console.error('Error deleting from localStorage:', err);
  }

  return { success: true, deletedFromSupabase };
}
export function clearAllLocalRecords() {
  localStorage.removeItem(LOCAL_STORAGE_KEY);
  return [];
}