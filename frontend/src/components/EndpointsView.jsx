import { useState, useEffect, useCallback } from 'react';
import ConfirmModal from './ConfirmModal';
import ResourceAccessModal from './ResourceAccessModal';
import EndpointCreateForm from './endpoints/EndpointCreateForm';
import EndpointsTable from './endpoints/EndpointsTable';
import EndpointNoteModal from './endpoints/EndpointNoteModal';
import EndpointTestModal from './endpoints/EndpointTestModal';
import {
  PAGE_SIZE,
  buildTestDiagnosticsMarkdown,
  validateJsonString,
} from './endpoints/endpointUtils';
import {
  createEndpoint,
  deleteEndpoint,
  getEndpoints,
  testEndpointConnection,
  updateEndpoint,
  updateEndpointNotes,
} from '../services/endpointsApi';
import { RESOURCE_TYPES, removeResourceAccess } from '../rolesStore';
import { useSort } from '../hooks/useSort';
import { usePagination } from '../hooks/usePagination';
import { useConfirmDialog } from '../hooks/useConfirmDialog';

export default function EndpointsView() {
  const [endpoints, setEndpoints] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [testingId, setTestingId] = useState(null);
  const [testStatuses, setTestStatuses] = useState({});
  const [testModal, setTestModal] = useState(null);
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);
  const [noteModal, setNoteModal] = useState(null);
  const [savingNote, setSavingNote] = useState(false);
  const [accessModalEndpoint, setAccessModalEndpoint] = useState(null);
  const [, setAccessTick] = useState(0);

  const { confirmDialog, openConfirm, closeConfirm } = useConfirmDialog();
  const { toggleSort, sortedItems: sortedEndpoints } = useSort(endpoints, {
    key: 'id',
    dir: 'asc',
  });
  const { setPage, totalPages, currentPage, paginatedItems: paginatedEndpoints } = usePagination(
    sortedEndpoints,
    PAGE_SIZE
  );

  const fetchEndpoints = useCallback(async () => {
    try {
      const data = await getEndpoints();
      setEndpoints(data);
    } catch (err) {
      console.error('Błąd pobierania endpointów:', err);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    getEndpoints()
      .then((data) => {
        if (!cancelled) setEndpoints(data);
      })
      .catch((err) => {
        console.error('Błąd pobierania endpointów:', err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreate = async (payload) => {
    try {
      await createEndpoint(payload);
      await fetchEndpoints();
      return true;
    } catch (err) {
      console.error('Błąd dodawania źródła:', err);
      return false;
    }
  };

  const handleToggleActive = async (ep) => {
    try {
      await updateEndpoint(ep.id, { ...ep, isActive: !ep.isActive });
      fetchEndpoints();
    } catch (err) {
      console.error('Błąd zmiany statusu:', err);
    }
  };

  const startEdit = (ep) => {
    setEditingId(ep.id);
    setEditForm({
      name: ep.name,
      url: ep.url,
      httpMethod: ep.httpMethod,
      payload: ep.httpMethod === 'GET' ? '' : ep.payload || '',
      linkTemplate: ep.linkTemplate || '',
      isActive: ep.isActive,
    });
  };

  const saveEdit = async (id) => {
    if (editForm.httpMethod === 'POST') {
      const check = validateJsonString(editForm.payload);
      if (!check.valid) return;
    }

    try {
      await updateEndpoint(id, {
        ...editForm,
        payload: editForm.httpMethod === 'GET' ? '' : (editForm.payload || '').trim(),
        linkTemplate: (editForm.linkTemplate || '').trim(),
      });
      setEditingId(null);
      fetchEndpoints();
    } catch (err) {
      console.error('Błąd zapisu endpointu:', err);
    }
  };

  const confirmDelete = (ep) => {
    openConfirm({
      title: 'Usuń źródło danych',
      message: `Czy na pewno chcesz usunąć endpoint "${ep.name}"?`,
      onConfirm: async () => {
        await deleteEndpoint(ep.id);
        removeResourceAccess(RESOURCE_TYPES.ENDPOINT, ep.id);
        fetchEndpoints();
      },
    });
  };

  const handleTestConnection = async (ep) => {
    setTestingId(ep.id);
    setCopiedMarkdown(false);
    const startTs = Date.now();
    try {
      const data = await testEndpointConnection(ep.id);
      const ok = Boolean(data.success);

      setTestStatuses((prev) => ({ ...prev, [ep.id]: ok ? 'OK' : 'ERR' }));
      setTestModal({
        endpoint: ep,
        success: ok,
        statusCode: data.statusCode ?? 0,
        resolvedUrl: data.resolvedUrl || ep.url,
        responseTimeMs: data.responseTimeMs ?? Date.now() - startTs,
        message: data.message || (ok ? 'Połączenie udane.' : 'Wystąpił błąd podczas testu.'),
        details: data.details || '',
        testedAt: new Date().toLocaleTimeString('pl-PL'),
      });
    } catch (err) {
      const elapsed = Date.now() - startTs;
      const httpStatus = err.response?.data?.statusCode ?? err.response?.status ?? 0;
      const backendMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Brak odpowiedzi z serwera backendu.';

      setTestStatuses((prev) => ({ ...prev, [ep.id]: 'ERR' }));
      setTestModal({
        endpoint: ep,
        success: false,
        statusCode: httpStatus,
        resolvedUrl: err.response?.data?.resolvedUrl || ep.url,
        responseTimeMs: elapsed,
        message: `Błąd wywołania testu: ${backendMsg}`,
        details: err.response?.data
          ? JSON.stringify(err.response.data, null, 2)
          : `Szczegóły błędu sieciowego: ${err.message}`,
        testedAt: new Date().toLocaleTimeString('pl-PL'),
      });
    } finally {
      setTestingId(null);
    }
  };

  const handleCopyDiagnosticsMarkdown = async () => {
    const markdown = buildTestDiagnosticsMarkdown(testModal);
    if (!markdown) return;
    try {
      await navigator.clipboard.writeText(markdown);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = markdown;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedMarkdown(true);
    setTimeout(() => setCopiedMarkdown(false), 2500);
  };

  const handleSaveNote = async () => {
    if (!noteModal) return;
    setSavingNote(true);
    try {
      await updateEndpointNotes(noteModal.endpoint.id, noteModal.text);
      setNoteModal(null);
      fetchEndpoints();
    } catch (err) {
      console.error('Błąd zapisu notatki endpointu:', err);
    } finally {
      setSavingNote(false);
    }
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

      <EndpointNoteModal
        noteModal={noteModal}
        savingNote={savingNote}
        onChangeText={(text) => setNoteModal((prev) => ({ ...prev, text }))}
        onSave={handleSaveNote}
        onClose={() => setNoteModal(null)}
      />

      <EndpointTestModal
        testModal={testModal}
        testingId={testingId}
        copiedMarkdown={copiedMarkdown}
        onRetest={handleTestConnection}
        onCopyMarkdown={handleCopyDiagnosticsMarkdown}
        onClose={() => setTestModal(null)}
      />

      <ResourceAccessModal
        isOpen={Boolean(accessModalEndpoint)}
        resourceType={RESOURCE_TYPES.ENDPOINT}
        resourceTypeLabel="Endpoint"
        resourceId={accessModalEndpoint?.id}
        resourceName={accessModalEndpoint?.name}
        usageHint="Wybierz, które role mogą korzystać z tego endpointu w Wyszukiwarce oraz w profilach Automatyzacji."
        onClose={() => setAccessModalEndpoint(null)}
        onSaved={() => setAccessTick((t) => t + 1)}
      />

      <div>
        <h2 className="text-2xl font-bold text-black">
          Zarządzanie Źródłami Danych (API i Web Scraper)
        </h2>
        <p className="text-xs font-semibold text-black mt-0.5">
          Zarządzaj źródłami API (GET/POST) i Web Scraperem. Opcjonalny Szablon linku ({'{objectId}'}, {'{id}'}) buduje klikalne adresy bez hardkodowania portali.
        </p>
      </div>

      <EndpointCreateForm onCreate={handleCreate} />

      <EndpointsTable
        endpoints={paginatedEndpoints}
        totalCount={sortedEndpoints.length}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setPage}
        onToggleSort={toggleSort}
        editingId={editingId}
        editForm={editForm}
        setEditForm={setEditForm}
        onStartEdit={startEdit}
        onSaveEdit={saveEdit}
        onCancelEdit={() => setEditingId(null)}
        onToggleActive={handleToggleActive}
        onTestConnection={handleTestConnection}
        testingId={testingId}
        testStatuses={testStatuses}
        onOpenNote={(ep) => setNoteModal({ endpoint: ep, text: ep.notes || '' })}
        onOpenAccess={(ep) => setAccessModalEndpoint(ep)}
        onConfirmDelete={confirmDelete}
      />
    </div>
  );
}
