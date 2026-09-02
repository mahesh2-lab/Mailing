"use client";
import { useEffect } from "react";

export function PwaRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js").catch((err) => {
          console.error("Service worker registration failed:", err);
        });
      });
    }
  }, []);
  return null;
}
