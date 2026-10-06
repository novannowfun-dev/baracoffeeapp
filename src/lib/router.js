import { ROLES } from './auth';

export const VALID_TABS = [
  'input',
  'stock',
  'kasbon',
  'attendance',
  'dashboard',
  'kasirpro',
  'history',
  'payroll',
  'pnl',
  'settings'
];

export const OWNER_ONLY_TABS = [
  'settings',
  'pnl',
  'assets'
];

const STORAGE_KEY_LAST_TAB = 'baracoffee_active_tab';

/**
 * Parsing rute dari window.location.hash
 */
export function getRouteFromHash() {
  try {
    const rawHash = window.location.hash || '';
    if (!rawHash) {
      const savedTab = localStorage.getItem(STORAGE_KEY_LAST_TAB);
      if (savedTab && VALID_TABS.includes(savedTab)) {
        return { tab: savedTab, subTab: null };
      }
      return { tab: 'dashboard', subTab: null };
    }

    const clean = rawHash.replace(/^#\/?/, '');
    const [pathPart, queryPart] = clean.split('?');
    const tab = pathPart.toLowerCase().trim();

    let subTab = null;
    if (queryPart) {
      const params = new URLSearchParams(queryPart);
      subTab = params.get('sub');
    }

    if (VALID_TABS.includes(tab)) {
      return { tab, subTab };
    }
  } catch (err) {
    console.warn('Error parsing route hash:', err);
  }

  return { tab: 'dashboard', subTab: null };
}

/**
 * Mengubah URL hash dan menyimpan ke local cache
 */
export function navigateRoute(tab, subTab = null) {
  if (!VALID_TABS.includes(tab)) return;

  const targetHash = subTab ? `#/${tab}?sub=${subTab}` : `#/${tab}`;
  
  if (window.location.hash !== targetHash) {
    window.location.hash = targetHash;
  }
  
  localStorage.setItem(STORAGE_KEY_LAST_TAB, tab);
}

export function isOwnerTab(tab) {
  return OWNER_ONLY_TABS.includes(tab);
}

export function getAccessibleTab(targetTab, currentUser) {
  const isOwner = currentUser?.role === ROLES.OWNER || currentUser?.role === ROLES.MANAGER;
  if (isOwnerTab(targetTab) && !isOwner) {
    return 'input';
  }
  return targetTab;
}