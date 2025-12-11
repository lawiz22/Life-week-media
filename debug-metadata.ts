import fs from 'fs';
import exifr from 'exifr';

const filePath = String.raw`C:\Users\Louis-Martin Richard\.gemini\antigravity\brain\3b82ff20-5942-4c30-93b4-6477ac6297ac\uploaded_image_1765482957448.jpg`;

async function debug() {
    console.log(`Processing: ${filePath}`);
    try {
        const buffer = await fs.promises.readFile(filePath);
        console.log(`Read buffer: ${buffer.length} bytes`);

        const metadata = await exifr.parse(buffer, {
            tiff: true,
            xmp: true,
            icc: false,
            exif: true,
            gps: true,
            interop: true,
        });

        console.log('--- Raw Metadata ---');
        console.log(JSON.stringify(metadata, null, 2));

        if (metadata) {
            console.log('--- Date Check ---');
            console.log('ModifyDate:', metadata.ModifyDate);
            console.log('DateTimeOriginal:', metadata.DateTimeOriginal);
            console.log('CreateDate:', metadata.CreateDate);
        } else {
            console.log('No metadata found via exifr');
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

debug();
