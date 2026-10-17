/**
 * useTradingAudio - Web Audio API Synthesizer Hook for Trading Alerts
 * Generates low-latency, zero-dependency audio alerts for critical engine events:
 * - CIRCUIT_BREAKER: Urgent dual-tone siren
 * - POSITION_OPEN: Modern high-tech confirmation chime
 * - TAKE_PROFIT: Triumphant rising arpeggio / success chime
 * - STOP_LOSS: Cautionary descending bass drop
 * - BREAK_EVEN: Crystal clear bell tone
 * - PANIC: Rapid staccato emergency alarm
 * - BATCH_BURST: High-frequency ladder multi-pip burst
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export type SoundEventType =
  | 'CIRCUIT_BREAKER'
  | 'POSITION_OPEN'
  | 'TAKE_PROFIT'
  | 'STOP_LOSS'
  | 'BREAK_EVEN'
  | 'PANIC'
  | 'BATCH_BURST';

export interface SoundInfo {
  type: SoundEventType;
  label: string;
  description: string;
  color: string;
}

export const SOUND_DEFINITIONS: Record<SoundEventType, SoundInfo> = {
  CIRCUIT_BREAKER: {
    type: 'CIRCUIT_BREAKER',
    label: 'Circuit Breaker',
    description: 'Syrena alarmowa po przekroczeniu Max Drawdown (5%)',
    color: '#ef4444'
  },
  POSITION_OPEN: {
    type: 'POSITION_OPEN',
    label: 'Otwarcie pozycji',
    description: 'Nowe zlecenie zrealizowane na rynku',
    color: '#06b6d4'
  },
  TAKE_PROFIT: {
    type: 'TAKE_PROFIT',
    label: 'Take Profit (TP)',
    description: 'Sukces - zrealizowanie docelowego zysku (+3%)',
    color: '#10b981'
  },
  STOP_LOSS: {
    type: 'STOP_LOSS',
    label: 'Stop Loss (SL)',
    description: 'Asekuracja kapitału - cięcie straty (-1.5%)',
    color: '#f97316'
  },
  BREAK_EVEN: {
    type: 'BREAK_EVEN',
    label: 'Break-Even (BE)',
    description: 'Przesunięcie zlecenia SL na cenę wejścia (+1.5% zysku)',
    color: '#3b82f6'
  },
  PANIC: {
    type: 'PANIC',
    label: 'Panic Close All',
    description: 'Natychmiastowe zrzucenie wszystkich pozycji',
    color: '#ec4899'
  },
  BATCH_BURST: {
    type: 'BATCH_BURST',
    label: 'Burst Mikro-Pozycji',
    description: 'Wystrzelenie serii 10-100 mikro-zleceń do orderbooka',
    color: '#a855f7'
  }
};

export function useTradingAudio() {
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('quantbot_sound_muted');
      return stored ? JSON.parse(stored) : false;
    } catch {
      return false;
    }
  });

  const [volume, setVolume] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('quantbot_sound_vol');
      return stored ? parseFloat(stored) : 0.7;
    } catch {
      return 0.7;
    }
  });

  const [lastPlayed, setLastPlayed] = useState<{ type: SoundEventType; timestamp: number } | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);

  // Lazy-initialize AudioContext on user interaction
  const getAudioContext = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContextClass();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
    return audioCtxRef.current;
  }, []);

  // Sync settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('quantbot_sound_muted', JSON.stringify(isMuted));
    } catch {}
  }, [isMuted]);

  useEffect(() => {
    try {
      localStorage.setItem('quantbot_sound_vol', volume.toString());
    } catch {}
  }, [volume]);

  const playSound = useCallback((type: SoundEventType) => {
    if (isMuted) return;

    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(Math.max(0.01, Math.min(1, volume)), now);
      masterGain.connect(ctx.destination);

      setLastPlayed({ type, timestamp: Date.now() });

      switch (type) {
        case 'CIRCUIT_BREAKER': {
          // Intense dual-tone emergency siren
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const sirenGain = ctx.createGain();

          osc1.type = 'sawtooth';
          osc2.type = 'square';

          // Frequency modulation for siren sweep
          osc1.frequency.setValueAtTime(750, now);
          osc1.frequency.linearRampToValueAtTime(950, now + 0.15);
          osc1.frequency.linearRampToValueAtTime(550, now + 0.35);
          osc1.frequency.linearRampToValueAtTime(950, now + 0.55);
          osc1.frequency.linearRampToValueAtTime(450, now + 0.75);

          osc2.frequency.setValueAtTime(375, now);
          osc2.frequency.linearRampToValueAtTime(475, now + 0.15);
          osc2.frequency.linearRampToValueAtTime(275, now + 0.35);
          osc2.frequency.linearRampToValueAtTime(475, now + 0.55);
          osc2.frequency.linearRampToValueAtTime(225, now + 0.75);

          sirenGain.gain.setValueAtTime(0.35, now);
          sirenGain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

          osc1.connect(sirenGain);
          osc2.connect(sirenGain);
          sirenGain.connect(masterGain);

          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + 0.85);
          osc2.stop(now + 0.85);
          break;
        }

        case 'TAKE_PROFIT': {
          // Bright ascending celebratory arpeggio: C5 (523), E5 (659), G5 (784), C6 (1046.5)
          const notes = [523.25, 659.25, 783.99, 1046.5];
          notes.forEach((freq, idx) => {
            const noteStart = now + idx * 0.08;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, noteStart);

            // Shimmer harmonic
            gain.gain.setValueAtTime(0.001, noteStart);
            gain.gain.linearRampToValueAtTime(0.3, noteStart + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.35);

            osc.connect(gain);
            gain.connect(masterGain);

            osc.start(noteStart);
            osc.stop(noteStart + 0.36);
          });
          break;
        }

        case 'POSITION_OPEN': {
          // Futuristic two-tone confirmation ping (high-tech sonar)
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const g1 = ctx.createGain();
          const g2 = ctx.createGain();

          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(659.25, now); // E5
          g1.gain.setValueAtTime(0.25, now);
          g1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(1046.5, now + 0.09); // C6
          g2.gain.setValueAtTime(0.001, now);
          g2.gain.setValueAtTime(0.28, now + 0.09);
          g2.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

          osc1.connect(g1);
          osc2.connect(g2);
          g1.connect(masterGain);
          g2.connect(masterGain);

          osc1.start(now);
          osc1.stop(now + 0.2);
          osc2.start(now + 0.09);
          osc2.stop(now + 0.35);
          break;
        }

        case 'STOP_LOSS': {
          // Cautionary descending bass drop (440 -> 220 -> 110 Hz)
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(380, now);
          osc.frequency.exponentialRampToValueAtTime(110, now + 0.45);

          // Low-pass filter to dampen harshness
          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(800, now);
          filter.frequency.linearRampToValueAtTime(300, now + 0.45);

          gain.gain.setValueAtTime(0.35, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(masterGain);

          osc.start(now);
          osc.stop(now + 0.46);
          break;
        }

        case 'BREAK_EVEN': {
          // Crystal bell harmonic chime (A5 880Hz + E6 1318Hz)
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();

          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(880, now);

          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(1320, now);

          gain.gain.setValueAtTime(0.22, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(masterGain);

          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + 0.52);
          osc2.stop(now + 0.52);
          break;
        }

        case 'PANIC': {
          // Rapid staccato triple klaxon
          for (let i = 0; i < 3; i++) {
            const burstTime = now + i * 0.12;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'square';
            osc.frequency.setValueAtTime(900, burstTime);
            osc.frequency.linearRampToValueAtTime(700, burstTime + 0.08);

            gain.gain.setValueAtTime(0.3, burstTime);
            gain.gain.exponentialRampToValueAtTime(0.001, burstTime + 0.09);

            osc.connect(gain);
            gain.connect(masterGain);

            osc.start(burstTime);
            osc.stop(burstTime + 0.1);
          }
          break;
        }

        case 'BATCH_BURST': {
          // Rapid multi-laser pips simulating a volley of micro-orders
          const pips = 6;
          for (let i = 0; i < pips; i++) {
            const pipTime = now + i * 0.045;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(800 + i * 120, pipTime);
            osc.frequency.exponentialRampToValueAtTime(1600 + i * 150, pipTime + 0.035);

            gain.gain.setValueAtTime(0.18, pipTime);
            gain.gain.exponentialRampToValueAtTime(0.001, pipTime + 0.04);

            osc.connect(gain);
            gain.connect(masterGain);

            osc.start(pipTime);
            osc.stop(pipTime + 0.045);
          }
          break;
        }
      }
    } catch (err) {
      console.warn('TradingAudio playback failed:', err);
    }
  }, [isMuted, volume, getAudioContext]);

  return {
    isMuted,
    setIsMuted,
    volume,
    setVolume,
    playSound,
    lastPlayed,
    definitions: SOUND_DEFINITIONS
  };
}
