#!/bin/bash
set -e

# ===========================================
# Build and Push All Coding Swarm Images
# ===========================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$REPO_ROOT"

# Build metadata
BUILD_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# Add -dirty suffix if there are uncommitted changes
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
    GIT_COMMIT="${GIT_COMMIT}-dirty"
fi

echo "=========================================="
echo "  Coding Swarm - Build & Push"
echo "=========================================="
echo "  Timestamp: $BUILD_TIMESTAMP"
echo "  Commit: $GIT_COMMIT"
echo "=========================================="
echo ""

# Parse arguments
BUILD_BASE=false
PUSH=true

for arg in "$@"; do
    case $arg in
        --with-base)
            BUILD_BASE=true
            ;;
        --no-push)
            PUSH=false
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --with-base    Also rebuild the base image (rarely needed)"
            echo "  --no-push      Build only, don't push to registry"
            echo ""
            exit 0
            ;;
    esac
done

# Function to build and optionally push
build_image() {
    local name=$1
    local dockerfile=$2
    local context=$3
    local tag=$4

    echo ""
    echo ">>> Building $name..."
    echo "    Dockerfile: $dockerfile"
    echo "    Context: $context"
    echo "    Tag: $tag"
    echo ""

    docker build \
        --build-arg BUILD_TIMESTAMP="$BUILD_TIMESTAMP" \
        --build-arg GIT_COMMIT="$GIT_COMMIT" \
        -f "$dockerfile" \
        -t "$tag" \
        "$context"

    if [ "$PUSH" = true ]; then
        echo ""
        echo ">>> Pushing $tag..."
        docker push "$tag"
    fi
}

# ===========================================
# Build Images
# ===========================================

# Base Image (optional)
if [ "$BUILD_BASE" = true ]; then
    build_image "Base Image" \
        "base-image/Dockerfile" \
        "base-image/" \
        "tobiaswaggoner/coding-swarm-base:latest"
fi

# Red Agent
build_image "Red Agent" \
    "spike-01-container/Dockerfile" \
    "spike-01-container/" \
    "tobiaswaggoner/coding-swarm-agent:latest"

# Green Agent (needs repo root context for prompts/)
build_image "Green Agent" \
    "green-agent/Dockerfile" \
    "." \
    "tobiaswaggoner/green-agent:latest"

# Spawning Engine (multi-stage build, no external tsc needed)
build_image "Spawning Engine" \
    "spawning-engine/Dockerfile" \
    "spawning-engine/" \
    "tobiaswaggoner/spawning-engine:latest"

# ===========================================
# Summary
# ===========================================

echo ""
echo "=========================================="
echo "  Build Complete!"
echo "=========================================="
echo "  Timestamp: $BUILD_TIMESTAMP"
echo "  Commit: $GIT_COMMIT"
echo ""
echo "  Images:"
if [ "$BUILD_BASE" = true ]; then
    echo "    - tobiaswaggoner/coding-swarm-base:latest"
fi
echo "    - tobiaswaggoner/coding-swarm-agent:latest (Red)"
echo "    - tobiaswaggoner/green-agent:latest (Green)"
echo "    - tobiaswaggoner/spawning-engine:latest"
echo ""
if [ "$PUSH" = true ]; then
    echo "  All images pushed to registry."
else
    echo "  Images built locally (not pushed)."
fi
echo "=========================================="
