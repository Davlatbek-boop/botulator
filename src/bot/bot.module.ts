import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { BotUpdate } from './bot.update';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Expence } from './entities/expence.entity';
import { Income } from './entities/income.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Expence, Income])],
  providers: [BotService, BotUpdate],
})
export class BotModule {}
