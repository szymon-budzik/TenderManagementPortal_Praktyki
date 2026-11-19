export const CONFIGURABLE_PERMISSIONS = [
  { id: 'ENDPOINTS', label: 'Endpointy' },
  { id: 'KEYWORDS', label: 'Keywordsy' },
  { id: 'SMTP', label: 'SMTP' },
  { id: 'USERS', label: 'Użytkownicy' },
];

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
  window.dispatchEvent(new Event('rolesUpdated'));
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
  window.dispatchEvent(new Event('rolesUpdated'));
}

export function getEffectiveUserRole(username, backendRole) {
  if (username && username.toLowerCase() === 'admin') {
    return 'ROLE_ADMIN';
  }
  const map = getUserRolesMap();
  return map[username] || backendRole || 'ROLE_USER';
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