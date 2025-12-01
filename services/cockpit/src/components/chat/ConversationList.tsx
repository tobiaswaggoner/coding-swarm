"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { Plus, MessageSquare, Archive, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/lib/database.types";

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string, title: string) => Promise<void>;
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  onCreate,
  onRename,
}: ConversationListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const startEdit = (conv: Conversation) => {
    setEditingId(conv.id);
    setEditTitle(conv.title || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
  };

  const saveEdit = async () => {
    if (editingId && editTitle.trim()) {
      await onRename(editingId, editTitle.trim());
    }
    cancelEdit();
  };

  const activeConversations = conversations.filter((c) => c.status === "active");
  const archivedConversations = conversations.filter((c) => c.status === "archived");

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b">
        <Button onClick={onCreate} className="w-full" variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          New Chat
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeConversations.length === 0 && archivedConversations.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            No conversations yet
          </div>
        ) : (
          <>
            {activeConversations.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isSelected={conv.id === selectedId}
                isEditing={conv.id === editingId}
                editTitle={editTitle}
                onSelect={() => onSelect(conv.id)}
                onStartEdit={() => startEdit(conv)}
                onEditChange={setEditTitle}
                onSaveEdit={saveEdit}
                onCancelEdit={cancelEdit}
              />
            ))}

            {archivedConversations.length > 0 && (
              <>
                <div className="px-3 py-2 text-xs font-medium text-muted-foreground flex items-center gap-2">
                  <Archive className="h-3 w-3" />
                  Archived
                </div>
                {archivedConversations.map((conv) => (
                  <ConversationItem
                    key={conv.id}
                    conversation={conv}
                    isSelected={conv.id === selectedId}
                    isEditing={false}
                    editTitle=""
                    onSelect={() => onSelect(conv.id)}
                    onStartEdit={() => {}}
                    onEditChange={() => {}}
                    onSaveEdit={() => {}}
                    onCancelEdit={() => {}}
                    isArchived
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  isEditing: boolean;
  editTitle: string;
  onSelect: () => void;
  onStartEdit: () => void;
  onEditChange: (title: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  isArchived?: boolean;
}

function ConversationItem({
  conversation,
  isSelected,
  isEditing,
  editTitle,
  onSelect,
  onStartEdit,
  onEditChange,
  onSaveEdit,
  onCancelEdit,
  isArchived = false,
}: ConversationItemProps) {
  const timeAgo = formatDistanceToNow(new Date(conversation.updated_at), {
    addSuffix: false,
    locale: de,
  });

  return (
    <div
      className={cn(
        "group px-3 py-2 cursor-pointer border-l-2 transition-colors",
        isSelected
          ? "bg-accent border-l-primary"
          : "border-l-transparent hover:bg-accent/50",
        isArchived && "opacity-60"
      )}
      onClick={!isEditing ? onSelect : undefined}
    >
      <div className="flex items-start gap-2">
        <MessageSquare
          className={cn(
            "h-4 w-4 mt-0.5 flex-shrink-0",
            isSelected ? "text-primary" : "text-muted-foreground"
          )}
        />
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex items-center gap-1">
              <Input
                value={editTitle}
                onChange={(e) => onEditChange(e.target.value)}
                className="h-6 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSaveEdit();
                  if (e.key === "Escape") onCancelEdit();
                }}
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  onSaveEdit();
                }}
              >
                <Check className="h-3 w-3" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  onCancelEdit();
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">
                  {conversation.title || "Untitled"}
                </span>
                {!isArchived && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartEdit();
                    }}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <span className="text-xs text-muted-foreground">{timeAgo}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
