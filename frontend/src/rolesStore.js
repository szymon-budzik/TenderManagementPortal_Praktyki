export const CONFIGURABLE_PERMISSIONS = [
  { id: 'ENDPOINTS', label: 'Endpointy' },
  { id: 'KEYWORDS', label: 'Keywordsy' },
  { id: 'SMTP', label: 'SMTP' },
  { id: 'USERS', label: 'Użytkownicy' },
];

const DEFAULT_ROLES = [
  {
    name: 'ROLE_ADMIN',
    permissions: ['ENDPOINTS', 'KEYWORDS', 'SMTP', 'USERS'],
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

export function getRoles() {
  const saved = localStorage.getItem(ROLES_KEY);
  if (!saved) {
    localStorage.setItem(ROLES_KEY, JSON.stringify(DEFAULT_ROLES));
    return DEFAULT_ROLES;
  }
  try {
    return JSON.parse(saved);
  } catch {
    return DEFAULT_ROLES;
  }
}

export function saveRoles(roles) {
  localStorage.setItem(ROLES_KEY, JSON.stringify(roles));
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
  const map = getUserRolesMap();
  map[username] = roleName;
  localStorage.setItem(USER_ROLES_MAP_KEY, JSON.stringify(map));
  window.dispatchEvent(new Event('rolesUpdated'));
}

export function getEffectiveUserRole(username, backendRole) {
  const map = getUserRolesMap();
  return map[username] || backendRole || 'ROLE_USER';
}

export function getRolePermissions(roleName) {
  const roles = getRoles();
  const found = roles.find((r) => r.name === roleName);
  return found ? found.permissions : [];
}

export function mapToBackendRole(roleName) {
  const perms = getRolePermissions(roleName);
  return perms.length > 0 ? 'ROLE_ADMIN' : 'ROLE_USER';
}