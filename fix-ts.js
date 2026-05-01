const fs = require('fs');

function fixWebHidScanner() {
    let content = fs.readFileSync('src/lib/webhid-scanner.ts', 'utf8');
    content = content.replace(/device\.serialNumber/g, "(device as any).serialNumber");
    content = content.replace(/device\.manufacturerName/g, "(device as any).manufacturerName");
    fs.writeFileSync('src/lib/webhid-scanner.ts', content);
}

function fixDeviceSelector() {
    let content = fs.readFileSync('src/components/device-selector.tsx', 'utf8');
    content = content.replace(/device\.manufacturerName/g, "(device as any).manufacturerName");
    content = content.replace(/device\.serialNumber/g, "(device as any).serialNumber");
    fs.writeFileSync('src/components/device-selector.tsx', content);
}

function fixDialog() {
    let content = fs.readFileSync('src/components/ui/dialog.tsx', 'utf8');
    content = content.replace(/if \(e\.target === e\.currentTarget\) \{/g, "if (e.target === e.currentTarget && e.currentTarget instanceof HTMLElement) {");
    fs.writeFileSync('src/components/ui/dialog.tsx', content);
}

fixWebHidScanner();
fixDeviceSelector();
fixDialog();

console.log("Fixed TS errors");
