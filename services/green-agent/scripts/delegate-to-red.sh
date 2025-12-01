#!/bin/bash
# =============================================================================
# delegate-to-red.sh - Create a task for a Red Agent
# =============================================================================
#
# Creates a WORK task in Supabase that will be picked up by the Spawning Engine
# and executed by a Red Agent (worker).
#
# Usage:
#   ./scripts/delegate-to-red.sh "<prompt>" [branch]
#
# Arguments:
#   prompt  - The task description for the Red Agent (required)
#   branch  - Target branch for the work (optional, defaults to INTEGRATION_BRANCH)
#
# Environment:
#   PROJECT_ID        - Project identifier (required)
#   REPO_URL          - Repository URL (required)
#   INTEGRATION_BRANCH - Default branch if not specified
#   CONVERSATION_ID   - Optional, links task to conversation
#
# Examples:
#   ./scripts/delegate-to-red.sh "Implement user login with JWT authentication"
#   ./scripts/delegate-to-red.sh "Fix the bug in checkout flow" "feature/fix-checkout"
#   ./scripts/delegate-to-red.sh "Merge feature/auth into integration/sprint-1"
#
# =============================================================================

set -e

PROMPT="$1"
BRANCH="${2:-$INTEGRATION_BRANCH}"

if [ -z "$PROMPT" ]; then
    echo "Error: prompt is required"
    echo "Usage: ./scripts/delegate-to-red.sh \"<prompt>\" [branch]"
    exit 1
fi

if [ -z "$PROJECT_ID" ]; then
    echo "Error: PROJECT_ID environment variable is required"
    exit 1
fi

if [ -z "$REPO_URL" ]; then
    echo "Error: REPO_URL environment variable is required"
    exit 1
fi

# Build arguments for CLI
ARGS="--project-id \"$PROJECT_ID\" --prompt \"$PROMPT\" --repo-url \"$REPO_URL\""

if [ -n "$BRANCH" ]; then
    ARGS="$ARGS --branch \"$BRANCH\""
fi

if [ -n "$CONVERSATION_ID" ]; then
    ARGS="$ARGS --conversation-id \"$CONVERSATION_ID\""
fi

# Execute CLI module
eval "node /app/dist/cli/create-task.js $ARGS"
