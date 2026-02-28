import fs from 'fs';
import path from 'path';

const pagesDir = path.join(process.cwd(), 'src', 'pages');
const compDir = path.join(process.cwd(), 'src', 'components', 'ui');
const layoutPath = path.join(process.cwd(), 'src', 'App.jsx');

const replacements = {
    // Semantic Backgrounds
    'bg-neutral-50': 'bg-background',
    'bg-white': 'bg-card',
    'bg-gray-50': 'bg-muted',
    'bg-neutral-100': 'bg-secondary',
    'bg-neutral-200': 'bg-secondary/80',
    'bg-neutral-900': 'bg-primary',

    // Semantic Text Colors
    'text-neutral-900': 'text-card-foreground',
    'text-neutral-800': 'text-foreground',
    'text-neutral-700': 'text-foreground/80',
    'text-neutral-600': 'text-muted-foreground',
    'text-neutral-500': 'text-muted-foreground',
    'text-neutral-400': 'text-muted-foreground/80',
    'text-white': 'text-primary-foreground',

    // Semantic Borders
    'border-gray-200': 'border-border',
    'border-gray-100': 'border-border/50',
    'border-gray-300': 'border-border',

    // Semantic Hovers
    'hover:bg-neutral-50': 'hover:bg-muted',
    'hover:bg-neutral-100': 'hover:bg-secondary',
    'hover:bg-neutral-200': 'hover:bg-secondary/80',
    'hover:text-neutral-900': 'hover:text-foreground',
};

function processFile(fullPath) {
    let content = fs.readFileSync(fullPath, 'utf8');
    let modified = false;

    for (const [oldClass, newClass] of Object.entries(replacements)) {
        // Find exact class match surrounded by standard class delimiters
        const regex = new RegExp(`(?<=[\\s"'\\\`])${oldClass}(?=[\\s"'\\\`])`, 'g');
        if (regex.test(content)) {
            content = content.replace(regex, newClass);
            modified = true;
        }
    }

    if (modified) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated semantic classes in: ${fullPath}`);
    }
}

function processDirectory(directory) {
    const files = fs.readdirSync(directory);
    for (const file of files) {
        const fullPath = path.join(directory, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDirectory(fullPath);
        } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
            processFile(fullPath);
        }
    }
}

try {
    processDirectory(pagesDir);
    processDirectory(compDir);
    processFile(layoutPath);
    console.log('Semantic style refactoring completed successfully.');
} catch (error) {
    console.error('Error during semantic refactoring:', error);
}
