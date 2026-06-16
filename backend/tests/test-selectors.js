// Test script to verify participant detection selectors
// Run this in browser console when on a Teams meeting page

console.log('=== TESTING TEAMS PARTICIPANT SELECTORS ===');

// Test the main participant selector
const participants = document.querySelectorAll('li[data-cid="roster-participant"]');
console.log(`Found ${participants.length} participants with li[data-cid="roster-participant"]`);

participants.forEach((elem, index) => {
  console.log(`\n--- Participant ${index + 1} ---`);
  
  // Test name extraction methods
  let name = '';
  
  // Method 1: data-tid
  const dataTid = elem.getAttribute('data-tid');
  if (dataTid && dataTid.startsWith('participantsInCall-')) {
    name = dataTid.replace('participantsInCall-', '');
    console.log(`✅ Name from data-tid: "${name}"`);
  } else {
    console.log(`❌ No data-tid: "${dataTid}"`);
  }
  
  // Method 2: aria-label
  if (!name) {
    const ariaLabel = elem.getAttribute('aria-label');
    if (ariaLabel) {
      name = ariaLabel.split(',')[0].trim();
      console.log(`✅ Name from aria-label: "${name}"`);
    } else {
      console.log(`❌ No aria-label`);
    }
  }
  
  // Method 3: title span
  if (!name) {
    const titleSpan = elem.querySelector('span[title]');
    if (titleSpan) {
      name = titleSpan.getAttribute('title');
      console.log(`✅ Name from title span: "${name}"`);
    } else {
      console.log(`❌ No title span`);
    }
  }
  
  // Test speaking detection
  const speakingIcon = elem.querySelector('svg[data-cid="roster-participant-unmuted"]');
  const isSpeaking = Boolean(speakingIcon);
  console.log(`🎤 Speaking: ${isSpeaking} (found icon: ${speakingIcon ? 'yes' : 'no'})`);
  
  console.log(`Final result: "${name}" - Speaking: ${isSpeaking}`);
});

console.log('\n=== TEST COMPLETE ==='); 