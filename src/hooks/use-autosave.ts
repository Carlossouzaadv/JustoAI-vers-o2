import { useCallback, useEffect, useRef, useState } from 'react';

interface UseAutosaveOptions<T> {
  delay?: number; // ms entre mudanças e salvamento (default: 1000ms)
  onSave: (_data: T) => Promise<void>;
  onError?: (_error: Error) => void;
}

export function useAutosave<T>(
  data: T | null,
  options: UseAutosaveOptions<T>
) {
  const { delay = 1000, onSave, onError } = options;
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastDataRef = useRef<T | null>(data);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const save = useCallback(async (dataToSave: T) => {
    if (!isMountedRef.current) return;

    try {
      setIsSaving(true);
      await onSave(dataToSave);

      if (isMountedRef.current) {
        setLastSaved(new Date());
        setHasUnsavedChanges(false);
        lastDataRef.current = dataToSave;
      }
    } catch (error) {
      if (isMountedRef.current && onError) {
        onError(error instanceof Error ? error : new Error('Save failed'));
      }
    } finally {
      if (isMountedRef.current) {
        setIsSaving(false);
      }
    }
  }, [onSave, onError]);

  useEffect(() => {
    // Skip autosave if data is null (narrowing seguro)
    if (data === null) {
      return;
    }

    // Comparar dados atuais com último salvamento
    if (JSON.stringify(data) !== JSON.stringify(lastDataRef.current)) {
      setHasUnsavedChanges(true);

      // Limpar timeout anterior
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Agendar salvamento
      timeoutRef.current = setTimeout(() => {
        save(data);
      }, delay);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, delay, save]);

  const forceSave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    // Type narrowing: only save if data is not null
    if (data !== null) {
      save(data);
    }
  }, [data, save]);

  const resetSaveState = useCallback(() => {
    setHasUnsavedChanges(false);
    setLastSaved(null);
    lastDataRef.current = data;
  }, [data]);

  return {
    isSaving,
    lastSaved,
    hasUnsavedChanges,
    forceSave,
    resetSaveState,
  };
}