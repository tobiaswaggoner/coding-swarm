"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Task } from "@/lib/database.types";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

interface UseRealtimeTasksOptions {
  projectId: string;
  initialTasks: Task[];
}

/**
 * Hook for real-time task updates via Supabase Realtime
 */
export function useRealtimeTasks({ projectId, initialTasks }: UseRealtimeTasksOptions) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [isConnected, setIsConnected] = useState(false);

  const handleChange = useCallback(
    (payload: RealtimePostgresChangesPayload<Task>) => {
      const { eventType, new: newRecord, old: oldRecord } = payload;

      // Only handle tasks for this project
      if (newRecord && "project_id" in newRecord && newRecord.project_id !== projectId) {
        return;
      }
      if (oldRecord && "project_id" in oldRecord && oldRecord.project_id !== projectId) {
        return;
      }

      setTasks((currentTasks) => {
        switch (eventType) {
          case "INSERT": {
            const newTask = newRecord as Task;
            // Check if task already exists (avoid duplicates)
            if (currentTasks.some((t) => t.id === newTask.id)) {
              return currentTasks;
            }
            // Add at the beginning (newest first)
            return [newTask, ...currentTasks];
          }

          case "UPDATE": {
            const updatedTask = newRecord as Task;
            return currentTasks.map((task) =>
              task.id === updatedTask.id ? updatedTask : task
            );
          }

          case "DELETE": {
            const deletedId = (oldRecord as Task)?.id;
            if (!deletedId) return currentTasks;
            return currentTasks.filter((task) => task.id !== deletedId);
          }

          default:
            return currentTasks;
        }
      });
    },
    [projectId]
  );

  useEffect(() => {
    // Subscribe to changes on the tasks table
    const channel = supabase
      .channel(`tasks-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `project_id=eq.${projectId}`,
        },
        handleChange
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, handleChange]);

  return { tasks, isConnected };
}

/**
 * Hook for real-time task log updates
 */
export function useRealtimeTaskLog(taskId: string, initialLog: string | null) {
  const [log, setLog] = useState<string | null>(initialLog);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const channel = supabase
      .channel(`task-log-${taskId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "task_logs",
          filter: `task_id=eq.${taskId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const newLog = payload.new as { jsonl_content?: string };
            if (newLog.jsonl_content) {
              setLog(newLog.jsonl_content);
            }
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId]);

  return { log, isConnected };
}

/**
 * Hook for real-time single task updates
 */
export function useRealtimeTask(initialTask: Task) {
  const [task, setTask] = useState<Task>(initialTask);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const channel = supabase
      .channel(`task-${initialTask.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tasks",
          filter: `id=eq.${initialTask.id}`,
        },
        (payload) => {
          if (payload.new) {
            setTask(payload.new as Task);
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [initialTask.id]);

  return { task, isConnected };
}
