import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { LmsSubmission } from './lms-submission.entity';

/** Un archivo adjunto de una entrega de tarea. Una entrega puede tener varios. */
@Entity('lms_submission_files')
export class LmsSubmissionFile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => LmsSubmission, (submission) => submission.files, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'submission_id' })
  submission: LmsSubmission;

  @Column()
  submission_id: string;

  @Column()
  file_url: string;

  @Column()
  original_name: string;

  @Column()
  mime_type: string;

  @Column()
  size_bytes: number;

  @CreateDateColumn()
  created_at: Date;
}
