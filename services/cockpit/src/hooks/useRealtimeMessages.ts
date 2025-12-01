"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Message, Conversation } from "@/lib/database.types";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

interface UseRealtimeMessagesOptions {
  conversationId: string;
  initialMessages: Message[];
}

/**
 * Hook for real-time message updates via Supabase Realtime
 */
export function useRealtimeMessages({
  conversationId,
  initialMessages,
}: UseRealtimeMessagesOptions) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isConnected, setIsConnected] = useState(false);

  const handleChange = useCallback(
    (payload: RealtimePostgresChangesPayload<Message>) => {
      const { eventType, new: newRecord, old: oldRecord } = payload;

      // Only handle messages for this conversation
      if (
        newRecord &&
        "conversation_id" in newRecord &&
        newRecord.conversation_id !== conversationId
      ) {
        return;
      }
      if (
        oldRecord &&
        "conversation_id" in oldRecord &&
        oldRecord.conversation_id !== conversationId
      ) {
        return;
      }

      setMessages((currentMessages) => {
        switch (eventType) {
          case "INSERT": {
            const newMessage = newRecord as Message;
            // Check if message already exists (avoid duplicates)
            if (currentMessages.some((m) => m.id === newMessage.id)) {
              return currentMessages;
            }
            // Add at the end (oldest first)
            return [...currentMessages, newMessage];
          }

          case "UPDATE": {
            const updatedMessage = newRecord as Message;
            return currentMessages.map((msg) =>
              msg.id === updatedMessage.id ? updatedMessage : msg
            );
          }

          case "DELETE": {
            const deletedId = (oldRecord as Message)?.id;
            if (!deletedId) return currentMessages;
            return currentMessages.filter((msg) => msg.id !== deletedId);
          }

          default:
            return currentMessages;
        }
      });
    },
    [conversationId]
  );

  useEffect(() => {
    // Subscribe to changes on the messages table
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        handleChange
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, handleChange]);

  // Update messages when initialMessages changes (e.g., switching conversations)
  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  return { messages, isConnected };
}

interface UseRealtimeConversationsOptions {
  projectId: string;
  initialConversations: Conversation[];
}

/**
 * Hook for real-time conversation updates via Supabase Realtime
 */
export function useRealtimeConversations({
  projectId,
  initialConversations,
}: UseRealtimeConversationsOptions) {
  const [conversations, setConversations] =
    useState<Conversation[]>(initialConversations);
  const [isConnected, setIsConnected] = useState(false);

  const handleChange = useCallback(
    (payload: RealtimePostgresChangesPayload<Conversation>) => {
      const { eventType, new: newRecord, old: oldRecord } = payload;

      // Only handle conversations for this project
      if (
        newRecord &&
        "project_id" in newRecord &&
        newRecord.project_id !== projectId
      ) {
        return;
      }
      if (
        oldRecord &&
        "project_id" in oldRecord &&
        oldRecord.project_id !== projectId
      ) {
        return;
      }

      setConversations((currentConversations) => {
        switch (eventType) {
          case "INSERT": {
            const newConv = newRecord as Conversation;
            // Check if conversation already exists
            if (currentConversations.some((c) => c.id === newConv.id)) {
              return currentConversations;
            }
            // Add at the beginning (newest first by updated_at)
            return [newConv, ...currentConversations];
          }

          case "UPDATE": {
            const updatedConv = newRecord as Conversation;
            // Update and re-sort by updated_at
            const updated = currentConversations.map((conv) =>
              conv.id === updatedConv.id ? updatedConv : conv
            );
            return updated.sort(
              (a, b) =>
                new Date(b.updated_at).getTime() -
                new Date(a.updated_at).getTime()
            );
          }

          case "DELETE": {
            const deletedId = (oldRecord as Conversation)?.id;
            if (!deletedId) return currentConversations;
            return currentConversations.filter((conv) => conv.id !== deletedId);
          }

          default:
            return currentConversations;
        }
      });
    },
    [projectId]
  );

  useEffect(() => {
    const channel = supabase
      .channel(`conversations-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
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

  // Update conversations when initialConversations changes
  useEffect(() => {
    setConversations(initialConversations);
  }, [initialConversations]);

  return { conversations, isConnected };
}
