import { useEffect, useState } from "react";
import axios from "axios";
export interface LabelData {
  id: string;
  name: string;
  color?: string | null;
  count: number;
}

export const DEFAULT_LABEL_NAMES = ["Important", "Work", "Personal"];

export function useMailSummary(refreshTick: number) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [labels, setLabels] = useState<LabelData[]>([]);

  useEffect(() => {
    let mounted = true;
    Promise.all([axios.get("/api/v1/messages?summary=1"), axios.get("/api/v1/labels")])
      .then(([summary, labelResponse]) => {
        if (!mounted) return;
        setCounts(summary.data || {});
        setLabels(labelResponse.data || []);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [refreshTick]);

  return { counts, labels };
}

