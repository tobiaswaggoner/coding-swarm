"use client";

import { useState, useCallback, useEffect } from "react";
import { ArrowLeft, MessageSquarePlus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConversationList } from "./ConversationList";
import { ChatMessages } from "./ChatMessages";
import { ChatInput } from "./ChatInput";
import {
  useRealtimeMessages,
  useRealtimeConversations,
} from "@/hooks/useRealtimeMessages";
import type { Conversation, Message, Project } from "@/lib/database.types";

interface ChatLayoutProps {
  project: Project;
  initialConversations: Conversation[];
  initialConversationId?: string;
}

export function ChatLayout({
  project,
  initialConversations,
  initialConversationId,
}: ChatLayoutProps) {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    initialConversationId || (initialConversations[0]?.id ?? null)
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // Real-time conversations
  const { conversations } = useRealtimeConversations({
    projectId: project.id,
    initialConversations,
  });

  // Real-time messages for selected conversation
  const { messages: realtimeMessages } = useRealtimeMessages({
    conversationId: selectedConversationId || "",
    initialMessages: messages,
  });

  // Update messages when realtime messages change
  useEffect(() => {
    if (selectedConversationId) {
      setMessages(realtimeMessages);
    }
  }, [realtimeMessages, selectedConversationId]);

  // Fetch messages when conversation changes
  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      setIsLoadingMessages(true);
      try {
        const res = await fetch(
          `/api/conversations/${selectedConversationId}/messages`
        );
        if (res.ok) {
          const data = await res.json();
          setMessages(data);
        }
      } catch (error) {
        console.error("Failed to fetch messages:", error);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    fetchMessages();
  }, [selectedConversationId]);

  const handleCreateConversation = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: project.id }),
      });

      if (res.ok) {
        const newConversation = await res.json();
        setSelectedConversationId(newConversation.id);
      }
    } catch (error) {
      console.error("Failed to create conversation:", error);
    }
  }, [project.id]);

  const handleRenameConversation = useCallback(
    async (id: string, title: string) => {
      try {
        await fetch(`/api/conversations/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        });
      } catch (error) {
        console.error("Failed to rename conversation:", error);
      }
    },
    []
  );

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!selectedConversationId) {
        // Create a new conversation first
        const res = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project_id: project.id }),
        });

        if (!res.ok) {
          throw new Error("Failed to create conversation");
        }

        const newConversation = await res.json();
        setSelectedConversationId(newConversation.id);

        // Send message to new conversation
        await fetch(`/api/conversations/${newConversation.id}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
      } else {
        await fetch(`/api/conversations/${selectedConversationId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
      }
    },
    [selectedConversationId, project.id]
  );

  const selectedConversation = conversations.find(
    (c) => c.id === selectedConversationId
  );

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b">
        <Link href={`/projects/${project.id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Project
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">{project.name}</h1>
          {selectedConversation && (
            <p className="text-sm text-muted-foreground">
              {selectedConversation.title || "New conversation"}
            </p>
          )}
        </div>
        <Badge variant="outline">{project.status}</Badge>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Conversation sidebar */}
        <div className="w-64 border-r flex-shrink-0 hidden md:block">
          <ConversationList
            conversations={conversations}
            selectedId={selectedConversationId}
            onSelect={setSelectedConversationId}
            onCreate={handleCreateConversation}
            onRename={handleRenameConversation}
          />
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedConversationId || conversations.length === 0 ? (
            <>
              <ChatMessages
                messages={messages}
                isLoading={isLoadingMessages}
              />
              <ChatInput
                onSend={handleSendMessage}
                placeholder="Send a message to the Project Manager..."
              />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-muted-foreground">
              <MessageSquarePlus className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">Select a conversation</p>
              <p className="text-sm mb-4">Or start a new one</p>
              <Button onClick={handleCreateConversation}>
                <MessageSquarePlus className="h-4 w-4 mr-2" />
                New Chat
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
