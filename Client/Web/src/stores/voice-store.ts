import { create } from 'zustand';

export interface AudioDeviceInfo {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'audiooutput';
}

export interface VoiceParticipant {
  userId: string;
  isSpeaking: boolean;
  isMuted: boolean;
}

interface VoiceStore {
  // 연결 상태
  isConnected: boolean;
  setConnected: (connected: boolean) => void;

  // 송신 권한 (호스트 또는 allowGuestVoice일 때 true)
  canTransmit: boolean;
  setCanTransmit: (canTransmit: boolean) => void;

  // 캡처 상태
  isCapturing: boolean;
  setCapturing: (capturing: boolean) => void;

  // 마이크 레벨 (0.0 ~ 1.0)
  micLevel: number;
  setMicLevel: (level: number) => void;

  // 장치 목록
  inputDevices: AudioDeviceInfo[];
  outputDevices: AudioDeviceInfo[];
  setInputDevices: (devices: AudioDeviceInfo[]) => void;
  setOutputDevices: (devices: AudioDeviceInfo[]) => void;

  // 선택된 장치
  selectedInputDeviceId: string;
  selectedOutputDeviceId: string;
  setSelectedInputDeviceId: (deviceId: string) => void;
  setSelectedOutputDeviceId: (deviceId: string) => void;

  // 참가자 음성 상태
  voiceParticipants: Map<string, VoiceParticipant>;
  setParticipantSpeaking: (userId: string, isSpeaking: boolean) => void;
  setParticipantMuted: (userId: string, isMuted: boolean) => void;
  removeVoiceParticipant: (userId: string) => void;
  clearVoiceParticipants: () => void;

  // 에러
  error: string | null;
  setError: (error: string | null) => void;

  // 리셋
  reset: () => void;
}

const initialState = {
  isConnected: false,
  canTransmit: true,
  isCapturing: false,
  micLevel: 0,
  inputDevices: [] as AudioDeviceInfo[],
  outputDevices: [] as AudioDeviceInfo[],
  selectedInputDeviceId: 'default',
  selectedOutputDeviceId: 'default',
  voiceParticipants: new Map<string, VoiceParticipant>(),
  error: null as string | null,
};

export const useVoiceStore = create<VoiceStore>((set, get) => ({
  ...initialState,

  setConnected: (connected) => set({ isConnected: connected }),
  setCanTransmit: (canTransmit) => set({ canTransmit }),
  setCapturing: (capturing) => set({ isCapturing: capturing }),
  setMicLevel: (level) => set({ micLevel: level }),

  setInputDevices: (devices) => set({ inputDevices: devices }),
  setOutputDevices: (devices) => set({ outputDevices: devices }),

  setSelectedInputDeviceId: (deviceId) => set({ selectedInputDeviceId: deviceId }),
  setSelectedOutputDeviceId: (deviceId) => set({ selectedOutputDeviceId: deviceId }),

  setParticipantSpeaking: (userId, isSpeaking) => {
    const { voiceParticipants } = get();
    const updated = new Map(voiceParticipants);
    const existing = updated.get(userId) || { userId, isSpeaking: false, isMuted: false };
    updated.set(userId, { ...existing, isSpeaking });
    set({ voiceParticipants: updated });
  },

  setParticipantMuted: (userId, isMuted) => {
    const { voiceParticipants } = get();
    const updated = new Map(voiceParticipants);
    const existing = updated.get(userId) || { userId, isSpeaking: false, isMuted: false };
    updated.set(userId, { ...existing, isMuted });
    set({ voiceParticipants: updated });
  },

  removeVoiceParticipant: (userId) => {
    const { voiceParticipants } = get();
    const updated = new Map(voiceParticipants);
    updated.delete(userId);
    set({ voiceParticipants: updated });
  },

  clearVoiceParticipants: () => set({ voiceParticipants: new Map() }),

  setError: (error) => set({ error }),

  reset: () => set({ ...initialState, voiceParticipants: new Map() }),
}));
