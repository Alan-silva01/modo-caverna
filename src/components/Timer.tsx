import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Timer, ChevronUp, ChevronDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

type TimerMode = 'stopwatch' | 'countdown';

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

function formatTime(totalMs: number, showMs: boolean) {
  const h = Math.floor(totalMs / 3600000);
  const m = Math.floor((totalMs % 3600000) / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  if (showMs) {
    const cs = Math.floor((totalMs % 1000) / 10); // Centiseconds (00-99)
    return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(cs)}`;
  }
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export default function HeaderTimer() {
  const { modoCaverna } = useTheme();

  const [mode, setMode] = useState<TimerMode>(() => {
    return (localStorage.getItem('timer-mode') as TimerMode) || 'stopwatch';
  });

  const [countdownTargetMs, setCountdownTargetMs] = useState<number>(() => {
    const secs = parseInt(localStorage.getItem('timer-target') || '3600', 10);
    return secs * 1000; // Store in ms
  });

  const [elapsedMs, setElapsedMs] = useState(0);
  const [running, setRunning] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [configH, setConfigH] = useState(1);
  const [configM, setConfigM] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTimeRef = useRef<number>(0);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Sync mode and countdown state when Modo Caverna is enabled
  useEffect(() => {
    if (modoCaverna) {
      setMode('countdown');
      setElapsedMs(0);
      setRunning(true);
    }
  }, [modoCaverna]);

  // Persist settings
  useEffect(() => {
    localStorage.setItem('timer-mode', mode);
    localStorage.setItem('timer-target', String(Math.floor(countdownTargetMs / 1000)));
  }, [mode, countdownTargetMs]);

  // Timer Tick Interval (running at ~30ms for smooth millisecond/centisecond rendering)
  useEffect(() => {
    if (running) {
      lastTimeRef.current = Date.now();
      intervalRef.current = setInterval(() => {
        const now = Date.now();
        const delta = now - lastTimeRef.current;
        lastTimeRef.current = now;

        setElapsedMs(prev => {
          if (mode === 'countdown') {
            const next = prev + delta;
            if (next >= countdownTargetMs) {
              setRunning(false);
              return countdownTargetMs;
            }
            return next;
          }
          return prev + delta;
        });
      }, 30);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, mode, countdownTargetMs]);

  // Close configuration popover on outside click
  useEffect(() => {
    if (!showConfig) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowConfig(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showConfig]);

  const handleReset = useCallback(() => {
    setRunning(false);
    setElapsedMs(0);
  }, []);

  const handleApplyCountdown = () => {
    const ms = (configH * 3600 + configM * 60) * 1000;
    setCountdownTargetMs(ms);
    setMode('countdown');
    setElapsedMs(0);
    setRunning(false);
    setShowConfig(false);
  };

  const handleSetStopwatch = () => {
    setMode('stopwatch');
    setElapsedMs(0);
    setRunning(false);
    setShowConfig(false);
  };

  const remainingMs = countdownTargetMs - elapsedMs;
  const displayMs = mode === 'stopwatch' ? elapsedMs : Math.max(0, remainingMs);
  const displayStr = formatTime(displayMs, modoCaverna);

  // Urgency indicator (flashes red when in Modo Caverna or when countdown is very low)
  const pct = mode === 'countdown' ? remainingMs / countdownTargetMs : 1;
  const timerClass = modoCaverna
    ? 'danger'
    : mode === 'countdown'
      ? pct <= 0.1 ? 'danger' : pct <= 0.25 ? 'warning' : ''
      : '';

  const adjustH = (delta: number) => setConfigH(h => Math.max(0, Math.min(23, h + delta)));
  const adjustM = (delta: number) => setConfigM(m => Math.max(0, Math.min(59, m + delta)));

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      {/* Timer Display */}
      <div
        className={`header-timer ${timerClass}`}
        style={{
          width: modoCaverna ? '95px' : '65px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: '12px',
          flexShrink: 0
        }}
      >
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{displayStr}</span>
      </div>

      {/* Controls */}
      <div className="timer-controls">
        <button
          className={`timer-btn ${running ? 'active' : ''}`}
          onClick={() => setRunning(r => !r)}
          title={running ? 'Pausar' : 'Iniciar'}
        >
          {running ? <Pause size={13} /> : <Play size={13} />}
        </button>
        <button
          className="timer-btn"
          onClick={handleReset}
          title="Reiniciar"
        >
          <RotateCcw size={13} />
        </button>
        <button
          className={`timer-btn ${showConfig ? 'active' : ''}`}
          onClick={() => setShowConfig(s => !s)}
          title="Configurar"
        >
          <Timer size={13} />
        </button>
      </div>

      {/* Popover Settings */}
      {showConfig && (
        <div className="timer-popover" ref={popoverRef}>
          {/* Mode Switcher */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 'var(--space-md)' }}>
            <button
              className={`btn ${mode === 'stopwatch' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1, fontSize: '10px' }}
              onClick={handleSetStopwatch}
            >
              <ArrowUp size={12} />
              CRESCENTE
            </button>
            <button
              className={`btn ${mode === 'countdown' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1, fontSize: '10px' }}
              onClick={() => setMode('countdown')}
            >
              <ArrowDown size={12} />
              REGRESSIVO
            </button>
          </div>

          {/* Time Picker for Countdown */}
          {mode === 'countdown' && (
            <>
              <div style={{
                display: 'flex',
                gap: 'var(--space-sm)',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 'var(--space-md)'
              }}>
                {/* Hours picker */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <button className="timer-btn" onClick={() => adjustH(1)}><ChevronUp size={13} /></button>
                  <div style={{
                    fontFamily: 'Rajdhani, monospace',
                    fontSize: '28px',
                    fontWeight: 700,
                    color: 'var(--foreground)',
                    lineHeight: 1,
                    width: '52px',
                    textAlign: 'center',
                    border: '1px solid var(--border)',
                    padding: '4px 0',
                    background: '#000',
                  }}>
                    {pad(configH)}
                  </div>
                  <button className="timer-btn" onClick={() => adjustH(-1)}><ChevronDown size={13} /></button>
                </div>

                <span style={{ fontFamily: 'Rajdhani', fontSize: '24px', fontWeight: 700, color: 'var(--muted-foreground)' }}>:</span>

                {/* Minutes picker */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <button className="timer-btn" onClick={() => adjustM(1)}><ChevronUp size={13} /></button>
                  <div style={{
                    fontFamily: 'Rajdhani, monospace',
                    fontSize: '28px',
                    fontWeight: 700,
                    color: 'var(--foreground)',
                    lineHeight: 1,
                    width: '52px',
                    textAlign: 'center',
                    border: '1px solid var(--border)',
                    padding: '4px 0',
                    background: '#000',
                  }}>
                    {pad(configM)}
                  </div>
                  <button className="timer-btn" onClick={() => adjustM(-1)}><ChevronDown size={13} /></button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignSelf: 'flex-end', paddingBottom: '2px' }}>
                  <span style={{ fontFamily: 'Rajdhani', fontSize: '10px', color: 'var(--muted-foreground)', letterSpacing: '0.06em' }}>HORAS</span>
                  <span style={{ fontFamily: 'Rajdhani', fontSize: '10px', color: 'var(--muted-foreground)', letterSpacing: '0.06em' }}>MIN</span>
                </div>
              </div>

              <button
                className="btn btn-primary btn-block"
                onClick={handleApplyCountdown}
                disabled={configH === 0 && configM === 0}
              >
                DEFINIR TEMPO
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
