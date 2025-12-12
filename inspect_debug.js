const fs = require('fs');

try {
    const data = fs.readFileSync('debug_ableton_scan.json', 'utf8');
    const json = JSON.parse(data);

    // Check Root
    console.log('Root Keys:', Object.keys(json));

    const liveSet = json.Ableton?.LiveSet?.[0];
    if (!liveSet) {
        console.log('No LiveSet found');
        return;
    }

    console.log('LiveSet Keys:', Object.keys(liveSet));

    if (liveSet.MasterTrack) {
        console.log('MasterTrack Found!');
        console.log('MasterTrack Keys:', Object.keys(liveSet.MasterTrack[0]));

        // Check DeviceChain/Mixer
        const devChain = liveSet.MasterTrack[0].DeviceChain?.[0];
        if (devChain) {
            const mixer = devChain.Mixer?.[0];
            if (mixer) {
                console.log('Mixer keys:', Object.keys(mixer));
                if (mixer.Tempo) console.log('Tempo:', JSON.stringify(mixer.Tempo, null, 2));
                else console.log('No Tempo in Mixer');

                if (mixer.TimeSignature) console.log('TimeSignature:', JSON.stringify(mixer.TimeSignature, null, 2));
                else console.log('No TimeSignature in Mixer');
            } else {
                console.log('No Mixer in DeviceChain');
            }
        } else {
            console.log('No DeviceChain in MasterTrack');
        }

    } else {
        console.log('MasterTrack NOT found in LiveSet');
        // Is it inside Tracks?
        const tracks = liveSet.Tracks?.[0];
        if (tracks) {
            console.log('Tracks keys fragment:', Object.keys(tracks).slice(0, 10));
        }
    }

    // Recursive search for ANY "SampleRef"
    let sampleRefCount = 0;
    const findSampleRef = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        if (Object.keys(obj).some(k => k.toLowerCase() === 'sampleref')) sampleRefCount++;
        Object.values(obj).forEach(findSampleRef);
    }
    findSampleRef(liveSet);
    console.log('Total SampleRef found:', sampleRefCount);

} catch (e) {
    console.error(e);
}
