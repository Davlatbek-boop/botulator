import { Controller } from '@nestjs/common';
import { BotService } from './bot.service';
import { Bot, Context } from 'grammy';

@Controller('bot')
export class BotUpdate {
  constructor(private readonly botService: BotService) {}
  private bot: Bot;

  onModuleInit() {
    this.bot = new Bot(process.env.BOT_TOKEN!);

    this.bot.command('start', async (ctx) => {
      this.botService.onStart(ctx);
    });

    this.bot.command('stop', async (ctx) => {
      this.botService.onStop(ctx);
    });

    this.bot.command('add_expense', async (ctx) => {
      this.botService.addExpence(ctx);
    });

    this.bot.command('add_income', async (ctx) => {
      this.botService.addIncome(ctx);
    });

    this.bot.command('balance', async (ctx) => {
      this.botService.showBalance(ctx);
    });

    this.bot.command('report', (ctx) => this.botService.report(ctx));

    this.bot.on('message', async (ctx) => {
      this.botService.onMessage(ctx);
    });

    this.bot.start();
  }
}
