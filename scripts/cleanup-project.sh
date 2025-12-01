#!/bin/bash
# =============================================================================
# cleanup-project.sh - Delete all data for a specific project
# =============================================================================
#
# Usage: ./scripts/cleanup-project.sh <project-id>
#
# Environment:
#   SUPABASE_URL - Supabase project URL
#   SUPABASE_KEY - Supabase service key
#
# =============================================================================

set -e

PROJECT_ID="$1"

if [ -z "$PROJECT_ID" ]; then
    echo "Usage: ./scripts/cleanup-project.sh <project-id>"
    exit 1
fi

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
    echo "Error: SUPABASE_URL and SUPABASE_KEY are required"
    exit 1
fi

API_URL="${SUPABASE_URL}/rest/v1"
AUTH_HEADER="Authorization: Bearer ${SUPABASE_KEY}"
API_KEY_HEADER="apikey: ${SUPABASE_KEY}"

echo "Cleaning up project: $PROJECT_ID"
echo ""

# Order: task_logs -> tasks -> messages -> conversations

# 1. Get task IDs
echo "Fetching tasks..."
TASK_IDS=$(curl -s -X GET \
    "${API_URL}/tasks?project_id=eq.${PROJECT_ID}&select=id" \
    -H "$AUTH_HEADER" \
    -H "$API_KEY_HEADER" \
    | grep -o '"id":"[^"]*"' | cut -d'"' -f4 | tr '\n' ',' | sed 's/,$//')

if [ -n "$TASK_IDS" ]; then
    echo "Found tasks: $TASK_IDS"

    # 2. Delete task_logs
    echo "Deleting task_logs..."
    curl -s -X DELETE \
        "${API_URL}/task_logs?task_id=in.(${TASK_IDS})" \
        -H "$AUTH_HEADER" \
        -H "$API_KEY_HEADER" > /dev/null
    echo "Done"
fi

# 3. Delete tasks
echo "Deleting tasks..."
curl -s -X DELETE \
    "${API_URL}/tasks?project_id=eq.${PROJECT_ID}" \
    -H "$AUTH_HEADER" \
    -H "$API_KEY_HEADER" > /dev/null
echo "Done"

# 4. Get conversation IDs
echo "Fetching conversations..."
CONV_IDS=$(curl -s -X GET \
    "${API_URL}/conversations?project_id=eq.${PROJECT_ID}&select=id" \
    -H "$AUTH_HEADER" \
    -H "$API_KEY_HEADER" \
    | grep -o '"id":"[^"]*"' | cut -d'"' -f4 | tr '\n' ',' | sed 's/,$//')

if [ -n "$CONV_IDS" ]; then
    echo "Found conversations: $CONV_IDS"

    # 5. Delete messages
    echo "Deleting messages..."
    curl -s -X DELETE \
        "${API_URL}/messages?conversation_id=in.(${CONV_IDS})" \
        -H "$AUTH_HEADER" \
        -H "$API_KEY_HEADER" > /dev/null
    echo "Done"
fi

# 6. Delete conversations
echo "Deleting conversations..."
curl -s -X DELETE \
    "${API_URL}/conversations?project_id=eq.${PROJECT_ID}" \
    -H "$AUTH_HEADER" \
    -H "$API_KEY_HEADER" > /dev/null
echo "Done"

# 7. Reset project counters
echo "Resetting project counters..."
curl -s -X PATCH \
    "${API_URL}/projects?id=eq.${PROJECT_ID}" \
    -H "$AUTH_HEADER" \
    -H "$API_KEY_HEADER" \
    -H "Content-Type: application/json" \
    -d '{"total_tasks": 0, "completed_tasks": 0, "failed_tasks": 0}' > /dev/null
echo "Done"

echo ""
echo "Cleanup complete!"
