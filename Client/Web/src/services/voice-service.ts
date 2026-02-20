import { useVoiceStore, type AudioDeviceInfo } from '../stores/voice-store';
import { usePanelStore } from '../stores/panel-store';
import VoiceSocketWorker from '../workers/voice-socket.worker?worker';

const SAMPLE_RATE = 48000;

/**
 * 음성 서비스 (Web Worker 기반)
 *
 * Socket.IO /voice 연결은 별도 Worker에서 실행되며,
 * AudioWorklet ↔ Worker 간 MessageChannel로 직접 통신한다.
 * 메인 스레드는 getUserMedia, AudioContext 생성, UI 상태 업데이트만 담당한다.
 *
 * [CaptureProcessor] ←MessageChannel→ [VoiceWorker] ←Socket.IO→ [Server]
 * [PlaybackProcessor] ←MessageChannel→ [VoiceWorker]
 * Main Thread: getUserMedia, device enum, UI updates
 */
class VoiceService {
  private worker: Worker | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private captureNode: AudioWorkletNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;

  // CaptureProcessor ↔ Worker 직접 통신용 MessageChannel
  private captureChannel: MessageChannel | null = null;

  // 수신: 발신자별 PlaybackNode 관리
  private playbackNodes: Map<string, AudioWorkletNode> = new Map();
  // Playback AudioWorklet ↔ Worker 직접 통신용 MessageChannel (senderId별)
  private playbackChannels: Map<string, MessageChannel> = new Map();
  private playbackContextReady = false;

  // 장치 변경 감지
  private deviceChangeHandler: (() => void) | null = null;

  // Screen Wake Lock (모바일 화면 꺼짐 방지)
  private wakeLock: WakeLockSentinel | null = null;
  private visibilityHandler: (() => void) | null = null;

  /**
   * Worker 생성 및 음성 소켓 연결
   */
  connect(serverUrl: string, auth: Record<string, unknown>, query: Record<string, unknown>): void {
    if (this.worker) return;

    this.worker = new VoiceSocketWorker();
    this.setupWorkerHandlers();

    // Worker에서 Socket.IO 연결 시작
    this.worker.postMessage({
      type: 'connect',
      url: serverUrl,
      auth,
      query,
    });

    this.enumerateDevices();
    this.startDeviceChangeListener();
    this.initPlaybackContext();

    console.log('[VoiceService] Worker created, connecting...');
  }

  /**
   * 수신용 AudioContext 초기화 (송신 권한 없어도 듣기 가능)
   */
  private async initPlaybackContext(): Promise<void> {
    try {
      if (!this.audioContext) {
        this.audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
      }
      if (!this.playbackContextReady) {
        await this.audioContext.audioWorklet.addModule('/audio-worklets/capture-processor.js');
        await this.audioContext.audioWorklet.addModule('/audio-worklets/playback-processor.js');
        this.playbackContextReady = true;
      }
    } catch (error) {
      console.warn('[VoiceService] Failed to init playback context:', error);
    }
  }

  /**
   * 연결 해제 및 리소스 정리
   */
  disconnect(): void {
    this.stopCapture();
    this.cleanupPlayback();
    this.stopDeviceChangeListener();
    this.releaseWakeLock();

    if (this.worker) {
      this.worker.postMessage({ type: 'disconnect' });
      this.worker.terminate();
      this.worker = null;
    }

    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    this.playbackContextReady = false;
    useVoiceStore.getState().reset();
    console.log('[VoiceService] Disconnected');
  }

  // ============================================
  // Worker 메시지 핸들러
  // ============================================

  private setupWorkerHandlers(): void {
    if (!this.worker) return;

    this.worker.onmessage = (event: MessageEvent) => {
      const msg = event.data;
      const store = useVoiceStore.getState();

      switch (msg.type) {
        case 'connected':
          store.setConnected(true);
          console.log('[VoiceService] Worker connected');
          break;

        case 'disconnected':
          store.setConnected(false);
          console.log('[VoiceService] Worker disconnected:', msg.reason);
          break;

        case 'connect_error':
          console.error('[VoiceService] Worker connect error:', msg.message);
          break;

        case 'voice:ready':
          if (msg.config?.canTransmit !== undefined) {
            store.setCanTransmit(msg.config.canTransmit);
          }
          console.log('[VoiceService] Voice ready:', msg.config);
          break;

        case 'voice:start':
          store.setParticipantSpeaking(msg.data.userId, true);
          break;

        case 'voice:end':
          store.setParticipantSpeaking(msg.data.userId, false);
          this.removePlaybackNode(msg.data.userId);
          break;

        case 'voice:mute':
          store.setParticipantMuted(msg.data.userId, true);
          break;

        case 'voice:unmute':
          store.setParticipantMuted(msg.data.userId, false);
          break;

        case 'mic-level':
          store.setMicLevel(Math.min(1, msg.rms * 5));
          break;

        case 'new-sender':
          // 새로운 발신자 → PlaybackNode 생성 후 port를 Worker에 전달
          this.handleNewSender(msg.senderId, msg.data, msg.timestamp);
          break;
      }
    };
  }

  // ============================================
  // Capture Pipeline
  // ============================================

  /**
   * 마이크 캡처 시작
   */
  async startCapture(): Promise<boolean> {
    const store = useVoiceStore.getState();
    if (store.isCapturing) return true;

    if (!store.canTransmit) {
      store.setError('voice_transmit_not_allowed');
      return false;
    }

    if (!navigator.mediaDevices) {
      store.setError('voice_requires_secure_context');
      return false;
    }

    try {
      store.setError(null);

      // AudioContext 생성 (한번만)
      if (!this.audioContext) {
        this.audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
      }

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // AudioWorklet 모듈 로드 (한번만)
      if (!this.playbackContextReady) {
        await this.audioContext.audioWorklet.addModule('/audio-worklets/capture-processor.js');
        await this.audioContext.audioWorklet.addModule('/audio-worklets/playback-processor.js');
        this.playbackContextReady = true;
      }

      // getUserMedia
      const deviceId = store.selectedInputDeviceId;
      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: deviceId !== 'default' ? { exact: deviceId } : undefined,
          sampleRate: SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      };

      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Capture AudioWorkletNode
      this.captureNode = new AudioWorkletNode(this.audioContext, 'capture-processor');

      // MessageChannel로 CaptureProcessor ↔ Worker 직접 연결
      this.captureChannel = new MessageChannel();

      // port1 → Worker에 전달
      if (this.worker) {
        this.worker.postMessage(
          { type: 'set-capture-port', port: this.captureChannel.port1 },
          [this.captureChannel.port1]
        );
      }

      // port2 → CaptureProcessor AudioWorklet에 전달
      this.captureNode.port.postMessage(
        { type: 'set-worker-port', port: this.captureChannel.port2 },
        [this.captureChannel.port2]
      );

      this.sourceNode.connect(this.captureNode);
      // captureNode → 스피커로 연결하지 않음 (자기 음성 에코 방지)
      // 대신 GainNode(0)으로 라우팅하여 프로세서가 동작하도록 함
      const silentGain = this.audioContext.createGain();
      silentGain.gain.value = 0;
      this.captureNode.connect(silentGain);
      silentGain.connect(this.audioContext.destination);

      // 서버에 voice:start 알림 (Worker 경유)
      this.workerEmit('voice:start');
      this.workerEmit('voice:unmute');

      store.setCapturing(true);
      usePanelStore.getState().setMicOn(true);

      // 모바일 화면 꺼짐 방지
      this.acquireWakeLock();

      console.log('[VoiceService] Capture started (Worker pipeline)');
      return true;
    } catch (error) {
      console.error('[VoiceService] Failed to start capture:', error);
      const message = error instanceof DOMException && error.name === 'NotAllowedError'
        ? 'microphone_permission_denied'
        : 'microphone_error';
      store.setError(message);
      store.setCapturing(false);
      usePanelStore.getState().setMicOn(false);
      return false;
    }
  }

  /**
   * 마이크 캡처 중지
   */
  stopCapture(): void {
    if (this.captureNode) {
      this.captureNode.port.postMessage({ type: 'stop' });
      this.captureNode.disconnect();
      this.captureNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    this.captureChannel = null;

    // 서버에 voice:end 알림 (Worker 경유)
    this.workerEmit('voice:end');
    this.workerEmit('voice:mute');

    // 화면 꺼짐 방지 해제
    this.releaseWakeLock();

    const store = useVoiceStore.getState();
    store.setCapturing(false);
    store.setMicLevel(0);
    usePanelStore.getState().setMicOn(false);
    console.log('[VoiceService] Capture stopped');
  }

  /**
   * 마이크 토글
   */
  async toggleCapture(): Promise<boolean> {
    const store = useVoiceStore.getState();
    if (store.isCapturing) {
      this.stopCapture();
      return false;
    } else {
      return this.startCapture();
    }
  }

  // ============================================
  // Playback Pipeline
  // ============================================

  /**
   * 새 발신자 감지 시 PlaybackNode 생성 및 Worker에 port 전달
   */
  private handleNewSender(senderId: string, firstFrameData: ArrayBuffer, _timestamp: number): void {
    const node = this.getOrCreatePlaybackNode(senderId);
    if (!node) return;

    // 첫 프레임은 Worker가 아직 port를 받기 전에 도착했으므로 직접 전달
    const channel = this.playbackChannels.get(senderId);
    if (channel) {
      // Worker port를 통해 이미 전달되므로 추가 작업 불필요
      // 하지만 첫 프레임은 Worker에서 직접 전달 못했으므로 메인스레드에서 전달
      node.port.postMessage(
        { type: 'frame', pcm: firstFrameData },
        [firstFrameData]
      );
    }
  }

  /**
   * 특정 발신자의 PlaybackNode 생성/반환
   */
  private getOrCreatePlaybackNode(senderId: string): AudioWorkletNode | null {
    if (!this.audioContext || !this.playbackContextReady) return null;

    let node = this.playbackNodes.get(senderId);
    if (node) return node;

    try {
      node = new AudioWorkletNode(this.audioContext, 'playback-processor');

      // 스피커 출력 장치 설정
      const outputDeviceId = useVoiceStore.getState().selectedOutputDeviceId;
      if (outputDeviceId !== 'default' && 'setSinkId' in this.audioContext) {
        (this.audioContext as AudioContext & { setSinkId: (id: string) => Promise<void> })
          .setSinkId(outputDeviceId)
          .catch((err) => console.warn('[VoiceService] setSinkId failed:', err));
      }

      node.connect(this.audioContext.destination);
      this.playbackNodes.set(senderId, node);

      // MessageChannel로 PlaybackProcessor ↔ Worker 직접 연결
      const channel = new MessageChannel();
      this.playbackChannels.set(senderId, channel);

      // port1 → Worker에 전달
      if (this.worker) {
        this.worker.postMessage(
          { type: 'set-playback-port', senderId, port: channel.port1 },
          [channel.port1]
        );
      }

      // port2 → PlaybackProcessor AudioWorklet에 전달
      // PlaybackProcessor는 port2에서 직접 프레임을 수신한다
      node.port.postMessage(
        { type: 'set-worker-port', port: channel.port2 },
        [channel.port2]
      );

      return node;
    } catch (error) {
      console.error('[VoiceService] Failed to create playback node:', error);
      return null;
    }
  }

  /**
   * 모든 재생 노드 정리
   */
  private cleanupPlayback(): void {
    for (const [senderId, node] of this.playbackNodes) {
      node.port.postMessage({ type: 'stop' });
      node.disconnect();
      this.worker?.postMessage({ type: 'remove-playback-port', senderId });
    }
    this.playbackNodes.clear();
    this.playbackChannels.clear();
  }

  /**
   * 특정 발신자의 재생 노드 제거
   */
  private removePlaybackNode(senderId: string): void {
    const node = this.playbackNodes.get(senderId);
    if (node) {
      node.port.postMessage({ type: 'stop' });
      node.disconnect();
      this.playbackNodes.delete(senderId);
      this.playbackChannels.delete(senderId);
      this.worker?.postMessage({ type: 'remove-playback-port', senderId });
    }
  }

  // ============================================
  // Worker 유틸리티
  // ============================================

  /**
   * Worker를 통해 소켓 이벤트 전송
   */
  private workerEmit(event: string, data?: unknown): void {
    if (this.worker) {
      this.worker.postMessage({ type: 'emit', event, data });
    }
  }

  // ============================================
  // Screen Wake Lock (모바일 화면 꺼짐 방지)
  // ============================================

  /**
   * Screen Wake Lock 획득
   * 음성 통화 중 모바일 기기의 화면 꺼짐을 방지한다.
   */
  private async acquireWakeLock(): Promise<void> {
    if (!('wakeLock' in navigator)) return;

    try {
      this.wakeLock = await navigator.wakeLock.request('screen');
      this.wakeLock.addEventListener('release', () => {
        this.wakeLock = null;
      });
      console.log('[VoiceService] Wake lock acquired');
    } catch (error) {
      console.warn('[VoiceService] Wake lock request failed:', error);
    }

    // 페이지가 다시 보일 때 wake lock 재획득 (탭 전환 등으로 해제된 경우)
    if (!this.visibilityHandler) {
      this.visibilityHandler = () => {
        if (document.visibilityState === 'visible' && useVoiceStore.getState().isCapturing) {
          this.acquireWakeLock();
        }
      };
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }
  }

  /**
   * Screen Wake Lock 해제
   */
  private async releaseWakeLock(): Promise<void> {
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }

    if (this.wakeLock) {
      await this.wakeLock.release().catch(() => {});
      this.wakeLock = null;
      console.log('[VoiceService] Wake lock released');
    }
  }

  // ============================================
  // Device Management
  // ============================================

  /**
   * 오디오 장치 열거
   */
  async enumerateDevices(): Promise<void> {
    if (!navigator.mediaDevices) {
      console.warn('[VoiceService] mediaDevices not available (non-secure context?)');
      return;
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const store = useVoiceStore.getState();

      const inputDevices: AudioDeviceInfo[] = devices
        .filter((d) => d.kind === 'audioinput')
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${d.deviceId.slice(0, 8)}`,
          kind: 'audioinput' as const,
        }));

      const outputDevices: AudioDeviceInfo[] = devices
        .filter((d) => d.kind === 'audiooutput')
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Speaker ${d.deviceId.slice(0, 8)}`,
          kind: 'audiooutput' as const,
        }));

      store.setInputDevices(inputDevices);
      store.setOutputDevices(outputDevices);
    } catch (error) {
      console.error('[VoiceService] Failed to enumerate devices:', error);
    }
  }

  /**
   * 입력 장치 변경
   */
  async switchInputDevice(deviceId: string): Promise<void> {
    useVoiceStore.getState().setSelectedInputDeviceId(deviceId);
    const wasCapturing = useVoiceStore.getState().isCapturing;
    if (wasCapturing) {
      this.stopCapture();
      await this.startCapture();
    }
  }

  /**
   * 출력 장치 변경
   */
  async switchOutputDevice(deviceId: string): Promise<void> {
    useVoiceStore.getState().setSelectedOutputDeviceId(deviceId);
    if (this.audioContext && 'setSinkId' in this.audioContext) {
      try {
        await (this.audioContext as AudioContext & { setSinkId: (id: string) => Promise<void> })
          .setSinkId(deviceId);
      } catch (err) {
        console.warn('[VoiceService] setSinkId failed:', err);
      }
    }
  }

  /**
   * 장치 핫플러그 감지 시작
   */
  private startDeviceChangeListener(): void {
    if (!navigator.mediaDevices) return;
    this.deviceChangeHandler = () => {
      this.enumerateDevices();
    };
    navigator.mediaDevices.addEventListener('devicechange', this.deviceChangeHandler);
  }

  /**
   * 장치 핫플러그 감지 중지
   */
  private stopDeviceChangeListener(): void {
    if (this.deviceChangeHandler && navigator.mediaDevices) {
      navigator.mediaDevices.removeEventListener('devicechange', this.deviceChangeHandler);
      this.deviceChangeHandler = null;
    }
  }

  // ============================================
  // Test Utilities (for Settings UI)
  // ============================================

  /**
   * 마이크 테스트 (3초 녹음 → 재생)
   */
  async testMicrophone(onLevel?: (level: number) => void): Promise<void> {
    const store = useVoiceStore.getState();
    const deviceId = store.selectedInputDeviceId;

    const testContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    await testContext.audioWorklet.addModule('/audio-worklets/capture-processor.js');

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: deviceId !== 'default' ? { exact: deviceId } : undefined,
        sampleRate: SAMPLE_RATE,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const source = testContext.createMediaStreamSource(stream);
    const captureNode = new AudioWorkletNode(testContext, 'capture-processor');
    const recordedFrames: Float32Array[] = [];

    const silentGain = testContext.createGain();
    silentGain.gain.value = 0;
    captureNode.connect(silentGain);
    silentGain.connect(testContext.destination);

    captureNode.port.onmessage = (event) => {
      if (event.data.type === 'frame') {
        const int16 = new Int16Array(event.data.pcm);
        const float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) {
          float32[i] = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7FFF);
        }
        recordedFrames.push(float32);
        onLevel?.(Math.min(1, event.data.rms * 5));
      }
    };

    source.connect(captureNode);

    // 3초 녹음
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // 정리
    captureNode.port.postMessage({ type: 'stop' });
    captureNode.disconnect();
    source.disconnect();
    stream.getTracks().forEach((t) => t.stop());

    // 재생
    if (recordedFrames.length > 0) {
      const totalLength = recordedFrames.reduce((sum, f) => sum + f.length, 0);
      const buffer = testContext.createBuffer(1, totalLength, SAMPLE_RATE);
      const channelData = buffer.getChannelData(0);
      let offset = 0;
      for (const frame of recordedFrames) {
        channelData.set(frame, offset);
        offset += frame.length;
      }

      const bufferSource = testContext.createBufferSource();
      bufferSource.buffer = buffer;
      bufferSource.connect(testContext.destination);
      bufferSource.start();

      await new Promise((resolve) => {
        bufferSource.onended = resolve;
      });
    }

    await testContext.close();
  }

  /**
   * 스피커 테스트 (440Hz 톤 1초)
   */
  async testSpeaker(): Promise<void> {
    const store = useVoiceStore.getState();
    const testContext = new AudioContext({ sampleRate: SAMPLE_RATE });

    // 출력 장치 설정
    const outputDeviceId = store.selectedOutputDeviceId;
    if (outputDeviceId !== 'default' && 'setSinkId' in testContext) {
      await (testContext as AudioContext & { setSinkId: (id: string) => Promise<void> })
        .setSinkId(outputDeviceId)
        .catch(() => {});
    }

    const oscillator = testContext.createOscillator();
    const gainNode = testContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = 440;
    gainNode.gain.value = 0.3;

    // Fade in/out to avoid click
    gainNode.gain.setValueAtTime(0, testContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, testContext.currentTime + 0.05);
    gainNode.gain.setValueAtTime(0.3, testContext.currentTime + 0.95);
    gainNode.gain.linearRampToValueAtTime(0, testContext.currentTime + 1.0);

    oscillator.connect(gainNode);
    gainNode.connect(testContext.destination);
    oscillator.start();
    oscillator.stop(testContext.currentTime + 1.0);

    await new Promise((resolve) => {
      oscillator.onended = resolve;
    });

    await testContext.close();
  }

  /**
   * 연결 상태 확인
   */
  isConnected(): boolean {
    return useVoiceStore.getState().isConnected;
  }
}

// 싱글톤 인스턴스
export const voiceService = new VoiceService();
