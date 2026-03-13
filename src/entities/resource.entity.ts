import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum ResourceType {
  LINK    = 'LINK',
  BOOK    = 'BOOK',
  TOOL    = 'TOOL',
  COURSE  = 'COURSE',
  VIDEO   = 'VIDEO',
  ARTICLE = 'ARTICLE',
  OTHER   = 'OTHER',
}

@Entity('resources')
export class Resource {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'enum', enum: ResourceType, default: ResourceType.LINK })
  type: ResourceType;

  @Column({ nullable: true })
  url: string | null;

  @Column({ type: 'simple-array', nullable: true })
  tags: string[];

  @Column({ default: false })
  is_free: boolean;

  @Column({ default: true })
  is_published: boolean;

  @Column({ type: 'int', default: 0 })
  order: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
