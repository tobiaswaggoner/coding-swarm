"use client";

import { useEffect, useRef } from "react";
import { MessageSquare } from "lucide-react";
import { ChatMessage } from "./ChatMessage";
import type { Message } from "@/lib/database.types";

interface ChatMessagesProps {
  messages: Message[];
  isLoading?: boolean;
}

export function ChatMessages({ messages, isLoading = false }: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-muted-foreground">
        <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-lg font-medium">No messages yet</p>
        <p className="text-sm">Start a conversation with the Project Manager</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto p-4"
    >
      {messages.map((message) => (
        <ChatMessage key={message.id} message={message} />
      ))}
      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm animate-pulse">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-bounce" />
          <div className="w-2 h-2 rounded-full bg-green-500 animate-bounce delay-100" />
          <div className="w-2 h-2 rounded-full bg-green-500 animate-bounce delay-200" />
          <span className="ml-2">Green is thinking...</span>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
