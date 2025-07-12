#!/bin/bash

# Messaging App Deployment Script
# This script builds and deploys the messaging app to AWS

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="messaging-app"
AWS_REGION=${AWS_REGION:-"us-east-1"}
DOCKER_IMAGE_TAG="latest"

echo -e "${GREEN}🚀 Starting deployment of $APP_NAME${NC}"

# Check if required tools are installed
check_requirements() {
    echo -e "${YELLOW}📋 Checking requirements...${NC}"
    
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker is not installed${NC}"
        exit 1
    fi
    
    if ! command -v aws &> /dev/null; then
        echo -e "${RED}❌ AWS CLI is not installed${NC}"
        exit 1
    fi
    
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js is not installed${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ All requirements met${NC}"
}

# Install dependencies
install_dependencies() {
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    
    # Install server dependencies
    npm install
    
    # Install client dependencies
    cd client && npm install && cd ..
    
    # Install infrastructure dependencies
    cd infrastructure && npm install && cd ..
    
    echo -e "${GREEN}✅ Dependencies installed${NC}"
}

# Build the application
build_app() {
    echo -e "${YELLOW}🔨 Building application...${NC}"
    
    # Build client
    cd client
    npm run build
    cd ..
    
    # Build Docker image
    docker build -t $APP_NAME:$DOCKER_IMAGE_TAG .
    
    echo -e "${GREEN}✅ Application built successfully${NC}"
}

# Run tests
run_tests() {
    echo -e "${YELLOW}🧪 Running tests...${NC}"
    
    # Run server tests
    npm test
    
    # Run client tests
    cd client && npm test && cd ..
    
    echo -e "${GREEN}✅ Tests passed${NC}"
}

# Deploy infrastructure
deploy_infrastructure() {
    echo -e "${YELLOW}🏗️  Deploying infrastructure...${NC}"
    
    cd infrastructure
    
    # Bootstrap CDK if needed
    if ! aws cloudformation describe-stacks --stack-name CDKToolkit --region $AWS_REGION &> /dev/null; then
        echo -e "${YELLOW}🔧 Bootstrapping CDK...${NC}"
        npx cdk bootstrap
    fi
    
    # Deploy the stack
    npx cdk deploy --require-approval never
    
    cd ..
    
    echo -e "${GREEN}✅ Infrastructure deployed${NC}"
}

# Push Docker image to ECR
push_to_ecr() {
    echo -e "${YELLOW}📤 Pushing Docker image to ECR...${NC}"
    
    # Get ECR repository URI from CDK outputs
    ECR_REPO_URI=$(aws cloudformation describe-stacks \
        --stack-name MessagingAppStack \
        --region $AWS_REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`ECRRepositoryURI`].OutputValue' \
        --output text)
    
    if [ -z "$ECR_REPO_URI" ]; then
        echo -e "${RED}❌ Could not get ECR repository URI${NC}"
        exit 1
    fi
    
    # Login to ECR
    aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REPO_URI
    
    # Tag and push image
    docker tag $APP_NAME:$DOCKER_IMAGE_TAG $ECR_REPO_URI:$DOCKER_IMAGE_TAG
    docker push $ECR_REPO_URI:$DOCKER_IMAGE_TAG
    
    echo -e "${GREEN}✅ Docker image pushed to ECR${NC}"
}

# Update ECS service
update_ecs_service() {
    echo -e "${YELLOW}🔄 Updating ECS service...${NC}"
    
    # Get cluster and service names from CDK outputs
    CLUSTER_NAME=$(aws cloudformation describe-stacks \
        --stack-name MessagingAppStack \
        --region $AWS_REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`ECSClusterName`].OutputValue' \
        --output text)
    
    SERVICE_NAME=$(aws cloudformation describe-stacks \
        --stack-name MessagingAppStack \
        --region $AWS_REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`ECSServiceName`].OutputValue' \
        --output text)
    
    if [ -z "$CLUSTER_NAME" ] || [ -z "$SERVICE_NAME" ]; then
        echo -e "${RED}❌ Could not get ECS cluster or service name${NC}"
        exit 1
    fi
    
    # Force new deployment
    aws ecs update-service \
        --cluster $CLUSTER_NAME \
        --service $SERVICE_NAME \
        --force-new-deployment \
        --region $AWS_REGION
    
    echo -e "${GREEN}✅ ECS service updated${NC}"
}

# Wait for deployment to complete
wait_for_deployment() {
    echo -e "${YELLOW}⏳ Waiting for deployment to complete...${NC}"
    
    CLUSTER_NAME=$(aws cloudformation describe-stacks \
        --stack-name MessagingAppStack \
        --region $AWS_REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`ECSClusterName`].OutputValue' \
        --output text)
    
    SERVICE_NAME=$(aws cloudformation describe-stacks \
        --stack-name MessagingAppStack \
        --region $AWS_REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`ECSServiceName`].OutputValue' \
        --output text)
    
    # Wait for service to be stable
    aws ecs wait services-stable \
        --cluster $CLUSTER_NAME \
        --services $SERVICE_NAME \
        --region $AWS_REGION
    
    echo -e "${GREEN}✅ Deployment completed successfully${NC}"
}

# Display deployment information
show_deployment_info() {
    echo -e "${GREEN}🎉 Deployment completed!${NC}"
    echo -e "${YELLOW}📊 Deployment Information:${NC}"
    
    # Get outputs from CloudFormation
    OUTPUTS=$(aws cloudformation describe-stacks \
        --stack-name MessagingAppStack \
        --region $AWS_REGION \
        --query 'Stacks[0].Outputs' \
        --output json)
    
    echo "$OUTPUTS" | jq -r '.[] | "\(.OutputKey): \(.OutputValue)"'
}

# Main deployment function
main() {
    check_requirements
    install_dependencies
    build_app
    run_tests
    deploy_infrastructure
    push_to_ecr
    update_ecs_service
    wait_for_deployment
    show_deployment_info
}

# Handle script arguments
case "${1:-}" in
    "infrastructure")
        deploy_infrastructure
        ;;
    "app")
        build_app
        push_to_ecr
        update_ecs_service
        wait_for_deployment
        ;;
    "test")
        run_tests
        ;;
    "build")
        build_app
        ;;
    *)
        main
        ;;
esac