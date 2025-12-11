import sharp from 'sharp';
import exifr from 'exifr';

const filePath = String.raw`C:\Users\Louis-Martin Richard\.gemini\antigravity\brain\3b82ff20-5942-4c30-93b4-6477ac6297ac\uploaded_image_1765482957448.jpg`;

async function debug() {
    console.log(`Processing with Sharp -> Exifr: ${filePath}`);
    try {
        const image = sharp(filePath);
        const metadata = await image.metadata();

        if (metadata.exif) {
            console.log(`Found EXIF buffer: ${metadata.exif.length} bytes`);
            // Parse the raw EXIF buffer
            const parsed = await exifr.parse(metadata.exif);

            console.log('--- Parsed from EXIF Buffer ---');
            console.log(JSON.stringify(parsed, null, 2));

            if (parsed) {
                console.log('CreateDate:', parsed.CreateDate);
                console.log('DateTimeOriginal:', parsed.DateTimeOriginal);
            }
        } else {
            console.log('Sharp found no EXIF buffer');
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

debug();
