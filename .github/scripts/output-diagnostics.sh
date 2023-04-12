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

kn quickstart help

print_header "Images"
docker images

print_header "Kubernetes resources"
kubectl get all --all-namespaces

PODS="$(
  kubectl get pod \
    -l app.kubernetes.io/name=veraid-authority \
    "-o=jsonpath={.items[*]['metadata.name']}"
)"
for pod in ${PODS}; do
  print_header "Logs for ${pod}"

  kubectl logs "${pod}" --all-containers=true
done
