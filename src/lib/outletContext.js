// Outlet Management Helper (Kedai Utama vs Gerobak)

const OUTLET_STORAGE_KEY = 'baracoffee_active_outlet';

export const OUTLETS = {
  KEDAI: {
    id: 'kedai',
    name: 'Kedai Utama',
    subtitle: 'Outlet Pusat & Dine-in',
    badge: 'Kedai',
    color: '#e07a2c'
  },
  GEROBAK: {
    id: 'gerobak',
    name: 'Gerobak Bara',
    subtitle: 'Street Coffee & Mobile Booth',
    badge: 'Gerobak',
    color: '#d97706'
  }
};

export function getActiveOutlet() {
  try {
    const saved = localStorage.getItem(OUTLET_STORAGE_KEY);
    if (saved && OUTLETS[saved.toUpperCase()]) {
      return saved;
    }
  } catch (e) {
    console.warn('Gagal membaca outlet dari storage', e);
  }
  return 'kedai';
}

export function setActiveOutlet(outletId) {
  try {
    localStorage.setItem(OUTLET_STORAGE_KEY, outletId);
    window.dispatchEvent(new CustomEvent('baracoffee:outlet-changed', { detail: { outlet: outletId } }));
  } catch (e) {
    console.error('Gagal menyimpan outlet aktif', e);
  }
}

export function subscribeOutletChange(callback) {
  const handler = (e) => {
    callback(e.detail?.outlet || getActiveOutlet());
  };
  window.addEventListener('baracoffee:outlet-changed', handler);
  return () => window.removeEventListener('baracoffee:outlet-changed', handler);
}