"use client";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, Info, XCircle } from "lucide-react";

export type ToastTone = "success" | "error" | "info";
type Toast = { id: number; message: string; tone: ToastTone };
const ToastContext = createContext<(message: string, tone?: ToastTone) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, tone: ToastTone = "success") => {
    const id = Date.now() + Math.random();
    setToasts((items) => [...items, { id, message, tone }]);
    window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 4800);
  }, []);
  const value = useMemo(() => push, [push]);
  return <ToastContext.Provider value={value}>{children}<div className="toast-region" aria-live="polite">{toasts.map((toast) => (
    <div className={`toast toast-${toast.tone}`} key={toast.id}>
      {toast.tone === "success" ? <CheckCircle2 aria-hidden="true"/> : toast.tone === "error" ? <XCircle aria-hidden="true"/> : <Info aria-hidden="true"/>}
      <span>{toast.message}</span>
    </div>
  ))}</div></ToastContext.Provider>;
}

export const useToast = () => useContext(ToastContext);
