#!/bin/bash
# =============================================================================
# send-message.sh - Send a message to the user in the current conversation
# =============================================================================
#
# Writes a message to the conversation in Supabase. The message will appear
# in the Cockpit chat interface for the user.
#
# Usage:
#   ./scripts/send-message.sh "<content>"
#
# Arguments:
#   content - The message to send (required, Markdown supported)
#
# Environment:
#   CONVERSATION_ID - Conversation to send to (required)
#
# Examples:
#   ./scripts/send-message.sh "I've started working on your request."
#   ./scripts/send-message.sh "Here's what I found:\n\n- Issue 1\n- Issue 2"
#   ./scripts/send-message.sh "I need more information. What framework are you using?"
#
# =============================================================================

set -e

CONTENT="$1"

if [ -z "$CONTENT" ]; then
    echo "Error: content is required"
    echo "Usage: ./scripts/send-message.sh \"<content>\""
    exit 1
fi

if [ -z "$CONVERSATION_ID" ]; then
    echo "Error: CONVERSATION_ID environment variable is required"
    exit 1
fi

# Execute CLI module
node /app/dist/cli/send-message.js --conversation-id "$CONVERSATION_ID" --role "green" --content "$CONTENT"
