"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppSeeder = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const bcrypt_1 = __importDefault(require("bcrypt"));
const content_block_entity_1 = require("../entities/content-block.entity");
const course_entity_1 = require("../entities/course.entity");
const course_section_entity_1 = require("../entities/course-section.entity");
const lesson_page_entity_1 = require("../entities/lesson-page.entity");
const lesson_entity_1 = require("../entities/lesson.entity");
const role_entity_1 = require("../entities/role.entity");
const user_entity_1 = require("../entities/user.entity");
const video_course_entity_1 = require("../entities/video-course.entity");
const video_lesson_entity_1 = require("../entities/video-lesson.entity");
const video_section_entity_1 = require("../entities/video-section.entity");
const contact_info_entity_1 = require("../entities/contact-info.entity");
const profile_item_entity_1 = require("../entities/profile-item.entity");
const project_entity_1 = require("../entities/project.entity");
const resource_entity_1 = require("../entities/resource.entity");
let AppSeeder = class AppSeeder {
    constructor(rolesRepo, usersRepo, coursesRepo, sectionsRepo, lessonsRepo, pagesRepo, blocksRepo, videoCoursesRepo, videoSectionsRepo, videoLessonsRepo, contactInfoRepo, profileRepo, projectsRepo, resourcesRepo) {
        this.rolesRepo = rolesRepo;
        this.usersRepo = usersRepo;
        this.coursesRepo = coursesRepo;
        this.sectionsRepo = sectionsRepo;
        this.lessonsRepo = lessonsRepo;
        this.pagesRepo = pagesRepo;
        this.blocksRepo = blocksRepo;
        this.videoCoursesRepo = videoCoursesRepo;
        this.videoSectionsRepo = videoSectionsRepo;
        this.videoLessonsRepo = videoLessonsRepo;
        this.contactInfoRepo = contactInfoRepo;
        this.profileRepo = profileRepo;
        this.projectsRepo = projectsRepo;
        this.resourcesRepo = resourcesRepo;
    }
    async seed() {
        const adminRole = await this.ensureRole('admin', ['admin:*']);
        const teacherRole = await this.ensureRole('teacher', ['content:read', 'content:write']);
        const studentRole = await this.ensureRole('student', ['content:read']);
        await this.ensureUser('admin@higueraf.dev', 'Admin123*', 'Francisco', 'Higuera', adminRole, user_entity_1.UserStatus.APPROVED);
        await this.ensureUser('student@higueraf.dev', 'Student123*', 'Demo', 'Student', studentRole, user_entity_1.UserStatus.APPROVED);
        await this.ensureUser('teacher@higueraf.dev', 'Teacher123*', 'Demo', 'Teacher', teacherRole, user_entity_1.UserStatus.APPROVED);
        await this.seedContactInfo();
        await this.seedProfile();
        await this.seedProjects();
        await this.seedTutorials();
        await this.seedVideoCourses();
        await this.seedResources();
        return { ok: true };
    }
    async seedContactInfo() {
        const items = [
            { key: 'email', label: 'Correo electrónico', value: 'franciscohiguera@gmail.com', icon: 'Mail', order: 0, is_visible: true },
            { key: 'phone', label: 'Teléfono', value: '+593 98 470 9901', icon: 'Phone', order: 1, is_visible: true },
            { key: 'linkedin', label: 'LinkedIn', value: 'https://www.linkedin.com/in/francisco-higuera/', icon: 'Linkedin', order: 2, is_visible: true },
            { key: 'github', label: 'GitHub', value: 'https://github.com/higueraf', icon: 'Github', order: 3, is_visible: true },
        ];
        for (const i of items) {
            const exists = await this.contactInfoRepo.findOne({ where: { key: i.key } });
            if (!exists) {
                await this.contactInfoRepo.save(this.contactInfoRepo.create(i));
            }
        }
    }
    async seedProfile() {
        if ((await this.profileRepo.count()) > 0)
            return;
        const items = [
            {
                type: profile_item_entity_1.ProfileItemType.EXPERIENCE, order: 0,
                title: 'Docente Universitario',
                subtitle: 'Universidad Tecnológica Equinoccial (UTE)',
                location: 'Quito, Ecuador',
                start_date: '2025-04', end_date: null,
                description: 'Docente de las materias Programación III, Programación IV y Calidad del Software. Formación de futuros ingenieros en desarrollo de software profesional.',
                tags: ['Python', 'Java', 'Calidad de Software', 'Docencia'],
            },
            {
                type: profile_item_entity_1.ProfileItemType.EXPERIENCE, order: 1,
                title: 'Arquitecto de Software',
                subtitle: 'SZ Fiber System',
                location: 'Ecuador',
                start_date: '2024-06', end_date: '2025-04',
                description: 'Diseño e implementación de arquitectura para plataforma ecommerce ourshop.shop. Decisiones técnicas sobre stack, microservicios y despliegue en AWS.',
                tags: ['Java 21', 'Spring Boot', 'Angular 18', 'MSSQL', 'AWS'],
            },
            {
                type: profile_item_entity_1.ProfileItemType.EXPERIENCE, order: 2,
                title: 'Software Backend Engineer',
                subtitle: 'JP Global Digital',
                location: 'Miami, USA (Remoto)',
                start_date: '2022-08', end_date: '2024-04',
                description: 'Desarrollo del Sistema Visor de Point Cloud para visualización de datos 3D. Arquitectura backend con C# .Net y NestJS, frontend con Vue.js y almacenamiento en Azure.',
                tags: ['C#', '.NET', 'NestJS', 'Vue.js', 'MSSQL', 'Azure'],
            },
            {
                type: profile_item_entity_1.ProfileItemType.EXPERIENCE, order: 3,
                title: 'Backend Developer',
                subtitle: 'Mi Águila',
                location: 'Bogotá, Colombia (Remoto)',
                start_date: '2021-01', end_date: '2022-06',
                description: 'Desarrollo del Sistema de Rutas con geolocalización en tiempo real y Sistema Ecommerce multi-tenant. Stack mixto C#, Java Spring Boot, Python Django y AWS.',
                tags: ['C#', 'Vue.js', 'Java', 'Spring Boot', 'Python', 'Django', 'PostgreSQL', 'AWS'],
            },
            {
                type: profile_item_entity_1.ProfileItemType.EXPERIENCE, order: 4,
                title: 'Fullstack Developer',
                subtitle: 'Corefix',
                location: 'Ciudad de México, México (Remoto)',
                start_date: '2020-06', end_date: '2020-12',
                description: 'Desarrollo de Sistema Ecommerce con Python Django en el backend, Angular en el frontend y C# para integraciones con servicios externos.',
                tags: ['Python', 'Django', 'Angular', 'C#'],
            },
            {
                type: profile_item_entity_1.ProfileItemType.EXPERIENCE, order: 5,
                title: 'Fullstack Developer – Freelancer',
                subtitle: 'MiWeb',
                location: 'Quito, Ecuador',
                start_date: '2020-01', end_date: '2021-01',
                description: 'Implementación y personalización de Sistema Contable sobre Odoo ERP. Desarrollo de módulos personalizados con Python, Django y JavaScript.',
                tags: ['Python', 'Django', 'Odoo ERP', 'JavaScript'],
            },
            {
                type: profile_item_entity_1.ProfileItemType.EXPERIENCE, order: 6,
                title: 'Fullstack Developer – Freelancer',
                subtitle: 'Ministerio de Agricultura y Cría del Ecuador',
                location: 'Quito, Ecuador',
                start_date: '2020-01', end_date: '2020-02',
                description: 'Desarrollo del Sistema de Control de Proyectos para gestión y seguimiento de proyectos agrícolas institucionales.',
                tags: ['PHP', 'Laravel', 'JavaScript'],
            },
            {
                type: profile_item_entity_1.ProfileItemType.EXPERIENCE, order: 7,
                title: 'Fullstack Developer',
                subtitle: 'Hermes.ec',
                location: 'Quito, Ecuador',
                start_date: '2017-03', end_date: '2020-12',
                description: 'Desarrollo y mantenimiento de Sistema Contable integral para empresa de logística. Arquitectura full-stack con Python Django, JavaScript y Java para módulos de reportería.',
                tags: ['Python', 'Django', 'JavaScript', 'Java'],
            },
            {
                type: profile_item_entity_1.ProfileItemType.EXPERIENCE, order: 8,
                title: 'Analista de Sistemas',
                subtitle: 'Secretaría de Salud del Estado Falcón',
                location: 'Falcón, Venezuela',
                start_date: '1998-09', end_date: '2017-02',
                description: 'Administración del Sistema Administrativo institucional, administración de servidores Linux y desarrollo de aplicaciones. Integración con sistemas de la UNEFM y UNEFA.',
                tags: ['PHP', 'CakePHP', 'PostgreSQL', 'Visual Basic', 'Linux'],
            },
            {
                type: profile_item_entity_1.ProfileItemType.EDUCATION, order: 0,
                title: 'Master en Ingeniería Biomédica',
                subtitle: 'Universidad Central "Marta Abreu" de Las Villas',
                location: 'Santa Clara, Cuba',
                start_date: '2013', end_date: '2016',
                description: 'Especialización en aplicación de tecnologías de la información al ámbito biomédico y sistemas de salud.',
                tags: ['Ingeniería Biomédica', 'Sistemas de Salud', 'TIC'],
            },
            {
                type: profile_item_entity_1.ProfileItemType.EDUCATION, order: 1,
                title: 'Ingeniero en Sistemas',
                subtitle: 'UNEFA – Universidad Nacional de las Fuerzas Armadas',
                location: 'Falcón, Venezuela',
                start_date: '2006', end_date: '2012',
                description: 'Formación en ingeniería de sistemas, desarrollo de software, redes, bases de datos y administración de servidores.',
                tags: ['Ingeniería de Sistemas', 'Redes', 'Bases de datos'],
            },
            {
                type: profile_item_entity_1.ProfileItemType.CERTIFICATION, order: 0,
                title: 'AWS: Building Modern Python Applications on AWS',
                subtitle: 'Amazon Web Services',
                description: 'Certificación en construcción de aplicaciones modernas con Python sobre servicios AWS: Lambda, API Gateway, DynamoDB, S3 y más.',
                tags: ['AWS', 'Python', 'Lambda', 'API Gateway', 'Cloud'],
            },
            {
                type: profile_item_entity_1.ProfileItemType.CERTIFICATION, order: 1,
                title: 'Big Data: Basic Principles',
                subtitle: 'Certificación en Big Data',
                description: 'Fundamentos de Big Data: procesamiento distribuido, ecosistema Hadoop, principios de análisis de grandes volúmenes de datos.',
                tags: ['Big Data', 'Hadoop', 'Data Engineering'],
            },
            {
                type: profile_item_entity_1.ProfileItemType.CERTIFICATION, order: 2,
                title: 'Lenguajes de Programación: C# .Net Core, Python, Nodejs, Java, PHP, Angular, React',
                subtitle: 'Certificaciones técnicas múltiples',
                description: 'Certificaciones en múltiples lenguajes y frameworks de desarrollo de software tanto para backend como frontend.',
                tags: ['C#', '.NET Core', 'Python', 'Node.js', 'Java', 'PHP', 'Angular', 'React'],
            },
            {
                type: profile_item_entity_1.ProfileItemType.CERTIFICATION, order: 3,
                title: 'Bases de Datos: PostgreSQL, MySQL, MongoDB, MSSQL',
                subtitle: 'Certificaciones en Bases de Datos',
                description: 'Dominio certificado en motores de bases de datos relacionales y NoSQL para diseño, optimización y administración.',
                tags: ['PostgreSQL', 'MySQL', 'MongoDB', 'MSSQL'],
            },
            {
                type: profile_item_entity_1.ProfileItemType.SKILL, order: 0,
                title: 'Backend Development',
                description: 'Python (10 años) · Django (7 años) · PHP / CakePHP (10 años) · Java / Spring Boot (7 años) · Node.js (5 años) · TypeScript / NestJS (5 años) · AdonisJS · ExpressJS · Laravel · C# / .NET',
                tags: ['Python', 'Django', 'Java', 'Spring Boot', 'NestJS', 'PHP', 'Laravel', 'C#', '.NET'],
            },
            {
                type: profile_item_entity_1.ProfileItemType.SKILL, order: 1,
                title: 'Frontend Development',
                description: 'React.js (5 años) · Angular (5 años) · Vue.js (5 años) · TypeScript · JavaScript',
                tags: ['React', 'Angular', 'Vue.js', 'TypeScript', 'JavaScript'],
            },
            {
                type: profile_item_entity_1.ProfileItemType.SKILL, order: 2,
                title: 'Bases de datos',
                description: 'PostgreSQL · MySQL · MongoDB · MSSQL · Diseño de esquemas, optimización de queries y administración.',
                tags: ['PostgreSQL', 'MySQL', 'MongoDB', 'MSSQL'],
            },
            {
                type: profile_item_entity_1.ProfileItemType.SKILL, order: 3,
                title: 'DevOps & Cloud',
                description: 'AWS (5 años) · Azure (5 años) · GitHub / GitHub Actions (5 años) · Docker · Linux servers · Redes LAN/WAN/MAN',
                tags: ['AWS', 'Azure', 'Docker', 'GitHub Actions', 'Linux'],
            },
            {
                type: profile_item_entity_1.ProfileItemType.SKILL, order: 4,
                title: 'Gestión & Arquitectura',
                description: 'Análisis de sistemas · Diseño de arquitectura de software · Gestión de proyectos · Toma de decisiones técnicas · Soporte técnico.',
                tags: ['Arquitectura de Software', 'Gestión de Proyectos', 'Análisis de Sistemas'],
            },
            {
                type: profile_item_entity_1.ProfileItemType.LANGUAGE, order: 0,
                title: 'Español', subtitle: 'Nativo', tags: [],
            },
            {
                type: profile_item_entity_1.ProfileItemType.LANGUAGE, order: 1,
                title: 'Inglés', subtitle: 'Intermedio (B2)', tags: [],
            },
        ];
        for (const p of items) {
            const exists = await this.profileRepo.findOne({
                where: { type: p.type, title: p.title }
            });
            if (!exists) {
                await this.profileRepo.save(this.profileRepo.create({ ...p, is_visible: true }));
            }
        }
    }
    async seedProjects() {
        if ((await this.projectsRepo.count()) > 0)
            return;
        const projects = [
            {
                title: 'Sistema de Control de Eventos Científicos',
                slug: 'sistema-control-eventos-cientificos',
                description: 'Plataforma web para gestión integral de conferencias y eventos académicos: ponencias, revisión por pares, programa y certificados.',
                long_description: `Sistema completo para la gestión de eventos científicos y conferencias académicas, desarrollado con Django REST Framework y React + TypeScript.

Módulos principales:
- **Gestión de eventos**: creación y configuración de conferencias con fechas, sede, capacidad y modalidades (presencial, virtual, híbrida).
- **Envío y gestión de ponencias**: los autores registran sus trabajos con título, resumen, palabras clave y archivo PDF. Control de estados: enviado → en revisión → aceptado / rechazado.
- **Revisión por pares (double-blind)**: asignación automática de revisores según área temática. Formulario de evaluación con rúbrica configurable y comentarios anónimos.
- **Gestión de participantes**: registro de asistentes, ponentes y revisores con roles diferenciados. Confirmación de asistencia y control de cupos.
- **Programa científico**: construcción visual del programa con tracks paralelos, sesiones y asignación de salas.
- **Generación de certificados**: emisión automática de certificados de participación y presentación en PDF con firma digital.
- **Panel administrativo**: dashboard con métricas del evento, gestión de comités, exportación de reportes en Excel/CSV.`,
                tech_stack: ['Python', 'Django', 'Django REST Framework', 'React', 'TypeScript', 'PostgreSQL', 'Celery', 'Redis', 'Docker'],
                url: null,
                repo_url: null,
                thumbnail: null,
                order: 0,
                status: project_entity_1.ProjectStatus.PUBLISHED,
            },
            {
                title: 'Plataforma de Cursos y Tutoriales',
                slug: 'plataforma-cursos-tutoriales',
                description: 'LMS completo con cursos en video, tutoriales paginados, panel administrativo y control de acceso por roles.',
                long_description: `Sistema de gestión de aprendizaje (LMS) construido con NestJS + TypeORM en el backend y React + TypeScript en el frontend.

Características principales:
- Cursos estructurados en secciones, lecciones y páginas con bloques de contenido enriquecido (Markdown, código con syntax highlighting, video embed).
- Panel administrativo completo para gestión de cursos, lecciones, proyectos, curriculum, recursos y contacto.
- Autenticación con JWT almacenado en cookies HttpOnly — sin localStorage.
- Control de acceso por rol: contenido libre vs. contenido para usuarios registrados y aprobados.
- Vista de lector paginada (sin scroll infinito) con navegación prev/next entre páginas.
- Flujo de aprobación de usuarios: registro → pendiente → aprobado/rechazado por el admin.`,
                tech_stack: ['NestJS', 'TypeORM', 'PostgreSQL', 'React', 'TypeScript', 'Vite', 'TanStack Query', 'Tailwind CSS', 'Docker'],
                url: null,
                repo_url: 'https://github.com/higueraf',
                thumbnail: null,
                order: 1,
                status: project_entity_1.ProjectStatus.PUBLISHED,
            },
            {
                title: 'Sistema Visor de Point Cloud',
                slug: 'sistema-visor-point-cloud',
                description: 'Aplicación para visualización e inspección de datos de nube de puntos 3D generados por escáner LiDAR, con backend .NET y Azure.',
                long_description: `Sistema desarrollado para JP Global Digital (Miami) orientado a la visualización e inspección de datos de Point Cloud (nubes de puntos) capturados con escáneres LiDAR.

Arquitectura y funcionalidades:
- Backend con C# .NET para procesamiento y conversión de formatos de Point Cloud (LAS, LAZ, E57).
- API REST con NestJS para servir datos de manera eficiente al cliente web.
- Frontend Vue.js con Three.js para renderizado 3D interactivo de las nubes de puntos en el navegador.
- Almacenamiento en Azure Blob Storage para archivos de gran tamaño.
- Base de datos MSSQL para metadatos de proyectos, escaneos y usuarios.
- Autenticación y autorización por roles: operador, supervisor, cliente.`,
                tech_stack: ['C#', '.NET', 'NestJS', 'Vue.js', 'Three.js', 'MSSQL', 'Azure Blob Storage', 'Azure'],
                url: null,
                repo_url: null,
                thumbnail: null,
                order: 2,
                status: project_entity_1.ProjectStatus.PUBLISHED,
            },
            {
                title: 'Sistema de Rutas y Ecommerce — Mi Águila',
                slug: 'sistema-rutas-ecommerce-mi-aguila',
                description: 'Sistema de geolocalización de rutas en tiempo real y plataforma ecommerce multi-tenant para empresa de logística en Colombia.',
                long_description: `Dos sistemas desarrollados para Mi Águila (Bogotá, Colombia) en trabajo remoto:

**Sistema de Rutas (Geolocalización):**
- Tracking en tiempo real de conductores y paquetes con WebSockets.
- Mapas interactivos con leaflet.js para visualización de rutas activas.
- Algoritmo de optimización de rutas considerando tráfico y prioridad de entrega.
- Integración con Google Maps API y servicios de geocodificación.
- Notificaciones push al cliente sobre estado de su entrega.

**Sistema Ecommerce Multi-tenant:**
- Arquitectura multi-empresa: cada cliente tiene su tienda con dominio propio.
- Catálogo de productos con variantes, inventario y precios diferenciados.
- Integración con pasarelas de pago locales e internacionales.
- Panel de administración por tenant con métricas de ventas y gestión de pedidos.`,
                tech_stack: ['C#', 'Vue.js', 'Java', 'Spring Boot', 'Python', 'Django', 'PostgreSQL', 'AWS', 'WebSockets', 'Redis'],
                url: null,
                repo_url: null,
                thumbnail: null,
                order: 3,
                status: project_entity_1.ProjectStatus.PUBLISHED,
            },
            {
                title: 'Sistema Contable Hermes.ec',
                slug: 'sistema-contable-hermes',
                description: 'Sistema contable integral para empresa de logística con módulos de facturación, inventario, nómina y reportería financiera.',
                long_description: `Sistema contable desarrollado durante más de 3 años en Hermes.ec (Quito, Ecuador), empresa del sector logístico.

Módulos implementados:
- **Contabilidad general**: plan de cuentas configurable, asientos contables, libro mayor y diario.
- **Facturación electrónica**: emisión de facturas, notas de crédito y débito conforme a normativa del SRI Ecuador.
- **Inventario**: control de stock, movimientos, valoración FIFO/promedio y toma de inventario.
- **Nómina**: cálculo de rol de pagos, beneficios sociales, décimos y liquidaciones según legislación ecuatoriana.
- **Cuentas por cobrar / pagar**: gestión de cartera, vencimientos y conciliaciones.
- **Reportería**: estados financieros (Balance General, P&G, Flujo de Caja) y exportación a Excel.`,
                tech_stack: ['Python', 'Django', 'JavaScript', 'Java', 'PostgreSQL'],
                url: null,
                repo_url: null,
                thumbnail: null,
                order: 4,
                status: project_entity_1.ProjectStatus.PUBLISHED,
            },
            {
                title: 'Ecommerce Ourshop.shop',
                slug: 'ecommerce-ourshop',
                description: 'Plataforma ecommerce moderna con arquitectura de microservicios, Java 21 + Spring Boot en el backend y Angular 18 en el frontend.',
                long_description: `Plataforma de comercio electrónico desarrollada como Arquitecto de Software en SZ Fiber System.

Decisiones arquitectónicas y características:
- Arquitectura de microservicios con Spring Boot 3 y Java 21 (Virtual Threads para concurrencia).
- API Gateway centralizado para enrutamiento, autenticación y rate limiting.
- Frontend SPA con Angular 18 (Signals, defer blocks, standalone components).
- Base de datos MSSQL con esquemas separados por servicio (catalog, orders, users, payments).
- Despliegue en AWS: ECS Fargate para contenedores, RDS para base de datos, CloudFront para el frontend.
- CI/CD con GitHub Actions: build, tests, push a ECR y deploy automático en ECS.`,
                tech_stack: ['Java 21', 'Spring Boot 3', 'Angular 18', 'MSSQL', 'AWS ECS', 'AWS RDS', 'CloudFront', 'Docker', 'GitHub Actions'],
                url: 'https://ourshop.shop',
                repo_url: null,
                thumbnail: null,
                order: 5,
                status: project_entity_1.ProjectStatus.PUBLISHED,
            },
        ];
        for (const p of projects) {
            const exists = await this.projectsRepo.findOne({ where: { slug: p.slug } });
            if (!exists) {
                await this.projectsRepo.save(this.projectsRepo.create(p));
            }
        }
    }
    async seedTutorials() {
        const t1Slug = 'django-rest-framework-desde-cero';
        const t1Exists = await this.coursesRepo.findOne({ where: { slug: t1Slug } });
        if (!t1Exists) {
            const course = await this.coursesRepo.save(this.coursesRepo.create({
                title: 'Django REST Framework desde cero',
                slug: 'django-rest-framework-desde-cero',
                description: 'Construye APIs profesionales con Python y Django REST Framework. Desde instalación hasta autenticación JWT y permisos personalizados.',
                level: 'Principiante',
                status: 'PUBLISHED',
            }));
            const s1 = await this.sectionsRepo.save(this.sectionsRepo.create({ course, title: 'Introducción y setup', order: 1, status: 'PUBLISHED' }));
            const l1_1 = await this.lessonsRepo.save(this.lessonsRepo.create({ section: s1, title: '¿Qué es Django REST Framework?', slug: 'que-es-django-rest-framework', summary: 'Visión general del framework y sus ventajas frente a Django puro.', order: 1, status: 'PUBLISHED' }));
            const l1_2 = await this.lessonsRepo.save(this.lessonsRepo.create({ section: s1, title: 'Instalación y proyecto base', slug: 'instalacion-y-proyecto-base', summary: 'Configura tu entorno virtual, instala dependencias y crea el proyecto inicial.', order: 2, status: 'PUBLISHED' }));
            const s2 = await this.sectionsRepo.save(this.sectionsRepo.create({ course, title: 'Serializers y Views', order: 2, status: 'PUBLISHED' }));
            const l2_1 = await this.lessonsRepo.save(this.lessonsRepo.create({ section: s2, title: 'Serializers: del modelo al JSON', slug: 'serializers-del-modelo-al-json', summary: 'Transforma modelos Django en JSON con ModelSerializer.', order: 1, status: 'PUBLISHED' }));
            const l2_2 = await this.lessonsRepo.save(this.lessonsRepo.create({ section: s2, title: 'APIView vs ViewSet', slug: 'apiview-vs-viewset', summary: 'Cuándo usar cada enfoque y cómo registrar rutas con routers.', order: 2, status: 'PUBLISHED' }));
            const s3 = await this.sectionsRepo.save(this.sectionsRepo.create({ course, title: 'Autenticación con JWT', order: 3, status: 'PUBLISHED' }));
            const l3_1 = await this.lessonsRepo.save(this.lessonsRepo.create({ section: s3, title: 'Configurar djangorestframework-simplejwt', slug: 'configurar-simplejwt', summary: 'Instala y configura JWT, rutas de token y refresh.', order: 1, status: 'PUBLISHED' }));
            await this.makePage(l1_1, 'Introducción', 1, 6, `# ¿Qué es Django REST Framework?

Django REST Framework (DRF) es la librería de referencia para construir **APIs RESTful** con Python y Django de forma robusta y escalable.

## ¿Por qué DRF?

- Serialización automática de modelos a JSON/XML.
- Sistema de autenticación pluggable: Session, Token, JWT, OAuth2.
- Permisos y throttling configurables por vista o globalmente.
- Browsable API: explora tus endpoints desde el navegador sin Postman.
- Documentación automática con drf-spectacular (OpenAPI 3.0).

## Requisitos previos

- Python 3.10+
- Django 4.x o superior
- Conocimiento básico de modelos y vistas Django`);
            await this.makePage(l1_2, 'Instalación', 1, 8, `# Instalación y proyecto base

## Entorno virtual y dependencias

\`\`\`bash
python -m venv venv
source venv/bin/activate        # Linux / macOS
venv\\Scripts\\activate            # Windows

pip install django djangorestframework
pip install djangorestframework-simplejwt
pip install django-cors-headers
\`\`\`

## Crear proyecto

\`\`\`bash
django-admin startproject config .
python manage.py startapp api
\`\`\`

## Registrar en INSTALLED_APPS

\`\`\`python
# config/settings.py
INSTALLED_APPS = [
    ...
    'rest_framework',
    'corsheaders',
    'api',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    ...
]

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticatedOrReadOnly',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
}
\`\`\``);
            await this.makePage(l2_1, 'Serializers', 1, 10, `# Serializers: del modelo al JSON

## ModelSerializer básico

\`\`\`python
# api/serializers.py
from rest_framework import serializers
from .models import Article

class ArticleSerializer(serializers.ModelSerializer):
    class Meta:
        model        = Article
        fields       = ['id', 'title', 'content', 'created_at']
        read_only_fields = ['id', 'created_at']
\`\`\`

## Validación personalizada

\`\`\`python
def validate_title(self, value):
    if len(value) < 5:
        raise serializers.ValidationError("Mínimo 5 caracteres.")
    return value.strip()
\`\`\`

## Relaciones anidadas

\`\`\`python
class ArticleSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    tags   = TagSerializer(many=True, read_only=True)

    class Meta:
        model  = Article
        fields = ['id', 'title', 'author', 'tags', 'content']
\`\`\``);
            await this.makePage(l2_2, 'APIView y ViewSet', 1, 12, `# APIView vs ViewSet

## APIView — control total

\`\`\`python
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

class ArticleListView(APIView):
    def get(self, request):
        articles   = Article.objects.filter(is_published=True)
        serializer = ArticleSerializer(articles, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = ArticleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(author=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
\`\`\`

## ViewSet + Router — menos código

\`\`\`python
from rest_framework.viewsets import ModelViewSet
from rest_framework.routers  import DefaultRouter

class ArticleViewSet(ModelViewSet):
    queryset         = Article.objects.filter(is_published=True)
    serializer_class = ArticleSerializer

# urls.py
router = DefaultRouter()
router.register('articles', ArticleViewSet)
urlpatterns = router.urls
\`\`\`

> **Regla práctica**: usa \`APIView\` para lógica muy personalizada; usa \`ViewSet\` cuando el CRUD estándar cubre tus necesidades.`);
            await this.makePage(l3_1, 'JWT con SimpleJWT', 1, 10, `# Autenticación con JWT

## Configurar rutas

\`\`\`python
# config/urls.py
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path('api/token/',         TokenObtainPairView.as_view()),
    path('api/token/refresh/', TokenRefreshView.as_view()),
]
\`\`\`

## Obtener token

\`\`\`bash
curl -X POST http://localhost:8000/api/token/ \\
  -H "Content-Type: application/json" \\
  -d '{"username": "admin", "password": "Admin123*"}'
\`\`\`

Respuesta:
\`\`\`json
{ "access": "eyJhbGci...", "refresh": "eyJhbGci..." }
\`\`\`

## Proteger una vista

\`\`\`python
from rest_framework.permissions import IsAuthenticated

class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"user": request.user.username})
\`\`\``);
        }
        const t2Slug = 'react-typescript-para-backend';
        const t2Exists = await this.coursesRepo.findOne({ where: { slug: t2Slug } });
        if (!t2Exists) {
            const course = await this.coursesRepo.save(this.coursesRepo.create({
                title: 'React + TypeScript para desarrolladores backend',
                slug: 'react-typescript-para-backend',
                description: 'Aprende React y TypeScript desde la perspectiva de alguien que ya sabe Python y Django. Consumo de APIs, estado y TanStack Query.',
                level: 'Intermedio',
                status: 'PUBLISHED',
            }));
            const s1 = await this.sectionsRepo.save(this.sectionsRepo.create({ course, title: 'Bases de React y TypeScript', order: 1, status: 'PUBLISHED' }));
            const l1 = await this.lessonsRepo.save(this.lessonsRepo.create({ section: s1, title: 'Por qué TypeScript sobre JavaScript', slug: 'por-que-typescript', summary: 'Ventajas de tipos estáticos en proyectos de mediano y gran porte.', order: 1, status: 'PUBLISHED' }));
            const l2 = await this.lessonsRepo.save(this.lessonsRepo.create({ section: s1, title: 'Componentes y props tipados', slug: 'componentes-y-props-tipados', summary: 'Define interfaces para props y evita errores en compilación.', order: 2, status: 'PUBLISHED' }));
            const s2 = await this.sectionsRepo.save(this.sectionsRepo.create({ course, title: 'Consumo de APIs REST', order: 2, status: 'PUBLISHED' }));
            const l3 = await this.lessonsRepo.save(this.lessonsRepo.create({ section: s2, title: 'Axios + TanStack Query', slug: 'axios-tanstack-query', summary: 'Configura cliente HTTP y maneja fetching, caché e invalidación.', order: 1, status: 'PUBLISHED' }));
            const l4 = await this.lessonsRepo.save(this.lessonsRepo.create({ section: s2, title: 'Autenticación con cookies HttpOnly', slug: 'autenticacion-cookies-httponly', summary: 'Implementa login seguro usando cookies en lugar de localStorage.', order: 2, status: 'PUBLISHED' }));
            await this.makePage(l1, 'Por qué TypeScript', 1, 8, `# Por qué TypeScript sobre JavaScript

Si vienes de Python, ya valoras los tipos. TypeScript le da eso a JavaScript — errores en compilación, no en producción.

## Error silencioso en JS vs. error explícito en TS

\`\`\`typescript
// JavaScript — error silencioso en runtime
function add(a, b) { return a + b; }
add("2", 3); // → "23"  (concatenación, no suma)

// TypeScript — error en compilación
function add(a: number, b: number): number { return a + b; }
add("2", 3); // Error: Argument of type 'string' is not assignable to 'number'
\`\`\`

## interface vs type

\`\`\`typescript
// interface — para objetos (extensible, preferido para props)
interface User {
  id:    string;
  name:  string;
  email: string;
  role?: 'admin' | 'student';  // opcional con ?
}

// type — para uniones y tipos complejos
type Status = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
type ID     = string | number;
\`\`\``);
            await this.makePage(l2, 'Componentes tipados', 1, 10, `# Componentes y props tipados

## Props con interface

\`\`\`typescript
interface CourseCardProps {
  id:          string;
  title:       string;
  description: string;
  level?:      'Principiante' | 'Intermedio' | 'Avanzado';
  onClick:     (id: string) => void;
}

export function CourseCard({
  id, title, description,
  level = 'Principiante',
  onClick,
}: CourseCardProps) {
  return (
    <div onClick={() => onClick(id)}>
      <h3>{title}</h3>
      <p>{description}</p>
      <span>{level}</span>
    </div>
  );
}
\`\`\`

## useState tipado

\`\`\`typescript
const [user,  setUser]  = useState<User | null>(null);
const [count, setCount] = useState<number>(0);
const [items, setItems] = useState<string[]>([]);
\`\`\``);
            await this.makePage(l3, 'TanStack Query', 1, 12, `# Axios + TanStack Query

## Configurar cliente HTTP

\`\`\`typescript
// src/shared/api/http.ts
import axios from 'axios';

const http = axios.create({
  baseURL:         import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,  // envía cookies HttpOnly
});

export default http;
\`\`\`

## useQuery para GET

\`\`\`typescript
import { useQuery } from '@tanstack/react-query';
import http from '../shared/api/http';

interface Course { id: string; title: string; slug: string; }

export function useCourses() {
  return useQuery({
    queryKey: ['courses'],
    queryFn:  () => http.get('/public/video-courses').then(r => r.data.data as Course[]),
    staleTime: 1000 * 60 * 5,
  });
}
\`\`\`

## useMutation para POST/PUT/DELETE

\`\`\`typescript
const mutation = useMutation({
  mutationFn: (data: Partial<Course>) =>
    data.id
      ? http.put(\`/courses/\${data.id}\`, data)
      : http.post('/courses', data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['courses'] });
  },
});
\`\`\``);
            await this.makePage(l4, 'Cookies HttpOnly', 1, 10, `# Autenticación con cookies HttpOnly

## localStorage vs Cookie HttpOnly

| | localStorage | Cookie HttpOnly |
|---|---|---|
| XSS | ⚠ Vulnerable | ✅ Protegido |
| Acceso desde JS | Sí | No |
| Envío automático | No | Sí (same-origin) |

## Login — el backend hace el trabajo

\`\`\`typescript
async function login(email: string, password: string) {
  // El backend responde con:  Set-Cookie: jwt=...; HttpOnly; Secure; SameSite=Lax
  await http.post('/auth/login', { email, password });
  // La cookie queda almacenada automáticamente por el navegador
}
\`\`\`

## Verificar sesión al cargar la app

\`\`\`typescript
const { data: user } = useQuery({
  queryKey: ['me'],
  queryFn:  () => http.get('/user').then(r => r.data.data),
  retry:    false,
  staleTime: Infinity,
});
\`\`\``);
        }
    }
    async seedVideoCourses() {
        const v1Slug = 'python-django-de-cero';
        const v1Exists = await this.videoCoursesRepo.findOne({ where: { slug: v1Slug } });
        if (!v1Exists) {
            const course = await this.videoCoursesRepo.save(this.videoCoursesRepo.create({
                title: 'Python y Django — De cero a tu primera API',
                slug: 'python-django-de-cero',
                description: 'Aprende Python moderno y construye tu primera API REST con Django. Ideal si vienes de JavaScript o no tienes experiencia en backend.',
                level: 'Principiante', status: 'PUBLISHED', thumbnail: null,
            }));
            const s1 = await this.videoSectionsRepo.save(this.videoSectionsRepo.create({ course, title: 'Fundamentos de Python', order: 1 }));
            await this.videoLessonsRepo.save(this.videoLessonsRepo.create({
                section: s1, order: 1, status: 'PUBLISHED',
                title: 'Introducción y configuración del entorno',
                slug: 'python-intro-entorno',
                video_type: 'youtube', video_url: 'https://www.youtube.com/watch?v=_uQrJ0TkZlc',
                duration_seconds: 360, is_free_preview: true,
                markdown: `# Introducción a Python\n\nConfiguramos Python 3.11+, VS Code y creamos nuestro primer script.\n\n\`\`\`bash\npython --version  # Python 3.11.x\npip --version\n\`\`\``,
            }));
            await this.videoLessonsRepo.save(this.videoLessonsRepo.create({
                section: s1, order: 2, status: 'PUBLISHED',
                title: 'Variables, tipos y estructuras de datos',
                slug: 'python-variables-tipos',
                video_type: 'youtube', video_url: 'https://www.youtube.com/watch?v=rfscVS0vtbw',
                duration_seconds: 480, is_free_preview: false,
                markdown: `# Variables y tipos\n\n\`\`\`python\nname  = "Francisco"\nstack = ["Django", "React", "PostgreSQL"]\nperson = {"name": "Francisco", "role": "dev"}\n\`\`\``,
            }));
            const s2 = await this.videoSectionsRepo.save(this.videoSectionsRepo.create({ course, title: 'Django y modelos', order: 2 }));
            await this.videoLessonsRepo.save(this.videoLessonsRepo.create({
                section: s2, order: 1, status: 'PUBLISHED',
                title: 'Tu primer proyecto Django',
                slug: 'primer-proyecto-django',
                video_type: 'youtube', video_url: 'https://www.youtube.com/watch?v=rHux0gMZ3Eg',
                duration_seconds: 540, is_free_preview: false,
                markdown: `# Primer proyecto Django\n\n\`\`\`bash\ndjango-admin startproject config .\npython manage.py startapp api\npython manage.py runserver\n\`\`\``,
            }));
            await this.videoLessonsRepo.save(this.videoLessonsRepo.create({
                section: s2, order: 2, status: 'PUBLISHED',
                title: 'Modelos y migraciones',
                slug: 'django-modelos-migraciones',
                video_type: 'youtube', video_url: 'https://www.youtube.com/watch?v=F5mRW0jo-U4',
                duration_seconds: 600, is_free_preview: false,
                markdown: `# Modelos y migraciones\n\n\`\`\`python\nclass Article(models.Model):\n    title      = models.CharField(max_length=200)\n    content    = models.TextField()\n    created_at = models.DateTimeField(auto_now_add=True)\n\`\`\`\n\n\`\`\`bash\npython manage.py makemigrations\npython manage.py migrate\n\`\`\``,
            }));
            const s3 = await this.videoSectionsRepo.save(this.videoSectionsRepo.create({ course, title: 'Django REST Framework', order: 3 }));
            await this.videoLessonsRepo.save(this.videoLessonsRepo.create({
                section: s3, order: 1, status: 'PUBLISHED',
                title: 'Serializers y tu primera API',
                slug: 'drf-serializers-primera-api',
                video_type: 'youtube', video_url: 'https://www.youtube.com/watch?v=i5JykvxUk_A',
                duration_seconds: 660, is_free_preview: false,
                markdown: `# Primera API con DRF\n\n\`\`\`python\nclass ArticleSerializer(serializers.ModelSerializer):\n    class Meta:\n        model  = Article\n        fields = '__all__'\n\nclass ArticleViewSet(viewsets.ModelViewSet):\n    queryset         = Article.objects.all()\n    serializer_class = ArticleSerializer\n\`\`\``,
            }));
        }
        const v2Slug = 'react-typescript-intermedio';
        const v2Exists = await this.videoCoursesRepo.findOne({ where: { slug: v2Slug } });
        if (!v2Exists) {
            const course = await this.videoCoursesRepo.save(this.videoCoursesRepo.create({
                title: 'React + TypeScript — Nivel intermedio',
                slug: 'react-typescript-intermedio',
                description: 'Hooks avanzados, TanStack Query, React Router v6, formularios con validación y patrones de componentes en proyectos reales.',
                level: 'Intermedio', status: 'PUBLISHED', thumbnail: null,
            }));
            const s1 = await this.videoSectionsRepo.save(this.videoSectionsRepo.create({ course, title: 'Hooks avanzados', order: 1 }));
            await this.videoLessonsRepo.save(this.videoLessonsRepo.create({
                section: s1, order: 1, status: 'PUBLISHED',
                title: 'useReducer y useContext — estado global sin Redux',
                slug: 'usereducer-usecontext',
                video_type: 'youtube', video_url: 'https://www.youtube.com/watch?v=RZPAQV7JvNU',
                duration_seconds: 720, is_free_preview: true,
                markdown: `# useReducer y useContext\n\n\`\`\`typescript\ntype Action = { type: 'SET_USER'; payload: User } | { type: 'CLEAR_USER' };\n\nfunction authReducer(state: AuthState, action: Action): AuthState {\n  switch (action.type) {\n    case 'SET_USER':   return { ...state, user: action.payload };\n    case 'CLEAR_USER': return { user: null, isAuth: false };\n    default:           return state;\n  }\n}\n\`\`\``,
            }));
            await this.videoLessonsRepo.save(this.videoLessonsRepo.create({
                section: s1, order: 2, status: 'PUBLISHED',
                title: 'useMemo y useCallback — rendimiento',
                slug: 'usememo-usecallback',
                video_type: 'youtube', video_url: 'https://www.youtube.com/watch?v=THL1OPn72vo',
                duration_seconds: 540, is_free_preview: false,
                markdown: `# useMemo y useCallback\n\n\`\`\`typescript\nconst filtered = useMemo(\n  () => courses.filter(c => c.level === level),\n  [courses, level]\n);\n\nconst handleDelete = useCallback(\n  (id: string) => deleteMutation.mutate(id),\n  [deleteMutation]\n);\n\`\`\``,
            }));
            const s2 = await this.videoSectionsRepo.save(this.videoSectionsRepo.create({ course, title: 'Routing y lazy loading', order: 2 }));
            await this.videoLessonsRepo.save(this.videoLessonsRepo.create({
                section: s2, order: 1, status: 'PUBLISHED',
                title: 'React Router v6 — rutas anidadas y protegidas',
                slug: 'react-router-v6-rutas-protegidas',
                video_type: 'youtube', video_url: 'https://www.youtube.com/watch?v=59IXY5IDrBA',
                duration_seconds: 660, is_free_preview: false,
                markdown: `# React Router v6\n\n\`\`\`typescript\nexport function RequireAuth() {\n  const { user, isLoading } = useAuth();\n  if (isLoading) return <Spinner />;\n  if (!user)     return <Navigate to="/login" replace />;\n  return <Outlet />;\n}\n\`\`\``,
            }));
            const s3 = await this.videoSectionsRepo.save(this.videoSectionsRepo.create({ course, title: 'Formularios y validación', order: 3 }));
            await this.videoLessonsRepo.save(this.videoLessonsRepo.create({
                section: s3, order: 1, status: 'PUBLISHED',
                title: 'Formularios controlados con TypeScript',
                slug: 'formularios-controlados-typescript',
                video_type: 'youtube', video_url: 'https://www.youtube.com/watch?v=SdzMBWT2CDQ',
                duration_seconds: 480, is_free_preview: false,
                markdown: `# Formularios controlados\n\n\`\`\`typescript\ninterface LoginForm { email: string; password: string; }\n\nconst [form, setForm] = useState<LoginForm>({ email: '', password: '' });\n\nfunction handleSubmit(e: React.FormEvent) {\n  e.preventDefault();\n  loginMutation.mutate(form);\n}\n\`\`\``,
            }));
        }
    }
    async seedResources() {
        if ((await this.resourcesRepo.count()) > 0)
            return;
        const resources = [
            { title: 'Visual Studio Code', description: 'El editor más popular para desarrollo web. Soporte nativo para TypeScript, Python, Java y extensiones para cada framework.', type: resource_entity_1.ResourceType.TOOL, url: 'https://code.visualstudio.com/', tags: ['Editor', 'IDE', 'TypeScript', 'Python'], is_free: true, is_published: true, order: 0 },
            { title: 'Postman', description: 'Cliente HTTP para probar y documentar APIs REST. Imprescindible al trabajar con Django REST Framework, NestJS o Spring Boot.', type: resource_entity_1.ResourceType.TOOL, url: 'https://www.postman.com/', tags: ['API', 'REST', 'Testing'], is_free: true, is_published: true, order: 1 },
            { title: 'TablePlus', description: 'GUI para PostgreSQL, MySQL, MSSQL y MongoDB. Ideal para inspeccionar modelos en desarrollo sin escribir SQL a mano.', type: resource_entity_1.ResourceType.TOOL, url: 'https://tableplus.com/', tags: ['PostgreSQL', 'Database', 'GUI'], is_free: true, is_published: true, order: 2 },
            { title: 'Docker Desktop', description: 'Contenedores para aislar entornos de desarrollo. Elimina el "en mi máquina funciona" con Docker Compose para backend + base de datos.', type: resource_entity_1.ResourceType.TOOL, url: 'https://www.docker.com/products/docker-desktop/', tags: ['Docker', 'DevOps', 'Contenedores'], is_free: true, is_published: true, order: 3 },
            { title: 'IntelliJ IDEA', description: 'El IDE de referencia para Java y Spring Boot. Refactoring inteligente, soporte completo para Maven/Gradle y debugging avanzado.', type: resource_entity_1.ResourceType.TOOL, url: 'https://www.jetbrains.com/idea/', tags: ['Java', 'Spring Boot', 'IDE'], is_free: false, is_published: true, order: 4 },
            { title: 'Two Scoops of Django', description: 'El libro de referencia para buenas prácticas en Django. Estructura de proyectos, seguridad, testing y deployment en producción.', type: resource_entity_1.ResourceType.BOOK, url: 'https://www.feldroy.com/books/two-scoops-of-django-3-x', tags: ['Django', 'Python', 'Best Practices'], is_free: false, is_published: true, order: 5 },
            { title: 'Fluent Python (2da Ed.)', description: 'La guía definitiva para Python idiomático y eficiente. Data model, tipado, async, generators y mucho más.', type: resource_entity_1.ResourceType.BOOK, url: 'https://www.oreilly.com/library/view/fluent-python-2nd/9781492056348/', tags: ['Python', 'Avanzado'], is_free: false, is_published: true, order: 6 },
            { title: 'Spring Boot in Action', description: 'Construye aplicaciones Spring Boot desde cero. Configuración automática, seguridad, testing y deploy en producción.', type: resource_entity_1.ResourceType.BOOK, url: 'https://www.manning.com/books/spring-boot-in-action', tags: ['Java', 'Spring Boot', 'Backend'], is_free: false, is_published: true, order: 7 },
            { title: 'Learning TypeScript', description: 'Introducción práctica a TypeScript para quienes ya conocen JavaScript. Tipos, clases, generics y configuración de tsconfig.', type: resource_entity_1.ResourceType.BOOK, url: 'https://www.oreilly.com/library/view/learning-typescript/9781098110321/', tags: ['TypeScript', 'JavaScript'], is_free: false, is_published: true, order: 8 },
            { title: 'CS50P — Introduction to Programming with Python (Harvard)', description: 'El curso de Python de Harvard. Gratuito, riguroso y con certificado. El mejor punto de partida para aprender Python desde cero.', type: resource_entity_1.ResourceType.COURSE, url: 'https://cs50.harvard.edu/python/', tags: ['Python', 'Principiante', 'Harvard'], is_free: true, is_published: true, order: 9 },
            { title: 'AWS: Building Modern Python Applications on AWS', description: 'Curso oficial de AWS para construir aplicaciones serverless con Python: Lambda, API Gateway, DynamoDB y S3. Base para la certificación.', type: resource_entity_1.ResourceType.COURSE, url: 'https://aws.amazon.com/training/', tags: ['AWS', 'Python', 'Lambda', 'Serverless'], is_free: false, is_published: true, order: 10 },
            { title: 'The Odin Project — Full Stack JavaScript', description: 'Currículo open source completo para aprender desarrollo web full-stack con JavaScript, Node.js y React.', type: resource_entity_1.ResourceType.COURSE, url: 'https://www.theodinproject.com/', tags: ['JavaScript', 'React', 'Node.js'], is_free: true, is_published: true, order: 11 },
            { title: 'Django REST Framework — Documentación oficial', description: 'Documentación oficial de DRF. Completa, con ejemplos claros de serializers, views, autenticación y permisos.', type: resource_entity_1.ResourceType.LINK, url: 'https://www.django-rest-framework.org/', tags: ['Django', 'REST', 'Documentación'], is_free: true, is_published: true, order: 12 },
            { title: 'Spring Boot Reference Documentation', description: 'Documentación oficial de Spring Boot. Todo sobre auto-configuración, starters, actuator, seguridad y testing.', type: resource_entity_1.ResourceType.LINK, url: 'https://docs.spring.io/spring-boot/docs/current/reference/htmlsingle/', tags: ['Java', 'Spring Boot', 'Documentación'], is_free: true, is_published: true, order: 13 },
            { title: 'TanStack Query Docs', description: 'Documentación oficial de TanStack Query. Fetching, caching, mutaciones y optimistic updates con React.', type: resource_entity_1.ResourceType.LINK, url: 'https://tanstack.com/query/latest', tags: ['React', 'TanStack Query', 'Documentación'], is_free: true, is_published: true, order: 14 },
            { title: 'Roadmap.sh — Backend Developer', description: 'Mapa visual con todas las tecnologías y conceptos que un desarrollador backend debería conocer en 2025.', type: resource_entity_1.ResourceType.LINK, url: 'https://roadmap.sh/backend', tags: ['Backend', 'Roadmap', 'Carrera'], is_free: true, is_published: true, order: 15 },
            { title: 'NestJS Documentation', description: 'Documentación oficial de NestJS. Módulos, controladores, guards, interceptors, TypeORM y mucho más.', type: resource_entity_1.ResourceType.LINK, url: 'https://docs.nestjs.com/', tags: ['NestJS', 'Node.js', 'TypeScript', 'Documentación'], is_free: true, is_published: true, order: 16 },
            { title: 'Traversy Media — Django Crash Course', description: 'Tutorial intensivo de Django: modelos, vistas, templates y autenticación. Excelente repaso en pocas horas.', type: resource_entity_1.ResourceType.VIDEO, url: 'https://www.youtube.com/watch?v=e1IyzVyrLSU', tags: ['Django', 'Python', 'Tutorial'], is_free: true, is_published: true, order: 17 },
            { title: 'Amigoscode — Spring Boot Tutorial', description: 'Tutorial completo de Spring Boot con Java: REST API, JPA, seguridad con Spring Security y deploy.', type: resource_entity_1.ResourceType.VIDEO, url: 'https://www.youtube.com/watch?v=9SGDpanrc8U', tags: ['Java', 'Spring Boot', 'Tutorial'], is_free: true, is_published: true, order: 18 },
        ];
        for (const r of resources) {
            const exists = await this.resourcesRepo.findOne({ where: { title: r.title } });
            if (!exists) {
                await this.resourcesRepo.save(this.resourcesRepo.create(r));
            }
        }
    }
    async makePage(lesson, title, order, minutes, markdown) {
        const page = await this.pagesRepo.save(this.pagesRepo.create({ lesson, title, order, estimated_minutes: minutes, status: 'PUBLISHED' }));
        await this.blocksRepo.save(this.blocksRepo.create({ page, type: 'markdown', order: 1, data: { markdown } }));
        return page;
    }
    async ensureRole(name, permissions) {
        let role = await this.rolesRepo.findOne({ where: { name } });
        if (!role)
            role = await this.rolesRepo.save(this.rolesRepo.create({ name, permissions }));
        return role;
    }
    async ensureUser(email, password, firstName, lastName, role, status = user_entity_1.UserStatus.APPROVED) {
        const existing = await this.usersRepo.findOne({ where: { email } });
        if (existing)
            return existing;
        const password_hash = await bcrypt_1.default.hash(password, 10);
        return this.usersRepo.save(this.usersRepo.create({ email, password_hash, first_name: firstName, last_name: lastName, role, status, is_active: true }));
    }
};
exports.AppSeeder = AppSeeder;
exports.AppSeeder = AppSeeder = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(role_entity_1.Role)),
    __param(1, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(2, (0, typeorm_1.InjectRepository)(course_entity_1.Course)),
    __param(3, (0, typeorm_1.InjectRepository)(course_section_entity_1.CourseSection)),
    __param(4, (0, typeorm_1.InjectRepository)(lesson_entity_1.Lesson)),
    __param(5, (0, typeorm_1.InjectRepository)(lesson_page_entity_1.LessonPage)),
    __param(6, (0, typeorm_1.InjectRepository)(content_block_entity_1.ContentBlock)),
    __param(7, (0, typeorm_1.InjectRepository)(video_course_entity_1.VideoCourse)),
    __param(8, (0, typeorm_1.InjectRepository)(video_section_entity_1.VideoSection)),
    __param(9, (0, typeorm_1.InjectRepository)(video_lesson_entity_1.VideoLesson)),
    __param(10, (0, typeorm_1.InjectRepository)(contact_info_entity_1.ContactInfo)),
    __param(11, (0, typeorm_1.InjectRepository)(profile_item_entity_1.ProfileItem)),
    __param(12, (0, typeorm_1.InjectRepository)(project_entity_1.Project)),
    __param(13, (0, typeorm_1.InjectRepository)(resource_entity_1.Resource)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], AppSeeder);
//# sourceMappingURL=app.seeder.js.map