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

  if (supabase) {
    try {
      await supabase.from('staff_kasbon').insert([newRecord]);
    } catch (e) {
      console.error('Insert kasbon to Supabase failed:', e);
    }
  }

  const existing = await getKasbonList();
  const updated = [newRecord, ...existing];
  localStorage.setItem(LOCAL_KASBON_KEY, JSON.stringify(updated));

  // GSheets Webhook Sync
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

  return newRecord;
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