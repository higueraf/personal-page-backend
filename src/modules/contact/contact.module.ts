import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactInfo } from '../../entities/contact-info.entity';
import { ContactMessage } from '../../entities/contact-message.entity';
import { ContactAdminController, ContactPublicController } from './contact.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ContactInfo, ContactMessage])],
  controllers: [ContactAdminController, ContactPublicController],
})
export class ContactModule {}
