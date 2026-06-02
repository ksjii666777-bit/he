import {
  Controller,
  Post,
  Body,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DeepgramSttService } from './deepgram-stt.service';
import { PronunciationService } from './pronunciation.service';
import { ElevenLabsTtsService } from './elevenlabs-tts.service';
import { AudioPreprocessor } from './audio-preprocessor';

@Controller('speech')
export class SpeechController {
  constructor(
    private readonly stt: DeepgramSttService,
    private readonly pronunciation: PronunciationService,
    private readonly tts: ElevenLabsTtsService,
    private readonly preprocessor: AudioPreprocessor,
  ) {}

  @Post('transcribe')
  @UseInterceptors(FileInterceptor('file'))
  async transcribe(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: 'audio/wav' }),
        ],
      }),
    )
    file: any,
  ) {
    const processed = this.preprocessor.process(file.buffer);
    const result = await this.stt.transcribe(processed);
    return result;
  }

  @Post('pronunciation')
  async scorePronunciation(
    @Body()
    body: {
      referenceText: string;
      audioBuffer?: string;
    },
  ) {
    const transcription = await this.stt.transcribe(
      Buffer.from(body.audioBuffer || '', 'base64'),
    );
    const result = this.pronunciation.score(body.referenceText, transcription);
    return result;
  }

  @Post('synthesize')
  async synthesize(
    @Body()
    body: {
      text: string;
      voiceId?: string;
      options?: { stability?: number; similarityBoost?: number; speed?: number };
    },
  ) {
    const audio = await this.tts.synthesize(body.text, {
      voiceId: body.voiceId,
      ...body.options,
    });
    return { audio: audio.toString('base64'), format: 'wav' };
  }
}
