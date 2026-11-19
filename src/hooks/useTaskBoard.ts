"use client";

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/mui/ToastProvider";

export interface TaskRecord {
  id: string; title: string; description: string | null;
  assigned_to: string | null; assigned_by: string | null;
  priority: string; status: string; due_date: string | null;
  related_entity_type: string | null; related_entity_id: string | null; created_at: string;
}

/** A shared canonical cache with immediate local feedback and failure rollback. */
export function useTaskBoard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const inFlight = useRef(new Set<string>());
  const [optimistic, setOptimistic] = useState<Record<string, string>>({});
  const queryKey = ["tasks", user?.id];
  const query = useQuery<TaskRecord[]>({
    queryKey, enabled: !!user, staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
  const updateStatus = async (id: string, status: string) => {
    if (inFlight.current.has(id)) return;
    inFlight.current.add(id);
    setOptimistic(current => ({ ...current, [id]: status }));
    try {
      await queryClient.cancelQueries({ queryKey });
      const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
      if (error) throw new Error(error.message);
      queryClient.setQueryData<TaskRecord[]>(queryKey, current => current?.map(task => task.id === id ? { ...task, status } : task));
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(status === "completed" ? "Task completed" : "Task updated");
    } catch (error) {
      // Canonical data was not changed on failure. Removing the local override
      // restores exactly the previous value, including concurrent task edits.
      toast.error(error instanceof Error ? error.message : "Could not update the task. Please try again.");
    } finally {
      inFlight.current.delete(id);
      setOptimistic(current => { const next = { ...current }; delete next[id]; return next; });
    }
  };
  const tasks = (query.data ?? []).map(task => optimistic[task.id] ? { ...task, status: optimistic[task.id] } : task);
  return { ...query, tasks, pendingIds: Object.keys(optimistic), updateStatus, refresh: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }) };
}
