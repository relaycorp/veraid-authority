#!/bin/bash
set -o nounset
set -o errexit
set -o pipefail

# Functions

print_header() {
  local title="$1"

  printf '#%.0s' {1..50}
  echo " ${title}"
}

# Main

print_header "Images"
docker images

print_header "Kubernetes resources"
kubectl get all --all-namespaces

print_header "App pods"
kubectl describe pod -l app.kubernetes.io/name=veraid-authority

print_header "App logs"
kubectl logs --prefix --all-containers=true -l app.kubernetes.io/name=veraid-authority
