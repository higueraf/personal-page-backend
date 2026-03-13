"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const app_seeder_1 = require("./database/app.seeder");
async function run() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    const seeder = app.get(app_seeder_1.AppSeeder);
    await seeder.seed();
    await app.close();
}
run();
//# sourceMappingURL=seed.js.map