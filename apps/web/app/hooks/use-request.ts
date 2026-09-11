"use client";
import { useCallback, useEffect, useState } from "react";
export function useRequest<T>(
  request: () => Promise<T>,
  dependencies: readonly unknown[] = [],
) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await request());
    } catch (value) {
      setError(value instanceof Error ? value.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, dependencies); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    void load();
  }, [load]);
  return { data, setData, error, loading, reload: load };
}
