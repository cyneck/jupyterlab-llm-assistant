#!/usr/bin/env python3
"""
Test API key persistence to config.json
"""

import json
import os
import tempfile
import shutil
from unittest.mock import patch, MagicMock

# Setup test environment before importing handlers
temp_dir = tempfile.mkdtemp()
config_file = os.path.join(temp_dir, "config.json")

# Create test config file
test_config = {
    "apiEndpoint": "https://api.openai.com/v1",
    "model": "gpt-4o",
    "temperature": 0.7,
    "maxTokens": 4096,
    "systemPrompt": "Test",
    "enableStreaming": True,
    "enableVision": True,
}
with open(config_file, "w") as f:
    json.dump(test_config, f)

print(f"Test config file: {config_file}")
print(f"Initial config: {test_config}")
print()

# Test 1: Test server-side config saving
print("=" * 60)
print("TEST 1: Server-side config save with rememberApiKey=True")
print("=" * 60)

# Simulate what happens when user saves config
from jupyterlab_llm_assistant.serverextension import _save_config

# Test with apiKey and rememberApiKey=True
test_store = {
    "apiKey": "sk-test-api-key-12345",
    "apiEndpoint": "https://api.openai.com/v1",
    "model": "gpt-4o",
    "temperature": 0.7,
    "maxTokens": 4096,
    "systemPrompt": "Test",
    "enableStreaming": True,
    "enableVision": True,
}

# Save with include_api_key=True
_save_config(test_store, include_api_key=True)

# Check if apiKey was saved
with open(config_file, "r") as f:
    saved_config = json.load(f)

print(f"Saved config: {saved_config}")
print()

if "apiKey" in saved_config and saved_config["apiKey"] == "sk-test-api-key-12345":
    print("✓ TEST 1 PASSED: apiKey saved to config.json")
else:
    print("✗ TEST 1 FAILED: apiKey NOT saved to config.json")
    print(f"  Expected: 'apiKey': 'sk-test-api-key-12345'")
    print(f"  Got: {saved_config.get('apiKey', 'NOT FOUND')}")

print()

# Test 2: Test server-side config save WITHOUT rememberApiKey
print("=" * 60)
print("TEST 2: Server-side config save with rememberApiKey=False")
print("=" * 60)

# Reset config
with open(config_file, "w") as f:
    json.dump(test_config, f)

test_store2 = {
    "apiKey": "sk-test-api-key-67890",
    "apiEndpoint": "https://api.openai.com/v1",
    "model": "gpt-4o",
}

# Save with include_api_key=False
_save_config(test_store2, include_api_key=False)

# Check if apiKey was NOT saved (for security)
with open(config_file, "r") as f:
    saved_config2 = json.load(f)

print(f"Saved config: {saved_config2}")
print()

if "apiKey" not in saved_config2:
    print("✓ TEST 2 PASSED: apiKey NOT saved (as expected)")
else:
    print("✗ TEST 2 FAILED: apiKey was saved when it shouldn't be")

print()
print("=" * 60)
print("TEST RESULTS")
print("=" * 60)

# Cleanup
shutil.rmtree(temp_dir)

print("\nAll tests completed!")