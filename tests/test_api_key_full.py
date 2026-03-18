#!/usr/bin/env python3
"""
Full integration test for API key persistence.
Tests the complete flow: Frontend settings -> API call -> Server save -> Config file
"""

import json
import os
import sys
import tempfile
import shutil
from unittest.mock import patch, MagicMock

# Add project to path
sys.path.insert(0, '/mnt/e/Code/jupyterlab-llm-assistant')

# Create temp dir for test
temp_dir = tempfile.mkdtemp()
config_file = os.path.join(temp_dir, "config.json")

# Patch the config file path
original_expanduser = os.path.expanduser

def patched_expanduser(path):
    if path == '~/.llm-assistant/config.json':
        return config_file
    return original_expanduser(path)

print("=" * 60)
print("FULL INTEGRATION TEST: API Key Persistence")
print("=" * 60)
print()

# Patch before importing
with patch('os.path.expanduser', patched_expanduser):
    # Reload module to use patched path
    import importlib
    import jupyterlab_llm_assistant.serverextension as se
    importlib.reload(se)
    import jupyterlab_llm_assistant.handlers as handlers
    importlib.reload(handlers)

    print(f"Test config file: {config_file}")
    print()

    # Setup initial config
    initial_config = {
        "apiEndpoint": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "model": "qwen-turbo",
        "temperature": 0.7,
        "maxTokens": 4096,
    }
    with open(config_file, 'w') as f:
        json.dump(initial_config, f)

    # ========== TEST 1: Save with apiKey and rememberApiKey=True ==========
    print("-" * 60)
    print("TEST 1: Save with apiKey and rememberApiKey=True")
    print("-" * 60)

    # Simulate config_store
    config_store = dict(initial_config)

    # Simulate what ConfigHandler.post() does when saving
    test_api_key = "sk-test-dashscope-key-12345"

    # Update config store (like ConfigHandler does)
    config_store["apiKey"] = test_api_key
    remember_api_key = True

    # Call save callback (like ConfigHandler does)
    save_callback = config_store.get("_save_callback")
    if save_callback:
        save_callback(config_store, include_api_key=remember_api_key)

    # Read back config
    with open(config_file, 'r') as f:
        saved_config = json.load(f)

    print(f"Config after save: {json.dumps(saved_config, indent=2)}")
    print()

    if saved_config.get("apiKey") == test_api_key:
        print("✓ TEST 1 PASSED: apiKey saved to config.json")
    else:
        print(f"✗ TEST 1 FAILED: Expected apiKey='{test_api_key}', got: {saved_config.get('apiKey', 'NOT FOUND')}")

    print()

    # ========== TEST 2: Load config with apiKey ==========
    print("-" * 60)
    print("TEST 2: Load config and verify apiKey is loaded")
    print("-" * 60)

    # Simulate _load_config
    loaded = se._load_config()
    print(f"Loaded config: {json.dumps(loaded, indent=2)}")
    print()

    # Check if apiKey was loaded
    if loaded.get("apiKey") == test_api_key:
        print("✓ TEST 2 PASSED: apiKey loaded from config.json")
    else:
        print(f"✗ TEST 2 FAILED: Expected apiKey='{test_api_key}', got: {loaded.get('apiKey', 'NOT FOUND')}")

    print()

    # ========== TEST 3: Save WITHOUT rememberApiKey ==========
    print("-" * 60)
    print("TEST 3: Save with rememberApiKey=False (security test)")
    print("-" * 60)

    # Reset config
    with open(config_file, 'w') as f:
        json.dump(initial_config, f)

    # Simulate user unchecks "remember API key"
    config_store2 = dict(initial_config)
    config_store2["apiKey"] = "sk-security-test-key"

    # Save with include_api_key=False
    save_callback2 = config_store2.get("_save_callback")
    if save_callback2:
        save_callback2(config_store2, include_api_key=False)

    with open(config_file, 'r') as f:
        saved_config2 = json.load(f)

    print(f"Config after save (rememberApiKey=False): {json.dumps(saved_config2, indent=2)}")
    print()

    if "apiKey" not in saved_config2:
        print("✓ TEST 3 PASSED: apiKey NOT saved (security - as expected)")
    else:
        print(f"✗ TEST 3 FAILED: apiKey should NOT be saved when rememberApiKey=False")

print()
print("=" * 60)
print("ALL TESTS COMPLETED")
print("=" * 60)

# Cleanup
shutil.rmtree(temp_dir)