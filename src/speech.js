// Reads country names out loud with the browser's built-in voice.
let enabled = true;
let voice = null;

function pickVoice() {
  const list = window.speechSynthesis?.getVoices() || [];
  voice = list.find((v) => v.lang === 'en-US' && /Samantha|Google US/i.test(v.name))
    || list.find((v) => v.lang === 'en-US')
    || list.find((v) => v.lang?.startsWith('en')) || null;
}
if ('speechSynthesis' in window) {
  pickVoice();
  window.speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
}

export function setVoiceOn(v) { enabled = v; }

// iPad Safari only allows speech after a tap, so call this from the Play button.
export function unlockSpeech() {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(' ');
  u.volume = 0;
  window.speechSynthesis.speak(u);
}

export function say(text) {
  if (!enabled || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = 0.85;
  if (voice) u.voice = voice;
  window.speechSynthesis.speak(u);
}
