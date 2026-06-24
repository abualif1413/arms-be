import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MailerService } from '@nestjs-modules/mailer';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { PurchaseEntity, PurchaseStatus } from '../../entities/purchase';

@Processor('purchase-queue')
@Injectable()
export class FlashSaleProcessor extends WorkerHost {
  private readonly logger = new Logger(FlashSaleProcessor.name);

  constructor(
    @InjectRepository(PurchaseEntity)
    private readonly purchaseRepository: Repository<PurchaseEntity>,
    private readonly mailerService: MailerService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    switch (job.name) {
      case 'proceed-purchase':
        await this.proceedPurchase(job.data);
        break;

      default:
        throw new Error(`No handler found for job name: ${job.name}`);
    }
  }

  private async proceedPurchase(data: { purchaseId: string }): Promise<void> {
    const purchase = await this.purchaseRepository.findOne({
      where: { id: data.purchaseId },
      relations: ['user', 'flashSale'],
    });

    if (!purchase) {
      throw new Error(`Purchase with id ${data.purchaseId} not found`);
    }

    try {
      /**
       * Simulates a heavy, complex purchasing workflow.
       *
       * This process includes time-consuming operations such as:
       *  - Payment processing and validation
       *  - Cross-border compliance and regulatory checks
       *
       * By isolating these operations into an asynchronous queue, we prevent
       * blocking the main thread, ensuring a fast, responsive UX for the user
       * immediately after they click "Purchase".
       *
       * and send mail is one of example that I make in this test
       */

      await this.mailerService.sendMail({
        from: 'Flash Sale Info',
        to: purchase.user.email,
        subject: 'Flash Sale Purchase Success',
        text: `Purchase with purchase code ${purchase.purchaseCode} has been paid successfully.`,
      });

      purchase.status = PurchaseStatus.DONE;
      await this.purchaseRepository.save(purchase);
    } catch (error) {
      purchase.status = PurchaseStatus.FAILED;
      purchase.message = error.message;
      await this.purchaseRepository.save(purchase);

      this.logger.error(
        `Failed to process purchase ${purchase.id}: ${error.message}`,
      );
      throw error;
    }
  }
}
