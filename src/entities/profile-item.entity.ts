import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Experiencia laboral, educación, certificaciones y otros ítems del curriculum.
 */
export enum ProfileItemType {
  EXPERIENCE    = 'EXPERIENCE',
  EDUCATION     = 'EDUCATION',
  CERTIFICATION = 'CERTIFICATION',
  SKILL         = 'SKILL',
  LANGUAGE      = 'LANGUAGE',
  AWARD         = 'AWARD',
  PUBLICATION   = 'PUBLICATION',
  VOLUNTEER     = 'VOLUNTEER',
}

@Entity('profile_items')
export class ProfileItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: ProfileItemType })
  type: ProfileItemType;

  @Column()
  title: string;

  @Column({ nullable: true })
  subtitle: string | null;       // empresa / institución / nivel

  @Column({ nullable: true })
  location: string | null;

  @Column({ nullable: true })
  start_date: string | null;     // YYYY-MM o YYYY

  @Column({ nullable: true })
  end_date: string | null;       // YYYY-MM, YYYY o null => "Actualidad"

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'simple-array', nullable: true })
  tags: string[];                // habilidades, tecnologías, etc.

  @Column({ nullable: true })
  url: string | null;            // badge, credencial, empresa

  @Column({ nullable: true })
  logo: string | null;           // URL del logo de empresa/institución

  @Column({ type: 'int', default: 0 })
  order: number;

  @Column({ default: true })
  is_visible: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
