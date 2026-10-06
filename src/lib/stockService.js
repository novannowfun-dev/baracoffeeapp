// Stock & Inventory Service for Bara Coffee (Supabase + LocalStorage Fallback + Google Sheets Webhook)
import { getSupabaseClient } from './supabase';
import { getSheetsWebhookUrl } from './sheetsSync';

const LOCAL_PRODUCTS_KEY = 'baracoffee_inventory_products';
const LOCAL_TRANSACTIONS_KEY = 'baracoffee_stock_transactions';

export const DEFAULT_PRODUCTS = [
  { id: 'PRD-001', name: 'Biji Kopi House Blend (Espresso)', category: 'Bahan Baku Bar', unit: 'Kg', min_stock: 3, unit_price: 160000, initial_stock: 12 },
  { id: 'PRD-002', name: 'Biji Kopi Arabika Single Origin', category: 'Bahan Baku Bar', unit: 'Kg', min_stock: 2, unit_price: 220000, initial_stock: 6 },
  { id: 'PRD-003', name: 'Fresh Milk Plain', category: 'Bahan Baku Bar', unit: 'Liter', min_stock: 10, unit_price: 18000, initial_stock: 24 },
  { id: 'PRD-004', name: 'Oat Milk Barista Edition', category: 'Bahan Baku Bar', unit: 'Liter', min_stock: 4, unit_price: 38000, initial_stock: 12 },
  { id: 'PRD-005', name: 'Sirup Vanilla', category: 'Bahan Baku Bar', unit: 'Botol', min_stock: 2, unit_price: 85000, initial_stock: 5 },
  { id: 'PRD-006', name: 'Sirup Caramel', category: 'Bahan Baku Bar', unit: 'Botol', min_stock: 2, unit_price: 85000, initial_stock: 5 },
  { id: 'PRD-007', name: 'Bubuk Cokelat Premium', category: 'Bahan Baku Bar', unit: 'Kg', min_stock: 2, unit_price: 90000, initial_stock: 6 },
  { id: 'PRD-008', name: 'Bubuk Matcha Green Tea', category: 'Bahan Baku Bar', unit: 'Kg', min_stock: 1, unit_price: 140000, initial_stock: 3 },
  { id: 'PRD-009', name: 'Cup Panas + Tutup (8oz)', category: 'Kemasan / Packaging', unit: 'Pcs', min_stock: 100, unit_price: 750, initial_stock: 350 },
  { id: 'PRD-010', name: 'Cup Dingin + Tutup (16oz)', category: 'Kemasan / Packaging', unit: 'Pcs', min_stock: 200, unit_price: 950, initial_stock: 500 },
  { id: 'PRD-011', name: 'Sedotan & Paper Bag', category: 'Kemasan / Packaging', unit: 'Pack', min_stock: 5, unit_price: 25000, initial_stock: 15 },
  { id: 'PRD-012', name: 'Gula Aren Cair', category: 'Bahan Baku Bar', unit: 'Liter', min_stock: 5, unit_price: 32000, initial_stock: 15 }
];

export async function getInventoryProducts() {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase.from('inventory_products').select('*').order('name');
      if (!error && data && data.length > 0) {
        localStorage.setItem(LOCAL_PRODUCTS_KEY, JSON.stringify(data));
        return data;
      }
    } catch (e) {
      console.warn('Supabase products fetch failed, using local fallback:', e);
    }
  }

  const cached = localStorage.getItem(LOCAL_PRODUCTS_KEY);
  if (cached) {
    try { return JSON.parse(cached); } catch (e) {}
  }
  localStorage.setItem(LOCAL_PRODUCTS_KEY, JSON.stringify(DEFAULT_PRODUCTS));
  return DEFAULT_PRODUCTS;
}

export async function addInventoryProduct(product) {
  const supabase = getSupabaseClient();
  const newProduct = {
    id: product.id || 'PRD-' + Date.now().toString().slice(-4),
    name: product.name,
    category: product.category || 'Bahan Baku Bar',
    unit: product.unit || 'Pcs',
    min_stock: Number(product.min_stock) || 5,
    unit_price: Number(product.unit_price) || 0,
    initial_stock: Number(product.initial_stock) || 0
  };

  if (supabase) {
    try {
      await supabase.from('inventory_products').upsert(newProduct);
    } catch (e) {
      console.warn('Failed to upsert to Supabase:', e);
    }
  }

  const current = await getInventoryProducts();
  const updated = [...current.filter(p => p.id !== newProduct.id), newProduct];
  localStorage.setItem(LOCAL_PRODUCTS_KEY, JSON.stringify(updated));
  return newProduct;
}

export async function updateInventoryProduct(productId, updates) {
  const supabase = getSupabaseClient();
  const current = await getInventoryProducts();
  const existing = current.find(p => p.id === productId);
  if (!existing) return null;

  const updatedProduct = {
    ...existing,
    name: updates.name !== undefined ? updates.name : existing.name,
    category: updates.category !== undefined ? updates.category : existing.category,
    unit: updates.unit !== undefined ? updates.unit : existing.unit,
    min_stock: updates.min_stock !== undefined ? Number(updates.min_stock) : existing.min_stock,
    unit_price: updates.unit_price !== undefined ? Number(updates.unit_price) : existing.unit_price,
    initial_stock: updates.initial_stock !== undefined ? Number(updates.initial_stock) : existing.initial_stock
  };

  if (supabase) {
    try {
      await supabase.from('inventory_products').upsert(updatedProduct);
    } catch (e) {
      console.warn('Failed to update product in Supabase:', e);
    }
  }

  const updatedList = current.map(p => p.id === productId ? updatedProduct : p);
  localStorage.setItem(LOCAL_PRODUCTS_KEY, JSON.stringify(updatedList));
  return updatedProduct;
}
export async function deleteInventoryProduct(productId) {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('inventory_products').delete().eq('id', productId);
    } catch (e) {
      console.warn('Failed to delete product from Supabase:', e);
    }
  }
  const current = await getInventoryProducts();
  const updated = current.filter(p => p.id !== productId);
  localStorage.setItem(LOCAL_PRODUCTS_KEY, JSON.stringify(updated));
  return true;
}

export async function getStockTransactions() {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('stock_transactions')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        localStorage.setItem(LOCAL_TRANSACTIONS_KEY, JSON.stringify(data));
        return data;
      }
    } catch (e) {
      console.warn('Supabase stock tx fetch error:', e);
    }
  }

  const cached = localStorage.getItem(LOCAL_TRANSACTIONS_KEY);
  return cached ? JSON.parse(cached) : [];
}

export async function deleteStockTransaction(transactionId) {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('stock_transactions').delete().eq('id', transactionId);
    } catch (e) {
      console.warn('Failed to delete tx from Supabase:', e);
    }
  }
  const existing = await getStockTransactions();
  const updated = existing.filter(tx => tx.id !== transactionId);
  localStorage.setItem(LOCAL_TRANSACTIONS_KEY, JSON.stringify(updated));
  return true;
}

export async function saveStockBatch({ direction, transactionDate, recordedBy, notes, destination, items }) {
  const supabase = getSupabaseClient();
  const createdRecords = [];

  for (const item of items) {
    const record = {
      id: crypto.randomUUID ? crypto.randomUUID() : 'stk_' + Math.random().toString(36).substring(2, 9),
      transaction_date: transactionDate,
      type: direction, // 'in' or 'out'
      product_id: item.productId || item.idProduk || null,
      product_name: item.productName || item.namaBarang,
      unit: item.unit || item.satuan,
      quantity: Number(item.quantity || item.kuantiti) || 0,
      unit_price: Number(item.unitPrice || item.hargaBeliSatuan) || 0,
      total_cost: Number(item.totalCost || item.totalBelanja) || 0,
      destination: destination || 'Kedai Utama',
      notes: notes || 'Mutasi Stok',
      recorded_by: recordedBy || 'Kru',
      created_at: new Date().toISOString()
    };
    createdRecords.push(record);
  }

  // 1. Simpan ke Supabase
  if (supabase && createdRecords.length > 0) {
    try {
      await supabase.from('stock_transactions').insert(createdRecords);
    } catch (e) {
      console.error('Error insert stock tx to Supabase:', e);
    }
  }

  // 2. Simpan ke LocalStorage
  const existing = await getStockTransactions();
  const updated = [...createdRecords, ...existing];
  localStorage.setItem(LOCAL_TRANSACTIONS_KEY, JSON.stringify(updated));

  // 3. Webhook sync ke Google Sheets (Async di background)
  const webhookUrl = getSheetsWebhookUrl();
  if (webhookUrl) {
    try {
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          sync_type: 'stock',
          direction,
          transaction_date: transactionDate,
          destination,
          recorded_by: recordedBy,
          items: createdRecords
        })
      }).catch(err => console.warn('GSheets Stock Webhook silent error:', err));
    } catch (e) {}
  }

  return createdRecords;
}

export function calculateStockBalances(products, transactions) {
  const balances = {};
  products.forEach(p => {
    const init = Number(p.initial_stock) || 0;
    const basePrice = Number(p.unit_price) || 0;
    balances[p.id] = {
      ...p,
      stockIn: init, // Starting initial baseline stock
      stockOutKedai: 0,
      stockOutGerobak: 0,
      totalOut: 0,
      currentBalance: init,
      totalPurchasedQty: init,
      totalPurchasedCost: init * basePrice,
      totalUsageCostKedai: 0,
      totalUsageCostGerobak: 0,
      totalUsageCost: 0,
      latestPrice: basePrice,
      avgPrice: basePrice
    };
  });

  // Urutkan transaksi kronologis ascending untuk menghitung weighted average price & harga terakhir
  const sortedTx = [...transactions].sort((a, b) => new Date(a.created_at || a.transaction_date) - new Date(b.created_at || b.transaction_date));

  sortedTx.forEach(tx => {
    const prodId = tx.product_id;
    if (balances[prodId]) {
      const qty = Number(tx.quantity) || 0;
      const unitPrice = Number(tx.unit_price) || 0;
      const totalCost = Number(tx.total_cost) || (qty * unitPrice);

      if (tx.type === 'in') {
        balances[prodId].stockIn += qty;
        balances[prodId].totalPurchasedQty += qty;
        balances[prodId].totalPurchasedCost += totalCost;
        if (unitPrice > 0) {
          balances[prodId].latestPrice = unitPrice;
        }
      } else {
        balances[prodId].totalOut += qty;
        const effectiveUnitCost = unitPrice > 0 ? unitPrice : (balances[prodId].avgPrice || balances[prodId].latestPrice || Number(balances[prodId].unit_price || 0));
        const itemUsageCost = totalCost > 0 ? totalCost : (qty * effectiveUnitCost);
        balances[prodId].totalUsageCost += itemUsageCost;

        if (String(tx.destination).toLowerCase().includes('gerobak')) {
          balances[prodId].stockOutGerobak += qty;
          balances[prodId].totalUsageCostGerobak += itemUsageCost;
        } else {
          balances[prodId].stockOutKedai += qty;
          balances[prodId].totalUsageCostKedai += itemUsageCost;
        }
      }
    }
  });

  Object.values(balances).forEach(b => {
    b.currentBalance = b.stockIn - b.totalOut;
    b.isLow = b.currentBalance <= Number(b.min_stock || 0);

    // Hitung rata-rata harga beli berbobot (Weighted Average Cost / HPP Rata-rata)
    if (b.totalPurchasedQty > 0 && b.totalPurchasedCost > 0) {
      b.avgPrice = Math.round(b.totalPurchasedCost / b.totalPurchasedQty);
    } else {
      b.avgPrice = Number(b.unit_price) || 0;
    }

    // Valuasi total nilai sisa stok fisik saat ini
    const effectivePrice = b.avgPrice > 0 ? b.avgPrice : (b.latestPrice > 0 ? b.latestPrice : Number(b.unit_price || 0));
    b.valuation = Math.max(0, b.currentBalance) * effectivePrice;
  });

  return Object.values(balances);
}