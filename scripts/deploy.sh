#!/usr/bin/env bash
# deploy.sh — Push GFFL code to Apps Script
#
# Usage:
#   bash scripts/deploy.sh
#
# What it does:
#   1. Runs clasp push --force to sync all .gs and .html files to Apps Script
#   2. Reminds you to create a new deployment version in the editor
#
# After running this script you MUST create a new version in the Apps Script editor
# for changes to go live. The URL stays the same — never create a new deployment.

set -e

echo "→ Pushing to Apps Script..."
export PATH="/c/Program Files/nodejs:/c/Users/chris/AppData/Roaming/npm:$PATH"
clasp push --force

echo ""
echo "✅ Code pushed."
echo ""
echo "⚠️  NEXT: create a new deployment version to go live:"
echo "   1. Open the Apps Script editor:"
echo "      https://script.google.com/home/projects/1ZPx2xknKYtcI43FLn2aHq--O6nRvFH4c55XaIDqYhWYWuVlCsULYXewX/edit"
echo "   2. Deploy → Manage deployments → pencil icon → New version → Deploy"
echo "   3. Same URL is preserved — do NOT click 'New deployment'"
