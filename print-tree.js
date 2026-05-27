const fs = require('fs');
const path = require('path');

function printTree(dir, indent = '') {
    const items = fs.readdirSync(dir).filter(item => !['node_modules', '.git', '.vs', 'dist', 'build', 'print-tree.js', 'print-tree.ps1'].includes(item));
    
    items.forEach((item, index) => {
        const isLast = index === items.length - 1;
        const fullPath = path.join(dir, item);
        const prefix = isLast ? '└── ' : '├── ';
        
        console.log(indent + prefix + item);
        
        if (fs.statSync(fullPath).isDirectory()) {
            const newIndent = indent + (isLast ? '    ' : '│   ');
            printTree(fullPath, newIndent);
        }
    });
}

console.log('do-an-tot-nghiep');
printTree('d:/do-an-tot-nghiep');
