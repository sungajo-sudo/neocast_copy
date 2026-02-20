/**
 * Playback AudioWorklet Processor
 *
 * Receives Int16 PCM frames from the Worker (via workerPort) or main thread (via port),
 * buffers them in a jitter buffer (min 4 / max 12 frames),
 * converts Int16 → Float32 and outputs to the speaker.
 * Outputs silence on buffer underrun.
 *
 * Worker 모드: MessageChannel port에서 직접 프레임 수신 (메인 스레드 우회)
 * Fallback: 기존처럼 port.onmessage로 메인 스레드에서 수신
 */
class PlaybackProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.FRAME_SIZE = 960; // 20ms @ 48kHz
    this.MIN_BUFFER = 4;   // 80ms  (메인 스레드 블로킹 생존)
    this.MAX_BUFFER = 12;  // 240ms (Worker 이전 후에도 방어적 유지)

    // Ring buffer of Float32 frames
    this.frameQueue = [];
    this.currentFrame = null;
    this.currentOffset = 0;
    this.active = true;
    this.buffering = true; // Start in buffering mode

    // Worker와 직접 통신할 MessagePort (없으면 메인 스레드 fallback)
    this.workerPort = null;

    // 프레임 수신 핸들러 (port와 workerPort 모두 동일 로직)
    const handleFrame = (event) => {
      if (event.data.type === 'frame') {
        const int16 = new Int16Array(event.data.pcm);
        const float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) {
          float32[i] = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7FFF);
        }

        // Drop oldest frames if buffer is full
        if (this.frameQueue.length >= this.MAX_BUFFER) {
          this.frameQueue.shift();
        }
        this.frameQueue.push(float32);

        // Exit buffering mode once we have enough frames
        if (this.buffering && this.frameQueue.length >= this.MIN_BUFFER) {
          this.buffering = false;
        }
      } else if (event.data.type === 'stop') {
        this.active = false;
      }
    };

    this.port.onmessage = (event) => {
      if (event.data.type === 'set-worker-port') {
        // 메인 스레드로부터 Worker 연결용 MessagePort 수신
        this.workerPort = event.data.port;
        this.workerPort.onmessage = handleFrame;
      } else {
        // 일반 메시지 (fallback 또는 stop)
        handleFrame(event);
      }
    };
  }

  process(inputs, outputs) {
    if (!this.active) return false;

    const output = outputs[0];
    if (!output || !output[0]) return true;

    const outputChannel = output[0];

    // If still buffering, output silence
    if (this.buffering) {
      outputChannel.fill(0);
      return true;
    }

    let outputOffset = 0;

    while (outputOffset < outputChannel.length) {
      // Get current frame if we don't have one
      if (!this.currentFrame) {
        if (this.frameQueue.length > 0) {
          this.currentFrame = this.frameQueue.shift();
          this.currentOffset = 0;
        } else {
          // Buffer underrun - output silence for the rest
          outputChannel.fill(0, outputOffset);
          this.buffering = true; // Re-enter buffering mode
          return true;
        }
      }

      const remaining = this.currentFrame.length - this.currentOffset;
      const needed = outputChannel.length - outputOffset;
      const toCopy = Math.min(remaining, needed);

      outputChannel.set(
        this.currentFrame.subarray(this.currentOffset, this.currentOffset + toCopy),
        outputOffset
      );

      this.currentOffset += toCopy;
      outputOffset += toCopy;

      // Frame exhausted
      if (this.currentOffset >= this.currentFrame.length) {
        this.currentFrame = null;
        this.currentOffset = 0;
      }
    }

    return true;
  }
}

registerProcessor('playback-processor', PlaybackProcessor);
