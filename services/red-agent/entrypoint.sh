#!/bin/bash
set -e

echo "=========================================="
echo "  Coding Swarm - Red Agent (Worker)"
echo "=========================================="
echo "  Build: ${BUILD_TIMESTAMP:-unknown}"
echo "  Commit: ${GIT_COMMIT:-unknown}"
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

# Verify gh authentication
if gh auth status &>/dev/null; then
    echo "  [OK] GitHub CLI authenticated"
else
    echo "  [OK] GitHub CLI configured (token-based)"
fi

echo "  [OK] Git credentials configured (GIT_ASKPASS)"

# ===========================================
# REPOSITORY SETUP (OPTIONAL)
# ===========================================

echo ""
echo "[4/5] Repository setup..."

if [ -n "$REPO_URL" ]; then
    echo "  Cloning: $REPO_URL"

    # GIT_ASKPASS handles authentication - no token in URL needed
    git clone "$REPO_URL" /workspace
    cd /workspace

    # Checkout branch if specified
    if [ -n "$BRANCH" ]; then
        echo "  Checking out branch: $BRANCH"
        # Fetch to ensure we have remote branch info
        git fetch origin

        # Check if remote branch exists
        if git ls-remote --exit-code --heads origin "$BRANCH" >/dev/null 2>&1; then
            # Remote branch exists - checkout tracking it
            echo "  [INFO] Remote branch origin/$BRANCH exists"
            git checkout -b "$BRANCH" "origin/$BRANCH" 2>/dev/null || git checkout "$BRANCH"
        else
            # Remote branch does NOT exist - create from current HEAD and push
            echo "  [WARN] Remote branch origin/$BRANCH does not exist!"
            echo "  [INFO] Creating branch $BRANCH from current HEAD and pushing..."
            git checkout -b "$BRANCH"
            git push -u origin "$BRANCH"
            echo "  [OK] Created and pushed new branch: $BRANCH"
        fi
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

# Output Format: text (default), json, oder stream-json (für Echtzeit-Monitoring)
OUTPUT_FORMAT="${OUTPUT_FORMAT:-stream-json}"

echo "Prompt: $TASK_PROMPT"
echo "Output Format: $OUTPUT_FORMAT"
echo ""

# stream-json benötigt --verbose Flag
if [ "$OUTPUT_FORMAT" = "stream-json" ]; then
    claude -p "$TASK_PROMPT" \
        --dangerously-skip-permissions \
        --output-format "$OUTPUT_FORMAT" \
        --verbose
else
    claude -p "$TASK_PROMPT" \
        --dangerously-skip-permissions \
        --output-format "$OUTPUT_FORMAT"
fi

echo ""
echo "=========================================="
echo "Red Agent completed successfully!"
