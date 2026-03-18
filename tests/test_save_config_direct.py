#!/usr/bin/env python3
"""
Direct test for _save_config function
"""

import json
import os
import sys
import tempfile
import shutil

# Add project to path
sys.path.insert(0, '/mnt/e/Code/jupyterlab-llm-assistant')

# Create temp dir for test
temp_dir = tempfile.mkdtemp()
config_file = os.path.join(temp_dir, "config.json")

print("=" * 60)
print("DIRECT TEST: _save_config function")
print("=" * 60)
print(f"Test config file: {config_file}")
print()

# Test the _save_config function directly
from jupyterlab_llm_assistant.serverextension import _save_config

# ========== TEST 1: Save with include_api_key=True ==========
print("-" * 60)
print("TEST 1: Save with include_api_key=True")
print("-" * 60)

config1 = {
    "apiKey": "sk-test-key-12345",
    "apiEndpoint": "https://api.openai.com/v1",
    "model": "gpt-4o",
}

# Temporarily patch the config file path
import jupyterlab_llm_assistant.serverextension as se
original_config_file = se._CONFIG_FILE
se._CONFIG_FILE = config_file

try:
    _save_config(config1, include_api_key=True)

    with open(config_file, 'r') as f:
        saved = json.load(f)

    print(f"Saved config: {json.dumps(saved, indent=2)}")

    if saved.get("apiKey") == "sk-test-key-12345":
        print("✓ TEST 1 PASSED")
    else:
        print("✗ TEST 1 FAILED")
finally:
    se._CONFIG_FILE = original_config_file

print()

# ========== TEST 2: Save with include_api_key=False ==========
print("-" * 60)
print("TEST 2: Save with include_api_key=False")
print("-" * 60)

config2 = {
    "apiKey": "sk-should-not-save",
    "apiEndpoint": "https://api.openai.com/v1",
    "model": "gpt-4o",
}

se._CONFIG_FILE = config_file

try:
    _save_config(config2, include_api_key=False)

    with open(config_file, 'r') as f:
        saved2 = json.load(f)

    print(f"Saved config: {json.dumps(saved2, indent=2)}")

    if "apiKey" not in saved2:
        print("✓ TEST 2 PASSED")
    else:
        print("✗ TEST 2 FAILED")
finally:
    se._CONFIG_FILE = original_config_file

print()

# ========== TEST 3: Verify _hasApiKey flag ==========
print("-" * 60)
print("TEST 3: Verify _hasApiKey flag is set")
print("-" * 60)

config3 = {
    "apiKey": "sk-flag-test",
    "apiEndpoint": "https://api.openai.com/v1",
}

se._CONFIG_FILE = config_file

try:
    _save_config(config3, include_api_key=False)

    with open(config_file, 'r') as f:
        saved3 = json.load(f)

    print(f"Saved config: {json.dumps(saved3, indent=2)}")

    if saved3.get("_hasApiKey") == True:
        print("✓ TEST 3 PASSED")
    else:
        print("✗ TEST 3 FAILED")
finally:
    se._CONFIG_FILE = original_config_file

print()
print("=" * 60)
print("ALL TESTS COMPLETED")
print("=" * 60)

# Cleanup
shutil.rmtree(temp_dir)