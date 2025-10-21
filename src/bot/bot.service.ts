import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Bot, Context, Keyboard } from 'grammy';
import { User } from './entities/user.entity';
import { In, MoreThan, Not, Repository } from 'typeorm';
import { Expence } from './entities/expence.entity';
import { Income } from './entities/income.entity';

@Injectable()
export class BotService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Expence)
    private readonly expenceRepo: Repository<Expence>,
    @InjectRepository(Income) private readonly incomeRepo: Repository<Income>,
  ) {}
  private userState = new Map();

  async onStart(ctx: Context) {
    const user = await this.userRepo.findOneBy({
      telegram_id: ctx.from!.id,
    });
    if (!user) {
      const newUser = this.userRepo.create({
        telegram_id: ctx.from!.id,
        username: ctx.from!.username,
        firstname: ctx.from!.first_name,
      });
      await this.userRepo.save(newUser);
    }
    await ctx.reply(
      `👋 Salom, <b>${ctx.from!.first_name}</b>!\n\n` +
        `Men <b>Botulator</b> — sizning shaxsiy moliyaviy yordamchingizman.\n\n` +
        `💰 Men yordam beraman:\n` +
        `• Xarajatlaringizni yozib borishda\n` +
        `• Daromadlaringizni kuzatishda\n` +
        `• Balansingizni ko‘rishda\n` +
        `• Hisobotlar olishda 📊\n\n` +
        `Boshlash uchun quyidagi buyruqlardan birini tanlang:\n` +
        `/add_expense – yangi xarajat qo‘shish\n` +
        `/add_income – yangi daromad qo‘shish\n` +
        `/balance – balansni ko‘rish\n` +
        `/report – hisobot olish`,
      {
        parse_mode: 'HTML',
        reply_markup: new Keyboard()
          .text('/balance')
          .row()
          .text('/add_expense')
          .text('/add_income')
          .row()
          .text('/report')
          .resized()
          .persistent(),
      },
    );
  }

  async onStop(ctx: Context) {
    const haveUser = await this.isRegistrUser(ctx);
    if (haveUser) {
      await ctx.reply(
        'Siz vaqtincha botdan chiqdingiz. Qayta faollashtirish uchun <b>/start</b> tugmasini bosing',
        {
          parse_mode: 'HTML',
          reply_markup: new Keyboard([['/start']]).oneTime().resized(),
        },
      );
    }
  }

  async addExpence(ctx: Context) {
    const haveUser = await this.isRegistrUser(ctx);
    if (haveUser) {
      await ctx.reply('Xarajat nomini kiriting >>>');
      const newExpence = this.expenceRepo.create({
        user_id: ctx.from!.id,
      });
      await this.expenceRepo.save(newExpence);
      this.userState.set(ctx.from!.id, 'expense');
    }
  }

  async addIncome(ctx: Context) {
    const haveUser = await this.isRegistrUser(ctx);
    if (haveUser) {
      await ctx.reply('Daromad nomini kiriting >>>');
      const newIncome = this.incomeRepo.create({
        user_id: ctx.from!.id,
      });
      await this.incomeRepo.save(newIncome);
      this.userState.set(ctx.from!.id, 'income');
    }
  }

  async showBalance(ctx: Context) {
    const haveUser = await this.isRegistrUser(ctx);
    if (haveUser) {
      const userId = ctx.from!.id;
      const expences = await this.expenceRepo.find({
        where: { user_id: userId },
      });
      const incomes = await this.incomeRepo.find({
        where: { user_id: userId },
      });
      const totalExpence = expences.reduce(
        (sum, expence) => sum + (expence.amount || 0),
        0,
      );
      const totalIncome = incomes.reduce(
        (sum, income) => sum + (income.amount || 0),
        0,
      );
      const balance = totalIncome - totalExpence;
      await ctx.reply(
        `💼 Sizning joriy balansingiz: <b>${balance} UZS</b>\n\n` +
          `📊 Umumiy daromad: <b>${totalIncome} UZS</b>\n` +
          `📉 Umumiy xarajat: <b>${totalExpence} UZS</b>`,
        { parse_mode: 'HTML' },
      );
    }
  }

  async report(ctx: Context) {
    const userId = ctx.from!.id;

    const expenses = await this.expenceRepo.find({
      where: {
        user_id: userId,
        last_state: 'finish',
        createdAt: MoreThan(
          new Date(new Date().setDate(new Date().getDate() - 7)),
        ),
      },
    });

    const incomes = await this.incomeRepo.find({
      where: {
        user_id: userId,
        last_state: 'finish',
        createdAt: MoreThan(
          new Date(new Date().setDate(new Date().getDate() - 7)),
        ),
      },
    });

    const expenseByCategory: Record<string, number> = {};
    expenses.forEach((e) => {
      if (e.category in expenseByCategory) {
        expenseByCategory[e.category] += e.amount;
      } else {
        expenseByCategory[e.category] = e.amount;
      }
    });

    const totalIncome = incomes.reduce((sum, i) => sum + i.amount, 0);
    const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);

    const balance = totalIncome - totalExpense;

    let reportMessage = `📊 <b>Hisobot (oxirgi 7 kun)</b>\n\n`;

    reportMessage += `💰 Umumiy daromad: ${totalIncome} so'm\n`;
    reportMessage += `💸 Umumiy xarajat: ${totalExpense} so'm\n`;
    reportMessage += `📈 Sof balans: ${balance} so'm\n\n`;
    reportMessage += `🏷️ Xarajatlar kategoriyalar bo'yicha:\n`;

    for (const [category, amount] of Object.entries(expenseByCategory)) {
      reportMessage += `• ${category}: ${amount} so'm\n`;
    }

    await ctx.reply(reportMessage, { parse_mode: 'HTML' });
  }

  async onMessage(ctx: Context) {
    const haveUser = await this.isRegistrUser(ctx);
    if (haveUser) {
      const userId = ctx.from!.id;
      const state = this.userState.get(userId);
      const text = ctx.message?.text;

      switch (state) {
        case 'expense':
          const expence = await this.expenceRepo.findOne({
            where: {
              user_id: userId,
              last_state: Not('finish'),
            },
            order: { id: 'DESC' },
          });

          if (expence) {
            switch (expence?.last_state) {
              case 'title':
                expence.title = text!;
                expence.last_state = 'amount';
                await this.expenceRepo.save(expence);
                await ctx.reply('💵 Xarajat summasini kiriting >>>');
                break;
              case 'amount':
                const check = await this.isNumber(text!);
                if (!check) {
                  await ctx.reply(`
                        Xarajat summasi raqam bulishi kerak. 
                        Qaytadan kiriting!
                        `);
                  return;
                }
                expence.amount = Number(text);
                expence.last_state = 'category';
                await this.expenceRepo.save(expence);
                await ctx.reply('🏷️ Xarajat kategoriyasini kiriting >>>');
                break;
              case 'category':
                expence.category = text!;
                expence.last_state = 'finish';
                this.userState.delete(userId);
                await this.expenceRepo.save(expence);
                await ctx.reply('✅ Xarajat muvaffaqiyatli qo‘shildi!');
                break;
            }
          }
          break;
        case 'income':
          const income = await this.incomeRepo.findOne({
            where: {
              user_id: userId,
              last_state: Not('finish'),
            },
            order: { id: 'DESC' },
          });

          if (income) {
            switch (income.last_state) {
              case 'source':
                income.source = text!;
                income.last_state = 'amount';
                await this.incomeRepo.save(income);
                await ctx.reply('💵 Kirim summasini kiriting >>>');
                break;

              case 'amount':
                const check = await this.isNumber(text!);
                if (check) {
                  income.amount = Number(text);
                  income.last_state = 'finish';
                  await this.incomeRepo.save(income);
                  await ctx.reply(
                    '✅ Kirim summasi muvaffaqiyatli qo‘shildi!>>>',
                  );
                } else {
                  await ctx.reply(`
                        Kirim summasi raqam bulishi kerak. 
                        Qaytadan kiriting!
                        `);
                }
                break;
            }
          }
      }
    }
  }

  async isRegistrUser(ctx: Context) {
    const user = await this.userRepo.findOneBy({ telegram_id: ctx.from!.id });
    if (!user) {
      await ctx.reply('Iltimos, <b>/start</b> tugmasini bosing', {
        parse_mode: 'HTML',
        reply_markup: new Keyboard([['/start']]).oneTime().resized(),
      });
      return false;
    }
    return true;
  }

  async isNumber(text: string) {
    if (!isNaN(Number(text))) {
      return true;
    }
    return false;
  }
}
