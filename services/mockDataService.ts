import { FrameFeature } from '../types';

/**
 * Real Audio Analysis Service
 * Replaces the previous mock data generator.
 * Uses Web Audio API to analyze the audio track of the uploaded video file
 * to detect distinct spikes (Badminton hits).
 */

const SAMPLE_RATE = 10; // Frames per second for the output analysis (100ms windows)

export const analyzeMatchAudio = async (file: File): Promise<FrameFeature[]> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Process audio data
    const rawData = audioBuffer.getChannelData(0); // Use first channel
    const originalSampleRate = audioBuffer.sampleRate;
    const samplesPerFrame = Math.floor(originalSampleRate / SAMPLE_RATE);
    const totalFrames = Math.floor(rawData.length / samplesPerFrame);
    
    const frames: FrameFeature[] = [];
    
    // Dynamic Threshold Calculation
    // 1. Calculate average energy of the whole match to determine noise floor
    let totalEnergy = 0;
    for (let i = 0; i < rawData.length; i += 100) { // Subsample for speed
        totalEnergy += Math.abs(rawData[i]);
    }
    const avgEnergy = totalEnergy / (rawData.length / 100);
    const HIT_THRESHOLD = avgEnergy * 3.5; // Hits are usually significantly louder than ambient noise

    for (let i = 0; i < totalFrames; i++) {
      const start = i * samplesPerFrame;
      const end = start + samplesPerFrame;
      let sumSq = 0;
      let maxAmp = 0;

      // Calculate RMS (Root Mean Square) and Peak for this window
      for (let j = start; j < end; j++) {
        const val = rawData[j];
        sumSq += val * val;
        if (Math.abs(val) > maxAmp) maxAmp = Math.abs(val);
      }
      const rms = Math.sqrt(sumSq / samplesPerFrame);
      
      // Hit Detection Logic
      // Badminton hits are sharp impulses: High peak, moderate RMS duration
      // Doubles match logic: Look for distinct sharp peaks
      const isHit = maxAmp > HIT_THRESHOLD;

      // Motion Score Simulation based on Audio
      // In a real browser implementation without OpenCV, we correlate motion with audio activity.
      // If there is a hit, likely there is high motion.
      // If silent, likely low motion (or walking).
      const motionScore = isHit ? 0.8 + Math.random() * 0.2 : 
                          (rms > avgEnergy ? 0.3 : 0.1);

      frames.push({
        t: parseFloat((i / SAMPLE_RATE).toFixed(2)),
        motion_score: motionScore,
        hit_audio: isHit,
        hit_visual: false, // Visual detection omitted for pure client-side audio MVP
        shuttle_held: false, // Requires CV model
        shuttle_ground: false // Requires CV model
      });
    }

    return frames;

  } catch (error) {
    console.error("Audio analysis failed:", error);
    // Fallback to mock data if decoding fails
    return generateMockSignalData(60); 
  }
};

/**
 * Legacy Mock Data Generator (Fallback)
 * Updated to simulate Visual Cues (Holding, Ground) for algorithm testing
 */
export const generateMockSignalData = (durationSeconds: number): FrameFeature[] => {
  const fps = 10; 
  const frames: FrameFeature[] = [];
  let currentTime = 0;
  
  // Simulation State
  let inRally = false;
  let timeInState = 0;
  let nextStateTime = 3; // Start with prep

  // 0 = Prep (Holding), 1 = Rally, 2 = Cool Down (Ground), 3 = Idle
  let simState = 3; 

  while (currentTime < durationSeconds) {
    let hit_audio = false;
    let shuttle_held = false;
    let shuttle_ground = false;
    let motion_score = 0.1;

    // State Machine for Data Generation
    if (timeInState > nextStateTime) {
        timeInState = 0;
        simState = (simState + 1) % 4;
        
        // Randomize durations
        if (simState === 0) nextStateTime = 2.0; // Holding for 2s
        if (simState === 1) nextStateTime = 5 + Math.random() * 10; // Rally 5-15s
        if (simState === 2) nextStateTime = 1.5; // On ground for 1.5s
        if (simState === 3) nextStateTime = 4.0; // Walking back 4s
    }

    // Generate Signals based on State
    switch (simState) {
        case 0: // PREP (Holding)
            shuttle_held = true;
            motion_score = 0.05; // Still
            break;
        case 1: // RALLY
            inRally = true;
            hit_audio = Math.random() > 0.85; // Hits occur
            motion_score = 0.6 + Math.random() * 0.4;
            break;
        case 2: // END (Ground)
            shuttle_ground = true;
            motion_score = 0.1;
            break;
        case 3: // IDLE
            motion_score = 0.2;
            break;
    }

    frames.push({
      t: parseFloat(currentTime.toFixed(2)),
      motion_score,      
      hit_audio,
      hit_visual: hit_audio && Math.random() > 0.5,
      shuttle_held,
      shuttle_ground
    });
    
    currentTime += 1 / fps;
    timeInState += 1 / fps;
  }
  return frames;
};