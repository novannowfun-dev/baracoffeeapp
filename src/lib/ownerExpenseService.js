import { getSupabaseClient } from './supabase';

const LOCAL_STORAGE_EXPENSES_KEY = 'baracoffee_owner_expenses';

/**
 * Daftar kategori pengeluaran belanjaan owner:
 * Termasuk HPP / COGS (Bahan Baku & Packaging) dan OPEX (Operasional, Utilitas, Maintenance, dll)
 */
export const EXPENSE_CATEGORIES = [
  { id: 'cogs_ingredients', label: 'HPP / Bahan Baku (Kopi, Susu, Tepung, Butter, Sirup)', type: 'cogs', icon: '☕' },
  { id: 'cogs_packaging', label: 'HPP / Packaging & Kemasan (Cup, Paperbag, Box, Sedotan)', type: 'cogs', icon: '📦' },
  { id: 'opex_utilities', label: 'Operasional & Utilitas (Listrik PLN, Air PDAM, Gas, Wi-Fi)', type: 'opex', icon: '⚡' },
  { id: 'opex_maintenance', label: 'Perawatan & Servis Alat (Mesin Espresso, Grinder, Chiller)', type: 'opex', icon: '🔧' },
  { id: 'opex_marketing', label: 'Marketing & Promosi (Ads, Influencer, Banner, Diskon)', type: 'opex', icon: '📢' },
  { id: 'opex_rent', label: 'Sewa Tempat & Legalitas / Izin Usaha', type: 'opex', icon: '🏢' },
  { id: 'opex_supplies', label: 'Perlengkapan Kebersihan & Toko (Tissue, Sabun, Plastik Sampah)', type: 'opex', icon: '🧹' },
  { id: 'other', label: 'Lain-lain / Tak Terduga', type: 'opex', icon: '📝' }
];

export const PAYMENT_METHODS = [
  'Transfer Bank / BCA / Mandiri',
  'QRIS / E-Wallet Owner',
  'Kartu Kredit / Debit',
  'Kas Tunai Pribadi Owner'
];

/**
 * Mendapatkan seluruh catatan belanjaan owner dari Supabase atau fallback local storage
 */
export async function getOwnerExpenses() {
  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('owner_expenses')
        .select('*')
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (!error && data) {
        localStorage.setItem(LOCAL_STORAGE_EXPENSES_KEY, JSON.stringify(data));
        return { source: 'supabase', data };
      }
      if (error) {
        console.warn('Supabase owner_expenses fetch error:', error.message);
      }
    } catch (err) {
      console.warn('Supabase owner_expenses network error:', err);
    }
  }

  // Fallback ke localStorage
  const saved = localStorage.getItem(LOCAL_STORAGE_EXPENSES_KEY);
  if (saved) {
    try {
      return { source: 'local', data: JSON.parse(saved) };
    } catch (e) {
      console.error('Error parsing local owner expenses:', e);
    }
  }

  return { source: 'local', data: [] };
}

/**
 * Menambahkan transaksi belanja owner baru
 */
export async function addOwnerExpense(expenseData) {
  const supabase = getSupabaseClient();
  const newItem = {
    id: `exp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    expense_date: expenseData.expense_date || new Date().toISOString().split('T')[0],
    title: expenseData.title?.trim() || 'Belanjaan Tanpa Judul',
    category: expenseData.category || 'cogs_ingredients',
    category_type: expenseData.category_type || 'cogs', // 'cogs' atau 'opex'
    amount: Math.max(0, Number(expenseData.amount) || 0),
    payment_method: expenseData.payment_method || 'Transfer Bank / BCA / Mandiri',
    vendor: expenseData.vendor?.trim() || '',
    notes: expenseData.notes?.trim() || '',
    receipt_url: expenseData.receipt_url || '',
    created_by: expenseData.created_by || 'Owner',
    created_at: new Date().toISOString()
  };

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('owner_expenses')
        .insert([{
          expense_date: newItem.expense_date,
          title: newItem.title,
          category: newItem.category,
          category_type: newItem.category_type,
          amount: newItem.amount,
          payment_method: newItem.payment_method,
          vendor: newItem.vendor,
          notes: newItem.notes,
          receipt_url: newItem.receipt_url,
          created_by: newItem.created_by
        }])
        .select();

      if (!error && data && data.length > 0) {
        newItem.id = data[0].id;
      } else if (error) {
        console.warn('Supabase insert owner_expenses error:', error.message);
      }
    } catch (err) {
      console.warn('Supabase insert owner_expenses failed, saved locally:', err);
    }
  }

  // Simpan ke local cache
  const existingRes = await getOwnerExpenses();
  const currentList = existingRes.data || [];
  const updatedList = [newItem, ...currentList.filter(item => item.id !== newItem.id)];
  localStorage.setItem(LOCAL_STORAGE_EXPENSES_KEY, JSON.stringify(updatedList));

  return newItem;
}

/**
 * Mengubah transaksi belanja owner
 */
export async function updateOwnerExpense(id, updates) {
  const supabase = getSupabaseClient();

  if (supabase && !id.startsWith('exp-')) {
    try {
      const { error } = await supabase
        .from('owner_expenses')
        .update({
          expense_date: updates.expense_date,
          title: updates.title,
          category: updates.category,
          category_type: updates.category_type,
          amount: updates.amount,
          payment_method: updates.payment_method,
          vendor: updates.vendor,
          notes: updates.notes,
          receipt_url: updates.receipt_url
        })
        .eq('id', id);

      if (error) {
        console.warn('Supabase update owner_expenses error:', error.message);
      }
    } catch (err) {
      console.warn('Supabase update error:', err);
    }
  }

  const existingRes = await getOwnerExpenses();
  const currentList = existingRes.data || [];
  const updatedList = currentList.map(item => item.id === id ? { ...item, ...updates } : item);
  localStorage.setItem(LOCAL_STORAGE_EXPENSES_KEY, JSON.stringify(updatedList));

  return true;
}

/**
 * Menghapus transaksi belanja owner
 */
export async function deleteOwnerExpense(id) {
  const supabase = getSupabaseClient();

  if (supabase && !id.startsWith('exp-')) {
    try {
      const { error } = await supabase
        .from('owner_expenses')
        .delete()
        .eq('id', id);

      if (error) {
        console.warn('Supabase delete owner_expenses error:', error.message);
      }
    } catch (err) {
      console.warn('Supabase delete error:', err);
    }
  }

  const existingRes = await getOwnerExpenses();
  const currentList = existingRes.data || [];
  const updatedList = currentList.filter(item => item.id !== id);
  localStorage.setItem(LOCAL_STORAGE_EXPENSES_KEY, JSON.stringify(updatedList));

  return true;
}

/**
 * Hitung kalkulasi Profit & Loss lengkap dari kombinasi:
 * 1. Penjualan Harian (Gross & Net Sales)
 * 2. Belanja Bahan & Packaging Owner (COGS / HPP)
 * 3. Pengeluaran Operasional (OPEX):
 *    - Kas Kecil Kasir (petty_cash_items / petty_cash_out)
 *    - Payroll & Gaji Kru (payroll_records)
 *    - Belanja Utilitas, Sewa, Maintenance Owner (owner_expenses type 'opex')
 */
export function calculateProfitAndLoss({
  salesRecords = [],
  ownerExpenses = [],
  payrollRecords = [],
  filterStartDate = null,
  filterEndDate = null
}) {
  // Filter berdasarkan range tanggal
  const inRange = (dateStr) => {
    if (!dateStr) return false;
    const cleanDate = dateStr.slice(0, 10);
    if (filterStartDate && cleanDate < filterStartDate) return false;
    if (filterEndDate && cleanDate > filterEndDate) return false;
    return true;
  };

  const filteredSales = salesRecords.filter(s => inRange(s.entry_date || s.date));
  const filteredOwnerExpenses = ownerExpenses.filter(e => inRange(e.expense_date || e.created_at));
  
  // Payroll: jika ada payment_date atau period, cek tanggal created_at/payment_date
  const filteredPayroll = payrollRecords.filter(p => {
    const pDate = p.payment_date || p.created_at || (p.period ? null : null);
    if (!pDate) return true; // default include
    return inRange(pDate);
  });

  // 1. REVENUE (PENDAPATAN)
  let totalGrossSales = 0;
  let totalDiscounts = 0;
  let totalNetSales = 0;

  // Breakdown kanal pembayaran
  let paymentCash = 0;
  let paymentQris = 0;
  let paymentEdc = 0;
  let paymentDelivery = 0;
  let paymentTransfer = 0;

  // Kas kecil dari shift sales
  let totalPettyCashOut = 0;

  filteredSales.forEach(rec => {
    const gross = Number(rec.gross_sales || 0);
    const disc = Number(rec.discounts || 0);
    const net = Number(rec.net_sales || (gross - disc));

    totalGrossSales += gross;
    totalDiscounts += disc;
    totalNetSales += net;

    paymentCash += Number(rec.payment_cash || 0);
    paymentQris += Number(rec.payment_qris || 0);
    paymentEdc += Number(rec.payment_edc || 0);
    paymentDelivery += Number(rec.payment_delivery || 0);
    paymentTransfer += Number(rec.payment_transfer || 0);

    totalPettyCashOut += Number(rec.petty_cash_out || 0);
  });

  // 2. COGS (HPP / BEBAN POKOK PENJUALAN)
  let cogsIngredients = 0;
  let cogsPackaging = 0;
  let totalCogs = 0;

  // 3. OPEX (BIAYA OPERASIONAL)
  let opexUtilities = 0;
  let opexMaintenance = 0;
  let opexMarketing = 0;
  let opexRent = 0;
  let opexSupplies = 0;
  let opexOther = 0;
  let totalOwnerOpex = 0;

  filteredOwnerExpenses.forEach(exp => {
    const amount = Number(exp.amount || 0);
    const cat = exp.category;
    const catType = exp.category_type || (cat?.startsWith('cogs_') ? 'cogs' : 'opex');

    if (catType === 'cogs') {
      totalCogs += amount;
      if (cat === 'cogs_packaging') {
        cogsPackaging += amount;
      } else {
        cogsIngredients += amount;
      }
    } else {
      totalOwnerOpex += amount;
      if (cat === 'opex_utilities') opexUtilities += amount;
      else if (cat === 'opex_maintenance') opexMaintenance += amount;
      else if (cat === 'opex_marketing') opexMarketing += amount;
      else if (cat === 'opex_rent') opexRent += amount;
      else if (cat === 'opex_supplies') opexSupplies += amount;
      else opexOther += amount;
    }
  });

  // Payroll Kru / Gaji
  let totalPayrollExpense = 0;
  filteredPayroll.forEach(p => {
    const netPay = Number(p.net_salary ?? p.netSalary ?? 0);
    totalPayrollExpense += netPay;
  });

  // Total OPEX Keseluruhan
  const totalOpex = totalPettyCashOut + totalPayrollExpense + totalOwnerOpex;

  // LABA KOTOR (GROSS PROFIT)
  const grossProfit = totalNetSales - totalCogs;
  const grossProfitMargin = totalNetSales > 0 ? (grossProfit / totalNetSales) * 100 : 0;

  // LABA BERSIH (NET PROFIT)
  const netProfit = grossProfit - totalOpex;
  const netProfitMargin = totalNetSales > 0 ? (netProfit / totalNetSales) * 100 : 0;

  return {
    period: {
      from: filterStartDate,
      to: filterEndDate,
      transactionCount: filteredSales.length,
      expenseCount: filteredOwnerExpenses.length,
      payrollCount: filteredPayroll.length
    },
    revenue: {
      grossSales: totalGrossSales,
      discounts: totalDiscounts,
      netSales: totalNetSales,
      breakdown: {
        cash: paymentCash,
        qris: paymentQris,
        edc: paymentEdc,
        delivery: paymentDelivery,
        transfer: paymentTransfer
      }
    },
    cogs: {
      ingredients: cogsIngredients,
      packaging: cogsPackaging,
      total: totalCogs,
      ratioToSales: totalNetSales > 0 ? (totalCogs / totalNetSales) * 100 : 0
    },
    grossProfit: {
      amount: grossProfit,
      marginPercent: grossProfitMargin
    },
    opex: {
      pettyCashKasir: totalPettyCashOut,
      payrollKru: totalPayrollExpense,
      utilities: opexUtilities,
      maintenance: opexMaintenance,
      marketing: opexMarketing,
      rent: opexRent,
      supplies: opexSupplies,
      other: opexOther,
      totalOwnerOpex: totalOwnerOpex,
      total: totalOpex,
      ratioToSales: totalNetSales > 0 ? (totalOpex / totalNetSales) * 100 : 0
    },
    netProfit: {
      amount: netProfit,
      marginPercent: netProfitMargin,
      isProfitable: netProfit >= 0
    }
  };
}
