import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument, UserRole } from '../users/entities/user.entity';
import { NotificationService } from '../notification/notification.service';

/**
 * Automated cleanup service for orphan users (registered but never onboarded).
 *
 * 3-Phase Email Lifecycle:
 *   Day 5 → Warning email:      "Complete onboarding — 2 days left"
 *   Day 6 → Final notice email:  "Last chance — your account will be removed tomorrow"
 *   Day 7 → Cleanup + confirmation: "Account removed per data retention policy"
 *
 * Runs daily at 3:00 AM UTC.
 */
@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly notificationService: NotificationService,
  ) {}

  @Cron('0 3 * * *') // Daily at 3 AM UTC
  async handleOrphanCleanup() {
    this.logger.log('🧹 Starting orphan user cleanup cycle...');

    const now = new Date();
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // ── Phase 3: Delete (Day 7+) ──
    // Users who were given final notice AND are 7+ days old
    const toDelete = await this.userModel.find({
      role: UserRole.USER,
      tenant: { $exists: false },
      createdAt: { $lte: sevenDaysAgo },
      cleanupFinalNoticeAt: { $exists: true },
    }).lean();

    for (const user of toDelete) {
      try {
        await this.notificationService.sendCleanupConfirmationEmail(
          user.email,
          user.firstName || user.email.split('@')[0],
        );
        await this.userModel.deleteOne({ _id: user._id });
        this.logger.log(`🗑️ Deleted orphan user: ${user.email} (created ${user.createdAt})`);
      } catch (err) {
        this.logger.error(`Failed to delete/notify ${user.email}: ${err.message}`);
      }
    }

    // ── Phase 2: Final notice (Day 6) ──
    // Users warned BUT not yet final-noticed, 6+ days old
    const toFinalNotice = await this.userModel.find({
      role: UserRole.USER,
      tenant: { $exists: false },
      createdAt: { $lte: sixDaysAgo, $gt: sevenDaysAgo },
      cleanupWarnedAt: { $exists: true },
      cleanupFinalNoticeAt: { $exists: false },
    }).lean();

    for (const user of toFinalNotice) {
      try {
        await this.notificationService.sendCleanupFinalNoticeEmail(
          user.email,
          user.firstName || user.email.split('@')[0],
        );
        await this.userModel.updateOne(
          { _id: user._id },
          { cleanupFinalNoticeAt: now },
        );
        this.logger.log(`⚠️ Final notice sent to: ${user.email}`);
      } catch (err) {
        this.logger.error(`Failed to send final notice to ${user.email}: ${err.message}`);
      }
    }

    // ── Phase 1: Warning (Day 5) ──
    // Users not yet warned, 5+ days old, not a tenant admin
    const toWarn = await this.userModel.find({
      role: UserRole.USER,
      tenant: { $exists: false },
      createdAt: { $lte: fiveDaysAgo, $gt: sixDaysAgo },
      cleanupWarnedAt: { $exists: false },
    }).lean();

    for (const user of toWarn) {
      try {
        await this.notificationService.sendCleanupWarningEmail(
          user.email,
          user.firstName || user.email.split('@')[0],
        );
        await this.userModel.updateOne(
          { _id: user._id },
          { cleanupWarnedAt: now },
        );
        this.logger.log(`📧 Warning sent to: ${user.email}`);
      } catch (err) {
        this.logger.error(`Failed to send warning to ${user.email}: ${err.message}`);
      }
    }

    this.logger.log(
      `🧹 Cleanup cycle complete — warned: ${toWarn.length}, final-noticed: ${toFinalNotice.length}, deleted: ${toDelete.length}`,
    );
  }
}
