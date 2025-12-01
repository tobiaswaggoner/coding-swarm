#!/bin/bash
set -e

echo "=========================================="
echo "  Coding Swarm - Green Agent (Project Manager)"
echo "=========================================="
echo "  Build: ${BUILD_TIMESTAMP:-unknown}"
echo "  Commit: ${GIT_COMMIT:-unknown}"
echo "  Mode: Prompt-driven (Claude decides)"
echo "=========================================="

# ===========================================
# SECURITY CHECKS
# ===========================================

echo ""
echo "[1/7] Security validation..."

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
echo "[2/7] Validating required secrets..."

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

# Supabase (REQUIRED for Green Agent)
if [ -z "$SUPABASE_URL" ]; then
    echo "  [MISSING] SUPABASE_URL - Required for database access"
    MISSING_SECRETS=1
else
    echo "  [OK] SUPABASE_URL"
fi

if [ -z "$SUPABASE_KEY" ]; then
    echo "  [MISSING] SUPABASE_KEY - Required for database access"
    MISSING_SECRETS=1
else
    echo "  [OK] SUPABASE_KEY"
fi

# Project ID (REQUIRED for Green Agent)
if [ -z "$PROJECT_ID" ]; then
    echo "  [MISSING] PROJECT_ID - Required for project management"
    MISSING_SECRETS=1
else
    echo "  [OK] PROJECT_ID: $PROJECT_ID"
fi

# Abort if secrets are missing
if [ "$MISSING_SECRETS" -eq 1 ]; then
    echo ""
    echo "FATAL: Required secrets are missing. Aborting."
    echo ""
    echo "Required secrets:"
    echo "  - CLAUDE_CODE_OAUTH_TOKEN: Claude subscription OAuth token"
    echo "  - GITHUB_TOKEN: GitHub Personal Access Token with repo scope"
    echo "  - SUPABASE_URL: Supabase project URL"
    echo "  - SUPABASE_KEY: Supabase service key"
    echo "  - PROJECT_ID: Project identifier"
    exit 1
fi

# ===========================================
# SECURE CREDENTIAL CONFIGURATION
# ===========================================

echo ""
echo "[3/7] Configuring credentials..."

# Ensure home directory permissions
chmod 700 "$HOME"

# Git configuration
git config --global user.email "${GIT_USER_EMAIL:-ai-agent@coding-swarm.local}"
git config --global user.name "${GIT_USER_NAME:-Coding Swarm Agent}"

# ===========================================
# GIT_ASKPASS Authentication (SOTA for CI/CD)
# ===========================================
# This is how GitHub Actions, GitLab CI, etc. handle git auth:
# - Token NEVER appears in URLs or logs
# - Works for clone, fetch, push - everything
# - No TTY required (non-interactive)

GIT_ASKPASS_SCRIPT="$HOME/.git-askpass.sh"
cat > "$GIT_ASKPASS_SCRIPT" << 'ASKPASS_EOF'
#!/bin/bash
# GIT_ASKPASS helper - returns token for password prompts
echo "$GITHUB_TOKEN"
ASKPASS_EOF
chmod 700 "$GIT_ASKPASS_SCRIPT"

# Configure git to use askpass and never prompt interactively
export GIT_ASKPASS="$GIT_ASKPASS_SCRIPT"
export GIT_TERMINAL_PROMPT=0

# For HTTPS URLs, git needs a username - use 'x-access-token' (GitHub standard)
git config --global url."https://x-access-token@github.com/".insteadOf "https://github.com/"

# Export GH_TOKEN for GitHub CLI (gh)
export GH_TOKEN="$GITHUB_TOKEN"

echo "  [OK] Git credentials configured (GIT_ASKPASS)"

# ===========================================
# REPOSITORY SETUP
# ===========================================

echo ""
echo "[4/7] Repository setup..."

if [ -n "$REPO_URL" ]; then
    echo "  Cloning: $REPO_URL"

    # GIT_ASKPASS handles authentication - no token in URL needed
    git clone "$REPO_URL" /workspace
    cd /workspace

    # Checkout branch if specified
    if [ -n "$BRANCH" ]; then
        echo "  Checking out branch: $BRANCH"
        git fetch origin
        git checkout -b "$BRANCH" "origin/$BRANCH" 2>/dev/null || git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH"
    fi

    echo "  [OK] Repository ready in /workspace"
else
    echo "  [SKIP] No REPO_URL set"
    mkdir -p /workspace
    cd /workspace
fi

# ===========================================
# ENVIRONMENT INFO
# ===========================================

echo ""
echo "[5/7] Environment info..."
echo "  Project ID: $PROJECT_ID"
echo "  Branch: ${BRANCH:-main}"
echo "  Integration Branch: ${INTEGRATION_BRANCH:-not set}"
echo "  Triggered By Task: ${TRIGGERED_BY_TASK_ID:-initial}"
echo "  Conversation ID: ${CONVERSATION_ID:-none}"

# ===========================================
# GENERATE PROMPT
# ===========================================

echo ""
echo "[6/7] Generating prompt..."

# Generate the complete prompt for Claude Code
PROMPT=$(node /app/dist/cli/generate-prompt.js)

if [ -z "$PROMPT" ]; then
    echo "FATAL: Failed to generate prompt"
    exit 1
fi

echo "  [OK] Prompt generated ($(echo "$PROMPT" | wc -c) bytes)"

# ===========================================
# CLAUDE CODE EXECUTION
# ===========================================

echo ""
echo "[7/7] Starting Claude Code..."
echo "=========================================="

# Make scripts executable
chmod +x /app/scripts/*.sh 2>/dev/null || true

# Run Claude Code with the generated prompt
# --dangerously-skip-permissions: Required for autonomous execution
# --output-format stream-json: For real-time monitoring via JSONL logs
# --verbose: Required for stream-json output

claude -p "$PROMPT" \
    --dangerously-skip-permissions \
    --output-format stream-json \
    --verbose

echo ""
echo "=========================================="
echo "Green Agent completed!"
