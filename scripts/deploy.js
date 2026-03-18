/**
 * Cross-platform deployment script for JupyterLab extension
 * Copies built extension files to Jupyter's data directory
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getJupyterDataDir() {
  try {
    return execSync('jupyter --data-dir', { encoding: 'utf8' }).trim();
  } catch (error) {
    console.error('Failed to get Jupyter data directory:', error.message);
    process.exit(1);
  }
}

function copyRecursive(src, dest) {
  // Create destination directory if it doesn't exist
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function main() {
  const sourceDir = path.join(__dirname, '..', 'jupyterlab_llm_assistant', 'labextension');
  const jupyterDataDir = getJupyterDataDir();
  const targetDir = path.join(jupyterDataDir, 'labextensions', 'jupyterlab-llm-assistant');

  console.log('Deploying JupyterLab LLM Assistant extension...');
  console.log(`Source: ${sourceDir}`);
  console.log(`Target: ${targetDir}`);

  if (!fs.existsSync(sourceDir)) {
    console.error('Source directory does not exist. Run `jlpm run build` first.');
    process.exit(1);
  }

  try {
    copyRecursive(sourceDir, targetDir);
    console.log('Deployment successful!');
  } catch (error) {
    console.error('Deployment failed:', error.message);
    process.exit(1);
  }
}

main();
