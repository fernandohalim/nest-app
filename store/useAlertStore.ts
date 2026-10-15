import { create } from "zustand";

type AlertType = "alert" | "confirm";
export type AlertSeverity = "default" | "destructive";
// drives the alert's badge emoji. "warn" is the default — validation nudges
// like "missing payer" — so only success / info / error calls pass one.
export type AlertTone = "warn" | "error" | "success" | "info";

interface AlertState {
  isOpen: boolean;
  type: AlertType;
  tone: AlertTone;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  severity: AlertSeverity;
  onConfirmAction?: () => void;
}

interface ShowConfirmOptions {
  title?: string;
  confirmText?: string;
  severity?: AlertSeverity;
}

interface AlertActions {
  showAlert: (message: string, title?: string, tone?: AlertTone) => void;
  showConfirm: (
    message: string,
    onConfirm: () => void,
    options?: ShowConfirmOptions,
  ) => void;
  close: () => void;
  confirm: () => void;
}

export const useAlertStore = create<AlertState & AlertActions>((set, get) => ({
  isOpen: false,
  type: "alert",
  tone: "warn",
  title: "",
  message: "",
  confirmText: "got it",
  cancelText: "cancel",
  severity: "default",
  onConfirmAction: undefined,

  showAlert: (message, title = "hold up! 🛑", tone = "warn") =>
    set({
      isOpen: true,
      type: "alert",
      tone,
      message,
      title,
      confirmText: "got it!",
      severity: "default",
      onConfirmAction: undefined,
    }),

  showConfirm: (message, onConfirm, options = {}) =>
    set({
      isOpen: true,
      type: "confirm",
      message,
      title: options.title ?? "are you sure? 🤔",
      confirmText: options.confirmText ?? "yes, do it!",
      cancelText: "nevermind",
      severity: options.severity ?? "default",
      onConfirmAction: onConfirm,
    }),

  close: () => set({ isOpen: false }),

  confirm: () => {
    const { onConfirmAction, close } = get();
    if (onConfirmAction) onConfirmAction();
    close();
  },
}));