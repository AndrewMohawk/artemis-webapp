"use client";

import { Pause, Play, RefreshCw, Settings, Square, X } from "lucide-react";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import "../audio-player.css";

type SinkCapableAudio = HTMLAudioElement & {
  setSinkId?: (sinkId: string) => Promise<void>;
};

function formatClock(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const minutes = Math.floor(value / 60);
  return `${minutes}:${Math.floor(value % 60).toString().padStart(2, "0")}`;
}

export function AudioPlayer({
  sources,
  title,
  initialVolume = 0.5,
  initialLoop = false,
  initialOutputDeviceId = "",
  onSettingsChange,
}: {
  sources: string[];
  title: string;
  initialVolume?: number;
  initialLoop?: boolean;
  initialOutputDeviceId?: string;
  onSettingsChange?: (settings: { volume?: number; loop?: boolean; outputDeviceId?: string }) => void;
}) {
  const availableSources = useMemo(() => sources.filter(Boolean), [sources]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [failedSources, setFailedSources] = useState<Set<string>>(() => new Set());
  const [playing, setPlaying] = useState(false);
  const loop = initialLoop;
  const volume = initialVolume;
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);
  const sinkId = initialOutputDeviceId;
  const [sinkSupported, setSinkSupported] = useState(false);
  const source = availableSources.find((candidate) => !failedSources.has(candidate)) || "";
  const progress = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const progressStyle = { "--audio-progress": `${progress}%` } as CSSProperties;

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.volume = volume;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current as SinkCapableAudio | null;
    if (!audio?.setSinkId || !sinkId) return;
    void audio.setSinkId(sinkId).catch(() => {
      onSettingsChange?.({ outputDeviceId: "" });
    });
  }, [onSettingsChange, sinkId, source]);

  async function play() {
    const audio = audioRef.current;
    if (!audio || !source) return;
    try {
      await audio.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  }

  function pause() {
    audioRef.current?.pause();
    setPlaying(false);
  }

  function stop() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setCurrentTime(0);
    setPlaying(false);
  }

  function handleSourceError() {
    setPlaying(false);
    if (source) setFailedSources((current) => new Set(current).add(source));
  }

  async function openSettings() {
    setSettingsOpen(true);
    setSinkSupported(Boolean((audioRef.current as SinkCapableAudio | null)?.setSinkId));
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setOutputs(devices.filter((device) => device.kind === "audiooutput"));
    } catch {
      setOutputs([]);
    }
  }

  async function changeOutput(nextSinkId: string) {
    const audio = audioRef.current as SinkCapableAudio | null;
    if (!audio?.setSinkId) return;
    try {
      await audio.setSinkId(nextSinkId);
      onSettingsChange?.({ outputDeviceId: nextSinkId });
    } catch {
      onSettingsChange?.({ outputDeviceId: "" });
    }
  }

  function changeLoop(next: boolean) {
    onSettingsChange?.({ loop: next });
  }

  function changeVolume(next: number) {
    onSettingsChange?.({ volume: next });
  }

  return (
    <div className="artemis-audio-player">
      <audio
        ref={audioRef}
        key={source}
        src={source || undefined}
        preload="metadata"
        loop={loop}
        onError={handleSourceError}
        onLoadStart={() => { setPlaying(false); setCurrentTime(0); setDuration(0); }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
      />

      {source ? (
        <div className="audio-console" aria-label={`Audio controls for ${title}`}>
          <div className="audio-primary-row">
            <button className="audio-primary-action" onClick={playing ? pause : play} aria-label={playing ? "Pause audio" : "Play audio"}>
              {playing ? <Pause size={18} /> : <Play size={18} />}
            </button>

            <div className="audio-track-meta">
              <div className="audio-track-title">
                <strong title={title}>{title}</strong>
              </div>
              <span className={playing ? "audio-track-state is-playing" : "audio-track-state"}>
                {playing ? "Playing now" : "Ready to play"}
              </span>
            </div>

            <button className="audio-settings-button" onClick={openSettings} aria-label="Audio player settings"><Settings size={16} /></button>
          </div>

          <div className="audio-timeline">
            <input
              type="range"
              min="0"
              max={duration || 0}
              step="0.01"
              value={Math.min(currentTime, duration || 0)}
              style={progressStyle}
              aria-label="Audio position"
              aria-valuetext={`${formatClock(currentTime)} of ${formatClock(duration)}`}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (audioRef.current) audioRef.current.currentTime = next;
                setCurrentTime(next);
              }}
            />
            <div className="audio-time-row">
              <span>{formatClock(currentTime)}</span>
              <span>{formatClock(duration)}</span>
            </div>
          </div>

          <div className="audio-utility-row">
            <button onClick={stop} aria-label="Stop audio">
              <Square size={12} />
              <span>Stop</span>
            </button>
            <button
              className={loop ? "is-active" : ""}
              onClick={() => changeLoop(!loop)}
              aria-label={loop ? "Disable audio loop" : "Loop audio"}
              aria-pressed={loop}
            >
              <RefreshCw size={13} />
              <span>Loop</span>
            </button>
            <span className="audio-volume-readout">Volume {Math.round(volume * 100)}%</span>
          </div>
        </div>
      ) : (
        <div className="audio-empty">No audio sample available</div>
      )}

      {settingsOpen ? (
        <div className="audio-settings-popover" role="dialog" aria-modal="false" aria-label="Audio player settings">
          <div>
            <strong>Audio player settings</strong>
            <button onClick={() => setSettingsOpen(false)} aria-label="Close audio settings"><X size={16} /></button>
          </div>
          <label>
            <span>Volume</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(event) => changeVolume(Number(event.target.value))}
            />
            <small>{Math.round(volume * 100)}%</small>
          </label>
          <label>
            <span>Replay (loop)</span>
            <input type="checkbox" checked={loop} onChange={(event) => changeLoop(event.target.checked)} />
          </label>
          <label>
            <span>Audio output</span>
            <select
              value={sinkId}
              disabled={!sinkSupported}
              onChange={(event) => void changeOutput(event.target.value)}
            >
              <option value="">System default</option>
              {outputs.map((output, index) => (
                <option key={output.deviceId} value={output.deviceId}>
                  {output.label || `Audio output ${index + 1}`}
                </option>
              ))}
            </select>
            {!sinkSupported ? (
              <small>Output selection is not supported by this browser.</small>
            ) : null}
          </label>
        </div>
      ) : null}
    </div>
  );
}
