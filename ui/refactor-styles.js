import fs from 'fs';
import path from 'path';

const pagesDir = path.join(process.cwd(), 'src', 'pages');
const compDir = path.join(process.cwd(), 'src', 'components', 'ui');

const replacements = {
    // Backgrounds
    'bg-slate-950': 'bg-neutral-50',
    'bg-slate-900': 'bg-white',
    // Borders
    'border-slate-800': 'border-gray-200',
    'border-slate-700': 'border-gray-300',
    // Text colors
    'text-white': 'text-neutral-900',
    'text-slate-50': 'text-neutral-800',
    'text-slate-200': 'text-neutral-700',
    'text-slate-300': 'text-neutral-600',
    'text-slate-400': 'text-neutral-500',
    'text-slate-500': 'text-neutral-400',
    // Hover states
    'hover:bg-slate-800': 'hover:bg-neutral-100',
    'hover:bg-slate-700': 'hover:bg-neutral-200',
    'hover:text-white': 'hover:text-neutral-900',
    // Specific Caravan aesthetics
    'rounded-xl': 'rounded-3xl',
    'rounded-lg': 'rounded-2xl',
    'rounded-md': 'rounded-xl',
    // Button styling (Primary buttons should stay colored, but ghost/secondary needs adjusting)
    'bg-indigo-500/10': 'bg-neutral-100',
    'text-indigo-400': 'text-neutral-900',
    'text-emerald-400': 'text-emerald-600',
    'text-rose-400': 'text-rose-600',
    'text-indigo-200': 'text-indigo-700',
    'bg-slate-900/50': 'bg-neutral-50',
    'bg-slate-950/50': 'bg-neutral-50'
};

function processDirectory(directory) {
    const files = fs.readdirSync(directory);
    for (const file of files) {
        const fullPath = path.join(directory, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDirectory(fullPath);
        } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let modified = false;

            for (const [oldClass, newClass] of Object.entries(replacements)) {
                // simple global replace
                const regex = new RegExp(oldClass.replace(/\//g, '\\/'), 'g');
                if (regex.test(content)) {
                    content = content.replace(regex, newClass);
                    modified = true;
                }
            }

            if (modified) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Updated: ${fullPath}`);
            }
        }
    }
}

try {
    processDirectory(pagesDir);
    processDirectory(compDir);
    console.log('Style refactoring completed successfully.');
} catch (error) {
    console.error('Error during refactoring:', error);
}
