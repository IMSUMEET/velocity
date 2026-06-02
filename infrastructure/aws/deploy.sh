#!/bin/bash
set -euo pipefail

REGION="${AWS_REGION:-us-west-2}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPO="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/velocity-backend"
CLUSTER_NAME="velocity-cluster"
SERVICE_NAME="velocity-backend-service"

echo "=== VeloCity Backend Deployment ==="
echo "Region: ${REGION}"
echo "Account: ${ACCOUNT_ID}"
echo ""

echo "[1/4] Authenticating with ECR..."
aws ecr get-login-password --region "${REGION}" | \
  docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

echo "[2/4] Building Docker image..."
cd ../../backend
docker build -t velocity-backend .
docker tag velocity-backend:latest "${ECR_REPO}:latest"
docker tag velocity-backend:latest "${ECR_REPO}:$(git rev-parse --short HEAD)"

echo "[3/4] Pushing to ECR..."
docker push "${ECR_REPO}:latest"
docker push "${ECR_REPO}:$(git rev-parse --short HEAD)"

echo "[4/4] Updating ECS service..."
aws ecs update-service \
  --cluster "${CLUSTER_NAME}" \
  --service "${SERVICE_NAME}" \
  --force-new-deployment \
  --region "${REGION}"

echo ""
echo "Deployment triggered. Monitor at:"
echo "https://${REGION}.console.aws.amazon.com/ecs/v2/clusters/${CLUSTER_NAME}/services/${SERVICE_NAME}"
