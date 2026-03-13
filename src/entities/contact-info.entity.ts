import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Información de contacto y redes sociales del propietario del sitio.
 * Diseñada como tabla key-value flexible para no requerir migraciones
 * al agregar nuevas redes. Hay un solo registro por clave (upsert).
 */
@Entity('contact_info')
export class ContactInfo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  key: string;           // "email" | "phone" | "linkedin" | "github" | "twitter" | ...

  @Column()
  label: string;         // "Correo electrónico", "LinkedIn", etc.

  @Column()
  value: string;         // el valor real: email, URL, número

  @Column({ nullable: true })
  icon: string | null;   // nombre del ícono (lucide) o URL

  @Column({ default: true })
  is_visible: boolean;

  @Column({ type: 'int', default: 0 })
  order: number;

  @UpdateDateColumn()
  updated_at: Date;
}
