const fs = require('fs');
const path = require('path');

const rootDirectory = process.cwd();

function findHtmlFiles(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const entryPath = path.join(directory, entry.name);
        return entry.isDirectory() ? findHtmlFiles(entryPath) : entry.name.endsWith('.html') ? [entryPath] : [];
    });
}

function localTarget(route, sourceFile) {
    const [routePath, rawFragment] = route.split('#', 2);
    const fragment = rawFragment ? `#${rawFragment.replace(/\.html$/, '')}` : '';
    const targetPath = routePath.replace(/^\/+/, '').replace(/\.html$/, '') || 'index';
    const targetFile = `${targetPath}.html`;
    const relativePath = path.relative(path.dirname(sourceFile), path.join(rootDirectory, ...targetFile.split('/')));
    return `${(relativePath || path.basename(targetFile)).replace(/\\/g, '/')}${fragment}`;
}

const linkRegex = /(href\s*=\s*)(["'])\/(?!\/)([^"']*)\2/g;
let changedFiles = 0;

for (const filePath of findHtmlFiles(rootDirectory)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const repairedContent = content
        .replace(/=\.html"/g, '="')
        .replace(/"\.\.\/>/g, '"/>')
        .replace(/^\s*<base href="[^"]*">\r?\n/gm, '');
    const updatedContent = repairedContent.replace(linkRegex, (match, prefix, quote, route) => {
        return `${prefix}${quote}${localTarget(route, filePath)}${quote}`;
    });

    if (updatedContent !== content) {
        fs.writeFileSync(filePath, updatedContent, 'utf8');
        changedFiles += 1;
    }
}

console.log(`Fixed links in ${changedFiles} HTML files.`);