const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const buildInfoPath = path.join(__dirname, 'src', 'build-info.json');

let commitHash = 'unknown';
try {
  commitHash = execSync('git rev-parse --short HEAD').toString().trim();
} catch (e) {
  console.warn('Could not get git commit hash, trying to preserve existing...');
  if (fs.existsSync(buildInfoPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(buildInfoPath, 'utf8'));
      if (existing.commitHash) {
        commitHash = existing.commitHash;
      }
    } catch (readErr) {
      // ignore
    }
  }
}

let version = process.env.npm_package_version;
if (!version) {
  try {
    const packageJsonPath = path.join(__dirname, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    version = packageJson.version;
  } catch (e) {
    version = '0.0.0';
  }
}

const buildInfo = {
  buildDate: new Date().toISOString(),
  commitHash: commitHash,
  version: version
};

fs.writeFileSync(buildInfoPath, JSON.stringify(buildInfo, null, 2));
console.log('Build info generated:', buildInfo);
