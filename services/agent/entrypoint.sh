#!/bin/bash
set -e

echo "=========================================="
echo "  Coding Swarm - Unified Agent"
echo "=========================================="
echo "  Role: ${AGENT_ROLE:-developer}"
echo "  Build: ${BUILD_TIMESTAMP:-unknown}"
echo "  Commit: ${GIT_COMMIT:-unknown}"
echo "=========================================="

# ===========================================
# [1/8] SECURITY CHECKS
# ===========================================

echo ""
echo "[1/8] Security validation..."

if [ -n "$ANTHROPIC_API_KEY" ]; then
    echo "FATAL: ANTHROPIC_API_KEY detected in environment!"
    echo "       This agent uses OAuth tokens only (subscription-based)."
    echo "       Remove ANTHROPIC_API_KEY and use CLAUDE_CODE_OAUTH_TOKEN instead."
    exit 1
fi

echo "  [OK] No forbidden API keys detected"

# ===========================================
# [2/8] VALIDATE REQUIRED SECRETS
# ===========================================

echo ""
echo "[2/8] Validating secrets..."

MISSING=0

# Required for all roles
if [ -z "$CLAUDE_CODE_OAUTH_TOKEN" ]; then
    echo "  [MISSING] CLAUDE_CODE_OAUTH_TOKEN"
    MISSING=1
fi

if [ -z "$GITHUB_TOKEN" ]; then
    echo "  [MISSING] GITHUB_TOKEN"
    MISSING=1
fi

# Project Manager needs additional secrets
if [ "$AGENT_ROLE" = "project-manager" ]; then
    if [ -z "$SUPABASE_URL" ]; then
        echo "  [MISSING] SUPABASE_URL (required for project-manager)"
        MISSING=1
    fi
    if [ -z "$SUPABASE_KEY" ]; then
        echo "  [MISSING] SUPABASE_KEY (required for project-manager)"
        MISSING=1
    fi
    if [ -z "$PROJECT_ID" ]; then
        echo "  [MISSING] PROJECT_ID (required for project-manager)"
        MISSING=1
    fi
fi

if [ "$MISSING" -eq 1 ]; then
    echo "FATAL: Missing required secrets for role: $AGENT_ROLE"
    exit 1
fi

echo "  [OK] All required secrets present for role: $AGENT_ROLE"

# ===========================================
# [3/8] CONFIGURE GIT CREDENTIALS
# ===========================================

echo ""
echo "[3/8] Configuring Git..."

# Ensure home directory has correct permissions
chmod 700 "$HOME"

# Configure git user
git config --global user.email "${GIT_USER_EMAIL:-ai-agent@coding-swarm.local}"
git config --global user.name "${GIT_USER_NAME:-Coding Swarm Agent}"

# Configure git to avoid prompts
git config --global init.defaultBranch main

# Setup GIT_ASKPASS for secure authentication (no tokens in URLs or logs)
GIT_ASKPASS_SCRIPT="$HOME/.git-askpass.sh"
cat > "$GIT_ASKPASS_SCRIPT" << 'ASKPASS_EOF'
#!/bin/bash
echo "$GITHUB_TOKEN"
ASKPASS_EOF
chmod 700 "$GIT_ASKPASS_SCRIPT"

export GIT_ASKPASS="$GIT_ASKPASS_SCRIPT"
export GIT_TERMINAL_PROMPT=0
export GH_TOKEN="$GITHUB_TOKEN"

# URL rewrite for GitHub (uses x-access-token which works with PATs)
git config --global url."https://x-access-token@github.com/".insteadOf "https://github.com/"

echo "  [OK] Git configured"
echo "       User: $(git config --global user.name) <$(git config --global user.email)>"

# ===========================================
# [4/8] CLONE RUNTIME REPO
# ===========================================

echo ""
echo "[4/8] Setting up runtime environment..."

RUNTIME_DIR="${RUNTIME_DIR:-/tmp/runtime}"

if [ -n "$RUNTIME_REPO" ]; then
    echo "  Cloning: $RUNTIME_REPO"
    echo "  Branch: ${RUNTIME_BRANCH:-main}"

    if git clone --depth 1 --branch "${RUNTIME_BRANCH:-main}" "$RUNTIME_REPO" "$RUNTIME_DIR" 2>/dev/null; then
        # Make scripts executable
        find "$RUNTIME_DIR/scripts" -name "*.sh" -exec chmod +x {} \; 2>/dev/null || true

        # Build tools if package.json exists
        if [ -f "$RUNTIME_DIR/tools/package.json" ]; then
            echo "  Building runtime tools..."
            cd "$RUNTIME_DIR/tools"
            npm ci --silent 2>/dev/null || npm install --silent
            npm run build --silent 2>/dev/null || true
            cd /workspace
        fi

        echo "  [OK] Runtime ready at $RUNTIME_DIR"
    else
        echo "  [WARN] Failed to clone runtime repo, using built-in defaults"
        RUNTIME_DIR=""
    fi
else
    echo "  [SKIP] No RUNTIME_REPO set, using built-in defaults"
    RUNTIME_DIR=""
fi

export RUNTIME_DIR

# ===========================================
# [5/8] CLONE TARGET REPO
# ===========================================

echo ""
echo "[5/8] Cloning target repository..."

if [ -n "$TARGET_REPO" ]; then
    echo "  Cloning: $TARGET_REPO"

    # Clone to workspace
    git clone "$TARGET_REPO" /workspace
    cd /workspace

    # Handle branch checkout/creation
    if [ -n "$TARGET_BRANCH" ]; then
        echo "  Target branch: $TARGET_BRANCH"

        # Fetch all remote branches
        git fetch origin

        # Check if branch exists on remote
        if git ls-remote --exit-code --heads origin "$TARGET_BRANCH" >/dev/null 2>&1; then
            echo "  Checking out existing branch..."
            git checkout -b "$TARGET_BRANCH" "origin/$TARGET_BRANCH" 2>/dev/null || git checkout "$TARGET_BRANCH"
        else
            echo "  Creating new branch..."
            # Determine base branch
            BASE_BRANCH="${BASE_BRANCH:-main}"
            if ! git rev-parse --verify "origin/$BASE_BRANCH" >/dev/null 2>&1; then
                BASE_BRANCH="master"
            fi

            git checkout -b "$TARGET_BRANCH" "origin/$BASE_BRANCH"
            git push -u origin "$TARGET_BRANCH"
            echo "  [OK] Branch created and pushed: $TARGET_BRANCH"
        fi
    fi

    echo "  [OK] Repository ready"
    echo "       Branch: $(git branch --show-current)"
    echo "       Last commit: $(git log -1 --format='%h %s' 2>/dev/null || echo 'none')"

elif [ -n "$REPO_URL" ]; then
    # Fallback to REPO_URL (for backwards compatibility with red-agent)
    echo "  Cloning: $REPO_URL (via REPO_URL)"

    git clone "$REPO_URL" /workspace
    cd /workspace

    if [ -n "$BRANCH" ]; then
        git fetch origin
        if git ls-remote --exit-code --heads origin "$BRANCH" >/dev/null 2>&1; then
            git checkout -b "$BRANCH" "origin/$BRANCH" 2>/dev/null || git checkout "$BRANCH"
        else
            git checkout -b "$BRANCH"
            git push -u origin "$BRANCH"
        fi
    fi

    echo "  [OK] Repository ready (legacy mode)"
else
    echo "  [SKIP] No TARGET_REPO or REPO_URL set"
    mkdir -p /workspace
    cd /workspace
fi

# ===========================================
# [6/8] COLLECT GITHUB CONTEXT
# ===========================================

echo ""
echo "[6/8] Collecting GitHub context..."

GITHUB_CONTEXT=""

# Try runtime script first
if [ -n "$RUNTIME_DIR" ] && [ -f "$RUNTIME_DIR/scripts/common/github-context.sh" ]; then
    GITHUB_CONTEXT=$("$RUNTIME_DIR/scripts/common/github-context.sh" 2>/dev/null || echo "")
    if [ -n "$GITHUB_CONTEXT" ]; then
        echo "  [OK] GitHub context collected via runtime script"
    fi
fi

# Fallback: collect basic context inline
if [ -z "$GITHUB_CONTEXT" ] && [ -d ".git" ]; then
    GITHUB_CONTEXT=$(cat << CONTEXT_EOF
## GitHub Status

### Repository
- **Branch**: $(git branch --show-current 2>/dev/null || echo "unknown")
- **Last Commit**: $(git log -1 --format='%h %s' 2>/dev/null || echo "none")

### Recent Commits
\`\`\`
$(git log --oneline -5 2>/dev/null || echo "No commits")
\`\`\`

### Open Feature Branches
\`\`\`
$(git branch -r 2>/dev/null | grep -E "(feature/|story/)" | head -10 || echo "None")
\`\`\`
CONTEXT_EOF
)
    echo "  [OK] GitHub context collected (built-in)"
fi

if [ -z "$GITHUB_CONTEXT" ]; then
    echo "  [SKIP] No Git repository available"
    GITHUB_CONTEXT="No GitHub context available (no repository)"
fi

export GITHUB_CONTEXT

# ===========================================
# [7/8] GENERATE PROMPT
# ===========================================

echo ""
echo "[7/8] Generating prompt..."

PROMPT=""

# Method 1: Runtime repo prompt generator
if [ -n "$RUNTIME_DIR" ] && [ -f "$RUNTIME_DIR/tools/dist/generate-prompt.js" ]; then
    echo "  Using runtime prompt generator..."
    PROMPT=$(node "$RUNTIME_DIR/tools/dist/generate-prompt.js" 2>/dev/null || echo "")
fi

# Method 2: Built-in prompt generator
if [ -z "$PROMPT" ] && [ -f "/app/tools/dist/generate-prompt.js" ]; then
    echo "  Using built-in prompt generator..."
    PROMPT=$(node "/app/tools/dist/generate-prompt.js" 2>/dev/null || echo "")
fi

# Method 3: Fallback - construct prompt from environment
if [ -z "$PROMPT" ]; then
    echo "  Using fallback prompt construction..."

    # Load system prompt based on role
    SYSTEM_PROMPT=""
    if [ -n "$RUNTIME_DIR" ] && [ -f "$RUNTIME_DIR/roles/$AGENT_ROLE/system.md" ]; then
        SYSTEM_PROMPT=$(cat "$RUNTIME_DIR/roles/$AGENT_ROLE/system.md")
    else
        # Default system prompts
        case "$AGENT_ROLE" in
            "project-manager")
                SYSTEM_PROMPT="Du bist der Project Manager im Coding Swarm System.
Du planst und koordinierst. Du implementierst NIEMALS selbst.
Delegiere alle Code-Arbeit an Developer."
                ;;
            "reviewer")
                SYSTEM_PROMPT="Du bist ein Code Reviewer im Coding Swarm System.
Pruefe den Code auf Qualitaet, Sicherheit und Konformitaet.
Dokumentiere deine Findings in der Review-Datei."
                ;;
            *)
                SYSTEM_PROMPT="Du bist ein Developer im Coding Swarm System.
Implementiere die Aufgabe gemaess den Anforderungen.
Committe und pushe deine Aenderungen am Ende."
                ;;
        esac
    fi

    PROMPT="$SYSTEM_PROMPT

---

## Deine Aufgabe

${TASK_PROMPT:-Keine spezifische Aufgabe angegeben.}

---

$GITHUB_CONTEXT"
fi

if [ -z "$PROMPT" ]; then
    echo "FATAL: Failed to generate prompt"
    exit 1
fi

PROMPT_SIZE=$(echo "$PROMPT" | wc -c)
echo "  [OK] Prompt generated ($PROMPT_SIZE bytes)"

# ===========================================
# [8/8] EXECUTE CLAUDE CODE
# ===========================================

echo ""
echo "[8/8] Starting Claude Code..."
echo "=========================================="
echo ""

OUTPUT_FORMAT="${OUTPUT_FORMAT:-stream-json}"

# Execute Claude Code CLI
if [ "$OUTPUT_FORMAT" = "stream-json" ]; then
    claude -p "$PROMPT" \
        --dangerously-skip-permissions \
        --output-format "$OUTPUT_FORMAT" \
        --verbose
else
    claude -p "$PROMPT" \
        --dangerously-skip-permissions \
        --output-format "$OUTPUT_FORMAT"
fi

EXIT_CODE=$?

echo ""
echo "=========================================="
echo "Agent completed with exit code: $EXIT_CODE"
echo "=========================================="

exit $EXIT_CODE
