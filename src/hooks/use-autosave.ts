import { useCallback, useEffect, useRef, useState } from 'react';

interface UseAutosaveOptions {
  delay?: number; // ms entre mudanças e salvamento (default: 1000ms)
  onSave: (data: any) => Promise<void>;
  onError?: (error: Error) => void;
}

export function useAutosave<T>(
  data: T,
  options: UseAutosaveOptions
) {
  const { delay = 1000, onSave, onError } = options;
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastDataRef = useRef<T>(data);
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
    save(data);
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