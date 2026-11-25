import { useState, useEffect, useCallback } from 'react';
import { Layers } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import AutomationProfileForm from './automation/AutomationProfileForm';
import AutomationProfilesTable from './automation/AutomationProfilesTable';
import {
  EMPTY_PROFILE_FORM,
  parseCategoryModesMap,
  parseIdList,
} from './automation/automationUtils';
import {
  createProfile,
  deleteProfile,
  getProfiles,
  getSmtpAccounts,
  triggerProfile,
  updateProfile,
} from '../services/automationApi';
import { getSearchSources } from '../services/endpointsApi';
import { getKeywordCategories } from '../services/keywordsApi';
import { useSort } from '../hooks/useSort';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import { usePolling } from '../hooks/usePolling';

export default function AutomationView() {
  const [profiles, setProfiles] = useState([]);
  const [endpoints, setEndpoints] = useState([]);
  const [categories, setCategories] = useState([]);
  const [smtpAccounts, setSmtpAccounts] = useState([]);
  const [loadingAction, setLoadingAction] = useState(false);

  const [editingProfileId, setEditingProfileId] = useState(null);
  const [profileForm, setProfileForm] = useState(EMPTY_PROFILE_FORM);

  const { confirmDialog, openConfirm, closeConfirm } = useConfirmDialog();
  const { toggleSort, sortedItems: sortedProfiles } = useSort(profiles, {
    key: 'id',
    dir: 'asc',
  });

  const fetchAll = useCallback(async () => {
    try {
      const [profData, smtpData, epData, catData] = await Promise.all([
        getProfiles().catch(() => []),
        getSmtpAccounts().catch(() => []),
        getSearchSources().catch(() => []),
        getKeywordCategories().catch(() => []),
      ]);
      setProfiles(profData);
      setSmtpAccounts(smtpData);
      setEndpoints(epData);
      setCategories(catData);
    } catch (err) {
      console.error('Błąd pobierania danych profili automatyzacji:', err);
    }
  }, []);

  const refreshProfilesQuietly = useCallback(async () => {
    try {
      const data = await getProfiles();
      setProfiles(data);
    } catch {
      // Ciche odświeżanie w tle co 10s
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  usePolling(refreshProfilesQuietly, 10000);

  const resetProfileForm = () => {
    setEditingProfileId(null);
    setProfileForm(EMPTY_PROFILE_FORM);
  };

  const handleStartEditProfile = (p) => {
    setEditingProfileId(p.id);
    const isInterval = (p.scheduleType || '').toUpperCase() === 'INTERVAL';
    setProfileForm({
      name: p.name || '',
      enabled: Boolean(p.enabled),
      notificationsEnabled: p.notificationsEnabled !== false,
      scheduleType: isInterval ? 'INTERVAL' : 'SCHEDULE',
      cronTime: p.cronTime || '8:00',
      intervalMinutes: p.intervalMinutes || 60,
      selectedEndpointIds: parseIdList(p.endpointIds),
      selectedCategoryIds: parseIdList(p.categoryIds),
      categoryModes: parseCategoryModesMap(p.categoryIds, p.matchMode),
      recipientEmails: p.recipientEmails || '',
      smtpAccountId: p.smtpAccountId ? String(p.smtpAccountId) : '',
    });
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (
      !profileForm.name.trim() ||
      profileForm.selectedEndpointIds.length === 0 ||
      profileForm.selectedCategoryIds.length === 0
    ) {
      return;
    }

    const serializedCategories = profileForm.selectedCategoryIds
      .map((id) => `${id}:${profileForm.categoryModes[id] || 'OR'}`)
      .join(',');

    const hasSmtp = Boolean(profileForm.smtpAccountId);

    const payload = {
      name: profileForm.name.trim(),
      enabled: profileForm.enabled,
      scheduleType: profileForm.scheduleType,
      cronTime: profileForm.cronTime.trim() || '8:00',
      intervalMinutes: Math.max(1, Number(profileForm.intervalMinutes) || 60),
      daysOfWeek: '',
      matchMode: 'OR',
      endpointIds: profileForm.selectedEndpointIds.join(','),
      categoryIds: serializedCategories,
      recipientEmails: hasSmtp ? profileForm.recipientEmails.trim() : '',
      smtpAccountId: hasSmtp ? Number(profileForm.smtpAccountId) : null,
      notificationsEnabled: profileForm.notificationsEnabled,
    };

    try {
      if (editingProfileId) {
        await updateProfile(editingProfileId, payload);
      } else {
        await createProfile(payload);
      }
      resetProfileForm();
      fetchAll();
    } catch (err) {
      console.error('Błąd zapisu profilu:', err);
    }
  };

  const handleToggleProfileEnabled = async (profile) => {
    try {
      await updateProfile(profile.id, { ...profile, enabled: !profile.enabled });
      fetchAll();
    } catch (err) {
      console.error('Błąd zmiany statusu profilu:', err);
    }
  };

  const handleToggleProfileNotifications = async (profile) => {
    try {
      await updateProfile(profile.id, {
        ...profile,
        notificationsEnabled: profile.notificationsEnabled === false,
      });
      fetchAll();
    } catch (err) {
      console.error('Błąd zmiany ustawień powiadomień profilu:', err);
    }
  };

  const handleTriggerProfileNow = async (profile) => {
    setLoadingAction(true);
    try {
      await triggerProfile(profile.id);
      await fetchAll();
    } catch (err) {
      console.error('Błąd uruchamiania profilu:', err);
    } finally {
      window.dispatchEvent(new Event('notificationsUpdated'));
      setLoadingAction(false);
    }
  };

  const confirmDeleteProfile = (profile) => {
    openConfirm({
      title: 'Usuń profil automatyzacji',
      message: `Czy na pewno chcesz usunąć profil "${profile.name}"?`,
      onConfirm: async () => {
        await deleteProfile(profile.id);
        if (editingProfileId === profile.id) resetProfileForm();
        fetchAll();
      },
    });
  };

  return (
    <div className="space-y-6 text-black">
      {confirmDialog && (
        <ConfirmModal
          isOpen={true}
          open={true}
          title={confirmDialog.title}
          message={confirmDialog.message}
          description={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={closeConfirm}
          onClose={closeConfirm}
        />
      )}

      <div>
        <h2 className="text-2xl font-extrabold text-black">
          Automatyzacja — Profile Harmonogramu (Cron)
        </h2>
        <p className="text-sm font-medium text-black mt-1">
          Twórz dedykowane profile (np. dla firmy IT, budowlanej) z własnymi endpointami, kategoriami (OR/AND), harmonogramem i opcjonalnym kontem SMTP.
        </p>
      </div>

      <div className="bg-white p-6 rounded-xl border-2 border-blue-600 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-blue-100 pb-4">
          <div className="flex items-center gap-2.5">
            <Layers size={22} className="text-blue-600" />
            <div>
              <h3 className="text-lg font-extrabold text-black">
                Kreator i Obsługa Profili Automatyzacji (Cron)
              </h3>
              <p className="text-xs font-semibold text-black">
                Wybierz tryb harmonogramu, konto SMTP (lub Brak SMTP) oraz przypisz endpointy i kategorie.
              </p>
            </div>
          </div>

          {editingProfileId && (
            <button
              type="button"
              onClick={resetProfileForm}
              className="px-3.5 py-1.5 bg-white border border-blue-400 hover:bg-blue-50 rounded-lg text-xs font-bold cursor-pointer"
            >
              Anuluj edycję
            </button>
          )}
        </div>

        <AutomationProfileForm
          profileForm={profileForm}
          setProfileForm={setProfileForm}
          editingProfileId={editingProfileId}
          endpoints={endpoints}
          categories={categories}
          smtpAccounts={smtpAccounts}
          onSubmit={handleSaveProfile}
        />

        <AutomationProfilesTable
          profiles={sortedProfiles}
          endpoints={endpoints}
          categories={categories}
          smtpAccounts={smtpAccounts}
          loadingAction={loadingAction}
          onToggleSort={toggleSort}
          onToggleEnabled={handleToggleProfileEnabled}
          onToggleNotifications={handleToggleProfileNotifications}
          onTriggerNow={handleTriggerProfileNow}
          onStartEdit={handleStartEditProfile}
          onConfirmDelete={confirmDeleteProfile}
        />
      </div>
    </div>
  );
}
