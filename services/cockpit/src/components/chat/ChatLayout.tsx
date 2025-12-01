"use client";

import { useState, useCallback, useEffect } from "react";
import { ArrowLeft, MessageSquarePlus, Menu } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
        setMobileMenuOpen(false);
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

  const handleSelectConversation = useCallback((id: string | null) => {
    setSelectedConversationId(id);
    setMobileMenuOpen(false);
  }, []);

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
    <div className="flex flex-col flex-1 overflow-hidden px-4 py-4">
      {/* Chat container with border */}
      <div className="flex flex-col flex-1 overflow-hidden border rounded-lg bg-card">
      {/* Sub-header with navigation and context */}
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        {/* Mobile menu button */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open conversations</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="px-4 py-3 border-b">
              <SheetTitle>Conversations</SheetTitle>
            </SheetHeader>
            <ConversationList
              conversations={conversations}
              selectedId={selectedConversationId}
              onSelect={handleSelectConversation}
              onCreate={handleCreateConversation}
              onRename={handleRenameConversation}
            />
          </SheetContent>
        </Sheet>

        {/* Back button */}
        <Link href={`/projects/${project.id}`}>
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Project</span>
          </Button>
        </Link>

        {/* Project and conversation info */}
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-medium truncate">{project.name}</h1>
          {selectedConversation && (
            <p className="text-xs text-muted-foreground truncate">
              {selectedConversation.title || "New conversation"}
            </p>
          )}
        </div>

        {/* Status badge */}
        <Badge variant="outline" className="hidden sm:flex">
          {project.status}
        </Badge>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Conversation sidebar - desktop only */}
        <div className="w-64 border-r flex-shrink-0 hidden md:flex md:flex-col">
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
    </div>
  );
}
