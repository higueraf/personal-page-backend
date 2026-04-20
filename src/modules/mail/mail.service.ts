import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface MailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: MailAttachment[];
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: this.config.get<string>('GMAIL_FROM_EMAIL'),
        clientId: this.config.get<string>('GMAIL_CLIENT_ID'),
        clientSecret: this.config.get<string>('GMAIL_CLIENT_SECRET'),
        refreshToken: this.config.get<string>('GMAIL_REFRESH_TOKEN'),
      },
    });
  }

  async send(options: SendMailOptions): Promise<void> {
    const from = `"Plataforma Educativa" <${this.config.get('GMAIL_FROM_EMAIL')}>`;
    try {
      await this.transporter.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        attachments: options.attachments,
      });
      this.logger.log(`Email sent → ${options.to} | ${options.subject}`);
    } catch (err) {
      this.logger.error(`Failed to send email → ${options.to}`, err?.message);
      throw err;
    }
  }
}
