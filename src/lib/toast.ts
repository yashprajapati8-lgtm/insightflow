"use client";

import { create } from "zustand";

interface ToastState {
  message: string | null;
  tone: "ok" | "error";
  show: (message: string, tone?: "ok" | "error") => void;
}

let timer: ReturnType<typeof setTimeout> | undefined;

export const useToast = create<ToastState>((set) => ({
  message: null,
  tone: "ok",
  show: (message, tone = "ok") => {
    clearTimeout(timer);
    set({ message, tone });
    timer = setTimeout(() => set({ message: null }), 3600);
  },
}));
