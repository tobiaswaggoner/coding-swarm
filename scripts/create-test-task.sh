#!/bin/bash
# Create a simple test task for the spawning engine


PROMPT="${1:-Say hello and tell me what 2+2 equals. Keep your response brief.}"
ADDRESSEE="${2:-red-agent-test}"

echo "Creating test task..."
echo "  Prompt: $PROMPT"
echo "  Addressee: $ADDRESSEE"
echo ""

curl -s -X POST "${SUPABASE_URL}/rest/v1/tasks" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{
    \"addressee\": \"${ADDRESSEE}\",
    \"prompt\": \"${PROMPT}\",
    \"repo_url\": null,
    \"branch\": null,
    \"status\": \"pending\",
    \"created_by\": \"test\"
  }" | jq .

echo ""
echo "Task created. Watch logs with:"
echo "  kubectl logs -f -n coding-swarm -l app=spawning-engine"
