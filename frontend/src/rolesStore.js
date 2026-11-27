export const CONFIGURABLE_PERMISSIONS = [
  { id: 'ENDPOINTS', label: 'Endpointy' },
  { id: 'KEYWORDS', label: 'Keywordsy' },
  { id: 'SMTP', label: 'SMTP' },
  { id: 'ai', label: 'Integracje AI' },
  { id: 'groups', label: 'Grupy' },
  { id: 'USERS', label: 'Użytkownicy' },
];

export const RESOURCE_TYPES = {
  ENDPOINT: 'ENDPOINT',
  KEYWORD: 'KEYWORD',
  SMTP: 'SMTP',
  AI: 'AI',
};

const ALL_PERMISSION_IDS = CONFIGURABLE_PERMISSIONS.map((p) => p.id);

const DEFAULT_ROLES = [
  {
    name: 'ROLE_ADMIN',
    permissions: [...ALL_PERMISSION_IDS],
    isSystem: true,
  },
  {
    name: 'ROLE_USER',
    permissions: [],
    isSystem: true,
  },
];

const ROLES_KEY = 'app_custom_roles_v3';
const USER_ROLES_MAP_KEY = 'app_user_roles_map_v2';
const RESOURCE_ACCESS_KEY = 'app_resource_role_access_v1';

let roleStoreVersion = 0;

function notifyRolesUpdated() {
  roleStoreVersion += 1;
  window.dispatchEvent(new Event('rolesUpdated'));
}

export function subscribeRoleStore(listener) {
  window.addEventListener('rolesUpdated', listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener('rolesUpdated', listener);
    window.removeEventListener('storage', listener);
  };
}

export function getRoleStoreSnapshot() {
  return `${roleStoreVersion}:${localStorage.getItem(ROLES_KEY) || ''}:${localStorage.getItem(USER_ROLES_MAP_KEY) || ''}:${localStorage.getItem(RESOURCE_ACCESS_KEY) || ''}`;
}

function enforceAdminRights(roles) {
  const list = Array.isArray(roles) ? roles : [...DEFAULT_ROLES];
  let hasAdmin = false;
  const normalized = list.map((r) => {
    if (r.name === 'ROLE_ADMIN') {
      hasAdmin = true;
      return {
        ...r,
        permissions: [...ALL_PERMISSION_IDS],
        isSystem: true,
      };
    }
    return r;
  });
  if (!hasAdmin) {
    normalized.unshift({
      name: 'ROLE_ADMIN',
      permissions: [...ALL_PERMISSION_IDS],
      isSystem: true,
    });
  }
  return normalized;
}

export function getRoles() {
  const saved = localStorage.getItem(ROLES_KEY);
  if (!saved) {
    localStorage.setItem(ROLES_KEY, JSON.stringify(DEFAULT_ROLES));
    return DEFAULT_ROLES;
  }
  try {
    return enforceAdminRights(JSON.parse(saved));
  } catch {
    return DEFAULT_ROLES;
  }
}

export function saveRoles(roles) {
  const safeRoles = enforceAdminRights(roles);
  localStorage.setItem(ROLES_KEY, JSON.stringify(safeRoles));
  notifyRolesUpdated();
}

export function getUserRolesMap() {
  try {
    return JSON.parse(localStorage.getItem(USER_ROLES_MAP_KEY) || '{}');
  } catch {
    return {};
  }
}

export function setUserCustomRole(username, roleName) {
  if (username && username.toLowerCase() === 'admin') {
    return;
  }
  const map = getUserRolesMap();
  map[username] = roleName;
  localStorage.setItem(USER_ROLES_MAP_KEY, JSON.stringify(map));
  notifyRolesUpdated();
}

export function getEffectiveUserRole(username, backendRole) {
  if (username && username.toLowerCase() === 'admin') {
    return 'ROLE_ADMIN';
  }
  const map = getUserRolesMap();
  return map[username] || backendRole || 'ROLE_USER';
}

export function getCurrentUserEffectiveRole() {
  return getEffectiveUserRole(localStorage.getItem('username'), localStorage.getItem('role'));
}

export function getRolePermissions(roleName) {
  if (roleName === 'ROLE_ADMIN') {
    return [...ALL_PERMISSION_IDS];
  }
  const roles = getRoles();
  const found = roles.find((r) => r.name === roleName);
  return found ? found.permissions : [];
}

export function mapToBackendRole(roleName) {
  if (roleName === 'ROLE_ADMIN') return 'ROLE_ADMIN';
  const perms = getRolePermissions(roleName);
  return perms.length > 0 ? 'ROLE_ADMIN' : 'ROLE_USER';
}

function makeResourceKey(resourceType, resourceId) {
  return `${resourceType}:${String(resourceId)}`;
}

export function getResourceAccessMap() {
  try {
    const raw = JSON.parse(localStorage.getItem(RESOURCE_ACCESS_KEY) || '{}');
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  } catch {
    return {};
  }
}

function saveResourceAccessMap(map) {
  localStorage.setItem(RESOURCE_ACCESS_KEY, JSON.stringify(map));
  notifyRolesUpdated();
}

/**
 * Zwraca null gdy zasób jest dostępny dla wszystkich ról (brak ograniczeń),
 * albo tablicę nazw ról z dostępem (zawsze zawierającą ROLE_ADMIN).
 */
export function getResourceAllowedRoles(resourceType, resourceId) {
  if (resourceId === null || resourceId === undefined) return null;
  const map = getResourceAccessMap();
  const entry = map[makeResourceKey(resourceType, resourceId)];
  if (!Array.isArray(entry)) return null;
  const set = new Set(entry);
  set.add('ROLE_ADMIN');
  return Array.from(set);
}

/**
 * Ustawia dostęp dla zasobu. Przekazanie null usuwa ograniczenia (dostęp dla wszystkich ról).
 */
export function setResourceAllowedRoles(resourceType, resourceId, allowedRoles) {
  if (resourceId === null || resourceId === undefined) return;
  const map = getResourceAccessMap();
  const key = makeResourceKey(resourceType, resourceId);

  if (allowedRoles === null || allowedRoles === undefined) {
    delete map[key];
  } else {
    const set = new Set(Array.isArray(allowedRoles) ? allowedRoles : []);
    set.add('ROLE_ADMIN');
    map[key] = Array.from(set);
  }

  saveResourceAccessMap(map);
}

export function removeResourceAccess(resourceType, resourceId) {
  if (resourceId === null || resourceId === undefined) return;
  const map = getResourceAccessMap();
  const key = makeResourceKey(resourceType, resourceId);
  if (key in map) {
    delete map[key];
    saveResourceAccessMap(map);
  }
}

export function removeRoleFromResourceAccess(roleName) {
  if (!roleName || roleName === 'ROLE_ADMIN') return;
  const map = getResourceAccessMap();
  let changed = false;
  Object.keys(map).forEach((key) => {
    if (Array.isArray(map[key]) && map[key].includes(roleName)) {
      map[key] = map[key].filter((r) => r !== roleName);
      if (!map[key].includes('ROLE_ADMIN')) {
        map[key].unshift('ROLE_ADMIN');
      }
      changed = true;
    }
  });
  if (changed) {
    saveResourceAccessMap(map);
  }
}

export function canRoleAccessResource(resourceType, resourceId, roleName) {
  const effectiveRole = roleName || getCurrentUserEffectiveRole();
  if (effectiveRole === 'ROLE_ADMIN') return true;
  const allowed = getResourceAllowedRoles(resourceType, resourceId);
  if (allowed === null) return true;
  return allowed.includes(effectiveRole);
}

export function filterAccessibleResources(resourceType, items, roleName) {
  if (!Array.isArray(items)) return [];
  const effectiveRole = roleName || getCurrentUserEffectiveRole();
  if (effectiveRole === 'ROLE_ADMIN') return items;
  return items.filter((item) => canRoleAccessResource(resourceType, item?.id, effectiveRole));
}

export function getResourceAccessSummary(resourceType, resourceId) {
  const allRoles = getRoles();
  const allowed = getResourceAllowedRoles(resourceType, resourceId);
  if (allowed === null) {
    return {
      isRestricted: false,
      allowedCount: allRoles.length,
      totalRoles: allRoles.length,
    };
  }
  const existingAllowedCount = allRoles.filter(
    (r) => r.name === 'ROLE_ADMIN' || allowed.includes(r.name)
  ).length;
  return {
    isRestricted: true,
    allowedCount: existingAllowedCount,
    totalRoles: allRoles.length,
  };
}
