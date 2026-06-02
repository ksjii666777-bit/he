import { Module } from '@nestjs/common';
import { DeepgramSttService } from './deepgram-stt.service';
import { PronunciationService } from './pronunciation.service';
import { ElevenLabsTtsService } from './elevenlabs-tts.service';
import { AudioPreprocessor } from './audio-preprocessor';
import { SpeechController } from './speech.controller';

@Module({
  controllers: [SpeechController],
  providers: [
    DeepgramSttService,
    PronunciationService,
    ElevenLabsTtsService,
    AudioPreprocessor,
  ],
  exports: [DeepgramSttService, PronunciationService, ElevenLabsTtsService],
})
export class SpeechModule {}
