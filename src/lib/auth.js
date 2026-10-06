import { getSupabaseClient } from './supabase';

const STORAGE_KEY_CURRENT_USER = 'baracoffee_active_user';
const STORAGE_KEY_STAFF_LIST = 'baracoffee_staff_list';
const STORAGE_KEY_OWNER_PIN = 'baracoffee_owner_pin';
const STORAGE_KEY_SESSION_TIMEOUT = 'baracoffee_session_timeout';
const STORAGE_KEY_LAST_ACTIVITY = 'baracoffee_last_activity';
const STORAGE_KEY_TIMEOUT_SCOPE = 'baracoffee_timeout_scope';

export const DEFAULT_TIMEOUT_MINUTES = 15;

export const ROLES = {
  OWNER: 'owner',
  MANAGER: 'manager',
  KRU: 'kru'
};

export const POSITIONS = [
  'Barista',
  'Baker',
  'Kasir',
  'Cook / Kitchen',
  'Supervisor / Manager'
];

const DEFAULT_OWNER_PIN = '8888';

const INITIAL_ADMIN = [
  { id: 'usr-owner', name: 'Owner Bara Coffee', role: ROLES.OWNER, position: 'Owner', pin_code: '8888', is_active: true }
];

const INITIAL_ADMIN_SEED = [
  { name: 'Owner Bara Coffee', role: ROLES.OWNER, position: 'Owner', pin_code: '8888', is_active: true }
];

export function getOwnerPin() {
  return localStorage.getItem(STORAGE_KEY_OWNER_PIN) || DEFAULT_OWNER_PIN;
}

export function setOwnerPin(newPin) {
  if (newPin && newPin.trim()) {
    localStorage.setItem(STORAGE_KEY_OWNER_PIN, newPin.trim());
  }
}

/**
 * Konfigurasi Batas Waktu Sesi (Menit)
 * 0 = nonaktif, 5, 10, 15 (default), 30, 60
 */
export function getSessionTimeoutMinutes() {
  const saved = localStorage.getItem(STORAGE_KEY_SESSION_TIMEOUT);
  if (saved !== null) {
    const parsed = Number(saved);
    return isNaN(parsed) ? DEFAULT_TIMEOUT_MINUTES : parsed;
  }
  return DEFAULT_TIMEOUT_MINUTES;
}

export function setSessionTimeoutMinutes(minutes) {
  const num = Number(minutes);
  if (!isNaN(num)) {
    localStorage.setItem(STORAGE_KEY_SESSION_TIMEOUT, String(num));
  }
}

/**
 * Cakupan Pengguna yang Terkena Timeout
 * 'owner_only' (Default, melindungi menu owner) atau 'all' (semua user)
 */
export function getSessionTimeoutScope() {
  return localStorage.getItem(STORAGE_KEY_TIMEOUT_SCOPE) || 'owner_only';
}

export function setSessionTimeoutScope(scope) {
  if (scope === 'all' || scope === 'owner_only') {
    localStorage.setItem(STORAGE_KEY_TIMEOUT_SCOPE, scope);
  }
}

/**
 * Pencatatan Aktivitas Interaksi Pengguna Terakhir
 */
export function recordUserActivity() {
  localStorage.setItem(STORAGE_KEY_LAST_ACTIVITY, String(Date.now()));
}

export function getLastUserActivity() {
  const saved = localStorage.getItem(STORAGE_KEY_LAST_ACTIVITY);
  return saved ? Number(saved) : Date.now();
}

/**
 * Cek apakah sesi pengguna saat ini sudah kedaluwarsa karena tidak ada aktivitas
 */
export function isSessionExpired(targetUser = null) {
  if (!targetUser) return false;

  const timeoutMinutes = getSessionTimeoutMinutes();
  if (timeoutMinutes <= 0) return false; // 0 = timeout dimatikan

  const scope = getSessionTimeoutScope();
  if (scope === 'owner_only') {
    const isOwnerOrManager = targetUser.role === ROLES.OWNER || targetUser.role === ROLES.MANAGER;
    if (!isOwnerOrManager) return false;
  }

  const lastActivity = getLastUserActivity();
  const elapsedMs = Date.now() - lastActivity;
  const timeoutMs = timeoutMinutes * 60 * 1000;

  return elapsedMs > timeoutMs;
}

/**
 * Return current logged in user, or null if logged out / expired
 */
export function getCurrentUser() {
  const saved = localStorage.getItem(STORAGE_KEY_CURRENT_USER);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Validasi apakah sesi sudah melebihi batas waktu inaktivitas
      if (isSessionExpired(parsed)) {
        logoutUser();
        return null;
      }
      return parsed;
    } catch (e) {
      console.error(e);
    }
  }
  return null; // Wajib login awal
}

export function setCurrentUser(user) {
  if (user) {
    localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(user));
    recordUserActivity();
  } else {
    localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
    localStorage.removeItem(STORAGE_KEY_LAST_ACTIVITY);
  }
}

export function logoutUser() {
  localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
  localStorage.removeItem(STORAGE_KEY_LAST_ACTIVITY);
}

/**
 * Mengambil daftar staf murni dari tabel cafe_users di Supabase
 */
export async function getStaffList() {
  const supabase = getSupabaseClient();
  
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('cafe_users')
        .select('*')
        .order('role', { ascending: true })
        .order('name', { ascending: true });

      if (!error && data) {
        // Jika tabel Supabase masih kosong sama sekali, daftarkan Owner pertama kali
        if (data.length === 0) {
          const seedRes = await supabase.from('cafe_users').insert(INITIAL_ADMIN_SEED).select();
          if (!seedRes.error && seedRes.data) {
            localStorage.setItem(STORAGE_KEY_STAFF_LIST, JSON.stringify(seedRes.data));
            return seedRes.data;
          }
        }
        localStorage.setItem(STORAGE_KEY_STAFF_LIST, JSON.stringify(data));
        return data;
      }
    } catch (err) {
      console.warn('Gagal fetch users dari Supabase:', err);
    }
  }

  const saved = localStorage.getItem(STORAGE_KEY_STAFF_LIST);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Bersihkan jika ada sisa mock staff
      const cleaned = parsed.filter(u => !['Budi Santoso', 'Siti Rahma', 'Andi Pratama', 'Reza Fahrezi', 'Maya Anggraini'].includes(u.name));
      if (cleaned.length > 0) return cleaned;
    } catch (e) {}
  }

  return INITIAL_ADMIN;
}

/**
 * Fungsi Login Pengguna (Owner atau Kru)
 */
export async function loginUser(nameOrId, pin) {
  const staffList = await getStaffList();
  const trimmedInput = nameOrId.trim().toLowerCase();
  const trimmedPin = pin.trim();

  // 1. Cek apakah login sebagai Owner langsung dengan PIN Owner
  if (trimmedInput === 'owner' || trimmedInput === 'owner baracoffee') {
    const masterPin = getOwnerPin();
    if (trimmedPin === masterPin || trimmedPin === '8888') {
      const ownerUser = staffList.find(u => u.role === ROLES.OWNER) || INITIAL_ADMIN[0];
      setCurrentUser(ownerUser);
      return { success: true, user: ownerUser };
    } else {
      return { success: false, message: 'PIN Owner salah. Silakan coba lagi.' };
    }
  }

  // 2. Cek kecocokan nama staf dan PIN
  const matchedUser = staffList.find(u => 
    u.name.toLowerCase() === trimmedInput || 
    u.id === nameOrId ||
    (u.phone && u.phone === trimmedInput)
  );

  if (!matchedUser) {
    return { success: false, message: 'Nama staf atau akun tidak ditemukan. Silakan periksa atau daftar akun baru.' };
  }

  if (matchedUser.is_active === false) {
    return { success: false, message: 'Akun staf ini berstatus nonaktif. Hubungi Owner untuk aktivasi kembali.' };
  }

  // Cek PIN
  const userPin = matchedUser.pin_code;
  const masterPin = getOwnerPin();

  if (trimmedPin === userPin || (matchedUser.role === ROLES.OWNER && trimmedPin === masterPin)) {
    setCurrentUser(matchedUser);
    return { success: true, user: matchedUser };
  } else {
    return { success: false, message: 'PIN tidak sesuai. Silakan hubungi Owner jika lupa PIN.' };
  }
}

/**
 * Pendaftaran Akun Kru Baru Mandiri
 */
export async function registerStaffUser({ name, position, pin, phone }) {
  const supabase = getSupabaseClient();
  const staffList = await getStaffList();

  const existing = staffList.find(u => u.name.toLowerCase() === name.trim().toLowerCase());
  if (existing) {
    return { success: false, message: `Nama "${name}" sudah terdaftar sebelumnya. Silakan gunakan nama lengkap atau nama panggilan lain.` };
  }

  const newUser = {
    name: name.trim(),
    role: ROLES.KRU,
    position: position || 'Barista',
    pin_code: pin.trim(),
    phone: phone ? phone.trim() : '',
    is_active: true
  };

  let savedUser = {
    ...newUser,
    id: `usr-${Date.now()}`,
    created_at: new Date().toISOString()
  };

  // Simpan ke Supabase jika terhubung
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('cafe_users')
        .insert([newUser])
        .select()
        .single();

      if (!error && data) {
        savedUser = data;
      }
    } catch (err) {
      console.warn('Gagal simpan registrasi kru ke Supabase:', err);
    }
  }

  const updated = [...staffList, savedUser];
  localStorage.setItem(STORAGE_KEY_STAFF_LIST, JSON.stringify(updated));
  
  // Langsung login otomatis setelah daftar
  setCurrentUser(savedUser);

  return { success: true, user: savedUser };
}

/**
 * Tambah Staf oleh Owner di menu Pengaturan
 */
export async function addStaffUser(user) {
  return registerStaffUser({
    name: user.name,
    position: user.position || 'Barista',
    pin: user.pin || '1234',
    phone: user.phone || ''
  });
}

export async function updateStaffUser(userId, updates) {
  const supabase = getSupabaseClient();
  
  if (supabase) {
    try {
      await supabase
        .from('cafe_users')
        .update(updates)
        .eq('id', userId);
    } catch (err) {
      console.warn('Gagal update user di Supabase:', err);
    }
  }

  const currentList = await getStaffList();
  const updated = currentList.map(u => u.id === userId ? { ...u, ...updates } : u);
  localStorage.setItem(STORAGE_KEY_STAFF_LIST, JSON.stringify(updated));

  // Jika yang diedit adalah user yang sedang aktif login, perbarui juga sesi aktifnya
  const activeUser = getCurrentUser();
  if (activeUser && (activeUser.id === userId || (activeUser.role === ROLES.OWNER && updates.role === ROLES.OWNER))) {
    const updatedActiveUser = { ...activeUser, ...updates };
    setCurrentUser(updatedActiveUser);
  }

  return true;
}

/**
 * Hapus staf
 */
export async function deleteStaffUser(userId) {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('cafe_users').delete().eq('id', userId);
    } catch (err) {
      console.warn('Gagal hapus user di Supabase:', err);
    }
  }

  const currentList = await getStaffList();
  const updated = currentList.filter(u => u.id !== userId);
  localStorage.setItem(STORAGE_KEY_STAFF_LIST, JSON.stringify(updated));
  return true;
}
