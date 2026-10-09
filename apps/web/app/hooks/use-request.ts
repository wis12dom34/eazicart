"use client";
import { useCallback, useEffect, useState } from "react";
export function useRequest<T>(
  request: () => Promise<T>,
  dependencies: readonly unknown[] = [],
  initialData?: T,
  initialError = "",
) {
  const [data, setData] = useState<T | undefined>(initialData);
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(
    initialData === undefined && !initialError,
  );
  const load = useCallback(async () => {
    setLoading(initialData === undefined);
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
