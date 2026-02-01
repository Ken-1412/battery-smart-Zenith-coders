#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

STAGE=${1:-dev}
REGION=${2:-us-east-1}
BUCKET_NAME="ai-ops-frontend-${STAGE}"

echo -e "${GREEN}🚀 Deploying Frontend to AWS S3${NC}"
echo -e "Stage: ${YELLOW}${STAGE}${NC}"
echo -e "Region: ${YELLOW}${REGION}${NC}"
echo ""

# Step 1: Get API Gateway URL
echo -e "${GREEN}📡 Getting API Gateway URL...${NC}"
API_URL=$(aws cloudformation describe-stacks \
  --stack-name "ai-ops-mvp-${STAGE}" \
  --query "Stacks[0].Outputs[?OutputKey=='ServiceEndpoint'].OutputValue" \
  --output text \
  --region ${REGION} 2>/dev/null || echo "")

if [ -z "$API_URL" ] || [[ "$API_URL" == *"/${STAGE}/${STAGE}" ]]; then
  # Fallback: use known API Gateway URL
  echo -e "${YELLOW}⚠️  Using known API Gateway URL...${NC}"
  API_URL="https://6ag0l59zmc.execute-api.${REGION}.amazonaws.com/${STAGE}"
fi

# Remove duplicate /dev/dev if present
API_URL=$(echo "$API_URL" | sed "s|/${STAGE}/${STAGE}|/${STAGE}|g")

echo -e "${GREEN}✅ API URL: ${API_URL}${NC}"
echo ""

# Step 2: Build frontend
echo -e "${GREEN}🔨 Building frontend...${NC}"
cd frontend

# Create .env.production file with API URL
echo "VITE_API_URL=${API_URL}" > .env.production
echo -e "${GREEN}✅ Created .env.production with API URL${NC}"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}📦 Installing dependencies...${NC}"
  npm install
fi

# Build
echo -e "${GREEN}🔨 Building React app...${NC}"
npm run build

if [ ! -d "dist" ]; then
  echo -e "${RED}❌ Build failed! dist folder not found.${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Build successful!${NC}"
echo ""

# Step 3: Create S3 bucket if it doesn't exist
echo -e "${GREEN}🪣 Checking S3 bucket...${NC}"
if ! aws s3 ls "s3://${BUCKET_NAME}" 2>&1 | grep -q 'NoSuchBucket'; then
  echo -e "${GREEN}✅ Bucket ${BUCKET_NAME} already exists${NC}"
else
  echo -e "${YELLOW}📦 Creating S3 bucket ${BUCKET_NAME}...${NC}"
  
  if [ "${REGION}" == "us-east-1" ]; then
    aws s3 mb "s3://${BUCKET_NAME}" --region ${REGION}
  else
    aws s3 mb "s3://${BUCKET_NAME}" --region ${REGION}
  fi
  
  # Disable block public access first (required before setting public policy)
  echo -e "${YELLOW}🔓 Disabling S3 Block Public Access...${NC}"
  aws s3api put-public-access-block \
    --bucket "${BUCKET_NAME}" \
    --public-access-block-configuration \
    "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false" \
    --region ${REGION} || echo -e "${YELLOW}⚠️  Could not disable block public access (may need manual configuration)${NC}"
  
  # Enable static website hosting
  echo -e "${YELLOW}🌐 Enabling static website hosting...${NC}"
  aws s3 website "s3://${BUCKET_NAME}" \
    --index-document index.html \
    --error-document index.html \
    --region ${REGION}
  
  # Set bucket policy for public read access
  echo -e "${YELLOW}📝 Setting bucket policy...${NC}"
  cat > /tmp/bucket-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::${BUCKET_NAME}/*"
    }
  ]
}
EOF
  
  aws s3api put-bucket-policy \
    --bucket "${BUCKET_NAME}" \
    --policy file:///tmp/bucket-policy.json \
    --region ${REGION} || echo -e "${YELLOW}⚠️  Could not set bucket policy (may need manual configuration in AWS Console)${NC}"
  
  echo -e "${GREEN}✅ Bucket created and configured${NC}"
fi
echo ""

# Step 4: Upload files to S3
echo -e "${GREEN}📤 Uploading files to S3...${NC}"
aws s3 sync dist/ "s3://${BUCKET_NAME}" \
  --delete \
  --region ${REGION} \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "*.html" \
  --exclude "*.json"

# Upload HTML files with no cache
aws s3 sync dist/ "s3://${BUCKET_NAME}" \
  --delete \
  --region ${REGION} \
  --cache-control "public, max-age=0, must-revalidate" \
  --include "*.html" \
  --include "*.json"

echo -e "${GREEN}✅ Files uploaded!${NC}"
echo ""

# Step 5: Get website URL
WEBSITE_URL="http://${BUCKET_NAME}.s3-website-${REGION}.amazonaws.com"
WEBSITE_ENDPOINT=$(aws s3api get-bucket-website \
  --bucket "${BUCKET_NAME}" \
  --region ${REGION} \
  --query 'WebsiteConfiguration.IndexDocument.Suffix' \
  --output text 2>/dev/null || echo "index.html")

echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo ""
echo -e "${GREEN}🌐 Frontend URL:${NC}"
echo -e "   ${YELLOW}${WEBSITE_URL}${NC}"
echo ""
echo -e "${GREEN}📝 API Endpoint:${NC}"
echo -e "   ${YELLOW}${API_URL}${NC}"
echo ""
echo -e "${YELLOW}💡 Note: For production, consider setting up CloudFront for HTTPS and CDN.${NC}"

cd ..
