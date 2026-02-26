import { create } from 'zustand';
import { neosmartpenService } from '../services/neosmartpen.service';
import { type DotData, type NcodePageAddress, formatPageAddress } from '../services/pen-protocol';

interface PenStore {
  // Connection state
  isAvailable: boolean;
  isConnecting: boolean;
  isConnected: boolean;
  isAuthenticated: boolean;
  needsPassword: boolean;
  passwordRetryCount: number;
  passwordMaxRetryCount: number;

  // Device info
  deviceName: string;
  macAddress: string;
  firmwareVersion: string;
  protocolVersion: string;
  battery: number;
  maxForce: number;

  // Current page from pen
  currentPenPageAddress: NcodePageAddress | null;

  // Log messages
  logMessages: string[];

  // Actions
  checkAvailability: () => Promise<boolean>;
  connect: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  inputPassword: (password: string) => void;
  clearLogs: () => void;
}

export const usePenStore = create<PenStore>((set) => {
  // Set up event handlers
  neosmartpenService.onConnected((data) => {
    set({
      isConnecting: false,
      isConnected: true,
      deviceName: data.deviceName,
      macAddress: data.macAddress,
      firmwareVersion: data.firmwareVersion,
      protocolVersion: data.protocolVersion,
      maxForce: data.maxForce,
    });
  });

  neosmartpenService.onDisconnected(() => {
    set({
      isConnected: false,
      isAuthenticated: false,
      needsPassword: false,
      deviceName: '',
      macAddress: '',
      firmwareVersion: '',
      protocolVersion: '',
      battery: -1,
      maxForce: -1,
      currentPenPageAddress: null,
    });
  });

  neosmartpenService.onAuthenticated(() => {
    set({
      isAuthenticated: true,
      needsPassword: false,
    });
  });

  neosmartpenService.onPasswordRequested((retryCount, maxRetryCount) => {
    set({
      needsPassword: true,
      passwordRetryCount: retryCount,
      passwordMaxRetryCount: maxRetryCount,
    });
  });

  neosmartpenService.onBattery((battery) => {
    set({ battery });
  });

  neosmartpenService.onLog((message) => {
    set((state) => ({
      logMessages: [...state.logMessages.slice(-99), message], // Keep last 100 messages
    }));
  });

  neosmartpenService.onDot((dot: DotData) => {
    // Update current pen page address when receiving dots
    if (dot.section >= 0) {
      set({
        currentPenPageAddress: {
          section: dot.section,
          owner: dot.owner,
          book: dot.book,
          page: dot.page,
        },
      });
    }
  });

  return {
    // Initial state
    isAvailable: false,
    isConnecting: false,
    isConnected: false,
    isAuthenticated: false,
    needsPassword: false,
    passwordRetryCount: 0,
    passwordMaxRetryCount: 0,

    deviceName: '',
    macAddress: '',
    firmwareVersion: '',
    protocolVersion: '',
    battery: -1,
    maxForce: -1,

    currentPenPageAddress: null,

    logMessages: [],

    checkAvailability: async () => {
      const isAvailable = await neosmartpenService.isAvailable();
      set({ isAvailable });
      return isAvailable;
    },

    connect: async () => {
      set({ isConnecting: true });
      const success = await neosmartpenService.connect();
      if (!success) {
        set({ isConnecting: false });
      }
      return success;
    },

    disconnect: async () => {
      await neosmartpenService.disconnect();
    },

    inputPassword: (password: string) => {
      neosmartpenService.inputPassword(password);
    },

    clearLogs: () => {
      set({ logMessages: [] });
    },
  };
});

// Export helper for formatting page address
export { formatPageAddress };
