// Kasbon & Cicilan Service for Bara Coffee
import { getSupabaseClient } from './supabase';
import { getSheetsWebhookUrl } from './sheetsSync';

const LOCAL_KASBON_KEY = 'baracoffee_staff_kasbon';

export async function getKasbonList() {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('staff_kasbon')
        .select('*')
        .order('entry_date', { ascending: false });
      if (!error && data) {
        localStorage.setItem(LOCAL_KASBON_KEY, JSON.stringify(data));
        return data;
      }
    } catch (e) {
      console.warn('Supabase kasbon fetch error:', e);
    }
  }

  const cached = localStorage.getItem(LOCAL_KASBON_KEY);
  return cached ? JSON.parse(cached) : [];
}

export async function addKasbonRecord(record) {
  const supabase = getSupabaseClient();
  const newRecord = {
    id: crypto.randomUUID ? crypto.randomUUID() : 'ksb_' + Math.random().toString(36).substring(2, 9),
    entry_date: record.entry_date || new Date().toISOString().split('T')[0],
    staff_name: record.staff_name,
    staff_id: record.staff_id || null,
    outlet: record.outlet || 'kedai',
    type: record.type || 'kasbon', // 'kasbon' (pinjam jangka pendek), 'pinjaman' (cicilan berjangka), 'cicilan' (bayar)
    tenor_months: Number(record.tenor_months) || 1, // Durasi cicilan (misal 12 bulan)
    installment_index: Number(record.installment_index) || null, // Cicilan ke-X
    total_installments: Number(record.total_installments) || null, // Total cicilan (misal 12)
    monthly_installment: Number(record.monthly_installment) || null, // Cicilan rutin per bulan
    amount: Number(record.amount) || 0,
    notes: record.notes || '',
    approved_by: record.approved_by || 'Owner',
    status: record.status || 'aktif',
    created_at: new Date().toISOString()
  };

  // 1. Simpan segera ke localStorage agar data pasti muncul di UI seketika
  let cached = [];
  try {
    const raw = localStorage.getItem(LOCAL_KASBON_KEY);
    cached = raw ? JSON.parse(raw) : [];
  } catch {
    cached = [];
  }
  const updated = [newRecord, ...cached.filter(r => r.id !== newRecord.id)];
  localStorage.setItem(LOCAL_KASBON_KEY, JSON.stringify(updated));

  let inSupabase = false;
  let supabaseWarning = null;
  let tableMissing = false;

  // 2. Simpan ke Supabase jika terhubung
  if (supabase) {
    try {
      const { data, error } = await supabase.from('staff_kasbon').insert([newRecord]).select().single();
      if (!error && data) {
        inSupabase = true;
      } else if (error) {
        console.warn('Gagal menyimpan kasbon ke Supabase:', error);
        tableMissing = error.code === '42P01' || error.message?.includes('does not exist');
        
        // Jika error karena kolom baru (misal tenor_months belum ada di database), coba insert tanpa kolom baru
        if (error.code === '42703' || error.message?.includes('column')) {
          console.log('Mencoba fallback insert kasbon versi kompatibel...');
          const fallbackRecord = {
            id: newRecord.id,
            entry_date: newRecord.entry_date,
            staff_name: newRecord.staff_name,
            staff_id: newRecord.staff_id,
            outlet: newRecord.outlet,
            type: newRecord.type,
            amount: newRecord.amount,
            notes: (newRecord.notes ? newRecord.notes + ' ' : '') + `[Tenor: ${newRecord.tenor_months} bln]`,
            approved_by: newRecord.approved_by,
            status: newRecord.status,
            created_at: newRecord.created_at
          };
          const fallbackRes = await supabase.from('staff_kasbon').insert([fallbackRecord]);
          if (!fallbackRes.error) {
            inSupabase = true;
          } else {
            supabaseWarning = fallbackRes.error.message;
          }
        } else {
          supabaseWarning = error.message;
        }
      }
    } catch (e) {
      console.warn('Koneksi Supabase error saat simpan kasbon:', e);
      supabaseWarning = e.message || 'Koneksi gagal';
    }
  }

  // 3. GSheets Webhook Sync
  const webhookUrl = getSheetsWebhookUrl();
  if (webhookUrl) {
    try {
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          sync_type: 'kasbon',
          ...newRecord
        })
      }).catch(err => console.warn('GSheets Kasbon Webhook error:', err));
    } catch (e) {}
  }

  return {
    ...newRecord,
    inSupabase,
    tableMissing,
    supabaseWarning
  };
}

export async function deleteKasbonRecord(recordId) {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('staff_kasbon').delete().eq('id', recordId);
    } catch (e) {
      console.warn('Failed to delete kasbon from Supabase:', e);
    }
  }
  const existing = await getKasbonList();
  const updated = existing.filter(r => r.id !== recordId);
  localStorage.setItem(LOCAL_KASBON_KEY, JSON.stringify(updated));
  return true;
}

export function computeStaffKasbonSummary(records) {
  const summary = {};
  records.forEach(r => {
    const name = r.staff_name;
    if (!summary[name]) {
      summary[name] = {
        name,
        totalPinjaman: 0,
        totalCicilan: 0,
        sisaHutang: 0,
        activeLoan: null, // Pinjaman berjangka yang sedang aktif
        paidInstallmentCount: 0, // Sudah bayar cicilan ke berapa
        transactions: []
      };
    }
    const amt = Number(r.amount) || 0;
    if (r.type === 'kasbon' || r.type === 'pinjaman') {
      summary[name].totalPinjaman += amt;
      if (r.type === 'pinjaman' && Number(r.tenor_months) > 1) {
        summary[name].activeLoan = r;
      }
    } else if (r.type === 'cicilan') {
      summary[name].totalCicilan += amt;
      summary[name].paidInstallmentCount += 1;
    }
    summary[name].transactions.push(r);
  });

  Object.values(summary).forEach(s => {
    s.sisaHutang = Math.max(0, s.totalPinjaman - s.totalCicilan);
  });

  return Object.values(summary);
}