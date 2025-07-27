#!/bin/bash

# FitCheck Notification System Deployment Script
# This script deploys the complete notification system to Firebase

set -e  # Exit on any error

echo "🚀 Deploying FitCheck Notification System v1.0"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    print_error "Firebase CLI is not installed. Please install it first:"
    echo "npm install -g firebase-tools"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "firebase.json" ]; then
    print_error "firebase.json not found. Please run this script from the FitCheck root directory."
    exit 1
fi

print_status "Starting deployment process..."

# Step 1: Install dependencies
print_status "Installing dependencies..."
cd functions
npm install
cd ..

# Step 2: Deploy Firestore Rules
print_status "Deploying Firestore Rules..."
firebase deploy --only firestore:rules

# Step 3: Deploy Firestore Indexes
print_status "Deploying Firestore Indexes..."
firebase deploy --only firestore:indexes

# Step 4: Deploy Cloud Functions
print_status "Deploying Cloud Functions..."
firebase deploy --only functions

# Step 5: Check deployment status
print_status "Checking deployment status..."
firebase functions:list

print_status "✅ Deployment completed successfully!"

# Step 6: Migration reminder
print_warning "Don't forget to run the migration script for existing users:"
echo "node scripts/migrate-notification-schema.js"

# Step 7: Testing instructions
print_status "To test the notification system:"
echo "1. Start Firebase emulators: firebase emulators:start"
echo "2. Test functions locally: cd functions && npm run serve"
echo "3. Check function logs: firebase functions:log"

print_status "🎉 FitCheck Notification System v1.0 is now deployed!" 