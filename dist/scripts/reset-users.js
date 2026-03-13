"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const app_module_1 = require("../app.module");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const bcrypt_1 = __importDefault(require("bcrypt"));
const user_entity_1 = require("../entities/user.entity");
const role_entity_1 = require("../entities/role.entity");
const USERS = [
    {
        first_name: 'Admin',
        last_name: 'Sistema',
        email: 'admin@personal.page',
        password: 'Admin123*',
        role_name: 'admin',
        status: user_entity_1.UserStatus.APPROVED,
    },
    {
        first_name: 'Demo',
        last_name: 'Teacher',
        email: 'teacher@personal.page',
        password: 'Teacher123*',
        role_name: 'teacher',
        status: user_entity_1.UserStatus.APPROVED,
    },
    {
        first_name: 'Demo',
        last_name: 'Student',
        email: 'student@personal.page',
        password: 'Student123*',
        role_name: 'student',
        status: user_entity_1.UserStatus.APPROVED,
    },
];
async function run() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    const usersRepo = app.get((0, typeorm_1.getRepositoryToken)(user_entity_1.User));
    const rolesRepo = app.get((0, typeorm_1.getRepositoryToken)(role_entity_1.Role));
    const dataSource = app.get(typeorm_2.DataSource);
    console.log('\n🗑  Eliminando usuarios existentes…');
    await dataSource.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
    console.log('   ✓ Tabla users vaciada\n');
    for (const u of USERS) {
        const role = await rolesRepo.findOne({ where: { name: u.role_name } });
        if (!role) {
            console.warn(`   ⚠ Rol "${u.role_name}" no encontrado, omitiendo ${u.email}`);
            continue;
        }
        const password_hash = await bcrypt_1.default.hash(u.password, 10);
        const user = usersRepo.create({
            first_name: u.first_name,
            last_name: u.last_name,
            email: u.email,
            password_hash,
            role,
            status: u.status,
            is_active: true,
        });
        await usersRepo.save(user);
        console.log(`   ✓ ${u.email}  →  ${u.role_name} · ${u.status}`);
    }
    console.log('\n✅ Reset completado.\n');
    await app.close();
}
run().catch((e) => { console.error(e); process.exit(1); });
//# sourceMappingURL=reset-users.js.map