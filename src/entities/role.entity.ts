import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  permissions: string[];

  @OneToMany(() => User, (user) => user.role)
  users: User[];
}
