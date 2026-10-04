#!/bin/sh
set -eu
cd "$(dirname "$0")"
uvx --from check-jsonschema==0.38.2 check-jsonschema --schemafile events-v4.schema.json events-v4.json
uvx --from check-jsonschema==0.38.2 check-jsonschema --schemafile registry-v4.schema.json registry-v4.json
ruby records/scripts/verify.rb
ruby records/scripts/boundaries.rb
ruby records/scripts/final_checks.rb
