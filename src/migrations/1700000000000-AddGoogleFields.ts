import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGoogleFields1700000000000 implements MigrationInterface {
  name = 'AddGoogleFields1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "google_id" character varying`);
    await queryRunner.query(`ALTER TABLE "users" ADD "avatar" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "avatar"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "google_id"`);
  }
}
