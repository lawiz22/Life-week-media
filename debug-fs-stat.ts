import fs from 'fs';

const filePath = String.raw`C:\Users\Louis-Martin Richard\.gemini\antigravity\brain\3b82ff20-5942-4c30-93b4-6477ac6297ac\uploaded_image_1765482957448.jpg`;

async function debug() {
    console.log(`Statting: ${filePath}`);
    try {
        const stat = await fs.promises.stat(filePath);
        console.log('Birthtime (Creation):', stat.birthtime);
        console.log('Mtime (Modified):', stat.mtime);
        console.log('Ctime (Change):', stat.ctime);
    } catch (e) {
        console.error('Error:', e);
    }
}

debug();
