#!/bin/bash
set -e

echo "Applying D1 schema..."
wrangler d1 execute form-system-db --file=./schema/d1-schema.sql --remote
echo "Schema applied."
