/**
 * Inicia o Next.js em dev evitando erro uv_interface_addresses (macOS/sandbox).
 * Faz patch de os.networkInterfaces antes de carregar o Next.
 */
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const original = os.networkInterfaces;
os.networkInterfaces = function networkInterfaces() {
  try {
    return original ? original.call(this) : {};
  } catch (e) {
    return {};
  }
};

// Gera build-info
execSync('node generate-build-info.js', { stdio: 'inherit', cwd: __dirname });

// Roda next dev no mesmo processo para o patch valer
process.argv = [process.argv[0], path.join(__dirname, 'node_modules/next/dist/bin/next'), 'dev'];
require('next/dist/bin/next');
