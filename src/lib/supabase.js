import { createClient } from '@supabase/supabase-js';

const STORAGE_KEY_URL = 'baracoffee_supabase_url';
const STORAGE_KEY_KEY = 'baracoffee_supabase_key';

export function getSupabaseConfig() {
  const url = localStorage.getItem(STORAGE_KEY_URL) || import.meta.env.VITE_SUPABASE_URL || '';
  const key = localStorage.getItem(STORAGE_KEY_KEY) || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  return { url: url.trim(), key: key.trim() };
}

export function saveSupabaseConfig(url, key) {
  if (url) localStorage.setItem(STORAGE_KEY_URL, url.trim());
  else localStorage.removeItem(STORAGE_KEY_URL);
  
  if (key) localStorage.setItem(STORAGE_KEY_KEY, key.trim());
  else localStorage.removeItem(STORAGE_KEY_KEY);
}

let cachedClient = null;
let lastUsedConfig = '';

export function getSupabaseClient() {
  const { url, key } = getSupabaseConfig();
  
  if (!url || !key) {
    return null;
  }

  const configSignature = `${url}:${key}`;
  if (cachedClient && lastUsedConfig === configSignature) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, key);
    lastUsedConfig = configSignature;
    return cachedClient;
  } catch (err) {
    console.error('Gagal inisialisasi Supabase client:', err);
    return null;
  }
}

export async function testSupabaseConnection(customUrl, customKey) {
  const url = customUrl || getSupabaseConfig().url;
  const key = customKey || getSupabaseConfig().key;

  if (!url || !key) {
    return { success: false, message: 'URL atau Anon Key Supabase belum diisi.' };
  }

  try {
    const testClient = createClient(url, key);
    // Coba query sederhana ke tabel daily_sales
    const { data, error } = await testClient.from('daily_sales').select('id').limit(1);
    
    if (error) {
      // Jika tabel belum dibuat, beritahu user
      if (error.code === '42P01' || error.message?.includes('relation "daily_sales" does not exist')) {
        return {
          success: false,
          message: 'Koneksi ke Supabase berhasil, tapi tabel "daily_sales" belum dibuat. Harap jalankan script supabase_schema.sql di SQL Editor Supabase.'
        };
      }
      return { success: false, message: `Error Supabase: ${error.message}` };
    }

    return { success: true, message: 'Koneksi ke Supabase Berhasil! Tabel daily_sales terdeteksi aktif.' };
  } catch (err) {
    return { success: false, message: `Koneksi gagal: ${err.message}` };
  }
}
