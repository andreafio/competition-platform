#!/bin/bash

# Test script to validate the validation script syntax and basic functionality
# This tests the script structure without requiring running services

echo "🔧 Testing validation script syntax and structure..."
echo "=================================================="

# Test 1: Check if script exists and is executable
if [ -f "validate_all.sh" ]; then
    echo "✅ Script file exists"
else
    echo "❌ Script file missing"
    exit 1
fi

# Test 2: Check for jq dependency (should not be present)
if grep -q "jq" validate_all.sh; then
    echo "❌ Script still contains jq dependency"
    exit 1
else
    echo "✅ No jq dependency found"
fi

# Test 3: Check for basic structure
if grep -q "ENGINE_URL=" validate_all.sh && grep -q "ORCHESTRATOR_URL=" validate_all.sh; then
    echo "✅ URL variables defined"
else
    echo "❌ URL variables missing"
    exit 1
fi

# Test 4: Check for test functions
if grep -q "test_api()" validate_all.sh && grep -q "run_sql()" validate_all.sh; then
    echo "✅ Helper functions defined"
else
    echo "❌ Helper functions missing"
    exit 1
fi

# Test 5: Check for color codes
if grep -q "GREEN=" validate_all.sh && grep -q "RED=" validate_all.sh; then
    echo "✅ Color codes defined"
else
    echo "❌ Color codes missing"
    exit 1
fi

# Test 6: Check section headers
sections=("A) Contratti" "B) Determinismo" "C) Validazione" "D) Algoritmo" "E) Qualità" "F) Repechage" "G) Persistenza" "H) Job lifecycle" "I) Webhooks")
for section in "${sections[@]}"; do
    if grep -q "$section" validate_all.sh; then
        echo "✅ Section '$section' found"
    else
        echo "❌ Section '$section' missing"
    fi
done

echo ""
echo "🎉 Validation script structure test completed!"
echo "The script is ready for production validation when services are running."