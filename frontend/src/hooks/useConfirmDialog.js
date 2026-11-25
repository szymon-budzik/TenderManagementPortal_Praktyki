import { useState, useCallback } from 'react';

export function useConfirmDialog() {
  const [confirmDialog, setConfirmDialog] = useState(null);

  const openConfirm = useCallback(({ title, message, onConfirm }) => {
    setConfirmDialog({
      title,
      message,
      onConfirm: async () => {
        try {
          await onConfirm();
        } finally {
          setConfirmDialog(null);
        }
      },
    });
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmDialog(null);
  }, []);

  return { confirmDialog, openConfirm, closeConfirm };
}
