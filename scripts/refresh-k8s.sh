#!/bin/bash
set -e

# ===========================================
# Refresh Kubernetes Deployments
# ===========================================
# Forces K8s to pull latest images and restart pods

NAMESPACE="${NAMESPACE:-coding-swarm}"

echo "=========================================="
echo "  Coding Swarm - K8s Refresh"
echo "=========================================="
echo "  Namespace: $NAMESPACE"
echo "=========================================="
echo ""

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "ERROR: kubectl not found"
    exit 1
fi

# Check if namespace exists
if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
    echo "ERROR: Namespace '$NAMESPACE' does not exist"
    echo ""
    echo "Create it with:"
    echo "  kubectl create namespace $NAMESPACE"
    exit 1
fi

# ===========================================
# Restart Spawning Engine Deployment
# ===========================================

echo ">>> Restarting Spawning Engine deployment..."

if kubectl get deployment spawning-engine -n "$NAMESPACE" &> /dev/null; then
    # Force rollout restart to pull new image
    kubectl rollout restart deployment/spawning-engine -n "$NAMESPACE"

    echo "    Waiting for rollout to complete..."
    kubectl rollout status deployment/spawning-engine -n "$NAMESPACE" --timeout=120s

    echo "    Done!"
else
    echo "    WARNING: Spawning Engine deployment not found"
    echo "    Deploy with: kubectl apply -f spawning-engine/k8s/deployment.yaml"
fi

# ===========================================
# Show Current Status
# ===========================================

echo ""
echo "=========================================="
echo "  Current Status"
echo "=========================================="
echo ""

echo ">>> Pods:"
kubectl get pods -n "$NAMESPACE" -o wide

echo ""
echo ">>> Deployments:"
kubectl get deployments -n "$NAMESPACE"

echo ""
echo ">>> Recent Jobs (last 5):"
kubectl get jobs -n "$NAMESPACE" --sort-by=.metadata.creationTimestamp | tail -6

# ===========================================
# Show Spawning Engine Logs (last few lines)
# ===========================================

echo ""
echo "=========================================="
echo "  Spawning Engine Logs (recent)"
echo "=========================================="
echo ""

POD=$(kubectl get pods -n "$NAMESPACE" -l app=spawning-engine -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")

if [ -n "$POD" ]; then
    kubectl logs "$POD" -n "$NAMESPACE" --tail=20 2>/dev/null || echo "    (waiting for pod to start...)"
else
    echo "    No spawning-engine pod found"
fi

echo ""
echo "=========================================="
echo "  Refresh Complete!"
echo "=========================================="
echo ""
echo "  To follow logs:"
echo "    kubectl logs -f -n $NAMESPACE deployment/spawning-engine"
echo ""
echo "  To check a specific Red/Green agent job:"
echo "    kubectl logs -n $NAMESPACE job/<job-name>"
echo ""
