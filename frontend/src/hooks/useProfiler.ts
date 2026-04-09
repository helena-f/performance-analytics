import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  CpuSample, MemorySample, IoSample, EnergySample,
  StackSample, SwiftUIIssue, FlameNode, ProfileEvent,
} from '../types';
import { buildFlameGraph } from '../utils/flamegraph';

const MAX_SAMPLES = 600; // ~2.5 minutes at 4Hz
const API_BASE = import.meta.env.DEV ? '' : 'https://perfscope-api.fly.dev';
const WS_BASE = import.meta.env.DEV
  ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
  : 'wss://perfscope-api.fly.dev';

export interface ProfilerState {
  isRecording: boolean;
  sessionId: string | null;
  cpuSamples: CpuSample[];
  memorySamples: MemorySample[];
  ioSamples: IoSample[];
  energySamples: EnergySample[];
  stackSamples: StackSample[];
  swiftUIIssues: SwiftUIIssue[];
  flameGraph: FlameNode | null;
  elapsed: number;
}

export function useProfiler() {
  const wsRef = useRef<WebSocket | null>(null);
  const [state, setState] = useState<ProfilerState>({
    isRecording: false,
    sessionId: null,
    cpuSamples: [],
    memorySamples: [],
    ioSamples: [],
    energySamples: [],
    stackSamples: [],
    swiftUIIssues: [],
    flameGraph: null,
    elapsed: 0,
  });

  const elapsedRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  const startRecording = useCallback(() => {
    const ws = new WebSocket(`${WS_BASE}/ws/profile`);
    wsRef.current = ws;

    ws.onopen = () => {
      setState(prev => ({ ...prev, isRecording: true }));
      elapsedRef.current = 0;
      timerRef.current = window.setInterval(() => {
        elapsedRef.current += 0.25;
        setState(prev => ({ ...prev, elapsed: elapsedRef.current }));
      }, 250);
    };

    ws.onmessage = (event) => {
      const msg: ProfileEvent = JSON.parse(event.data);

      setState(prev => {
        switch (msg.type) {
          case 'CpuUpdate':
            return {
              ...prev,
              cpuSamples: [...prev.cpuSamples.slice(-MAX_SAMPLES), msg.data],
            };
          case 'MemoryUpdate':
            return {
              ...prev,
              memorySamples: [...prev.memorySamples.slice(-MAX_SAMPLES), msg.data],
            };
          case 'IoUpdate':
            return {
              ...prev,
              ioSamples: [...prev.ioSamples.slice(-MAX_SAMPLES), msg.data],
            };
          case 'EnergyUpdate':
            return {
              ...prev,
              energySamples: [...prev.energySamples.slice(-MAX_SAMPLES), msg.data],
            };
          case 'StackCapture':
            return {
              ...prev,
              stackSamples: [...prev.stackSamples.slice(-MAX_SAMPLES), msg.data],
            };
          case 'SwiftUIIssue':
            return {
              ...prev,
              swiftUIIssues: [...prev.swiftUIIssues, msg.data],
            };
          case 'SessionStarted':
            return {
              ...prev,
              sessionId: msg.data.session_id,
            };
          default:
            return prev;
        }
      });
    };

    ws.onclose = () => {
      setState(prev => ({ ...prev, isRecording: false }));
      if (timerRef.current) clearInterval(timerRef.current);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  const stopRecording = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setState(prev => ({ ...prev, isRecording: false }));
  }, []);

  const clearSession = useCallback(() => {
    stopRecording();
    setState({
      isRecording: false,
      sessionId: null,
      cpuSamples: [],
      memorySamples: [],
      ioSamples: [],
      energySamples: [],
      stackSamples: [],
      swiftUIIssues: [],
      flameGraph: null,
      elapsed: 0,
    });
  }, [stopRecording]);

  const fetchFlameGraph = useCallback(async () => {
    // Build flame graph from collected stack samples (live data)
    setState(prev => {
      if (prev.stackSamples.length === 0) return prev;
      const flame = buildFlameGraph(prev.stackSamples);
      return { ...prev, flameGraph: flame };
    });
  }, []);

  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return {
    ...state,
    startRecording,
    stopRecording,
    clearSession,
    fetchFlameGraph,
  };
}
