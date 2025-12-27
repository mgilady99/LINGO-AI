// src/services/audioService.ts

// פענוח אודיו חוזר מה-AI (24kHz PCM)
export const decode = (base64: string): ArrayBuffer => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

export const decodeAudioData = (arrayBuffer: ArrayBuffer, audioCtx: AudioContext, sampleRate: number = 24000): AudioBuffer => {
  const int16Array = new Int16Array(arrayBuffer);
  const buffer = audioCtx.createBuffer(1, int16Array.length, sampleRate);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < int16Array.length; i++) {
    channelData[i] = int16Array[i] / 32768.0; // המרה מ-int16 חזרה ל-float
  }
  return buffer;
};

// המרת קול מהמיקרופון לפורמט שגוגל מבינה (16kHz PCM)
export const createPcmBlob = (float32Array: Float32Array, inputSampleRate: number): string => {
  const targetSampleRate = 16000;
  const compression = inputSampleRate / targetSampleRate;
  const length = Math.floor(float32Array.length / compression);
  const int16Array = new Int16Array(length);

  // Resampling פשוט ומהיר ל-16kHz
  for (let i = 0; i < length; i++) {
    const index = Math.floor(i * compression);
    const s = Math.max(-1, Math.min(1, float32Array[index]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }

  const bytes = new Uint8Array(int16Array.buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};
