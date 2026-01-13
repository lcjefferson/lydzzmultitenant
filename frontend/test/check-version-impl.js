const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');

function checkFile(filePath, checks) {
    const fullPath = path.join(projectRoot, filePath);
    if (!fs.existsSync(fullPath)) {
        console.error(`FAIL: File not found: ${filePath}`);
        process.exit(1);
    }
    const content = fs.readFileSync(fullPath, 'utf-8');
    let allPass = true;
    
    console.log(`Checking ${filePath}...`);
    checks.forEach(({ name, regex }) => {
        if (regex.test(content)) {
            console.log(`  [PASS] ${name}`);
        } else {
            console.error(`  [FAIL] ${name}`);
            allPass = false;
        }
    });
    return allPass;
}

let success = true;

// 1. Check next.config.ts for Env Vars
success &= checkFile('next.config.ts', [
    { name: 'NEXT_PUBLIC_APP_VERSION defined', regex: /NEXT_PUBLIC_APP_VERSION:\s*packageJson\.version/ },
    { name: 'NEXT_PUBLIC_BUILD_DATE defined', regex: /NEXT_PUBLIC_BUILD_DATE:\s*buildDate/ },
    { name: 'Date formatting logic', regex: /toLocaleDateString\('pt-BR'/ }
]);

// 2. Check login page for display
success &= checkFile('src/app/login/page.tsx', [
    { name: 'Relative container', regex: /className="[^"]*relative[^"]*min-h-screen/ },
    { name: 'Absolute positioning', regex: /absolute bottom-6/ },
    { name: 'Text styling (xs, gray-500)', regex: /text-xs text-gray-500/ },
    { name: 'Version Variable usage', regex: /process\.env\.NEXT_PUBLIC_APP_VERSION/ },
    { name: 'Date Variable usage', regex: /process\.env\.NEXT_PUBLIC_BUILD_DATE/ }
]);

if (success) {
    console.log('\nAll checks passed! Version display implementation verified.');
    process.exit(0);
} else {
    console.error('\nSome checks failed.');
    process.exit(1);
}
