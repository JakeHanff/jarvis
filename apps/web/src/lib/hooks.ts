"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, onInvalidate } from "./api";

/**
 * Fetch a resource, refetch on invalidation, window focus and a polling interval.
 * Polling is how changes made on another device (phone/iPad) show up here.
 */
export function useApi<T>(path: string | null, opts: { interval?: number } = {}) {
  const { interval = 20000 } = opts;
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const pathRef = useRef(path);
  pathRef.current = path;

  const reload = useCallback(async () => {
    const p = pathRef.current;
    if (!p) return;
    try {
      const d = await api<T>(p);
      if (pathRef.current === p) {
        setData(d);
        setError(null);
      }
    } catch (e) {
      if (pathRef.current === p) setError(e as ApiError);
    } finally {
      if (pathRef.current === p) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    reload();
  }, [path, reload]);

  useEffect(() => {
    if (!path) return;
    const unsub = onInvalidate((prefix) => {
      if (path.startsWith(prefix)) reload();
    });
    const onFocus = () => document.visibilityState === "visible" && reload();
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    const t = interval > 0 ? window.setInterval(() => document.visibilityState === "visible" && reload(), interval) : undefined;
    return () => {
      unsub();
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
      if (t) window.clearInterval(t);
    };
  }, [path, interval, reload]);

  return { data, error, loading, reload, setData };
}

export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function useMediaQuery(query: string) {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    setMatch(mq.matches);
    const fn = () => setMatch(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, [query]);
  return match;
}
