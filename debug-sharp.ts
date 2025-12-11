import sharp from 'sharp';

const filePath = String.raw`C:\Users\Louis-Martin Richard\.gemini\antigravity\brain\3b82ff20-5942-4c30-93b4-6477ac6297ac\uploaded_image_1765482957448.jpg`;

async function debug() {
    console.log(`Processing with Sharp: ${filePath}`);
    try {
        const metadata = await sharp(filePath).metadata();
        console.log('--- Sharp Metadata ---');
        console.log(JSON.stringify(metadata, null, 2));

        if (metadata.exif) {
            console.log('--- EXIF Buffer Found ---');
            // Sharp returns raw buffer for exif, we might need to parse it?
            // But it extracts some fields to root
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

debug();
