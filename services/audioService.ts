
export const decode = (base64: string): ArrayBuffer => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

export const decodeAudioData = (
  arrayBuffer: ArrayBuffer,
  audioContext: AudioContext,
  sampleRate: number = 24000,
  channels: number = 1
): AudioBuffer => {
  // המרה מ-PCM 16-bit (מה שמגיע מ-Gemini) ל-Float32 (מה שהדפדפן צריך)
  const dataView = new DataView(arrayBuffer);
  // כל דגימה היא 2 בייטים (16 ביט)
  const length = arrayBuffer.byteLength / 2; 
  const audioBuffer = audioContext.createBuffer(channels, length, sampleRate);
  const channelData = audioBuffer.getChannelData(0);

  for (let i = 0; i < length; i++) {
    // קריאת מספר שלם (Int16) והמרה למספר עשרוני (Float32) בין -1 ל-1
    const int16 = dataView.getInt16(i * 2, true); // true = Little Endian
    channelData[i] = int16 / 32768.0;
  }

  return audioBuffer;
};

export const createPcmBlob = (float32Array: Float32Array): string => {
  // המרה הפוכה: מהמיקרופון (Float32) ל-PCM 16-bit (לשליחה ל-Gemini)
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    // המרה לטווח של 16 ביט
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  
  // המרה ל-Base64 לשליחה ברשת
  let binary = '';
  const bytes = new Uint8Array(int16Array.buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};
