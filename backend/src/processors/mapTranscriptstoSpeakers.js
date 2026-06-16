const fs = require('fs');
const csv = require('csv-parser');

function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const records = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', data => records.push(data))
      .on('end', () => resolve(records))
      .on('error', reject);
  });
}

function mapWordsToSpeakers(transcript, csvRecords, meetingStartTime, chunkStartOffset = 0) {
  // Handle both old format (transcript with words) and new format (text string)
  let words = [];
  let segments = [];
  
  if (typeof transcript === 'string') {
    // Simple text - create basic word objects
    const textWords = transcript.split(' ');
    const avgDuration = 0.5; // Assume 0.5 seconds per word
    words = textWords.map((word, index) => ({
      word: word,
      start: chunkStartOffset + (index * avgDuration),
      end: chunkStartOffset + ((index + 1) * avgDuration)
    }));
  } else if (transcript.words && Array.isArray(transcript.words)) {
    // Original format with words array
    words = transcript.words.map(w => ({
      ...w,
      start: w.start + chunkStartOffset,
      end: w.end + chunkStartOffset
    }));
  } else if (transcript.segments && Array.isArray(transcript.segments)) {
    // New format with segments - extract words from segments
    words = [];
    transcript.segments.forEach(segment => {
      if (segment.words && Array.isArray(segment.words)) {
        words.push(...segment.words.map(w => ({
          ...w,
          start: w.start + chunkStartOffset,
          end: w.end + chunkStartOffset
        })));
      } else {
        // No word-level timing, estimate from segment
        const segmentWords = segment.text.split(' ');
        const wordDuration = (segment.end - segment.start) / segmentWords.length;
        segmentWords.forEach((word, index) => {
          words.push({
            word: word,
            start: segment.start + chunkStartOffset + (index * wordDuration),
            end: segment.start + chunkStartOffset + ((index + 1) * wordDuration)
          });
        });
      }
    });
  } else {
    throw new Error("Transcription does not contain a valid 'words' array, 'segments' array, or text string");
  }

  // Prepare dynamic records with speaker information
  const dynamicRecords = csvRecords.map(record => {
    const ts = record['Timestamp'] || record['Timestamp (UTC)'];
    const timestamp = new Date(ts);
    const offset = (timestamp - meetingStartTime) / 1000;
    let speakersStr = record['Participants'] || record['participants'] || '';
    speakersStr = speakersStr.replace(/( are speaking| is speaking)$/i, '');
    const speakers = speakersStr.split(',')
      .map(s => s.trim())
      .filter(s => s);
    return { offset, speakers };
  });
  
  dynamicRecords.sort((a, b) => a.offset - b.offset);

  // Map speakers to words
  const wordsWithSpeakers = words.map(wordObj => {
    let bestMatch = null;
    let minDiff = Infinity;
    
    for (const rec of dynamicRecords) {
      const diff = Math.abs(wordObj.start - rec.offset);
      if (diff < minDiff) {
        minDiff = diff;
        bestMatch = rec;
      }
    }
    
    return { 
      ...wordObj, 
      speakers: bestMatch ? bestMatch.speakers : ['Unknown']
    };
  });

  // Group words into speaker segments
  const speakerSegments = [];
  let currentSegment = null;
  
  for (const w of wordsWithSpeakers) {
    if (!currentSegment) {
      currentSegment = { 
        start: w.start, 
        end: w.end, 
        words: [w.word], 
        speakers: w.speakers 
      };
    } else {
      // Check if speakers are the same (use JSON.stringify for array comparison)
      if (JSON.stringify(currentSegment.speakers.sort()) === JSON.stringify(w.speakers.sort())) {
        currentSegment.end = w.end;
        currentSegment.words.push(w.word);
      } else {
        // Speakers changed, finish current segment and start new one
        speakerSegments.push({
          start: currentSegment.start,
          end: currentSegment.end,
          text: currentSegment.words.join(' '),
          speakers: currentSegment.speakers,
          wordCount: currentSegment.words.length
        });
        currentSegment = { 
          start: w.start, 
          end: w.end, 
          words: [w.word], 
          speakers: w.speakers 
        };
      }
    }
  }
  
  // Add the last segment
  if (currentSegment) {
    speakerSegments.push({
      start: currentSegment.start,
      end: currentSegment.end,
      text: currentSegment.words.join(' '),
      speakers: currentSegment.speakers,
      wordCount: currentSegment.words.length
    });
  }

  return speakerSegments;
}

// Enhanced function for processing multiple chunks
function mapChunkedTranscriptsToSpeakers(chunks, csvRecords, meetingStartTime) {
  const allSegments = [];
  
  chunks.forEach((chunk, index) => {
    console.log(`🎯 Processing chunk ${index} (${chunk.startTime}s - ${chunk.endTime}s)`);
    
    if (chunk.transcript && chunk.transcript.text) {
      const chunkSegments = mapWordsToSpeakers(
        chunk.transcript, 
        csvRecords, 
        meetingStartTime, 
        chunk.startTime
      );
      
      allSegments.push(...chunkSegments);
    }
  });
  
  return allSegments;
}

module.exports = {
  parseCSV,
  mapWordsToSpeakers,
  mapChunkedTranscriptsToSpeakers,
};
