import { useMemo, useSyncExternalStore } from 'react';
import {
  filterAccessibleResources,
  getRoleStoreSnapshot,
  subscribeRoleStore,
} from '../rolesStore';

export function useAccessibleResources(resourceType, items) {
  const snapshot = useSyncExternalStore(subscribeRoleStore, getRoleStoreSnapshot);
  return useMemo(() => {
    void snapshot;
    return filterAccessibleResources(resourceType, items);
  }, [resourceType, items, snapshot]);
}
