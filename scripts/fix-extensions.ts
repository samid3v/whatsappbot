import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const distDir = './dist';

function fixExtensions(dir: string): void {
    const files = readdirSync(dir, { withFileTypes: true });

    for (const file of files) {
        const fullPath = join(dir, file.name);

        if (file.isDirectory()) {
            fixExtensions(fullPath);
        } else if (file.name.endsWith('.js')) {
            let content = readFileSync(fullPath, 'utf-8');
            
            // Fix import/export statements - add .js extension to relative imports
            content = content.replace(
                /from ["'](\.[^"']+)(?<!\.js)["']/g,
                'from "$1.js"'
            );
            content = content.replace(
                /import\(["'](\.[^"']+)(?<!\.js)["']\)/g,
                'import("$1.js")'
            );

            writeFileSync(fullPath, content, 'utf-8');
        }
    }
}

fixExtensions(distDir);
console.log('✅ Fixed import extensions in dist/');
