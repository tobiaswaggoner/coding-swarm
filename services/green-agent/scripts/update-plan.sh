#!/bin/bash
# =============================================================================
# update-plan.sh - Commit and push changes to .ai/plan.md
# =============================================================================
#
# After Claude has edited .ai/plan.md directly, this script commits and pushes
# the changes to the repository.
#
# Usage:
#   ./scripts/update-plan.sh "<commit-message>"
#
# Arguments:
#   commit-message - Description of the plan changes (required)
#
# Environment:
#   (Uses git configuration from entrypoint.sh)
#
# Examples:
#   ./scripts/update-plan.sh "Marked step 2 as completed"
#   ./scripts/update-plan.sh "Added new step for error handling"
#   ./scripts/update-plan.sh "Updated epic description based on user feedback"
#
# =============================================================================

set -e

MESSAGE="$1"

if [ -z "$MESSAGE" ]; then
    echo "Error: commit message is required"
    echo "Usage: ./scripts/update-plan.sh \"<commit-message>\""
    exit 1
fi

# Ensure we're in the workspace
cd /workspace

# Check if plan exists
if [ ! -f ".ai/plan.md" ]; then
    echo "Error: .ai/plan.md does not exist"
    exit 1
fi

# Stage the plan file
git add .ai/plan.md

# Check if there are changes to commit
if git diff --cached --quiet; then
    echo "No changes to commit in .ai/plan.md"
    exit 0
fi

# Commit with the provided message
git commit -m "plan: $MESSAGE"

# Push to remote
git push

echo "Plan updated and pushed successfully"
