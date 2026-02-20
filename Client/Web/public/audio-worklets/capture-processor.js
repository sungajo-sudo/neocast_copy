/**
 * Capture AudioWorklet Processor
 *
 * Accumulates 128-sample input blocks into 960-sample (20ms @ 48kHz) frames,
 * converts Float32 → Int16 PCM, calculates RMS for level metering,
 * and posts the frame to the Worker (via workerPort) or main thread (via port).
 *
 * Worker 모드: MessageChannel port로 직접 Worker에 전달 (메인 스레드 우회)
 * Fallback: 기존처럼 port.postMessage로 메인 스레드에 전달
 */
class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // 960 samples = 20ms @ 48kHz
    this.FRAME_SIZE = 960;
    this.buffer = new Float32Array(this.FRAME_SIZE);
    this.bufferOffset = 0;
    this.active = true;

    // Worker와 직접 통신할 MessagePort (없으면 메인 스레드 fallback)
    this.workerPort = null;

    this.port.onmessage = (event) => {
      if (event.data.type === 'stop') {
        this.active = false;
      } else if (event.data.type === 'set-worker-port') {
        // 메인 스레드로부터 Worker 연결용 MessagePort 수신
        this.workerPort = event.data.port;
      }
    };
  }

  process(inputs) {
    if (!this.active) return false;

    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0]; // mono channel
    let offset = 0;

    while (offset < channelData.length) {
      const remaining = this.FRAME_SIZE - this.bufferOffset;
      const available = channelData.length - offset;
      const toCopy = Math.min(remaining, available);

      this.buffer.set(channelData.subarray(offset, offset + toCopy), this.bufferOffset);
      this.bufferOffset += toCopy;
      offset += toCopy;

      if (this.bufferOffset >= this.FRAME_SIZE) {
        // Calculate RMS
        let sumSquares = 0;
        for (let i = 0; i < this.FRAME_SIZE; i++) {
          sumSquares += this.buffer[i] * this.buffer[i];
        }
        const rms = Math.sqrt(sumSquares / this.FRAME_SIZE);

        // Convert Float32 → Int16 PCM
        const pcm = new Int16Array(this.FRAME_SIZE);
        for (let i = 0; i < this.FRAME_SIZE; i++) {
          const s = Math.max(-1, Math.min(1, this.buffer[i]));
          pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        const frameMsg = { type: 'frame', pcm: pcm.buffer, rms };

        if (this.workerPort) {
          // Worker에 직접 전달 (메인 스레드 완전 우회)
          this.workerPort.postMessage(frameMsg, [pcm.buffer]);
        } else {
          // Fallback: 메인 스레드로 전달
          this.port.postMessage(frameMsg, [pcm.buffer]);
        }

        this.bufferOffset = 0;
      }
    }

    return true;
  }
}

registerProcessor('capture-processor', CaptureProcessor);
