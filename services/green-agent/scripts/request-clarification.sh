#!/bin/bash
# =============================================================================
# request-clarification.sh - Ask the user a question and pause the project
# =============================================================================
#
# Sends a clarification question to the user and pauses the project until
# they respond. Use this when you need additional information to proceed.
#
# Usage:
#   ./scripts/request-clarification.sh "<question>"
#
# Arguments:
#   question - The question to ask the user (required, Markdown supported)
#
# Environment:
#   CONVERSATION_ID - Conversation to send to (required)
#   PROJECT_ID      - Project to pause (required)
#
# Examples:
#   ./scripts/request-clarification.sh "Which database should I use: PostgreSQL or MySQL?"
#   ./scripts/request-clarification.sh "I found multiple implementations. Which one should I modify?"
#   ./scripts/request-clarification.sh "The tests are failing. Should I fix them or skip for now?"
#
# Note: The project will be paused until the user responds to your question.
#
# =============================================================================

set -e

QUESTION="$1"

if [ -z "$QUESTION" ]; then
    echo "Error: question is required"
    echo "Usage: ./scripts/request-clarification.sh \"<question>\""
    exit 1
fi

if [ -z "$CONVERSATION_ID" ]; then
    echo "Error: CONVERSATION_ID environment variable is required"
    exit 1
fi

if [ -z "$PROJECT_ID" ]; then
    echo "Error: PROJECT_ID environment variable is required"
    exit 1
fi

# Send the question as a message
node /app/dist/cli/send-message.js \
    --conversation-id "$CONVERSATION_ID" \
    --role "green" \
    --content "$QUESTION"

# Pause the project (user response will resume it)
node /app/dist/cli/pause-project.js --project-id "$PROJECT_ID"

echo "Clarification requested and project paused"
