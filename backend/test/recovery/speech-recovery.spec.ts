import { DeepgramSttService } from '../../src/speech/deepgram-stt.service';
import { PronunciationService } from '../../src/speech/pronunciation.service';
import { ElevenLabsTtsService } from '../../src/speech/elevenlabs-tts.service';
import { AudioPreprocessor } from '../../src/speech/audio-preprocessor';

describe('Speech — Failure Recovery', () => {
  describe('DeepgramSTT — Missing API Key', () => {
    it('should use mock transcription when API key is missing', async () => {
      const configService = { get: () => undefined };
      const stt = new DeepgramSttService(configService as any);
      const result = await stt.transcribe(Buffer.from('test'));
      expect(result.text).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.words.length).toBeGreaterThan(0);
    });

    it('should return valid structure on empty audio', async () => {
      const configService = { get: () => undefined };
      const stt = new DeepgramSttService(configService as any);
      const result = await stt.transcribe(Buffer.alloc(0));
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('words');
    });
  });

  describe('ElevenLabsTTS — Missing API Key', () => {
    it('should return mock audio when API key is missing', async () => {
      const configService = { get: () => undefined };
      const tts = new ElevenLabsTtsService(configService as any);
      const result = await tts.synthesize('Hello world');
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should generate valid WAV header in mock', async () => {
      const configService = { get: () => undefined };
      const tts = new ElevenLabsTtsService(configService as any);
      const result = await tts.synthesize('Test');
      const header = result.toString('ascii', 0, 4);
      expect(header).toBe('RIFF');
      expect(result.readUInt32LE(4 + 4)).toBeGreaterThan(0);
    });
  });

  describe('PronunciationService — Edge Cases', () => {
    let service: PronunciationService;

    beforeAll(() => {
      service = new PronunciationService();
    });

    it('should handle empty reference text', () => {
      const result = service.score('', { text: '', confidence: 0, words: [] });
      expect(result.overallScore).toBeDefined();
      expect(result.feedback.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle mismatched word counts', () => {
      const result = service.score(
        'The quick brown fox jumps over the lazy dog',
        {
          text: 'hello world',
          confidence: 0.5,
          words: [
            { word: 'hello', confidence: 0.5 },
            { word: 'world', confidence: 0.5 },
          ],
        },
      );
      expect(result.wordScores.length).toBeGreaterThan(0);
      expect(result.wordScores.some((w) => w.score === 0)).toBe(true);
    });

    it('should handle high confidence transcription', () => {
      const words = 'the cat sat on the mat'.split(' ').map((w, i) => ({
        word: w,
        confidence: 0.95,
        start: i * 0.3,
        end: (i + 1) * 0.3,
      }));
      const result = service.score('The cat sat on the mat', {
        text: 'the cat sat on the mat',
        confidence: 0.95,
        words,
      });
      expect(result.overallScore).toBeGreaterThanOrEqual(70);
    });
  });

  describe('AudioPreprocessor — Edge Cases', () => {
    let preprocessor: AudioPreprocessor;

    beforeAll(() => {
      preprocessor = new AudioPreprocessor();
    });

    it('should handle empty input', () => {
      const result = preprocessor.process(Buffer.alloc(0));
      expect(result).toBeInstanceOf(Buffer);
    });

    it('should handle silent audio', () => {
      const silent = Buffer.alloc(16000 * 2);
      const result = preprocessor.process(silent);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should produce valid WAV output', () => {
      const samples = new Float32Array(16000);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.sin((2 * Math.PI * 440 * i) / 16000) * 0.5;
      }
      const rawBuf = Buffer.alloc(samples.length * 2);
      for (let i = 0; i < samples.length; i++) {
        rawBuf.writeInt16LE(Math.round(samples[i] * 32767), i * 2);
      }
      const result = preprocessor.process(rawBuf);
      const header = result.toString('ascii', 0, 4);
      expect(header).toBe('RIFF');
    });
  });
});
