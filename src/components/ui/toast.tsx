"use client";
import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Tone = "success" | "error" | "info";
interface ToastItem { id: number; message: string; tone: Tone }

const ToastContext = React.createContext<{ toast: (message: string, tone?: Tone) => void }>({ toast: () => {} });

export function useToast() {
  return React.useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const toast = React.useCallback((message: string, tone: Tone = "success") => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s.slice(-2), { id, message, tone }]);
    setTimeout(() => setItems((s) => s.filter((i) => i.id !== id)), tone === "error" ? 6000 : 3500);
  }, []);
  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(80px+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:pr-6">
        <AnimatePresence initial={false}>
          {items.map((i) => (
            <motion.div
              key={i.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }}
              role={i.tone === "error" ? "alert" : "status"}
              className={cn(
                "pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-full px-4 py-3 text-sm font-semibold shadow-[var(--shadow-pop)]",
                i.tone === "error" ? "bg-danger text-white" : "bg-ink text-white",
              )}
            >
              {i.tone === "success" && <CheckCircle2 className="size-4 text-[#8ed6b8]" />}
              {i.tone === "error" && <AlertCircle className="size-4" />}
              {i.tone === "info" && <Info className="size-4" />}
              {i.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
