#!/bin/bash

set -e

REPO="/Users/ag/Documents/Dev/kontomierz-transactions-import"

cd "$REPO"

echo "================================"
echo "Kontomierz Transactions Import"
echo "================================"
echo ""
echo "Repository: $REPO"
echo ""

node src/index.js