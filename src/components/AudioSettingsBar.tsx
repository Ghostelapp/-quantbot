/**
 * AudioSettingsBar - Real-Time Audio Alerts Controls & Sound Tester
 * Provides instant mute/unmute, volume slider, visual audio pulse,
 * and a sound testing laboratory for all critical trading events.
 */

import React, { useState } from 'react';
import { Volume2, VolumeX, Bell, Play, Sparkles, AlertTriangle, ShieldCheck, Zap } from 'lucide-react';
import { SoundEventType, SOUND_DEFINITIONS } from '../hooks/useTradingAudio';

interface AudioSettingsBarProps {
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  volume: number;
  setVolume: (vol: number) => void;
  playSound: (type: SoundEventType) => void;
  lastPlayed: { type: SoundEventType; timestamp: number } | null;
}

export const AudioSettingsBar: React.FC<AudioSettingsBarProps> = ({
  isMuted,
  setIsMuted,
  volume,
  setVolume,
  playSound,
  lastPlayed
}) => {
  const [showTester, setShowTester] = useState(false);
  const [activeTest, setActiveTest] = useState<SoundEventType | null>(null);

  const handleTest = (type: SoundEventType) => {
    setActiveTest(type);
    playSound(type);
    setTimeout(() => {
      setActiveTest(null);
    }, 600);
  };

  const isRecentSound = lastPlayed && Date.now() - lastPlayed.timestamp < 3000;
  const recentSoundDef = lastPlayed ? SOUND_DEFINITIONS[lastPlayed.type] : null;

  return (
    <div className="bg-[#0b1222] border border-slate-800/80 rounded-xl p-2.5 sm:p-3 text-xs shadow-md transition-all">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Volume & Mute Status */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsMuted(!isMuted)}
            title={isMuted ? 'Włącz dźwięki alertów' : 'Wycisz dźwięki alertów'}
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
              isMuted
                ? 'bg-rose-950/60 border-rose-800/80 text-rose-300 hover:bg-rose-900/60'
                : 'bg-emerald-950/60 border-emerald-800/80 text-emerald-300 hover:bg-emerald-900/60'
            }`}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            <span>{isMuted ? 'Dźwięk: WYŁ' : 'Dźwięk: WŁ'}</span>
          </button>

          {/* Volume Slider */}
          <div className="flex items-center space-x-2">
            <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">Głośność:</span>
            <input
              type="range"
              min="0.05"
              max="1.0"
              step="0.05"
              value={volume}
              disabled={isMuted}
              onChange={e => setVolume(parseFloat(e.target.value))}
              className="w-18 sm:w-24 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 disabled:opacity-40"
            />
            <span className="text-[11px] text-cyan-400 font-mono w-7 text-right">
              {Math.round(volume * 100)}%
            </span>
          </div>

          {/* Live Audio Event Indicator Badge */}
          {isRecentSound && recentSoundDef && (
            <div
              className="hidden md:flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border animate-pulse"
              style={{
                backgroundColor: `${recentSoundDef.color}18`,
                borderColor: `${recentSoundDef.color}60`,
                color: recentSoundDef.color
              }}
            >
              <span className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: recentSoundDef.color }} />
              <span>Alert: {recentSoundDef.label}</span>
            </div>
          )}
        </div>

        {/* Right: Sound Tester Toggle & Quick Previews */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowTester(!showTester)}
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              showTester
                ? 'bg-cyan-950 border-cyan-700 text-cyan-200'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Bell className="w-3.5 h-3.5 text-cyan-400" />
            <span>{showTester ? 'Zwiń Tester Audio' : 'Testuj Alerty Dźwiękowe'}</span>
          </button>
        </div>
      </div>

      {/* Expandable Audio Lab / Tester */}
      {showTester && (
        <div className="mt-3 pt-3 border-t border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>Laboratorium Syntezy Dźwięków Web Audio (Zero Opóźnień)</span>
            </span>
            <span className="text-[10px] text-slate-500">Kliknij przycisk, aby odsłuchać natychmiast</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {(Object.keys(SOUND_DEFINITIONS) as SoundEventType[]).map(type => {
              const def = SOUND_DEFINITIONS[type];
              const isPlayingThis = activeTest === type;

              return (
                <button
                  key={type}
                  onClick={() => handleTest(type)}
                  className={`p-2 rounded-lg border text-left flex flex-col justify-between transition-all group ${
                    isPlayingThis
                      ? 'scale-105 shadow-lg border-cyan-400 bg-cyan-950/60'
                      : 'bg-slate-900/80 hover:bg-slate-800 border-slate-800'
                  }`}
                  style={{
                    borderLeftWidth: '3px',
                    borderLeftColor: def.color
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-[11px] text-white truncate group-hover:text-cyan-300">
                      {def.label}
                    </span>
                    <Play className="w-3 h-3 text-slate-400 group-hover:text-cyan-400 shrink-0" />
                  </div>
                  <span className="text-[9px] text-slate-400 line-clamp-1">
                    {def.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
