#!/bin/bash
set -e

# Use the deployment domain if available, otherwise fall back to dev domain
DOMAIN="${REPLIT_INTERNAL_APP_DOMAIN:-${REPLIT_DEV_DOMAIN:-canteen-intelligence-pro.replit.app}}"

export EXPO_PUBLIC_DOMAIN="$DOMAIN"
export EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY="${CLERK_PUBLISHABLE_KEY_PROD:-${CLERK_PUBLISHABLE_KEY}}"
export EXPO_PUBLIC_REPL_ID="${REPL_ID}"

echo "Building Expo web app for domain: $DOMAIN"

cd "$(dirname "$0")/.."
pnpm exec expo export --platform web

echo "Web build complete → dist/"
