import * as k8s from "@kubernetes/client-node";
import * as fs from "fs";
import * as path from "path";
import { log } from "../logger.js";

const IN_CLUSTER_TOKEN_PATH = "/var/run/secrets/kubernetes.io/serviceaccount/token";

/**
 * K8s client configured for in-cluster or local kubeconfig
 */
export function createK8sClients() {
  const kc = new k8s.KubeConfig();

  // Check if we're running in a K8s cluster
  if (fs.existsSync(IN_CLUSTER_TOKEN_PATH)) {
    log.info("Loading K8s config from cluster");
    kc.loadFromCluster();
  } else {
    log.info("Loading K8s config from kubeconfig");
    const kubeconfigPath = process.env.KUBECONFIG ||
      path.join(process.env.HOME || process.env.USERPROFILE || "", ".kube", "config");
    kc.loadFromFile(kubeconfigPath);
  }

  return {
    batchApi: kc.makeApiClient(k8s.BatchV1Api),
    coreApi: kc.makeApiClient(k8s.CoreV1Api),
  };
}

export type K8sClients = ReturnType<typeof createK8sClients>;
