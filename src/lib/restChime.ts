import { Platform, Vibration } from 'react-native';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

// Short two-note chime synthesized for Forge (assets/sounds/rest-done.wav) — no third-party audio.
const CHIME = require('../../assets/sounds/rest-done.wav');

let player: AudioPlayer | null = null;

function getPlayer(): AudioPlayer {
  if (!player) {
    player = createAudioPlayer(CHIME);
    player.volume = 0.9;
    // iOS: still audible with the ring/silent switch on — this is a timer the user asked for.
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }
  return player;
}

/**
 * Call from a tap handler (e.g. ticking off a set) so browsers that block
 * audio until a user gesture have the player ready when rest ends.
 */
export function primeRestChime(): void {
  try {
    getPlayer();
  } catch {
    // Audio unavailable — the timer still shows and vibrates.
  }
}

/** Rest's over: chime + a double buzz (phones; web vibrates where the browser supports it). */
export function playRestChime(): void {
  try {
    const p = getPlayer();
    p.seekTo(0).catch(() => {});
    p.play();
  } catch {
    // Ignore — never let a sound failure break the workout screen.
  }
  if (Platform.OS !== 'web') Vibration.vibrate([0, 250, 120, 250]);
  else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.([250, 120, 250]);
}
