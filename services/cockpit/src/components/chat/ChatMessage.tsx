"use client";

import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { User, Bot, Cpu, Info } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { Message, MessageRole } from "@/lib/database.types";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  message: Message;
}

const roleConfig: Record<
  MessageRole,
  {
    icon: React.ElementType;
    label: string;
    bgClass: string;
    textClass: string;
    alignClass: string;
  }
> = {
  user: {
    icon: User,
    label: "You",
    bgClass: "bg-primary/10",
    textClass: "text-primary",
    alignClass: "ml-auto",
  },
  green: {
    icon: Cpu,
    label: "Project Manager",
    bgClass: "bg-green-500/10",
    textClass: "text-green-500",
    alignClass: "mr-auto",
  },
  blue: {
    icon: Bot,
    label: "Executive Assistant",
    bgClass: "bg-blue-500/10",
    textClass: "text-blue-500",
    alignClass: "mr-auto",
  },
  system: {
    icon: Info,
    label: "System",
    bgClass: "bg-muted",
    textClass: "text-muted-foreground",
    alignClass: "mx-auto",
  },
};

export function ChatMessage({ message }: ChatMessageProps) {
  const config = roleConfig[message.role] || roleConfig.system;
  const Icon = config.icon;
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  const timeAgo = formatDistanceToNow(new Date(message.created_at), {
    addSuffix: true,
    locale: de,
  });

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-xs">
          <Icon className="h-3 w-3" />
          <span>{message.content}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex gap-3 max-w-[85%] mb-4",
        config.alignClass
      )}
    >
      {!isUser && (
        <div
          className={cn(
            "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
            config.bgClass
          )}
        >
          <Icon className={cn("h-4 w-4", config.textClass)} />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          {!isUser && (
            <span className={cn("text-xs font-medium", config.textClass)}>
              {config.label}
            </span>
          )}
          <span className="text-xs text-muted-foreground">{timeAgo}</span>
        </div>
        <div
          className={cn(
            "rounded-lg px-4 py-3",
            isUser ? "bg-primary text-primary-foreground" : config.bgClass
          )}
        >
          <div
            className={cn(
              "prose prose-sm max-w-none",
              isUser ? "prose-invert" : "dark:prose-invert"
            )}
          >
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        </div>
      </div>
      {isUser && (
        <div
          className={cn(
            "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
            "bg-primary"
          )}
        >
          <Icon className="h-4 w-4 text-primary-foreground" />
        </div>
      )}
    </div>
  );
}
