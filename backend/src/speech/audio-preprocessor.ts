export class AudioPreprocessor {
  process(input: Buffer): Buffer {
    const samples = this.bufferToSamples(input);
    const gated = this.noiseGate(samples, -50);
    const filtered = this.highPassFilter(gated, 80, 16000);
    const normalized = this.peakNormalize(filtered, -3);
    const trimmed = this.trimSilence(normalized, 16000);
    return this.samplesToBuffer(trimmed);
  }

  private bufferToSamples(buffer: Buffer): Float32Array {
    const samples = new Float32Array(buffer.length / 2);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = buffer.readInt16LE(i * 2) / 32768;
    }
    return samples;
  }

  private noiseGate(
    samples: Float32Array,
    thresholdDb: number,
  ): Float32Array {
    const threshold = Math.pow(10, thresholdDb / 20);
    return samples.map((s) => (Math.abs(s) < threshold ? 0 : s));
  }

  private highPassFilter(
    samples: Float32Array,
    cutoffHz: number,
    sampleRate: number,
  ): Float32Array {
    const rc = 1 / (2 * Math.PI * cutoffHz);
    const dt = 1 / sampleRate;
    const alpha = rc / (rc + dt);
    const result = new Float32Array(samples.length);
    result[0] = samples[0];
    for (let i = 1; i < samples.length; i++) {
      result[i] = alpha * (result[i - 1] + samples[i] - samples[i - 1]);
    }
    return result;
  }

  private peakNormalize(samples: Float32Array, targetDb: number): Float32Array {
    const target = Math.pow(10, targetDb / 20);
    const peak = Math.max(...samples.map(Math.abs), 0.0001);
    const gain = target / peak;
    return samples.map((s) => s * gain);
  }

  private trimSilence(
    samples: Float32Array,
    sampleRate: number,
  ): Float32Array {
    const threshold = 0.01;
    let start = 0;
    let end = samples.length - 1;
    while (start < samples.length && Math.abs(samples[start]) < threshold)
      start++;
    while (end > start && Math.abs(samples[end]) < threshold) end--;
    const padStart = Math.max(0, Math.round(sampleRate * 0.05));
    const padEnd = Math.min(
      samples.length,
      end + Math.round(sampleRate * 0.05),
    );
    return samples.slice(Math.max(0, start - padStart), padEnd);
  }

  private samplesToBuffer(samples: Float32Array): Buffer {
    const buffer = Buffer.alloc(samples.length * 2 + 44);
    this.writeWavHeader(buffer, samples.length, 16000);
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      buffer.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
    }
    return buffer;
  }

  private writeWavHeader(
    buffer: Buffer,
    sampleCount: number,
    sampleRate: number,
  ): void {
    const byteRate = sampleRate * 2;
    const dataSize = sampleCount * 2;
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(1, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(2, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);
  }
}
