"use client";

import { useEffect } from "react";
import { api } from "@/lib/api";

const DEVICE_KEY = "jarvis.deviceId";

function detectPlatform(): { platform: string; name: string } {
  const ua = navigator.userAgent;
  const touchMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  if (/iPad/.test(ua) || touchMac) return { platform: "ipados", name: "iPad" };
  if (/iPhone/.test(ua)) return { platform: "ios", name: "iPhone" };
  if (/Android/.test(ua)) return { platform: "android", name: "Android device" };
  if (/Windows/.test(ua)) return { platform: "windows", name: "Windows PC" };
  if (/Mac/.test(ua)) return { platform: "macos", name: "Mac" };
  return { platform: "other", name: "Browser" };
}

/** Registers this browser as a device so JARVIS knows which devices are in use. */
export function useDeviceHeartbeat() {
  useEffect(() => {
    let id: string | null = null;
    try {
      id = localStorage.getItem(DEVICE_KEY);
      if (!id) {
        id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        localStorage.setItem(DEVICE_KEY, id);
      }
    } catch {
      return;
    }
    const { platform, name } = detectPlatform();
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    const beat = () =>
      api("/api/devices/heartbeat", {
        method: "POST",
        json: { id, name, platform, capabilities: ["dashboard", ...(standalone ? ["installed_pwa"] : [])] },
      }).catch(() => undefined);
    beat();
    const t = window.setInterval(beat, 5 * 60 * 1000);
    return () => window.clearInterval(t);
  }, []);
}
