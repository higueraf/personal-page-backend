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
import { Institution } from './institution.entity';
import { StudyCourse } from './study-course.entity';

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

/** Distingue si el usuario es alumno de una institución o público general. */
export enum UserType {
  STUDENT = 'student',
  PUBLIC  = 'public',
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

  @Column({ nullable: true })
  google_id?: string;

  @Column({ nullable: true })
  avatar?: string;

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

  /** Tipo de usuario: alumno de una institución o público general */
  @Column({
    type: 'enum',
    enum: UserType,
    default: UserType.PUBLIC,
  })
  user_type: UserType;

  /** Institución educativa a la que pertenece (solo para alumnos) */
  @ManyToOne(() => Institution, { nullable: true, onDelete: 'SET NULL', eager: false })
  @JoinColumn({ name: 'institution_id' })
  institution?: Institution;

  @Column({ nullable: true })
  institution_id?: string;

  /** Curso/carrera que está estudiando */
  @ManyToOne(() => StudyCourse, { nullable: true, onDelete: 'SET NULL', eager: false })
  @JoinColumn({ name: 'study_course_id' })
  study_course?: StudyCourse;

  @Column({ nullable: true })
  study_course_id?: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
