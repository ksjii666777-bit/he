import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface TtsOptions {
  voiceId?: string;
  stability?: number;
  similarityBoost?: number;
  speed?: number;
}

@Injectable()
export class ElevenLabsTtsService {
  private readonly logger = new Logger(ElevenLabsTtsService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.elevenlabs.io/v1';

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('ELEVENLABS_API_KEY') || '';
    if (!this.apiKey) {
      this.logger.warn('ELEVENLABS_API_KEY not set, using mock TTS');
    }
  }

  async synthesize(
    text: string,
    options: TtsOptions = {},
  ): Promise<Buffer> {
    if (!this.apiKey) {
      return this.mockTts(text);
    }

    const voiceId = options.voiceId || '21m00Tcm4TlvDq8ikWAM';
    const stability = options.stability ?? 0.5;
    const similarityBoost = options.similarityBoost ?? 0.5;
    const speed = options.speed ?? 1.0;

    try {
      const response = await fetch(
        `${this.baseUrl}/text-to-speech/${voiceId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': this.apiKey,
            Accept: 'audio/wav',
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_turbo_v2',
            voice_settings: {
              stability,
              similarity_boost: similarityBoost,
              speed,
            },
          }),
        },
      );

      if (!response.ok) {
        this.logger.error(
          `ElevenLabs TTS error: ${response.status} ${response.statusText}`,
        );
        return this.mockTts(text);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (err) {
      this.logger.error('ElevenLabs TTS request failed', err);
      return this.mockTts(text);
    }
  }

  private mockTts(_text: string): Buffer {
    const duration = 1;
    const sampleRate = 16000;
    const numSamples = duration * sampleRate;
    const buffer = Buffer.alloc(numSamples * 2 + 44);
    this.writeWavHeader(buffer, numSamples, sampleRate);
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const sample = Math.sin(2 * Math.PI * 220 * t) * 0.3;
      buffer.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
    }
    return buffer;
  }

  private writeWavHeader(buffer: Buffer, sampleCount: number, sampleRate: number): void {
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
