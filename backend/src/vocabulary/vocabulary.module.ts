import { Module } from '@nestjs/common';
import { VocabularyController } from './vocabulary.controller';
import { VocabularyService } from './vocabulary.service';
import { Sm5Service } from './sm-5.service';

@Module({
  controllers: [VocabularyController],
  providers: [VocabularyService, Sm5Service],
  exports: [VocabularyService],
})
export class VocabularyModule {}
