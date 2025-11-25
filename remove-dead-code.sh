#!/bin/bash

# Remove commented-out code blocks from key files

# File 1: src/app/dashboard/page.tsx - Remove commented helper functions
perl -i -0pe 's/\/\/ Helper functions.*?(?=\n  \})/\/\/ Removed: helper functions/sg' src/app/dashboard/page.tsx

# File 2: src/app/dashboard/upload/page.tsx - Remove commented code
perl -i -0pe 's/\/\/ interface CaseData.*?(?=\n  \/\/)/\/\/ Removed: CaseData interface/sg' src/app/dashboard/upload/page.tsx

# File 3: src/app/dashboard/reports/page.tsx - Remove commented API calls  
perl -i -0pe 's/\/\/ const schedulesRes.*?(?=\n    \})/\/\/ Removed: mock API calls/sg' src/app/dashboard/reports/page.tsx

echo "✓ Dead code removal complete"
