"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useToast } from "@/hooks/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

/**
 * Renders the toast stack in a portal to document.body so it is not a descendant
 * of the element that gets aria-hidden when a Dialog opens. This avoids the
 * "Blocked aria-hidden on an element because its descendant retained focus" error
 * when a toast is visible and a dialog is open/closed.
 */
export function Toaster() {
  const { toasts } = useToast();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const content = (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );

  if (!mounted || typeof document === "undefined") {
    return null;
  }

  return createPortal(content, document.body);
}
