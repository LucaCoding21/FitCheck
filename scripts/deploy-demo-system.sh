#!/bin/bash

# FitCheck Demo Account System Deployment Script
# This script deploys the demo account functions and sets up demo data

echo "🚀 Deploying FitCheck Demo Account System..."

# Navigate to functions directory
cd functions

# Deploy Firebase Functions
echo "📦 Deploying Firebase Functions..."
firebase deploy --only functions

# Wait for deployment to complete
echo "⏳ Waiting for deployment to complete..."
sleep 10

# Get the deployed function URLs
echo "🔗 Getting function URLs..."

# Extract project ID from firebase.json or use default
PROJECT_ID=$(grep -o '"projectId": "[^"]*"' ../firebase.json | cut -d'"' -f4)
if [ -z "$PROJECT_ID" ]; then
    echo "⚠️  Could not find project ID in firebase.json, using default"
    PROJECT_ID="fitcheck-app"
fi

echo "📋 Project ID: $PROJECT_ID"

# Function URLs
CREATE_DEMO_URL="https://us-central1-$PROJECT_ID.cloudfunctions.net/createDemoAccount"
RESET_DEMO_URL="https://us-central1-$PROJECT_ID.cloudfunctions.net/resetDemoData"
CHECK_DEMO_URL="https://us-central1-$PROJECT_ID.cloudfunctions.net/checkDemoAccount"

echo "✅ Demo Functions Deployed Successfully!"
echo ""
echo "📋 Demo Account Information:"
echo "   Email: reviewer@fitcheck.app"
echo "   Password: ReviewTest123!"
echo "   Group: Demo Fashion Crew"
echo ""
echo "🔗 Function URLs:"
echo "   Create Demo: $CREATE_DEMO_URL"
echo "   Reset Demo: $RESET_DEMO_URL"
echo "   Check Demo: $CHECK_DEMO_URL"
echo ""
echo "🧪 Testing Functions..."

# Test check demo account
echo "🔍 Checking if demo account exists..."
curl -X GET "$CHECK_DEMO_URL" | jq '.'

echo ""
echo "📝 To create demo account, run:"
echo "curl -X POST $CREATE_DEMO_URL"
echo ""
echo "📝 To reset demo data, run:"
echo "curl -X POST $RESET_DEMO_URL"
echo ""
echo "✅ Demo system ready for App Store review!" 