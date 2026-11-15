import { useCallback, useEffect, useState } from 'react';

export type ToastMessage = { text: string; tone?: 'info' | 'warn' | 'good' };

export function useToast(ms = 3200) {
  const [toast, setToast] = useState<(ToastMessage & { id: number }) | null>(null);
  const show = useCallback((t: ToastMessage) => setToast({ ...t, id: Date.now() }), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), ms);
    return () => clearTimeout(t);
  }, [toast, ms]);
  return { toast, show };
}
