"use client";

import {
  CheckCircle2,
  Info,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ToastVariant = "default" | "destructive" | "success";

type ToastInput = {
  title: string;
  description?: string;
  variant?: ToastVariant;
};

type Toast = ToastInput & {
  id: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  toast: (input: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const variantStyles: Record<
  ToastVariant,
  { className: string; icon: LucideIcon; iconClassName: string }
> = {
  default: {
    className: "border-white/10 bg-[#111315] text-zinc-100",
    icon: Info,
    iconClassName: "text-zinc-300",
  },
  destructive: {
    className: "border-red-300/25 bg-red-950 text-red-50",
    icon: TriangleAlert,
    iconClassName: "text-red-200",
  },
  success: {
    className: "border-emerald-300/25 bg-emerald-950 text-emerald-50",
    icon: CheckCircle2,
    iconClassName: "text-emerald-200",
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = crypto.randomUUID();
      const nextToast: Toast = {
        id,
        variant: input.variant ?? "default",
        title: input.title,
        description: input.description,
      };

      setToasts((current) => [nextToast, ...current].slice(0, 4));
      window.setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3">
        {toasts.map((item) => {
          const styles = variantStyles[item.variant];
          const Icon = styles.icon;

          return (
            <div
              className={cn(
                "pointer-events-auto flex gap-3 rounded-md border p-4 shadow-2xl shadow-black/30 animate-soft-in",
                styles.className,
              )}
              key={item.id}
              role="status"
            >
              <Icon
                aria-hidden="true"
                className={cn("mt-0.5 h-4 w-4 shrink-0", styles.iconClassName)}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{item.title}</p>
                {item.description ? (
                  <p className="mt-1 text-sm leading-5 opacity-80">
                    {item.description}
                  </p>
                ) : null}
              </div>
              <Button
                aria-label="Dismiss notification"
                className="h-7 w-7 shrink-0 border-white/10 bg-transparent p-0 text-current hover:bg-white/10"
                onClick={() => dismiss(item.id)}
                type="button"
                variant="outline"
              >
                <X aria-hidden="true" className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within ToastProvider.");
  }

  return context.toast;
}
