import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from './role.entity';

/**
 * Estado del ciclo de vida de un usuario.
 *
 * PENDING   → Recién registrado, espera revisión del administrador.
 * APPROVED  → El admin aprobó la cuenta; puede iniciar sesión.
 * SUSPENDED → Acceso revocado temporalmente.
 * REJECTED  → Solicitud denegada definitivamente.
 */
export enum UserStatus {
  PENDING   = 'PENDING',
  APPROVED  = 'APPROVED',
  SUSPENDED = 'SUSPENDED',
  REJECTED  = 'REJECTED',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  first_name: string;

  @Column()
  last_name: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password_hash: string;

  @ManyToOne(() => Role, (role) => role.users, { eager: true, nullable: false })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.PENDING,
  })
  status: UserStatus;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
