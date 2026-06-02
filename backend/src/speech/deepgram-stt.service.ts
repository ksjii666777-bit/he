import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';

export interface TranscriptionResult {
  text: string;
  confidence: number;
  words: { word: string; confidence: number; start: number; end: number }[];
}

@Injectable()
export class DeepgramSttService {
  private readonly logger = new Logger(DeepgramSttService.name);
  private readonly deepgram;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('DEEPGRAM_API_KEY');
    if (apiKey) {
      this.deepgram = createClient(apiKey);
    } else {
      this.logger.warn('DEEPGRAM_API_KEY not set, using mock STT');
    }
  }

  async transcribe(audioBuffer: Buffer): Promise<TranscriptionResult> {
    if (!this.deepgram) {
      return this.mockTranscription(audioBuffer);
    }

    try {
      const { result, error } = await this.deepgram.listen.prerecorded.transcribeFile(
        audioBuffer,
        {
          model: 'nova-2',
          language: 'en',
          punctuate: true,
          utterances: true,
          encoding: 'linear16',
          sample_rate: 16000,
        },
      );

      if (error) {
        this.logger.error('Deepgram transcription error', error);
        return this.mockTranscription(audioBuffer);
      }

      const channel = result?.results?.channels?.[0];
      const alternative = channel?.alternatives?.[0];
      const words =
        alternative?.words?.map((w: any) => ({
          word: w.word,
          confidence: w.confidence,
          start: w.start,
          end: w.end,
        })) || [];

      return {
        text: alternative?.transcript || '',
        confidence: alternative?.confidence || 0,
        words,
      };
    } catch (err) {
      this.logger.error('Deepgram request failed', err);
      return this.mockTranscription(audioBuffer);
    }
  }

  private mockTranscription(_audioBuffer: Buffer): TranscriptionResult {
    return {
      text: 'This is a simulated transcription.',
      confidence: 0.85,
      words: [
        { word: 'This', confidence: 0.9, start: 0, end: 0.2 },
        { word: 'is', confidence: 0.9, start: 0.2, end: 0.35 },
        { word: 'a', confidence: 0.9, start: 0.35, end: 0.4 },
        { word: 'simulated', confidence: 0.8, start: 0.4, end: 0.7 },
        { word: 'transcription', confidence: 0.8, start: 0.7, end: 1.0 },
      ],
    };
  }
}
