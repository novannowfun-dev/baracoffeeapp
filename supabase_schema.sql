-- ==============================================================================
-- SCHEMA DATABASE SUPABASE UNTUK BARA COFFEE (LENGKAP SEMUA FITUR)
-- Skrip ini bersifat IDEMPOTENT (Aman dijalankan berulang-ulang tanpa error).
-- Jalankan kode ini di SQL Editor pada dashboard Supabase Anda.
-- ==============================================================================

-- 1. Tabel Transaksi Omset Harian (Daily Sales)
CREATE TABLE IF NOT EXISTS daily_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_date DATE NOT NULL,
    shift VARCHAR(30) NOT NULL, -- 'Shift Pagi', 'Shift Sore', 'Full Day', 'Split Shift'
    cashier_name VARCHAR(100) NOT NULL,
    
    -- Rincian Penjualan
    gross_sales NUMERIC(12, 2) NOT NULL DEFAULT 0,
    discounts NUMERIC(12, 2) NOT NULL DEFAULT 0,
    net_sales NUMERIC(12, 2) NOT NULL DEFAULT 0,
    
    -- Kanal Pembayaran (Payment Breakdown)
    payment_cash NUMERIC(12, 2) NOT NULL DEFAULT 0,
    payment_qris NUMERIC(12, 2) NOT NULL DEFAULT 0,
    payment_edc NUMERIC(12, 2) NOT NULL DEFAULT 0,
    payment_delivery NUMERIC(12, 2) NOT NULL DEFAULT 0,
    payment_transfer NUMERIC(12, 2) NOT NULL DEFAULT 0,
    
    -- Rekonsiliasi Kas Laci (Drawer Cash Reconciliation)
    opening_cash NUMERIC(12, 2) NOT NULL DEFAULT 0,      -- Modal kas awal
    petty_cash_out NUMERIC(12, 2) NOT NULL DEFAULT 0,    -- Pengeluaran kas kecil darurat
    expected_cash NUMERIC(12, 2) NOT NULL DEFAULT 0,     -- Kas Awal + Cash In - Kas Kecil
    actual_cash NUMERIC(12, 2) NOT NULL DEFAULT 0,       -- Uang fisik dihitung kasir
    cash_difference NUMERIC(12, 2) NOT NULL DEFAULT 0,   -- Selisih (+ lebih, - kurang)
    
    -- Mode POS Kumulatif & Potongan Shift Pagi
    pos_cumulative_gross NUMERIC(12, 2) DEFAULT NULL, -- Total kotor yang terbaca di mesin POS
    shift1_deducted_gross NUMERIC(12, 2) DEFAULT NULL, -- Nilai kotor shift pagi yang dikurangkan

    -- Informasi Tambahan
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabel Rincian Nota Kas Kecil (Petty Cash Expenses)
CREATE TABLE IF NOT EXISTS petty_cash_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_id UUID REFERENCES daily_sales(id) ON DELETE CASCADE,
    item_name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL, -- 'Es Batu / Air', 'Bahan Baku Darurat', 'Operasional', 'Lainnya'
    amount NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabel Daftar Pengguna & Kru Cafe (Staff, Roles, & PIN Login)
CREATE TABLE IF NOT EXISTS cafe_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'kru', -- 'owner', 'manager', 'kru'
    position VARCHAR(50) DEFAULT 'Barista',  -- 'Barista', 'Baker', 'Kasir', 'Cook', 'Manager'
    pin_code VARCHAR(20) DEFAULT '1234',     -- PIN keamanan 4-6 digit untuk login shift
    phone VARCHAR(30),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Tabel Absensi Shift Kru (Attendance)
CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_date DATE NOT NULL,
    user_id UUID REFERENCES cafe_users(id) ON DELETE SET NULL,
    staff_name VARCHAR(100) NOT NULL,
    position VARCHAR(100) DEFAULT 'Barista',     -- 'Barista', 'Baker', 'Kasir', 'Kitchen', 'Manager'
    shift VARCHAR(150) NOT NULL,                 -- 'Shift Pagi', 'Shift Sore', 'Full Day', 'Split Shift', dsb
    schedule_in VARCHAR(10),
    schedule_out VARCHAR(10),
    clock_in VARCHAR(10) NOT NULL,
    clock_out VARCHAR(10) DEFAULT '-',
    work_duration VARCHAR(100) DEFAULT '-',      -- Contoh: '8 Jam 15 Menit'
    status VARCHAR(50) NOT NULL DEFAULT 'Hadir', -- 'Hadir', 'Terlambat', 'Sakit', 'Izin', 'Cuti'
    late_minutes INTEGER DEFAULT 0,              -- Menit terlambat jika lewat jam masuk shift
    late_reason TEXT,                            -- Alasan keterlambatan jika telat
    overtime_hours NUMERIC(4, 2) DEFAULT 0,      -- Jam lembur
    handover_notes TEXT,                         -- Catatan serah terima shift & closing bar
    notes TEXT,                                  -- Catatan absensi / alasan izin / sakit
    photo_url TEXT,                              -- Foto selfie presensi (anti-cheat)
    is_demo BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Penambahan & Penyesuaian Kolom Baru secara Idempotent (Jika tabel sudah dibuat sebelumnya)
ALTER TABLE attendance ALTER COLUMN shift TYPE VARCHAR(150);
ALTER TABLE attendance ALTER COLUMN position TYPE VARCHAR(100);
ALTER TABLE attendance ALTER COLUMN work_duration TYPE VARCHAR(100);
ALTER TABLE attendance ALTER COLUMN status TYPE VARCHAR(50);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES cafe_users(id) ON DELETE SET NULL;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS position VARCHAR(100) DEFAULT 'Barista';
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS work_duration VARCHAR(100) DEFAULT '-';
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS handover_notes TEXT;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS late_minutes INTEGER DEFAULT 0;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS late_reason TEXT;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS schedule_in VARCHAR(10);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS schedule_out VARCHAR(10);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- 5. Tabel Penggajian Staf (Payroll & Payslip)
CREATE TABLE IF NOT EXISTS payroll_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_month VARCHAR(20) NOT NULL, -- contoh: 'September 2026'
    user_id UUID REFERENCES cafe_users(id) ON DELETE SET NULL,
    staff_name VARCHAR(100) NOT NULL,
    position VARCHAR(50),
    basic_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
    allowances NUMERIC(12, 2) NOT NULL DEFAULT 0,
    overtime_pay NUMERIC(12, 2) NOT NULL DEFAULT 0,
    bonus NUMERIC(12, 2) NOT NULL DEFAULT 0,
    kasbon_deduction NUMERIC(12, 2) NOT NULL DEFAULT 0,
    loan_deduction NUMERIC(12, 2) NOT NULL DEFAULT 0,
    loan_installment_info TEXT,
    absence_deduction NUMERIC(12, 2) NOT NULL DEFAULT 0,
    net_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
    status VARCHAR(20) DEFAULT 'Paid', -- 'Pending', 'Paid'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Migrasi jika kolom potongan cicilan berjangka belum ada di tabel payroll_records:
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS loan_deduction NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS loan_installment_info TEXT;

-- ==============================================================================
-- KEAMANAN ROW LEVEL SECURITY (RLS) & POLICIES (IDEMPOTENT)
-- ==============================================================================

-- A. RLS untuk daily_sales
ALTER TABLE daily_sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon read daily_sales" ON daily_sales;
DROP POLICY IF EXISTS "Allow anon insert daily_sales" ON daily_sales;
DROP POLICY IF EXISTS "Allow anon update daily_sales" ON daily_sales;
DROP POLICY IF EXISTS "Allow anon delete daily_sales" ON daily_sales;
DROP POLICY IF EXISTS "Allow anon all daily_sales" ON daily_sales;
CREATE POLICY "Allow anon all daily_sales" ON daily_sales FOR ALL USING (true) WITH CHECK (true);

-- B. RLS untuk petty_cash_items
ALTER TABLE petty_cash_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon read petty_cash_items" ON petty_cash_items;
DROP POLICY IF EXISTS "Allow anon insert petty_cash_items" ON petty_cash_items;
DROP POLICY IF EXISTS "Allow anon update petty_cash_items" ON petty_cash_items;
DROP POLICY IF EXISTS "Allow anon delete petty_cash_items" ON petty_cash_items;
DROP POLICY IF EXISTS "Allow anon all petty_cash_items" ON petty_cash_items;
CREATE POLICY "Allow anon all petty_cash_items" ON petty_cash_items FOR ALL USING (true) WITH CHECK (true);

-- C. RLS untuk cafe_users
ALTER TABLE cafe_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon read cafe_users" ON cafe_users;
DROP POLICY IF EXISTS "Allow anon insert cafe_users" ON cafe_users;
DROP POLICY IF EXISTS "Allow anon update cafe_users" ON cafe_users;
DROP POLICY IF EXISTS "Allow anon delete cafe_users" ON cafe_users;
DROP POLICY IF EXISTS "Allow anon all cafe_users" ON cafe_users;
CREATE POLICY "Allow anon all cafe_users" ON cafe_users FOR ALL USING (true) WITH CHECK (true);

-- D. RLS untuk attendance
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon read attendance" ON attendance;
DROP POLICY IF EXISTS "Allow anon insert attendance" ON attendance;
DROP POLICY IF EXISTS "Allow anon update attendance" ON attendance;
DROP POLICY IF EXISTS "Allow anon delete attendance" ON attendance;
DROP POLICY IF EXISTS "Allow anon all attendance" ON attendance;
CREATE POLICY "Allow anon all attendance" ON attendance FOR ALL USING (true) WITH CHECK (true);

-- E. RLS untuk payroll_records
ALTER TABLE payroll_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon all payroll" ON payroll_records;
CREATE POLICY "Allow anon all payroll" ON payroll_records FOR ALL USING (true) WITH CHECK (true);

-- 6. Tabel Target Omset Bulanan & Bonus Kru (Monthly Team Goals)
CREATE TABLE IF NOT EXISTS cafe_targets (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'current_target',
    monthly_target NUMERIC(12, 2) NOT NULL DEFAULT 45000000,          -- Target bulanan tim bersama Rp 45.000.000
    bonus_percent_per_staff NUMERIC(5, 2) NOT NULL DEFAULT 1.0,      -- Bonus 1% dari total omset per kru saat target tembus
    daily_target NUMERIC(12, 2) DEFAULT 1500000,
    shift_pagi_target NUMERIC(12, 2) DEFAULT 700000,
    shift_sore_target NUMERIC(12, 2) DEFAULT 800000,
    notes TEXT DEFAULT 'Goals bersama seluruh kru Bara Coffee. Tembus target bulanan = bonus 1% omset untuk setiap kru!',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Penambahan Kolom Bulanan secara Idempotent
ALTER TABLE cafe_targets ADD COLUMN IF NOT EXISTS monthly_target NUMERIC(12, 2) DEFAULT 45000000;
ALTER TABLE cafe_targets ADD COLUMN IF NOT EXISTS bonus_percent_per_staff NUMERIC(5, 2) DEFAULT 1.0;

ALTER TABLE cafe_targets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon all cafe_targets" ON cafe_targets;
CREATE POLICY "Allow anon all cafe_targets" ON cafe_targets FOR ALL USING (true) WITH CHECK (true);

-- Seed konfigurasi default
INSERT INTO cafe_targets (id, monthly_target, bonus_percent_per_staff, daily_target, notes)
VALUES ('current_target', 45000000, 1.0, 1500000, 'Goals bersama seluruh kru Bara Coffee. Tembus target bulanan = bonus 1% omset untuk setiap kru!')
ON CONFLICT (id) DO UPDATE SET 
    monthly_target = EXCLUDED.monthly_target,
    bonus_percent_per_staff = EXCLUDED.bonus_percent_per_staff;

-- 7. Tabel Master Posisi & Role Kru (Kustomisasi Owner)
CREATE TABLE IF NOT EXISTS cafe_positions (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(50) NOT NULL,
    division VARCHAR(50) DEFAULT 'General',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE cafe_positions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon all cafe_positions" ON cafe_positions;
CREATE POLICY "Allow anon all cafe_positions" ON cafe_positions FOR ALL USING (true) WITH CHECK (true);

-- Seed Data Awal Posisi / Role Kru
INSERT INTO cafe_positions (id, title, division) VALUES
    ('pos-barista', 'Barista', 'Barista & Kasir (FOH)'),
    ('pos-baker', 'Baker', 'Bakery & Pastry (Produksi)'),
    ('pos-kasir', 'Kasir', 'Barista & Kasir (FOH)'),
    ('pos-kitchen', 'Kitchen / Cook', 'Kitchen & Cook (Hot Food)'),
    ('pos-pastry', 'Pastry Chef', 'Bakery & Pastry (Produksi)'),
    ('pos-supervisor', 'Supervisor / Manager', 'Management'),
    ('pos-steward', 'Steward / Runner', 'General')
ON CONFLICT (id) DO NOTHING;

-- 8. Tabel Master Jadwal Shift & Waktu (Kustomisasi Owner)
CREATE TABLE IF NOT EXISTS cafe_shifts (
    id VARCHAR(50) PRIMARY KEY,
    division VARCHAR(50) NOT NULL,
    label VARCHAR(100) NOT NULL,
    short_name VARCHAR(50) NOT NULL,
    start_time VARCHAR(10) NOT NULL,
    end_time VARCHAR(10) NOT NULL,
    grace_period_minutes INTEGER DEFAULT 5,
    sort_order INTEGER DEFAULT 0,
    icon VARCHAR(20) DEFAULT '⏰',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE cafe_shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon all cafe_shifts" ON cafe_shifts;
CREATE POLICY "Allow anon all cafe_shifts" ON cafe_shifts FOR ALL USING (true) WITH CHECK (true);

-- Seed Data Awal Master Jadwal Shift
INSERT INTO cafe_shifts (id, division, label, short_name, start_time, end_time, grace_period_minutes, sort_order, icon) VALUES
    ('barista_pagi', '☕ Barista & Kasir (FOH)', 'Barista / Kasir — Shift Pagi (07:00 – 15:00)', 'Shift Pagi (FOH)', '07:00', '15:00', 5, 0, '☀️'),
    ('barista_sore', '☕ Barista & Kasir (FOH)', 'Barista / Kasir — Shift Sore / Closing (15:00 – 23:00)', 'Shift Sore (FOH)', '15:00', '23:00', 5, 1, '🌙'),
    ('bakery_subuh', '🥐 Bakery & Pastry (Produksi)', 'Bakery — Shift Subuh / Proofing & Oven (05:30 – 13:30)', 'Bakery Subuh', '05:30', '13:30', 5, 2, '🥐'),
    ('bakery_siang', '🥐 Bakery & Pastry (Produksi)', 'Bakery — Shift Siang / Dough & Restock (12:00 – 20:00)', 'Bakery Siang', '12:00', '20:00', 5, 3, '🥖'),
    ('kitchen_pagi', '🍳 Kitchen & Cook (Hot Food)', 'Kitchen — Shift Pagi (08:00 – 16:00)', 'Kitchen Pagi', '08:00', '16:00', 5, 4, '🍳'),
    ('kitchen_sore', '🍳 Kitchen & Cook (Hot Food)', 'Kitchen — Shift Sore / Closing (14:00 – 22:00)', 'Kitchen Sore', '14:00', '22:00', 5, 5, '🔥'),
    ('middle_shift', '⚡ Umum & Fleksibel', 'Middle Shift / Peak Hours (11:00 – 19:00)', 'Middle Shift', '11:00', '19:00', 5, 6, '⚡') ON CONFLICT (id) DO NOTHING;
-- 9. Tabel Konfigurasi Integrasi Cloud (KasirPro API, Webhooks, dll agar sinkron ke seluruh device)
CREATE TABLE IF NOT EXISTS cafe_integrations (
    key_name VARCHAR(100) PRIMARY KEY,
    key_value TEXT,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE cafe_integrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon all cafe_integrations" ON cafe_integrations;
CREATE POLICY "Allow anon all cafe_integrations" ON cafe_integrations FOR ALL USING (true) WITH CHECK (true);

-- 10. Tabel Rekap Belanjaan Owner (COGS & Biaya Operasional / P&L)
CREATE TABLE IF NOT EXISTS owner_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    title VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL, -- 'cogs_ingredients', 'cogs_packaging', 'opex_utilities', 'opex_maintenance', 'opex_marketing', 'opex_rent', 'opex_supplies', 'other'
    category_type VARCHAR(20) NOT NULL DEFAULT 'opex', -- 'cogs' atau 'opex'
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    payment_method VARCHAR(50) DEFAULT 'Transfer Bank / BCA / Mandiri',
    vendor VARCHAR(100),
    notes TEXT,
    receipt_url TEXT,
    created_by VARCHAR(100) DEFAULT 'Owner',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE owner_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon all owner_expenses" ON owner_expenses;
CREATE POLICY "Allow anon all owner_expenses" ON owner_expenses FOR ALL USING (true) WITH CHECK (true);


-- ==============================================================================
-- 11. TABEL EKSTENSI KHUSUS BARA COFFEE (MULTI-OUTLET, STOK, KASBON & ASET)
-- ==============================================================================

-- A. Outlet Support pada daily_sales & petty_cash
ALTER TABLE daily_sales ADD COLUMN IF NOT EXISTS outlet VARCHAR(50) DEFAULT 'kedai';
ALTER TABLE daily_sales ADD COLUMN IF NOT EXISTS pos_cumulative_gross NUMERIC(12, 2) DEFAULT NULL;
ALTER TABLE daily_sales ADD COLUMN IF NOT EXISTS shift1_deducted_gross NUMERIC(12, 2) DEFAULT NULL;
ALTER TABLE petty_cash_items ADD COLUMN IF NOT EXISTS outlet VARCHAR(50) DEFAULT 'kedai';
CREATE INDEX IF NOT EXISTS idx_daily_sales_outlet ON daily_sales(outlet);

-- B. Tabel Master Produk & Bahan Baku (Stok Bar / Kitchen / Packaging)
CREATE TABLE IF NOT EXISTS inventory_products (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(50) DEFAULT 'Bahan Baku Bar', -- 'Bahan Baku Bar', 'Bahan Baku Dapur', 'Kemasan / Packaging', 'Lainnya'
    unit VARCHAR(30) DEFAULT 'Pcs', -- 'Pcs', 'Kg', 'Gram', 'Liter', 'Botol', 'Pack'
    min_stock NUMERIC(10, 2) DEFAULT 5,
    unit_price NUMERIC(12, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE inventory_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon all inventory_products" ON inventory_products;
CREATE POLICY "Allow anon all inventory_products" ON inventory_products FOR ALL USING (true) WITH CHECK (true);

-- Seed awal produk bahan baku Bara Coffee
INSERT INTO inventory_products (id, name, category, unit, min_stock, unit_price) VALUES
    ('PRD-001', 'Biji Kopi House Blend (Espresso)', 'Bahan Baku Bar', 'Kg', 3, 160000),
    ('PRD-002', 'Biji Kopi Arabika Single Origin', 'Bahan Baku Bar', 'Kg', 2, 220000),
    ('PRD-003', 'Fresh Milk Plain', 'Bahan Baku Bar', 'Liter', 10, 18000),
    ('PRD-004', 'Oat Milk Barista Edition', 'Bahan Baku Bar', 'Liter', 4, 38000),
    ('PRD-005', 'Sirup Vanilla', 'Bahan Baku Bar', 'Botol', 2, 85000),
    ('PRD-006', 'Sirup Caramel', 'Bahan Baku Bar', 'Botol', 2, 85000),
    ('PRD-007', 'Bubuk Cokelat Premium', 'Bahan Baku Bar', 'Kg', 2, 90000),
    ('PRD-008', 'Bubuk Matcha Green Tea', 'Bahan Baku Bar', 'Kg', 1, 140000),
    ('PRD-009', 'Cup Panas + Tutup (8oz)', 'Kemasan / Packaging', 'Pcs', 100, 750),
    ('PRD-010', 'Cup Dingin + Tutup (16oz)', 'Kemasan / Packaging', 'Pcs', 200, 950),
    ('PRD-011', 'Sedotan & Paper Bag', 'Kemasan / Packaging', 'Pack', 5, 25000),
    ('PRD-012', 'Gula Aren Cair', 'Bahan Baku Bar', 'Liter', 5, 32000)
ON CONFLICT (id) DO NOTHING;

-- C. Tabel Transaksi Mutasi Stok (Masuk dari Supplier / Keluar ke Outlet / Bar / Waste)
CREATE TABLE IF NOT EXISTS stock_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    type VARCHAR(10) NOT NULL, -- 'in' (Masuk/Belanja) atau 'out' (Keluar/Pemakaian)
    product_id VARCHAR(50) REFERENCES inventory_products(id) ON DELETE SET NULL,
    product_name VARCHAR(150) NOT NULL,
    unit VARCHAR(30) NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL DEFAULT 0,
    unit_price NUMERIC(12, 2) DEFAULT 0,
    total_cost NUMERIC(12, 2) DEFAULT 0,
    destination VARCHAR(50) DEFAULT 'Kedai Utama', -- 'Kedai Utama', 'Gerobak', 'Gudang'
    notes VARCHAR(200) DEFAULT 'Bahan Baku Bar',
    recorded_by VARCHAR(100) DEFAULT 'Kru',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE stock_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon all stock_transactions" ON stock_transactions;
CREATE POLICY "Allow anon all stock_transactions" ON stock_transactions FOR ALL USING (true) WITH CHECK (true);

-- D. Tabel Kasbon Kru & Cicilan (Pinjaman & Pelunasan)
CREATE TABLE IF NOT EXISTS staff_kasbon (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    staff_name VARCHAR(100) NOT NULL,
    staff_id VARCHAR(50),
    outlet VARCHAR(50) DEFAULT 'kedai', -- 'kedai' atau 'gerobak'
    type VARCHAR(20) NOT NULL DEFAULT 'kasbon', -- 'kasbon' (pinjam), 'pinjaman' (cicilan berjangka), atau 'cicilan' (bayar/potong)
    tenor_months INTEGER DEFAULT 1,
    installment_index INTEGER,
    total_installments INTEGER,
    monthly_installment NUMERIC(12, 2),
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    approved_by VARCHAR(100) DEFAULT 'Owner',
    status VARCHAR(20) DEFAULT 'aktif', -- 'aktif', 'lunas', 'dipotong_gaji'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Migrasi jika kolom berjangka belum ada pada tabel lama:
ALTER TABLE staff_kasbon ADD COLUMN IF NOT EXISTS tenor_months INTEGER DEFAULT 1;
ALTER TABLE staff_kasbon ADD COLUMN IF NOT EXISTS installment_index INTEGER;
ALTER TABLE staff_kasbon ADD COLUMN IF NOT EXISTS total_installments INTEGER;
ALTER TABLE staff_kasbon ADD COLUMN IF NOT EXISTS monthly_installment NUMERIC(12, 2);

ALTER TABLE staff_kasbon ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon all staff_kasbon" ON staff_kasbon;
CREATE POLICY "Allow anon all staff_kasbon" ON staff_kasbon FOR ALL USING (true) WITH CHECK (true);

-- E. Tabel Aset & Inventaris Gudang / Outlet (Opsional / Legacy)
CREATE TABLE IF NOT EXISTS warehouse_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_code VARCHAR(50),
    name VARCHAR(150) NOT NULL,
    category VARCHAR(50) DEFAULT 'Peralatan Bar', -- 'Mesin Kopi', 'Peralatan Bar', 'Elektronik', 'Gerobak & Booth', 'Furniture'
    location VARCHAR(50) DEFAULT 'Kedai Utama', -- 'Kedai Utama', 'Gerobak', 'Gudang'
    quantity INTEGER DEFAULT 1,
    condition VARCHAR(50) DEFAULT 'Baik / Berfungsi Normal', -- 'Baik / Berfungsi Normal', 'Perlu Servis', 'Rusak'
    estimated_value NUMERIC(12, 2) DEFAULT 0,
    purchase_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE warehouse_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon all warehouse_assets" ON warehouse_assets;
CREATE POLICY "Allow anon all warehouse_assets" ON warehouse_assets FOR ALL USING (true) WITH CHECK (true);

-- Seed Awal Aset Bara Coffee
INSERT INTO warehouse_assets (asset_code, name, category, location, quantity, condition, estimated_value, notes) VALUES
    ('AST-01', 'Mesin Espresso Komersial 2 Group', 'Mesin Kopi', 'Kedai Utama', 1, 'Baik / Berfungsi Normal', 35000000, 'Mesin Utama Kedai'),
    ('AST-02', 'Grinder Espresso On Demand', 'Mesin Kopi', 'Kedai Utama', 1, 'Baik / Berfungsi Normal', 6500000, 'Grinder Utama'),
    ('AST-03', 'Unit Gerobak Kayu Mobile + Tenda', 'Gerobak & Booth', 'Gerobak', 1, 'Baik / Berfungsi Normal', 12000000, 'Gerobak Jualan Luar'),
    ('AST-04', 'Mesin Espresso Portable / Manual', 'Mesin Kopi', 'Gerobak', 1, 'Baik / Berfungsi Normal', 3500000, 'Unit Operasional Gerobak'),
    ('AST-05', 'Tablet POS Kasir Android', 'Elektronik', 'Kedai Utama', 1, 'Baik / Berfungsi Normal', 2200000, 'Tablet KasirPro')
ON CONFLICT DO NOTHING;