import { getSupabaseClient } from './supabase';

const STORAGE_KEY_ATTENDANCE = 'baracoffee_real_attendance';

function isValidUuid(id) {
  if (!id || typeof id !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Mengambil seluruh data presensi kru real-time dari Supabase
 * dengan fallback ke cache lokal jika offline / Supabase belum diset.
 */
export async function getAttendanceRecords() {
  const supabase = getSupabaseClient();
  let localRecords = [];

  try {
    const saved = localStorage.getItem(STORAGE_KEY_ATTENDANCE);
    if (saved) {
      localRecords = JSON.parse(saved);
    }
  } catch (err) {
    console.warn('Gagal membaca cache lokal absensi:', err);
  }

  // 1. Jika terhubung ke Supabase, ambil data dari tabel attendance
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Supabase query attendance error:', error.message);
        return {
          source: 'local',
          data: localRecords,
          isLive: false,
          error: error.message
        };
      }

      if (data) {
        // Ambil data lokal yang belum tersimpan di Supabase (id berawalan 'att-')
        const unsyncedLocal = localRecords.filter(r => String(r.id).startsWith('att-'));
        
        // Gabungkan: Unsynced local di posisi paling atas, diikuti data resmi Supabase
        const remoteIds = new Set(data.map(d => d.id));
        const nonDuplicateUnsynced = unsyncedLocal.filter(u => !remoteIds.has(u.id));
        const merged = [...nonDuplicateUnsynced, ...data];

        localStorage.setItem(STORAGE_KEY_ATTENDANCE, JSON.stringify(merged));

        // Background auto-sync jika ada unsynced records
        if (nonDuplicateUnsynced.length > 0) {
          syncPendingAttendance(nonDuplicateUnsynced).catch(e => console.warn('Background sync warning:', e));
        }

        return {
          source: 'supabase',
          data: merged,
          isLive: true,
          hasUnsynced: nonDuplicateUnsynced.length > 0
        };
      }
    } catch (err) {
      console.warn('Supabase fetch attendance exception:', err);
      return {
        source: 'local',
        data: localRecords,
        isLive: false,
        error: err.message
      };
    }
  }

  return {
    source: 'local',
    data: localRecords,
    isLive: false
  };
}

/**
 * Menyimpan catatan Clock-In atau Kehadiran Kru ke Supabase.
 * Dilengkapi fallback otomatis bila struktur database di Supabase belum diperbarui.
 */
export async function saveClockInRecord(recordData, shiftObj = null) {
  const supabase = getSupabaseClient();
  const tempId = recordData.id || `att-${Date.now()}`;
  let finalRecord = {
    ...recordData,
    id: tempId,
    created_at: recordData.created_at || new Date().toISOString()
  };
  let saveResult = {
    success: false,
    source: 'local',
    data: finalRecord,
    error: null
  };

  // 1. Simpan ke Supabase jika terhubung
  if (supabase) {
    const payload = {
      entry_date: recordData.entry_date,
      staff_name: recordData.staff_name,
      position: recordData.position || 'Barista',
      shift: recordData.shift,
      schedule_in: recordData.schedule_in || null,
      schedule_out: recordData.schedule_out || null,
      clock_in: recordData.clock_in,
      clock_out: recordData.clock_out || '-',
      work_duration: recordData.work_duration || '-',
      status: recordData.status || 'Hadir',
      late_minutes: Number(recordData.late_minutes) || 0,
      late_reason: recordData.late_reason || null,
      overtime_hours: Number(recordData.overtime_hours) || 0,
      handover_notes: recordData.handover_notes || '',
      notes: recordData.notes || '',
      is_demo: Boolean(recordData.is_demo),
      photo_url: recordData.photo_url || null
    };

    if (isValidUuid(recordData.user_id)) {
      payload.user_id = recordData.user_id;
    }

    try {
      // Upaya 1: Insert payload penuh
      const { data, error } = await supabase
        .from('attendance')
        .insert([payload])
        .select()
        .single();

      if (!error && data) {
        finalRecord = data;
        saveResult = { success: true, source: 'supabase', data, error: null };
      } else if (error) {
        console.warn('Supabase attendance insert attempt 1 failed:', error.message);
        
        // Upaya 2: Jika error karena shift melebihi VARCHAR(30)
        let retryPayload = { ...payload };
        if (error.message?.includes('character varying(30)') || error.message?.includes('value too long')) {
          const shortShift = shiftObj?.shortName || payload.shift.slice(0, 30);
          retryPayload.shift = shortShift;
          if (retryPayload.position) retryPayload.position = retryPayload.position.slice(0, 50);
          if (retryPayload.work_duration) retryPayload.work_duration = retryPayload.work_duration.slice(0, 30);
        }

        // Jika error karena kolom baru belum ada (misal: late_reason, schedule_in, is_demo)
        if (error.message?.includes('column') && error.message?.includes('does not exist')) {
          delete retryPayload.late_reason;
          delete retryPayload.schedule_in;
          delete retryPayload.schedule_out;
          delete retryPayload.is_demo;
        }

        const retryRes = await supabase
          .from('attendance')
          .insert([retryPayload])
          .select()
          .single();

        if (!retryRes.error && retryRes.data) {
          finalRecord = retryRes.data;
          saveResult = { 
            success: true, 
            source: 'supabase', 
            data: retryRes.data, 
            warning: 'Tersimpan dengan mode kompatibilitas schema. Disarankan perbarui script supabase_schema.sql di Supabase SQL Editor.' 
          };
        } else {
          // Upaya 3: Minimal base payload
          const minimalPayload = {
            entry_date: payload.entry_date,
            staff_name: payload.staff_name,
            shift: (shiftObj?.shortName || payload.shift).slice(0, 30),
            clock_in: payload.clock_in,
            clock_out: payload.clock_out,
            status: payload.status,
            notes: payload.notes
          };
          const minimalRes = await supabase
            .from('attendance')
            .insert([minimalPayload])
            .select()
            .single();

          if (!minimalRes.error && minimalRes.data) {
            finalRecord = minimalRes.data;
            saveResult = { success: true, source: 'supabase', data: minimalRes.data };
          } else {
            saveResult = { 
              success: false, 
              source: 'local', 
              data: finalRecord, 
              error: error.message || retryRes.error?.message 
            };
          }
        }
      }
    } catch (err) {
      console.warn('Gagal simpan absensi ke Supabase, simpan lokal:', err);
      saveResult = { success: false, source: 'local', data: finalRecord, error: err.message };
    }
  }

  // 2. Simpan ke local cache
  try {
    const saved = localStorage.getItem(STORAGE_KEY_ATTENDANCE);
    const existing = saved ? JSON.parse(saved) : [];
    const updated = [finalRecord, ...existing.filter(r => r.id !== finalRecord.id && r.id !== tempId)];
    localStorage.setItem(STORAGE_KEY_ATTENDANCE, JSON.stringify(updated));
  } catch (err) {
    console.error('Gagal update local storage absensi:', err);
  }

  return saveResult;
}

/**
 * Mengupdate data Clock-Out kru di Supabase dan LocalStorage
 */
export async function updateClockOutRecord(targetRecord, updates) {
  const supabase = getSupabaseClient();
  let updatedRecord = { ...targetRecord, ...updates };
  let result = { success: false, source: 'local', data: updatedRecord };

  if (supabase && targetRecord.id && isValidUuid(targetRecord.id)) {
    try {
      const cleanUpdates = {
        clock_out: updates.clock_out,
        work_duration: updates.work_duration || '-',
        overtime_hours: Number(updates.overtime_hours) || 0,
        handover_notes: updates.handover_notes || '',
        photo_out_url: updates.photo_out_url || null
      };

      const { data, error } = await supabase
        .from('attendance')
        .update(cleanUpdates)
        .eq('id', targetRecord.id)
        .select()
        .single();

      if (!error && data) {
        updatedRecord = data;
        result = { success: true, source: 'supabase', data };
      } else if (error) {
        console.warn('Supabase update clock-out error:', error.message);
        result = { success: false, source: 'local', data: updatedRecord, error: error.message };
      }
    } catch (err) {
      console.warn('Clock-out update exception:', err);
      result = { success: false, source: 'local', data: updatedRecord, error: err.message };
    }
  } else if (supabase && String(targetRecord.id).startsWith('att-')) {
    // Record sebelumnya gagal masuk Supabase saat clock in.
    // Coba simpan sekarang sebagai satu record lengkap yang sudah clock out!
    const fullRecordToInsert = { ...targetRecord, ...updates };
    const insertRes = await saveClockInRecord(fullRecordToInsert);
    if (insertRes.success) {
      updatedRecord = insertRes.data;
      result = { success: true, source: 'supabase', data: insertRes.data };
    }
  }

  // Update local storage
  try {
    const saved = localStorage.getItem(STORAGE_KEY_ATTENDANCE);
    const existing = saved ? JSON.parse(saved) : [];
    const updated = existing.map(r => r.id === targetRecord.id ? updatedRecord : r);
    localStorage.setItem(STORAGE_KEY_ATTENDANCE, JSON.stringify(updated));
  } catch (err) {
    console.error('Error update local storage clock out:', err);
  }

  return result;
}

/**
 * Menyimpan catatan Izin / Sakit / Cuti kru
 */
export async function saveLeaveRecord(leaveData) {
  const recordToSave = {
    entry_date: leaveData.entry_date,
    staff_name: leaveData.staff_name,
    position: leaveData.position || 'Kru',
    shift: 'Non-Shift',
    schedule_in: '-',
    schedule_out: '-',
    clock_in: '-',
    clock_out: '-',
    work_duration: '-',
    status: leaveData.status || 'Izin',
    late_minutes: 0,
    late_reason: null,
    overtime_hours: 0,
    handover_notes: '',
    notes: leaveData.notes || `Status: ${leaveData.status}`,
    is_demo: false
  };

  return await saveClockInRecord(recordToSave);
}

/**
 * Menghapus catatan absensi dari Supabase & local storage
 */
export async function deleteAttendanceRecord(recordId) {
  const supabase = getSupabaseClient();
  let result = { success: true, source: 'local' };

  if (supabase && isValidUuid(recordId)) {
    try {
      const { error } = await supabase.from('attendance').delete().eq('id', recordId);
      if (!error) {
        result = { success: true, source: 'supabase' };
      } else {
        console.warn('Gagal hapus absensi dari Supabase:', error.message);
        result = { success: false, error: error.message };
      }
    } catch (err) {
      console.warn('Exception saat hapus absensi Supabase:', err);
      result = { success: false, error: err.message };
    }
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY_ATTENDANCE);
    if (saved) {
      const existing = JSON.parse(saved);
      const filtered = existing.filter(r => r.id !== recordId);
      localStorage.setItem(STORAGE_KEY_ATTENDANCE, JSON.stringify(filtered));
    }
  } catch (err) {
    console.error('Gagal update local storage hapus:', err);
  }

  return result;
}

/**
 * Sinkronisasi data absensi lokal (id: 'att-*') yang belum sempat masuk ke Supabase
 */
export async function syncPendingAttendance(customList = null) {
  const supabase = getSupabaseClient();
  if (!supabase) return { syncedCount: 0, message: 'Supabase belum dikonfigurasi.' };

  let listToSync = customList;
  if (!listToSync) {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ATTENDANCE);
      if (saved) {
        const parsed = JSON.parse(saved);
        listToSync = parsed.filter(r => String(r.id).startsWith('att-'));
      }
    } catch (e) {
      listToSync = [];
    }
  }

  if (!listToSync || listToSync.length === 0) {
    return { syncedCount: 0, message: 'Semua catatan absensi sudah tersinkronisasi.' };
  }

  let successCount = 0;
  let errors = [];

  for (const item of listToSync) {
    const res = await saveClockInRecord(item);
    if (res.success && res.source === 'supabase') {
      successCount++;
    } else if (res.error) {
      errors.push(res.error);
    }
  }

  return {
    syncedCount: successCount,
    totalAttempted: listToSync.length,
    errors
  };
}
