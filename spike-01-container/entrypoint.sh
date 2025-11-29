#!/bin/bash
set -e

echo "=========================================="
echo "  Coding Swarm - Red Agent"
echo "=========================================="

# ===========================================
# SECURITY CHECKS
# ===========================================

echo ""
echo "[1/5] Security validation..."

# CRITICAL: API-Key darf NICHT gesetzt sein (Kostenschutz)
if [ -n "$ANTHROPIC_API_KEY" ]; then
    echo "FATAL: ANTHROPIC_API_KEY detected!"
    echo "This would trigger pay-per-token billing."
    echo "Remove this environment variable and use CLAUDE_CODE_OAUTH_TOKEN instead."
    exit 1
fi

# ===========================================
# REQUIRED SECRETS VALIDATION
# ===========================================

echo ""
echo "[2/5] Validating required secrets..."

MISSING_SECRETS=0

# Claude OAuth Token (REQUIRED)
if [ -z "$CLAUDE_CODE_OAUTH_TOKEN" ]; then
    echo "  [MISSING] CLAUDE_CODE_OAUTH_TOKEN - Required for Claude Code CLI"
    MISSING_SECRETS=1
else
    echo "  [OK] CLAUDE_CODE_OAUTH_TOKEN"
fi

# GitHub Token (REQUIRED for git operations)
if [ -z "$GITHUB_TOKEN" ]; then
    echo "  [MISSING] GITHUB_TOKEN - Required for git/gh operations"
    MISSING_SECRETS=1
else
    echo "  [OK] GITHUB_TOKEN"
fi

# Abort if secrets are missing
if [ "$MISSING_SECRETS" -eq 1 ]; then
    echo ""
    echo "FATAL: Required secrets are missing. Aborting."
    echo ""
    echo "Required secrets (deploy via kubectl create secret):"
    echo "  - CLAUDE_CODE_OAUTH_TOKEN: Claude subscription OAuth token"
    echo "  - GITHUB_TOKEN: GitHub Personal Access Token with repo scope"
    exit 1
fi

# ===========================================
# SECURE CREDENTIAL CONFIGURATION
# ===========================================

echo ""
echo "[3/5] Configuring credentials..."

# Ensure home directory permissions
chmod 700 "$HOME"

# Git configuration
git config --global credential.helper store
git config --global user.email "${GIT_USER_EMAIL:-ai-agent@coding-swarm.local}"
git config --global user.name "${GIT_USER_NAME:-Coding Swarm Agent}"

# Store git credentials securely (file permissions)
CREDENTIALS_FILE="$HOME/.git-credentials"
echo "https://${GITHUB_TOKEN}@github.com" > "$CREDENTIALS_FILE"
chmod 600 "$CREDENTIALS_FILE"

# Export GH_TOKEN for GitHub CLI (gh)
export GH_TOKEN="$GITHUB_TOKEN"

# Verify gh authentication
if gh auth status &>/dev/null; then
    echo "  [OK] GitHub CLI authenticated"
else
    echo "  [OK] GitHub CLI configured (token-based)"
fi

echo "  [OK] Git credentials configured"

# ===========================================
# REPOSITORY SETUP (OPTIONAL)
# ===========================================

echo ""
echo "[4/5] Repository setup..."

if [ -n "$REPO_URL" ]; then
    echo "  Cloning: $REPO_URL"

    # Insert token into URL for authentication (credential helper doesn't work in non-TTY)
    if [[ "$REPO_URL" == *"github.com"* ]] && [ -n "$GITHUB_TOKEN" ]; then
        CLONE_URL=$(echo "$REPO_URL" | sed "s|https://github.com|https://${GITHUB_TOKEN}@github.com|")
    else
        CLONE_URL="$REPO_URL"
    fi

    git clone "$CLONE_URL" /workspace
    cd /workspace

    # Checkout branch if specified
    if [ -n "$BRANCH" ]; then
        echo "  Checking out branch: $BRANCH"
        git checkout -b "$BRANCH" 2>/dev/null || git checkout "$BRANCH"
    fi

    echo "  [OK] Repository ready in /workspace"
else
    echo "  [SKIP] No REPO_URL set"
    mkdir -p /workspace
    cd /workspace
fi

# ===========================================
# CLAUDE CODE EXECUTION
# ===========================================

echo ""
echo "[5/5] Executing Claude Code..."
echo "=========================================="

TASK_PROMPT="${TASK_PROMPT:-Antworte nur mit einem kurzen Satz: Wer bist du und welches Modell verwendest du?}"

echo "Prompt: $TASK_PROMPT"
echo ""

claude -p "$TASK_PROMPT" --dangerously-skip-permissions

echo ""
echo "=========================================="
echo "Red Agent completed successfully!"
