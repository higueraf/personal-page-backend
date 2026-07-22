import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import bcrypt from 'bcrypt';

import { ContentBlock }   from '../entities/content-block.entity';
import { Course }         from '../entities/course.entity';
import { CourseSection }  from '../entities/course-section.entity';
import { LessonPage }     from '../entities/lesson-page.entity';
import { Lesson }         from '../entities/lesson.entity';
import { Role }           from '../entities/role.entity';
import { User, UserStatus } from '../entities/user.entity';
import { VideoCourse }    from '../entities/video-course.entity';
import { VideoLesson }    from '../entities/video-lesson.entity';
import { VideoSection }   from '../entities/video-section.entity';
import { ContactInfo }    from '../entities/contact-info.entity';
import { ProfileItem, ProfileItemType } from '../entities/profile-item.entity';
import { Project, ProjectStatus } from '../entities/project.entity';
import { Resource, ResourceType } from '../entities/resource.entity';
import { PlaygroundTemplate } from '../entities/playground-template.entity';
import { ExamTemplate } from '../entities/exam-template.entity';
import { ExamVersion, ExamQuestion } from '../entities/exam-version.entity';

@Injectable()
export class AppSeeder {
  constructor(
    @InjectRepository(Role)          private readonly rolesRepo:         Repository<Role>,
    @InjectRepository(User)          private readonly usersRepo:         Repository<User>,
    @InjectRepository(Course)        private readonly coursesRepo:       Repository<Course>,
    @InjectRepository(CourseSection) private readonly sectionsRepo:      Repository<CourseSection>,
    @InjectRepository(Lesson)        private readonly lessonsRepo:       Repository<Lesson>,
    @InjectRepository(LessonPage)    private readonly pagesRepo:         Repository<LessonPage>,
    @InjectRepository(ContentBlock)  private readonly blocksRepo:        Repository<ContentBlock>,
    @InjectRepository(VideoCourse)   private readonly videoCoursesRepo:  Repository<VideoCourse>,
    @InjectRepository(VideoSection)  private readonly videoSectionsRepo: Repository<VideoSection>,
    @InjectRepository(VideoLesson)   private readonly videoLessonsRepo:  Repository<VideoLesson>,
    @InjectRepository(ContactInfo)   private readonly contactInfoRepo:   Repository<ContactInfo>,
    @InjectRepository(ProfileItem)   private readonly profileRepo:       Repository<ProfileItem>,
    @InjectRepository(Project)       private readonly projectsRepo:      Repository<Project>,
    @InjectRepository(Resource)      private readonly resourcesRepo:     Repository<Resource>,
    @InjectRepository(PlaygroundTemplate) private readonly playgroundTemplatesRepo: Repository<PlaygroundTemplate>,
    @InjectRepository(ExamTemplate)  private readonly examTemplatesRepo: Repository<ExamTemplate>,
    @InjectRepository(ExamVersion)   private readonly examVersionsRepo:  Repository<ExamVersion>,
  ) {}

  // ════════════════════════════════════════════════════════════════════════════
  async seed() {
    const adminRole   = await this.ensureRole('admin',   ['admin:*']);
    const teacherRole = await this.ensureRole('teacher', ['content:read', 'content:write']);
    const studentRole = await this.ensureRole('student', ['content:read']);

    const adminUser = await this.ensureUser('admin@higueraf.dev',   'Admin123*',   'Francisco', 'Higuera',  adminRole,   UserStatus.APPROVED);
    await this.ensureUser('student@higueraf.dev', 'Student123*', 'Demo',      'Student',  studentRole, UserStatus.APPROVED);
    await this.ensureUser('teacher@higueraf.dev', 'Teacher123*', 'Demo',      'Teacher',  teacherRole, UserStatus.APPROVED);

    // ── Alumnos ficticios para probar la distribución round-robin de variantes ──
    await this.ensureUser('alumno1.prueba@higueraf.dev', 'Alumno123*', 'Alumno', 'Uno',    studentRole, UserStatus.APPROVED);
    await this.ensureUser('alumno2.prueba@higueraf.dev', 'Alumno123*', 'Alumno', 'Dos',    studentRole, UserStatus.APPROVED);
    await this.ensureUser('alumno3.prueba@higueraf.dev', 'Alumno123*', 'Alumno', 'Tres',   studentRole, UserStatus.APPROVED);
    await this.ensureUser('alumno4.prueba@higueraf.dev', 'Alumno123*', 'Alumno', 'Cuatro', studentRole, UserStatus.APPROVED);

    await this.seedContactInfo();
    await this.seedProfile();
    await this.seedProjects();
    await this.seedTutorials();
    await this.seedVideoCourses();
    await this.seedResources();
    await this.seedPlaygroundTemplates(adminUser);
    await this.seedExamTemplates(adminUser);
    await this.seedExamTemplateTypeScriptV2(adminUser);
    await this.seedExamTemplateFlutter(adminUser);
    await this.seedExamTemplateFlutterSingle(adminUser);
    await this.seedExamTemplateNestJS(adminUser);
    await this.seedExamTemplateReact(adminUser);
    await this.seedExamTemplateReactSingle(adminUser);

    return { ok: true };
  }

  // ── 1. Contacto ──────────────────────────────────────────────────────────────
  private async seedContactInfo() {
    const items = [
      { key: 'email',    label: 'Correo electrónico', value: 'franciscohiguera@gmail.com',              icon: 'Mail',     order: 0, is_visible: true  },
      { key: 'phone',    label: 'Teléfono',           value: '+593 98 470 9901',                        icon: 'Phone',    order: 1, is_visible: true  },
      { key: 'linkedin', label: 'LinkedIn',           value: 'https://www.linkedin.com/in/francisco-higuera/', icon: 'Linkedin', order: 2, is_visible: true  },
      { key: 'github',   label: 'GitHub',             value: 'https://github.com/higueraf',             icon: 'Github',   order: 3, is_visible: true  },
    ];
    for (const i of items) {
      const exists = await this.contactInfoRepo.findOne({ where: { key: i.key } });
      if (!exists) {
        await this.contactInfoRepo.save(this.contactInfoRepo.create(i));
      }
    }
  }

  // ── 2. Perfil / Curriculum ────────────────────────────────────────────────────
  private async seedProfile() {
    if ((await this.profileRepo.count()) > 0) return;

    const items = [
      // ── Experiencia ──────────────────────────────────────────────────────────
      {
        type: ProfileItemType.EXPERIENCE, order: 0,
        title: 'Docente Universitario',
        subtitle: 'Universidad Tecnológica Equinoccial (UTE)',
        location: 'Quito, Ecuador',
        start_date: '2025-04', end_date: null,
        description: 'Docente de las materias Programación III, Programación IV y Calidad del Software. Formación de futuros ingenieros en desarrollo de software profesional.',
        tags: ['Python', 'Java', 'Calidad de Software', 'Docencia'],
      },
      {
        type: ProfileItemType.EXPERIENCE, order: 1,
        title: 'Arquitecto de Software',
        subtitle: 'SZ Fiber System',
        location: 'Ecuador',
        start_date: '2024-06', end_date: '2025-04',
        description: 'Diseño e implementación de arquitectura para plataforma ecommerce ourshop.shop. Decisiones técnicas sobre stack, microservicios y despliegue en AWS.',
        tags: ['Java 21', 'Spring Boot', 'Angular 18', 'MSSQL', 'AWS'],
      },
      {
        type: ProfileItemType.EXPERIENCE, order: 2,
        title: 'Software Backend Engineer',
        subtitle: 'JP Global Digital',
        location: 'Miami, USA (Remoto)',
        start_date: '2022-08', end_date: '2024-04',
        description: 'Desarrollo del Sistema Visor de Point Cloud para visualización de datos 3D. Arquitectura backend con C# .Net y NestJS, frontend con Vue.js y almacenamiento en Azure.',
        tags: ['C#', '.NET', 'NestJS', 'Vue.js', 'MSSQL', 'Azure'],
      },
      {
        type: ProfileItemType.EXPERIENCE, order: 3,
        title: 'Backend Developer',
        subtitle: 'Mi Águila',
        location: 'Bogotá, Colombia (Remoto)',
        start_date: '2021-01', end_date: '2022-06',
        description: 'Desarrollo del Sistema de Rutas con geolocalización en tiempo real y Sistema Ecommerce multi-tenant. Stack mixto C#, Java Spring Boot, Python Django y AWS.',
        tags: ['C#', 'Vue.js', 'Java', 'Spring Boot', 'Python', 'Django', 'PostgreSQL', 'AWS'],
      },
      {
        type: ProfileItemType.EXPERIENCE, order: 4,
        title: 'Fullstack Developer',
        subtitle: 'Corefix',
        location: 'Ciudad de México, México (Remoto)',
        start_date: '2020-06', end_date: '2020-12',
        description: 'Desarrollo de Sistema Ecommerce con Python Django en el backend, Angular en el frontend y C# para integraciones con servicios externos.',
        tags: ['Python', 'Django', 'Angular', 'C#'],
      },
      {
        type: ProfileItemType.EXPERIENCE, order: 5,
        title: 'Fullstack Developer – Freelancer',
        subtitle: 'MiWeb',
        location: 'Quito, Ecuador',
        start_date: '2020-01', end_date: '2021-01',
        description: 'Implementación y personalización de Sistema Contable sobre Odoo ERP. Desarrollo de módulos personalizados con Python, Django y JavaScript.',
        tags: ['Python', 'Django', 'Odoo ERP', 'JavaScript'],
      },
      {
        type: ProfileItemType.EXPERIENCE, order: 6,
        title: 'Fullstack Developer – Freelancer',
        subtitle: 'Ministerio de Agricultura y Cría del Ecuador',
        location: 'Quito, Ecuador',
        start_date: '2020-01', end_date: '2020-02',
        description: 'Desarrollo del Sistema de Control de Proyectos para gestión y seguimiento de proyectos agrícolas institucionales.',
        tags: ['PHP', 'Laravel', 'JavaScript'],
      },
      {
        type: ProfileItemType.EXPERIENCE, order: 7,
        title: 'Fullstack Developer',
        subtitle: 'Hermes.ec',
        location: 'Quito, Ecuador',
        start_date: '2017-03', end_date: '2020-12',
        description: 'Desarrollo y mantenimiento de Sistema Contable integral para empresa de logística. Arquitectura full-stack con Python Django, JavaScript y Java para módulos de reportería.',
        tags: ['Python', 'Django', 'JavaScript', 'Java'],
      },
      {
        type: ProfileItemType.EXPERIENCE, order: 8,
        title: 'Analista de Sistemas',
        subtitle: 'Secretaría de Salud del Estado Falcón',
        location: 'Falcón, Venezuela',
        start_date: '1998-09', end_date: '2017-02',
        description: 'Administración del Sistema Administrativo institucional, administración de servidores Linux y desarrollo de aplicaciones. Integración con sistemas de la UNEFM y UNEFA.',
        tags: ['PHP', 'CakePHP', 'PostgreSQL', 'Visual Basic', 'Linux'],
      },

      // ── Educación ────────────────────────────────────────────────────────────
      {
        type: ProfileItemType.EDUCATION, order: 0,
        title: 'Master en Ingeniería Biomédica',
        subtitle: 'Universidad Central "Marta Abreu" de Las Villas',
        location: 'Santa Clara, Cuba',
        start_date: '2013', end_date: '2016',
        description: 'Especialización en aplicación de tecnologías de la información al ámbito biomédico y sistemas de salud.',
        tags: ['Ingeniería Biomédica', 'Sistemas de Salud', 'TIC'],
      },
      {
        type: ProfileItemType.EDUCATION, order: 1,
        title: 'Ingeniero en Sistemas',
        subtitle: 'UNEFA – Universidad Nacional de las Fuerzas Armadas',
        location: 'Falcón, Venezuela',
        start_date: '2006', end_date: '2012',
        description: 'Formación en ingeniería de sistemas, desarrollo de software, redes, bases de datos y administración de servidores.',
        tags: ['Ingeniería de Sistemas', 'Redes', 'Bases de datos'],
      },

      // ── Certificaciones ──────────────────────────────────────────────────────
      {
        type: ProfileItemType.CERTIFICATION, order: 0,
        title: 'AWS: Building Modern Python Applications on AWS',
        subtitle: 'Amazon Web Services',
        description: 'Certificación en construcción de aplicaciones modernas con Python sobre servicios AWS: Lambda, API Gateway, DynamoDB, S3 y más.',
        tags: ['AWS', 'Python', 'Lambda', 'API Gateway', 'Cloud'],
      },
      {
        type: ProfileItemType.CERTIFICATION, order: 1,
        title: 'Big Data: Basic Principles',
        subtitle: 'Certificación en Big Data',
        description: 'Fundamentos de Big Data: procesamiento distribuido, ecosistema Hadoop, principios de análisis de grandes volúmenes de datos.',
        tags: ['Big Data', 'Hadoop', 'Data Engineering'],
      },
      {
        type: ProfileItemType.CERTIFICATION, order: 2,
        title: 'Lenguajes de Programación: C# .Net Core, Python, Nodejs, Java, PHP, Angular, React',
        subtitle: 'Certificaciones técnicas múltiples',
        description: 'Certificaciones en múltiples lenguajes y frameworks de desarrollo de software tanto para backend como frontend.',
        tags: ['C#', '.NET Core', 'Python', 'Node.js', 'Java', 'PHP', 'Angular', 'React'],
      },
      {
        type: ProfileItemType.CERTIFICATION, order: 3,
        title: 'Bases de Datos: PostgreSQL, MySQL, MongoDB, MSSQL',
        subtitle: 'Certificaciones en Bases de Datos',
        description: 'Dominio certificado en motores de bases de datos relacionales y NoSQL para diseño, optimización y administración.',
        tags: ['PostgreSQL', 'MySQL', 'MongoDB', 'MSSQL'],
      },

      // ── Habilidades técnicas ──────────────────────────────────────────────────
      {
        type: ProfileItemType.SKILL, order: 0,
        title: 'Backend Development',
        description: 'Python (10 años) · Django (7 años) · PHP / CakePHP (10 años) · Java / Spring Boot (7 años) · Node.js (5 años) · TypeScript / NestJS (5 años) · AdonisJS · ExpressJS · Laravel · C# / .NET',
        tags: ['Python', 'Django', 'Java', 'Spring Boot', 'NestJS', 'PHP', 'Laravel', 'C#', '.NET'],
      },
      {
        type: ProfileItemType.SKILL, order: 1,
        title: 'Frontend Development',
        description: 'React.js (5 años) · Angular (5 años) · Vue.js (5 años) · TypeScript · JavaScript',
        tags: ['React', 'Angular', 'Vue.js', 'TypeScript', 'JavaScript'],
      },
      {
        type: ProfileItemType.SKILL, order: 2,
        title: 'Bases de datos',
        description: 'PostgreSQL · MySQL · MongoDB · MSSQL · Diseño de esquemas, optimización de queries y administración.',
        tags: ['PostgreSQL', 'MySQL', 'MongoDB', 'MSSQL'],
      },
      {
        type: ProfileItemType.SKILL, order: 3,
        title: 'DevOps & Cloud',
        description: 'AWS (5 años) · Azure (5 años) · GitHub / GitHub Actions (5 años) · Docker · Linux servers · Redes LAN/WAN/MAN',
        tags: ['AWS', 'Azure', 'Docker', 'GitHub Actions', 'Linux'],
      },
      {
        type: ProfileItemType.SKILL, order: 4,
        title: 'Gestión & Arquitectura',
        description: 'Análisis de sistemas · Diseño de arquitectura de software · Gestión de proyectos · Toma de decisiones técnicas · Soporte técnico.',
        tags: ['Arquitectura de Software', 'Gestión de Proyectos', 'Análisis de Sistemas'],
      },

      // ── Idiomas ───────────────────────────────────────────────────────────────
      {
        type: ProfileItemType.LANGUAGE, order: 0,
        title: 'Español', subtitle: 'Nativo', tags: [],
      },
      {
        type: ProfileItemType.LANGUAGE, order: 1,
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

  // ── 3. Proyectos ──────────────────────────────────────────────────────────────
  private async seedProjects() {
    if ((await this.projectsRepo.count()) > 0) return;

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
        status: ProjectStatus.PUBLISHED,
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
        status: ProjectStatus.PUBLISHED,
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
        status: ProjectStatus.PUBLISHED,
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
        status: ProjectStatus.PUBLISHED,
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
        status: ProjectStatus.PUBLISHED,
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
        status: ProjectStatus.PUBLISHED,
      },
    ];

    for (const p of projects) {
      const exists = await this.projectsRepo.findOne({ where: { slug: p.slug } });
      if (!exists) {
        await this.projectsRepo.save(this.projectsRepo.create(p));
      }
    }
  }

  // ── 4. Tutoriales (cursos de texto) ───────────────────────────────────────────
  private async seedTutorials() {
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

    // ── Tutorial 2: React + TypeScript para backends ──────────────────────────
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

  // ── 5. Cursos en video ────────────────────────────────────────────────────────
  private async seedVideoCourses() {
    // ── Curso 1: Python y Django para principiantes ───────────────────────────
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

    // ── Curso 2: React + TypeScript Intermedio ────────────────────────────────
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

  // ── 6. Recursos ───────────────────────────────────────────────────────────────
  private async seedResources() {
    if ((await this.resourcesRepo.count()) > 0) return;

    const resources = [
      // ── Herramientas ─────────────────────────────────────────────────────────
      { title: 'Visual Studio Code', description: 'El editor más popular para desarrollo web. Soporte nativo para TypeScript, Python, Java y extensiones para cada framework.', type: ResourceType.TOOL, url: 'https://code.visualstudio.com/', tags: ['Editor', 'IDE', 'TypeScript', 'Python'], is_free: true, is_published: true, order: 0 },
      { title: 'Postman', description: 'Cliente HTTP para probar y documentar APIs REST. Imprescindible al trabajar con Django REST Framework, NestJS o Spring Boot.', type: ResourceType.TOOL, url: 'https://www.postman.com/', tags: ['API', 'REST', 'Testing'], is_free: true, is_published: true, order: 1 },
      { title: 'TablePlus', description: 'GUI para PostgreSQL, MySQL, MSSQL y MongoDB. Ideal para inspeccionar modelos en desarrollo sin escribir SQL a mano.', type: ResourceType.TOOL, url: 'https://tableplus.com/', tags: ['PostgreSQL', 'Database', 'GUI'], is_free: true, is_published: true, order: 2 },
      { title: 'Docker Desktop', description: 'Contenedores para aislar entornos de desarrollo. Elimina el "en mi máquina funciona" con Docker Compose para backend + base de datos.', type: ResourceType.TOOL, url: 'https://www.docker.com/products/docker-desktop/', tags: ['Docker', 'DevOps', 'Contenedores'], is_free: true, is_published: true, order: 3 },
      { title: 'IntelliJ IDEA', description: 'El IDE de referencia para Java y Spring Boot. Refactoring inteligente, soporte completo para Maven/Gradle y debugging avanzado.', type: ResourceType.TOOL, url: 'https://www.jetbrains.com/idea/', tags: ['Java', 'Spring Boot', 'IDE'], is_free: false, is_published: true, order: 4 },

      // ── Libros ───────────────────────────────────────────────────────────────
      { title: 'Two Scoops of Django', description: 'El libro de referencia para buenas prácticas en Django. Estructura de proyectos, seguridad, testing y deployment en producción.', type: ResourceType.BOOK, url: 'https://www.feldroy.com/books/two-scoops-of-django-3-x', tags: ['Django', 'Python', 'Best Practices'], is_free: false, is_published: true, order: 5 },
      { title: 'Fluent Python (2da Ed.)', description: 'La guía definitiva para Python idiomático y eficiente. Data model, tipado, async, generators y mucho más.', type: ResourceType.BOOK, url: 'https://www.oreilly.com/library/view/fluent-python-2nd/9781492056348/', tags: ['Python', 'Avanzado'], is_free: false, is_published: true, order: 6 },
      { title: 'Spring Boot in Action', description: 'Construye aplicaciones Spring Boot desde cero. Configuración automática, seguridad, testing y deploy en producción.', type: ResourceType.BOOK, url: 'https://www.manning.com/books/spring-boot-in-action', tags: ['Java', 'Spring Boot', 'Backend'], is_free: false, is_published: true, order: 7 },
      { title: 'Learning TypeScript', description: 'Introducción práctica a TypeScript para quienes ya conocen JavaScript. Tipos, clases, generics y configuración de tsconfig.', type: ResourceType.BOOK, url: 'https://www.oreilly.com/library/view/learning-typescript/9781098110321/', tags: ['TypeScript', 'JavaScript'], is_free: false, is_published: true, order: 8 },

      // ── Cursos externos ───────────────────────────────────────────────────────
      { title: 'CS50P — Introduction to Programming with Python (Harvard)', description: 'El curso de Python de Harvard. Gratuito, riguroso y con certificado. El mejor punto de partida para aprender Python desde cero.', type: ResourceType.COURSE, url: 'https://cs50.harvard.edu/python/', tags: ['Python', 'Principiante', 'Harvard'], is_free: true, is_published: true, order: 9 },
      { title: 'AWS: Building Modern Python Applications on AWS', description: 'Curso oficial de AWS para construir aplicaciones serverless con Python: Lambda, API Gateway, DynamoDB y S3. Base para la certificación.', type: ResourceType.COURSE, url: 'https://aws.amazon.com/training/', tags: ['AWS', 'Python', 'Lambda', 'Serverless'], is_free: false, is_published: true, order: 10 },
      { title: 'The Odin Project — Full Stack JavaScript', description: 'Currículo open source completo para aprender desarrollo web full-stack con JavaScript, Node.js y React.', type: ResourceType.COURSE, url: 'https://www.theodinproject.com/', tags: ['JavaScript', 'React', 'Node.js'], is_free: true, is_published: true, order: 11 },

      // ── Documentación / Referencias ───────────────────────────────────────────
      { title: 'Django REST Framework — Documentación oficial', description: 'Documentación oficial de DRF. Completa, con ejemplos claros de serializers, views, autenticación y permisos.', type: ResourceType.LINK, url: 'https://www.django-rest-framework.org/', tags: ['Django', 'REST', 'Documentación'], is_free: true, is_published: true, order: 12 },
      { title: 'Spring Boot Reference Documentation', description: 'Documentación oficial de Spring Boot. Todo sobre auto-configuración, starters, actuator, seguridad y testing.', type: ResourceType.LINK, url: 'https://docs.spring.io/spring-boot/docs/current/reference/htmlsingle/', tags: ['Java', 'Spring Boot', 'Documentación'], is_free: true, is_published: true, order: 13 },
      { title: 'TanStack Query Docs', description: 'Documentación oficial de TanStack Query. Fetching, caching, mutaciones y optimistic updates con React.', type: ResourceType.LINK, url: 'https://tanstack.com/query/latest', tags: ['React', 'TanStack Query', 'Documentación'], is_free: true, is_published: true, order: 14 },
      { title: 'Roadmap.sh — Backend Developer', description: 'Mapa visual con todas las tecnologías y conceptos que un desarrollador backend debería conocer en 2025.', type: ResourceType.LINK, url: 'https://roadmap.sh/backend', tags: ['Backend', 'Roadmap', 'Carrera'], is_free: true, is_published: true, order: 15 },
      { title: 'NestJS Documentation', description: 'Documentación oficial de NestJS. Módulos, controladores, guards, interceptors, TypeORM y mucho más.', type: ResourceType.LINK, url: 'https://docs.nestjs.com/', tags: ['NestJS', 'Node.js', 'TypeScript', 'Documentación'], is_free: true, is_published: true, order: 16 },

      // ── Videos ────────────────────────────────────────────────────────────────
      { title: 'Traversy Media — Django Crash Course', description: 'Tutorial intensivo de Django: modelos, vistas, templates y autenticación. Excelente repaso en pocas horas.', type: ResourceType.VIDEO, url: 'https://www.youtube.com/watch?v=e1IyzVyrLSU', tags: ['Django', 'Python', 'Tutorial'], is_free: true, is_published: true, order: 17 },
      { title: 'Amigoscode — Spring Boot Tutorial', description: 'Tutorial completo de Spring Boot con Java: REST API, JPA, seguridad con Spring Security y deploy.', type: ResourceType.VIDEO, url: 'https://www.youtube.com/watch?v=9SGDpanrc8U', tags: ['Java', 'Spring Boot', 'Tutorial'], is_free: true, is_published: true, order: 18 },
    ];

    for (const r of resources) {
      const exists = await this.resourcesRepo.findOne({ where: { title: r.title } });
      if (!exists) {
        await this.resourcesRepo.save(this.resourcesRepo.create(r));
      }
    }
  }

  // ── 7. Plantillas de Playground (Hello World básico por lenguaje) ────────────
  private async seedPlaygroundTemplates(admin: User) {
    const templates: {
      name: string;
      language: string;
      description: string;
      files: PlaygroundTemplate['files'];
    }[] = [
      {
        name: 'Hello World — Python', language: 'python',
        description: 'Ejemplo básico de Python: imprime un saludo por consola.',
        files: [{ name: 'main.py', path: '/main.py', is_folder: false, content: 'print("Hello World!")\n' }],
      },
      {
        name: 'Hello World — JavaScript', language: 'javascript',
        description: 'Ejemplo básico de JavaScript: imprime un saludo por consola.',
        files: [{ name: 'main.js', path: '/main.js', is_folder: false, content: 'console.log("Hello World!");\n' }],
      },
      {
        name: 'Hello World — TypeScript', language: 'typescript',
        description: 'Ejemplo básico de TypeScript: imprime un saludo por consola.',
        files: [{ name: 'main.ts', path: '/main.ts', is_folder: false, content: 'const message: string = "Hello World!";\nconsole.log(message);\n' }],
      },
      {
        name: 'Hello World — Kotlin', language: 'kotlin',
        description: 'Ejemplo básico de Kotlin: imprime un saludo por consola.',
        files: [{ name: 'main.kt', path: '/main.kt', is_folder: false, content: 'fun main() {\n    println("Hello World!")\n}\n' }],
      },
      {
        name: 'Hello World — Dart', language: 'dart',
        description: 'Ejemplo básico de Dart: imprime un saludo por consola.',
        files: [{ name: 'main.dart', path: '/main.dart', is_folder: false, content: 'void main() {\n  print("Hello World!");\n}\n' }],
      },
      {
        name: 'Hello World — R', language: 'r',
        description: 'Ejemplo básico de R: imprime un saludo por consola.',
        files: [{ name: 'main.R', path: '/main.R', is_folder: false, content: 'cat("Hello World!\\n")\n' }],
      },
      {
        name: 'Hello World — HTML/CSS/JS', language: 'html',
        description: 'Ejemplo básico web: una página con un saludo.',
        files: [
          { name: 'index.html', path: '/index.html', is_folder: false, content: '<!DOCTYPE html>\n<html>\n<head>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <h1>Hello World!</h1>\n  <script src="script.js"></script>\n</body>\n</html>\n' },
          { name: 'style.css', path: '/style.css', is_folder: false, content: 'h1 { color: #333; text-align: center; font-family: sans-serif; }\n' },
          { name: 'script.js', path: '/script.js', is_folder: false, content: 'console.log("Hello World!");\n' },
        ],
      },
      {
        name: 'Hello World — React', language: 'react',
        description: 'Ejemplo básico de React + TypeScript: componente que muestra un saludo.',
        files: [
          { name: 'src', path: '/src', is_folder: true, content: '' },
          {
            name: 'main.tsx', path: '/src/main.tsx', is_folder: false,
            content: `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\n\nconst root = ReactDOM.createRoot(document.getElementById('root')!);\nroot.render(<App />);\n`,
          },
          {
            name: 'App.tsx', path: '/src/App.tsx', is_folder: false,
            content: `import React from 'react';\n\nexport default function App() {\n  return (\n    <div style={{ fontFamily: 'sans-serif', padding: '2rem', textAlign: 'center' }}>\n      <h1>Hello World!</h1>\n    </div>\n  );\n}\n`,
          },
        ],
      },
      {
        name: 'Hello World — Flutter', language: 'flutter',
        description: 'Ejemplo básico de Flutter: una pantalla con un saludo.',
        files: [
          { name: 'lib', path: '/lib', is_folder: true, content: '' },
          {
            name: 'main.dart', path: '/lib/main.dart', is_folder: false,
            content: `import 'package:flutter/material.dart';\n\nvoid main() {\n  runApp(const MyApp());\n}\n\nclass MyApp extends StatelessWidget {\n  const MyApp({super.key});\n\n  @override\n  Widget build(BuildContext context) {\n    return MaterialApp(\n      debugShowCheckedModeBanner: false,\n      home: Scaffold(\n        body: Center(\n          child: Text('Hello World!', style: TextStyle(fontSize: 24)),\n        ),\n      ),\n    );\n  }\n}\n`,
          },
          {
            name: 'pubspec.yaml', path: '/pubspec.yaml', is_folder: false,
            content: `name: flutter_hello_world\ndescription: Ejemplo básico de Flutter.\n\nenvironment:\n  sdk: '>=3.0.0 <4.0.0'\n  flutter: '>=3.10.0'\n\ndependencies:\n  flutter:\n    sdk: flutter\n`,
          },
        ],
      },
      {
        name: 'Hello World — React Native', language: 'react-native',
        description: 'Ejemplo básico de React Native: una pantalla con un saludo.',
        files: [
          {
            name: 'App.tsx', path: '/App.tsx', is_folder: false,
            content: `import { Text, View } from 'react-native';\n\nexport default function App() {\n  return (\n    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>\n      <Text>Hello World!</Text>\n    </View>\n  );\n}\n`,
          },
        ],
      },
      {
        name: 'Hello World — Vue', language: 'vue',
        description: 'Ejemplo básico de Vue: un componente que muestra un saludo.',
        files: [
          {
            name: 'App.js', path: '/App.js', is_folder: false,
            content: `const { createApp } = Vue;\n\ncreateApp({\n  template: \`<h1 style="text-align: center; font-family: sans-serif; margin-top: 2rem;">Hello World!</h1>\`\n}).mount("#app");\n`,
          },
        ],
      },
      {
        name: 'Hello World — Angular', language: 'angular',
        description: 'Ejemplo básico de Angular: muestra un saludo en pantalla.',
        files: [
          {
            name: 'app.ts', path: '/app.ts', is_folder: false,
            content: `document.body.innerHTML = \`<h1 style="text-align: center; font-family: sans-serif; margin-top: 2rem;">Hello World!</h1>\`;\n`,
          },
        ],
      },
      {
        name: 'React + Vitest — Servicio y Controlador', language: 'react',
        description: 'Proyecto de práctica con un servicio y un componente controlador, cada uno con su test (Vitest + Testing Library). Usa el botón "Ejecutar tests".',
        files: [
          { name: 'src', path: '/src', is_folder: true, content: '' },
          { name: 'services', path: '/src/services', is_folder: true, content: '' },
          { name: 'controllers', path: '/src/controllers', is_folder: true, content: '' },
          {
            name: 'main.tsx', path: '/src/main.tsx', is_folder: false,
            content: `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\n\nconst root = ReactDOM.createRoot(document.getElementById('root')!);\nroot.render(<App />);\n`,
          },
          {
            name: 'App.tsx', path: '/src/App.tsx', is_folder: false,
            content: `import React from 'react';\nimport UserController from './controllers/UserController';\n\nexport default function App() {\n  return (\n    <div style={{ fontFamily: 'sans-serif', padding: '2rem', maxWidth: 600, margin: '0 auto' }}>\n      <h1>Servicio y Controlador</h1>\n      <UserController />\n    </div>\n  );\n}\n`,
          },
          {
            name: 'userService.ts', path: '/src/services/userService.ts', is_folder: false,
            content: `export interface Usuario {\n  id: number;\n  nombre: string;\n}\n\nconst USUARIOS: Usuario[] = [\n  { id: 1, nombre: 'Ada Lovelace' },\n  { id: 2, nombre: 'Alan Turing' },\n];\n\n/** Devuelve el listado de usuarios. */\nexport function obtenerUsuarios(): Usuario[] {\n  return USUARIOS;\n}\n\n/** Busca un usuario por id, o undefined si no existe. */\nexport function buscarUsuarioPorId(id: number): Usuario | undefined {\n  return USUARIOS.find((u) => u.id === id);\n}\n`,
          },
          {
            name: 'userService.test.ts', path: '/src/services/userService.test.ts', is_folder: false,
            content: `import { describe, it, expect } from 'vitest';\nimport { obtenerUsuarios, buscarUsuarioPorId } from './userService';\n\ndescribe('userService', () => {\n  it('obtenerUsuarios devuelve el listado completo', () => {\n    expect(obtenerUsuarios()).toHaveLength(2);\n  });\n\n  it('buscarUsuarioPorId encuentra un usuario existente', () => {\n    const usuario = buscarUsuarioPorId(1);\n    expect(usuario?.nombre).toBe('Ada Lovelace');\n  });\n\n  it('buscarUsuarioPorId devuelve undefined si no existe', () => {\n    expect(buscarUsuarioPorId(999)).toBeUndefined();\n  });\n});\n`,
          },
          {
            name: 'UserController.tsx', path: '/src/controllers/UserController.tsx', is_folder: false,
            content: `import React, { useState } from 'react';\nimport { obtenerUsuarios } from '../services/userService';\n\nexport default function UserController() {\n  const [usuarios] = useState(obtenerUsuarios());\n\n  return (\n    <div>\n      <h2>Usuarios</h2>\n      <ul>\n        {usuarios.map((u) => (\n          <li key={u.id}>{u.nombre}</li>\n        ))}\n      </ul>\n    </div>\n  );\n}\n`,
          },
          {
            name: 'UserController.test.tsx', path: '/src/controllers/UserController.test.tsx', is_folder: false,
            content: `import { render, screen } from '@testing-library/react';\nimport { describe, it, expect } from 'vitest';\nimport UserController from './UserController';\n\ndescribe('UserController', () => {\n  it('renderiza la lista de usuarios del servicio', () => {\n    render(<UserController />);\n    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();\n    expect(screen.getByText('Alan Turing')).toBeInTheDocument();\n  });\n});\n`,
          },
        ],
      },
      {
        name: 'NestJS + Jest — Servicio, Controlador y Endpoint', language: 'nestjs',
        description: 'Proyecto de práctica con un servicio (lógica simple) y un controlador con un endpoint GET, cada uno con su test (Jest + ts-jest, endpoint probado con supertest). Usa el botón "Ejecutar" para ver el bootstrap y "Ejecutar tests" para correr Jest.',
        files: [
          { name: 'src', path: '/src', is_folder: true, content: '' },
          {
            name: 'main.ts', path: '/src/main.ts', is_folder: false,
            content: `import 'reflect-metadata';\nimport { NestFactory } from '@nestjs/core';\nimport { AppModule } from './app.module';\n\nasync function bootstrap() {\n  const app = await NestFactory.create(AppModule);\n  await app.listen(3000);\n  console.log('🐱 Nest application is running (bootstrap OK)');\n}\nbootstrap();\n`,
          },
          {
            name: 'app.module.ts', path: '/src/app.module.ts', is_folder: false,
            content: `import { Module } from '@nestjs/common';\nimport { AppController } from './app.controller';\nimport { AppService } from './app.service';\n\n@Module({\n  controllers: [AppController],\n  providers: [AppService],\n})\nexport class AppModule {}\n`,
          },
          {
            name: 'app.service.ts', path: '/src/app.service.ts', is_folder: false,
            content: `import { Injectable } from '@nestjs/common';\n\nexport interface Tarea {\n  id: number;\n  titulo: string;\n  completada: boolean;\n}\n\n@Injectable()\nexport class AppService {\n  private tareas: Tarea[] = [\n    { id: 1, titulo: 'Aprender NestJS', completada: false },\n    { id: 2, titulo: 'Escribir tests con Jest', completada: false },\n  ];\n\n  /** Devuelve todas las tareas. */\n  obtenerTareas(): Tarea[] {\n    return this.tareas;\n  }\n\n  /** Marca una tarea como completada. Devuelve la tarea actualizada o undefined si no existe. */\n  completarTarea(id: number): Tarea | undefined {\n    const tarea = this.tareas.find((t) => t.id === id);\n    if (tarea) tarea.completada = true;\n    return tarea;\n  }\n}\n`,
          },
          // Unit test — run it with the "Ejecutar tests" button (Jest)
          {
            name: 'app.service.spec.ts', path: '/src/app.service.spec.ts', is_folder: false,
            content: `import { Test, TestingModule } from '@nestjs/testing';\nimport { AppService } from './app.service';\n\ndescribe('AppService', () => {\n  let service: AppService;\n\n  beforeEach(async () => {\n    const module: TestingModule = await Test.createTestingModule({\n      providers: [AppService],\n    }).compile();\n\n    service = module.get<AppService>(AppService);\n  });\n\n  it('obtenerTareas devuelve el listado inicial', () => {\n    expect(service.obtenerTareas()).toHaveLength(2);\n  });\n\n  it('completarTarea marca una tarea existente como completada', () => {\n    const tarea = service.completarTarea(1);\n    expect(tarea?.completada).toBe(true);\n  });\n\n  it('completarTarea devuelve undefined si la tarea no existe', () => {\n    expect(service.completarTarea(999)).toBeUndefined();\n  });\n});\n`,
          },
          {
            name: 'app.controller.ts', path: '/src/app.controller.ts', is_folder: false,
            content: `import { Controller, Get, Param } from '@nestjs/common';\nimport { AppService } from './app.service';\n\n@Controller('tareas')\nexport class AppController {\n  constructor(private readonly appService: AppService) {}\n\n  @Get()\n  listar() {\n    return this.appService.obtenerTareas();\n  }\n\n  @Get(':id/completar')\n  completar(@Param('id') id: string) {\n    return this.appService.completarTarea(Number(id));\n  }\n}\n`,
          },
          // Endpoint test with supertest — no real port needed, uses
          // app.getHttpServer() directly (in-memory HTTP)
          {
            name: 'app.controller.spec.ts', path: '/src/app.controller.spec.ts', is_folder: false,
            content: `import { Test, TestingModule } from '@nestjs/testing';\nimport { INestApplication } from '@nestjs/common';\nimport request from 'supertest';\nimport { AppModule } from './app.module';\n\ndescribe('AppController (e2e)', () => {\n  let app: INestApplication;\n\n  beforeAll(async () => {\n    const moduleFixture: TestingModule = await Test.createTestingModule({\n      imports: [AppModule],\n    }).compile();\n\n    app = moduleFixture.createNestApplication();\n    await app.init();\n  });\n\n  afterAll(async () => {\n    await app.close();\n  });\n\n  it('GET /tareas devuelve el listado de tareas', () => {\n    return request(app.getHttpServer())\n      .get('/tareas')\n      .expect(200)\n      .expect((res) => {\n        expect(res.body).toHaveLength(2);\n      });\n  });\n\n  it('GET /tareas/:id/completar marca una tarea como completada', () => {\n    return request(app.getHttpServer())\n      .get('/tareas/1/completar')\n      .expect(200)\n      .expect((res) => {\n        expect(res.body.completada).toBe(true);\n      });\n  });\n});\n`,
          },
        ],
      },
    ];

    for (const t of templates) {
      const exists = await this.playgroundTemplatesRepo.findOne({ where: { name: t.name } });
      if (!exists) {
        await this.playgroundTemplatesRepo.save(
          this.playgroundTemplatesRepo.create({
            name: t.name,
            description: t.description,
            language: t.language,
            files: t.files,
            created_by: admin.id,
          }),
        );
      }
    }
  }

  // ── Examen con variantes temáticas (Programación IV — TypeScript) ────────────
  private async seedExamTemplates(admin: User) {
    const templateName = 'Programación IV — Estructuras de Control, Ciclos y Switch';
    const exists = await this.examTemplatesRepo.findOne({ where: { name: templateName } });
    if (exists) return;

    // Same difficulty/structure/numbers as the base guide, only re-themed vocabulary:
    //   Q1: for + if/else if — tarifa por horas (0h gratis, 1-2h $1.50/h, 3-5h $1.00/h, >5h $8.00 fijo)
    //   Q2: switch — 4 planes/tipos con descuento (0%, 5%, 10%, 15%)
    //   Q3: for + if/else if — clasifica 6 elementos por precio en 4 segmentos
    //   Q4: while (centinela 0) — tarifa por categoría (1-4), cuenta reservas de "alto valor" (> $300)
    const versions: { theme_name: string; order_index: number; questions: ExamQuestion[] }[] = [
      {
        theme_name: 'Restaurante', order_index: 0,
        questions: [
          {
            order: 1, points: 2.5, title: 'Tarifa de ocupación de mesas',
            statement: 'Se registra el tiempo (en horas) que permanecieron ocupadas 5 mesas del restaurante en una noche. La tarifa de servicio por mesa es: 0 horas: gratis; 1 a 2 horas: $1.50 por hora; 3 a 5 horas: $1.00 por hora; más de 5 horas: tarifa fija de $8.00. Usando un ciclo for y una estructura if/else if, calcula el cargo de servicio de cada mesa y, al final, indica cuántas mesas pagaron la tarifa fija máxima ($8.00).',
          },
          {
            order: 2, points: 2.5, title: 'Menús con descuento',
            statement: 'El restaurante ofrece 4 tipos de menú (plan 1 a 4: Ejecutivo, Familiar, Buffet, Degustación). Escribe una función que reciba el número de plan y la cantidad de comensales, calcule el precio base × comensales como subtotal, aplique un descuento según el plan usando switch (Plan 1: 0%, Plan 2: 5%, Plan 3: 10%, Plan 4: 15%), y devuelva un objeto con precioBase, subtotal, descuento y total.',
          },
          {
            order: 3, points: 2.5, title: 'Clasificación de platos por precio',
            statement: 'El restaurante tiene 6 platos en su menú con distintos precios. Usando un ciclo for y una estructura if/else if, clasifica cada plato por precio en 4 categorías (Económico: menos de $10; Estándar: $10 a $20; Premium: $20 a $35; Gourmet: más de $35), acumula el valor total del menú y cuenta cuántos platos son de categoría Gourmet.',
          },
          {
            order: 4, points: 2.5, title: 'Facturación de reservas de mesa',
            statement: 'Se registran reservas de mesa una por una: para cada reserva se ingresa la categoría de mesa (1: mesa estándar $80; 2: mesa VIP $150; 3: salón privado pequeño $280; 4: salón privado grande $450), hasta que se ingresa 0 (centinela) que indica el fin del turno. Usando un ciclo while, acumula la recaudación total del turno y cuenta cuántas reservas fueron de "alto valor" (más de $300).',
          },
        ],
      },
      {
        theme_name: 'Cine', order_index: 1,
        questions: [
          {
            order: 1, points: 2.5, title: 'Tarifa de anticipación de boletos',
            statement: 'Se registra, para 5 boletos vendidos, cuántas horas antes de la función fueron comprados. La tarifa es: comprado el mismo día (0 horas antes): gratis (promoción); 1 a 2 horas antes: $1.50 por hora de anticipación; 3 a 5 horas antes: $1.00 por hora de anticipación; más de 5 horas antes: tarifa fija de $8.00. Usando un ciclo for y una estructura if/else if, calcula el cargo de cada boleto y cuenta cuántos pagaron la tarifa fija máxima ($8.00).',
          },
          {
            order: 2, points: 2.5, title: 'Salas con descuento',
            statement: 'El cine ofrece 4 tipos de sala (tipo 1 a 4: Estándar, VIP, 3D, IMAX). Escribe una función que reciba el tipo de sala y la cantidad de boletos, calcule el precio base × boletos como subtotal, aplique un descuento según el tipo de sala usando switch (Tipo 1: 0%, Tipo 2: 5%, Tipo 3: 10%, Tipo 4: 15%), y devuelva un objeto con precioBase, subtotal, descuento y total.',
          },
          {
            order: 3, points: 2.5, title: 'Clasificación de películas por recaudación',
            statement: 'La cartelera tiene 6 películas con distinta recaudación en su primer fin de semana. Usando un ciclo for y una estructura if/else if, clasifica cada película por recaudación en 4 segmentos (Bajo: menos de $1,000,000; Medio: $1,000,000 a $10,000,000; Alto: $10,000,000 a $50,000,000; Blockbuster: más de $50,000,000), acumula la recaudación total y cuenta cuántas películas son Blockbuster.',
          },
          {
            order: 4, points: 2.5, title: 'Venta de entradas hasta agotar función',
            statement: 'Se venden entradas una por una: para cada venta se ingresa la categoría de sala (1: Estándar $60; 2: VIP $120; 3: 3D $200; 4: IMAX/Premium $350), hasta que se ingresa 0 (centinela) que indica que la función se agotó o cerró la venta. Usando un ciclo while, acumula la recaudación total de la función y cuenta cuántas ventas fueron de "alto valor" (más de $300).',
          },
        ],
      },
      {
        theme_name: 'Veterinaria', order_index: 2,
        questions: [
          {
            order: 1, points: 2.5, title: 'Tarifa de internación',
            statement: 'Se registra el tiempo (en horas) que 5 mascotas estuvieron internadas en observación. La tarifa es: 0 horas: gratis (solo revisión); 1 a 2 horas: $1.50 por hora; 3 a 5 horas: $1.00 por hora; más de 5 horas: tarifa fija de $8.00. Usando un ciclo for y una estructura if/else if, calcula el costo de internación de cada mascota y cuenta cuántas pagaron la tarifa fija máxima ($8.00).',
          },
          {
            order: 2, points: 2.5, title: 'Planes de servicio con descuento',
            statement: 'La veterinaria ofrece 4 planes de servicio (plan 1 a 4: Baño y Peluquería, Vacunación, Control General, Cirugía). Escribe una función que reciba el número de plan y la cantidad de mascotas atendidas, calcule el precio base × mascotas como subtotal, aplique un descuento según el plan usando switch (Plan 1: 0%, Plan 2: 5%, Plan 3: 10%, Plan 4: 15%), y devuelva un objeto con precioBase, subtotal, descuento y total.',
          },
          {
            order: 3, points: 2.5, title: 'Clasificación de tratamientos por costo',
            statement: 'La clínica atendió 6 mascotas con tratamientos de distinto costo. Usando un ciclo for y una estructura if/else if, clasifica cada tratamiento por costo en 4 categorías (Básico: menos de $30; Intermedio: $30 a $80; Avanzado: $80 a $200; Especializado: más de $200), acumula el costo total de los tratamientos y cuenta cuántos son Especializados.',
          },
          {
            order: 4, points: 2.5, title: 'Turnos hasta agotar la agenda',
            statement: 'Se registran turnos uno por uno: para cada turno se ingresa la categoría de servicio (1: consulta general $40; 2: vacunación $90; 3: cirugía menor $220; 4: cirugía mayor $380), hasta que se ingresa 0 (centinela) que indica que se cerró la agenda del día. Usando un ciclo while, acumula la recaudación total del día y cuenta cuántos turnos fueron de "alto valor" (más de $300).',
          },
        ],
      },
      {
        theme_name: 'Consultorio Odontológico', order_index: 3,
        questions: [
          {
            order: 1, points: 2.5, title: 'Tarifa de tratamiento',
            statement: 'Se registra el tiempo (en horas) que tomó atender a 5 pacientes. La tarifa es: 0 horas: gratis (solo revisión); 1 a 2 horas: $1.50 por hora; 3 a 5 horas: $1.00 por hora; más de 5 horas: tarifa fija de $8.00. Usando un ciclo for y una estructura if/else if, calcula el costo de atención de cada paciente y cuenta cuántos pagaron la tarifa fija máxima ($8.00).',
          },
          {
            order: 2, points: 2.5, title: 'Planes de tratamiento con descuento',
            statement: 'El consultorio ofrece 4 planes de tratamiento (plan 1 a 4: Limpieza, Blanqueamiento, Ortodoncia, Implante). Escribe una función que reciba el número de plan y la cantidad de sesiones, calcule el precio base × sesiones como subtotal, aplique un descuento según el plan usando switch (Plan 1: 0%, Plan 2: 5%, Plan 3: 10%, Plan 4: 15%), y devuelva un objeto con precioBase, subtotal, descuento y total.',
          },
          {
            order: 3, points: 2.5, title: 'Clasificación de tratamientos por costo',
            statement: 'El consultorio realizó 6 tratamientos con distinto costo. Usando un ciclo for y una estructura if/else if, clasifica cada tratamiento por costo en 4 categorías (Básico: menos de $40; Intermedio: $40 a $100; Avanzado: $100 a $300; Premium: más de $300), acumula el costo total de los tratamientos y cuenta cuántos son Premium.',
          },
          {
            order: 4, points: 2.5, title: 'Turnos hasta agotar la agenda del día',
            statement: 'Se registran turnos uno por uno: para cada turno se ingresa la categoría de tratamiento (1: limpieza $50; 2: extracción $100; 3: endodoncia $260; 4: ortodoncia/implante $420), hasta que se ingresa 0 (centinela) que indica que se cerró la agenda del día. Usando un ciclo while, acumula la recaudación total del día y cuenta cuántos turnos fueron de "alto valor" (más de $300).',
          },
        ],
      },
    ];

    const template = await this.examTemplatesRepo.save(
      this.examTemplatesRepo.create({
        name: templateName,
        description: 'Examen de TypeScript con 4 ejercicios (for+if, switch, for+if, while) y 4 variantes temáticas para evitar copias entre alumnos.',
        language: 'typescript',
        created_by: admin.id,
      }),
    );

    await this.examVersionsRepo.save(
      versions.map((v) =>
        this.examVersionsRepo.create({
          exam_template_id: template.id,
          theme_name: v.theme_name,
          order_index: v.order_index,
          questions: v.questions,
        }),
      ),
    );
  }

  private async seedExamTemplateTypeScriptV2(admin: User) {
    const templateName = 'Programación IV — Estructuras de Control, Ciclos y Switch (Variante 2)';
    const exists = await this.examTemplatesRepo.findOne({ where: { name: templateName } });
    if (exists) return;

    // Misma dificultad/estructura/números que la plantilla original, con vocabulario nuevo:
    //   Q1: for + if/else if — tarifa por horas (0h gratis, 1-2h $1.50/h, 3-5h $1.00/h, >5h $8.00 fijo)
    //   Q2: switch — 4 planes/tipos con descuento (0%, 5%, 10%, 15%)
    //   Q3: for + if/else if — clasifica 6 elementos por precio en 4 segmentos
    //   Q4: while (centinela 0) — tarifa por categoría (1-4), cuenta reservas de "alto valor" (> $300)
    const versions: { theme_name: string; order_index: number; questions: ExamQuestion[] }[] = [
      {
        theme_name: 'Ferretería', order_index: 0,
        questions: [
          {
            order: 1, points: 2.5, title: 'Tarifa de despacho a domicilio',
            statement: 'Se registra el tiempo estimado (en horas) de despacho de 5 pedidos de la ferretería. La tarifa de despacho es: 0 horas: gratis (retiro en tienda); 1 a 2 horas: $1.50 por hora; 3 a 5 horas: $1.00 por hora; más de 5 horas: tarifa fija de $8.00. Usando un ciclo for y una estructura if/else if, calcula el costo de despacho de cada pedido y cuenta cuántos pagaron la tarifa fija máxima ($8.00).',
          },
          {
            order: 2, points: 2.5, title: 'Tipos de cliente con descuento',
            statement: 'La ferretería clasifica a sus clientes en 4 tipos (tipo 1 a 4: Particular, Contratista, Mayorista, Constructora). Escribe una función que reciba el tipo de cliente y el monto de la compra, calcule el subtotal (se recibe directamente como monto de compra), aplique un descuento según el tipo usando switch (Tipo 1: 0%, Tipo 2: 5%, Tipo 3: 10%, Tipo 4: 15%), y devuelva un objeto con subtotal, descuento y total.',
          },
          {
            order: 3, points: 2.5, title: 'Clasificación de productos por precio',
            statement: 'La ferretería tiene 6 productos con distintos precios. Usando un ciclo for y una estructura if/else if, clasifica cada producto por precio en 4 categorías (Económico: menos de $10; Estándar: $10 a $20; Profesional: $20 a $35; Premium: más de $35), acumula el valor total del inventario y cuenta cuántos productos son de categoría Premium.',
          },
          {
            order: 4, points: 2.5, title: 'Ventas en caja hasta el cierre',
            statement: 'Se registran ventas en caja una por una: para cada venta se ingresa la categoría de producto (1: herramienta manual $80; 2: herramienta eléctrica $150; 3: material de construcción $280; 4: maquinaria pesada $450), hasta que se ingresa 0 (centinela) que indica el cierre de caja. Usando un ciclo while, acumula la recaudación total del día y cuenta cuántas ventas fueron de "alto valor" (más de $300).',
          },
        ],
      },
      {
        theme_name: 'Gimnasio', order_index: 1,
        questions: [
          {
            order: 1, points: 2.5, title: 'Tarifa de uso de sala de pesas',
            statement: 'Se registra el tiempo (en horas) que 5 socios permanecieron en la sala de pesas. La tarifa adicional (fuera de la membresía básica) es: 0 horas: gratis; 1 a 2 horas: $1.50 por hora; 3 a 5 horas: $1.00 por hora; más de 5 horas: tarifa fija de $8.00. Usando un ciclo for y una estructura if/else if, calcula el cargo adicional de cada socio y cuenta cuántos pagaron la tarifa fija máxima ($8.00).',
          },
          {
            order: 2, points: 2.5, title: 'Planes de membresía con descuento',
            statement: 'El gimnasio ofrece 4 planes de membresía (plan 1 a 4: Mensual, Trimestral, Semestral, Anual). Escribe una función que reciba el número de plan y la cantidad de meses, calcule el precio base × meses como subtotal, aplique un descuento según el plan usando switch (Plan 1: 0%, Plan 2: 5%, Plan 3: 10%, Plan 4: 15%), y devuelva un objeto con precioBase, subtotal, descuento y total.',
          },
          {
            order: 3, points: 2.5, title: 'Clasificación de clases por costo',
            statement: 'El gimnasio ofrece 6 clases grupales con distinto costo. Usando un ciclo for y una estructura if/else if, clasifica cada clase por costo en 4 categorías (Básica: menos de $10; Estándar: $10 a $20; Especializada: $20 a $35; Premium: más de $35), acumula el costo total de las clases y cuenta cuántas son Premium.',
          },
          {
            order: 4, points: 2.5, title: 'Inscripciones hasta agotar cupos',
            statement: 'Se registran inscripciones a clases una por una: para cada inscripción se ingresa la categoría de clase (1: yoga $50; 2: spinning $100; 3: crossfit $260; 4: entrenamiento personalizado $420), hasta que se ingresa 0 (centinela) que indica que se agotaron los cupos del día. Usando un ciclo while, acumula la recaudación total y cuenta cuántas inscripciones fueron de "alto valor" (más de $300).',
          },
        ],
      },
      {
        theme_name: 'Lavandería', order_index: 2,
        questions: [
          {
            order: 1, points: 2.5, title: 'Tarifa de servicio urgente',
            statement: 'Se registra el tiempo (en horas) que tomó procesar 5 pedidos de lavandería con servicio urgente. La tarifa urgente es: 0 horas: gratis (servicio normal); 1 a 2 horas: $1.50 por hora; 3 a 5 horas: $1.00 por hora; más de 5 horas: tarifa fija de $8.00. Usando un ciclo for y una estructura if/else if, calcula el cargo urgente de cada pedido y cuenta cuántos pagaron la tarifa fija máxima ($8.00).',
          },
          {
            order: 2, points: 2.5, title: 'Tipos de prenda con descuento',
            statement: 'La lavandería clasifica las prendas en 4 tipos (tipo 1 a 4: Ropa Casual, Ropa Formal, Edredones, Cortinas). Escribe una función que reciba el tipo de prenda y la cantidad de piezas, calcule el precio base × piezas como subtotal, aplique un descuento según el tipo usando switch (Tipo 1: 0%, Tipo 2: 5%, Tipo 3: 10%, Tipo 4: 15%), y devuelva un objeto con precioBase, subtotal, descuento y total.',
          },
          {
            order: 3, points: 2.5, title: 'Clasificación de pedidos por costo',
            statement: 'La lavandería procesó 6 pedidos con distinto costo. Usando un ciclo for y una estructura if/else if, clasifica cada pedido por costo en 4 categorías (Básico: menos de $10; Estándar: $10 a $20; Grande: $20 a $35; Premium: más de $35), acumula el costo total de los pedidos y cuenta cuántos son Premium.',
          },
          {
            order: 4, points: 2.5, title: 'Entregas hasta cerrar el turno',
            statement: 'Se registran entregas de pedidos una por una: para cada entrega se ingresa la categoría del servicio (1: lavado simple $50; 2: lavado y planchado $100; 3: tintorería $260; 4: edredones/cortinas $420), hasta que se ingresa 0 (centinela) que indica el cierre del turno. Usando un ciclo while, acumula la recaudación total del turno y cuenta cuántas entregas fueron de "alto valor" (más de $300).',
          },
        ],
      },
      {
        theme_name: 'Parqueadero', order_index: 3,
        questions: [
          {
            order: 1, points: 2.5, title: 'Tarifa por tiempo de estacionamiento',
            statement: 'Se registra el tiempo (en horas) que permanecieron estacionados 5 vehículos. La tarifa es: 0 horas: gratis (primeros minutos de cortesía); 1 a 2 horas: $1.50 por hora; 3 a 5 horas: $1.00 por hora; más de 5 horas: tarifa fija de $8.00. Usando un ciclo for y una estructura if/else if, calcula el cargo de cada vehículo y cuenta cuántos pagaron la tarifa fija máxima ($8.00).',
          },
          {
            order: 2, points: 2.5, title: 'Tipos de vehículo con descuento',
            statement: 'El parqueadero clasifica los vehículos en 4 tipos (tipo 1 a 4: Auto, Moto, Camioneta, Camión). Escribe una función que reciba el tipo de vehículo y la cantidad de días de plan mensual, calcule el precio base × días como subtotal, aplique un descuento según el tipo usando switch (Tipo 1: 0%, Tipo 2: 5%, Tipo 3: 10%, Tipo 4: 15%), y devuelva un objeto con precioBase, subtotal, descuento y total.',
          },
          {
            order: 3, points: 2.5, title: 'Clasificación de espacios por tarifa mensual',
            statement: 'El parqueadero ofrece 6 tipos de espacio con distinta tarifa mensual. Usando un ciclo for y una estructura if/else if, clasifica cada espacio por tarifa en 4 categorías (Económico: menos de $10; Estándar: $10 a $20; Cubierto: $20 a $35; VIP: más de $35), acumula el valor total de los espacios y cuenta cuántos son VIP.',
          },
          {
            order: 4, points: 2.5, title: 'Cobros hasta el cierre del día',
            statement: 'Se registran cobros de salida uno por uno: para cada cobro se ingresa la categoría del vehículo (1: moto $50; 2: auto $100; 3: camioneta $260; 4: camión $420), hasta que se ingresa 0 (centinela) que indica el cierre del día. Usando un ciclo while, acumula la recaudación total del día y cuenta cuántos cobros fueron de "alto valor" (más de $300).',
          },
        ],
      },
    ];

    const template = await this.examTemplatesRepo.save(
      this.examTemplatesRepo.create({
        name: templateName,
        description: 'Segunda plantilla de TypeScript con 4 ejercicios (for+if, switch, for+if, while) y 4 variantes temáticas nuevas, misma dificultad que la plantilla original.',
        language: 'typescript',
        created_by: admin.id,
      }),
    );

    await this.examVersionsRepo.save(
      versions.map((v) =>
        this.examVersionsRepo.create({
          exam_template_id: template.id,
          theme_name: v.theme_name,
          order_index: v.order_index,
          questions: v.questions,
        }),
      ),
    );
  }

  private async seedExamTemplateFlutter(admin: User) {
    const templateName = 'Programación IV — Flutter, CRUD contra API';
    const description =
      'Examen de Flutter con 4 variantes temáticas: pantalla principal con menú + 3 botones — ' +
      'CRUD contra la API de práctica (7 pts) y 2 pantallas de cálculo (1.5 pts c/u) — más un ejemplo ' +
      'de referencia (ToDo) accesible desde el menú.';

    // Cada variante: Q1 CRUD contra la API de práctica (7 pts, pantalla propia) + Q2/Q3 (1.5 pts c/u),
    // cada una resuelta en su propia pantalla (accedida desde uno de los 3 botones de la pantalla
    // principal). El `theme_name` define el segmento de URL (`/practice-api/<slug>/<resource>`) y los
    // 7 campos propios de esa variante — ver `practice-variants.config.ts`. Endpoint y campos son
    // distintos por variante a propósito, para que no se pueda reusar el mismo proyecto entre
    // variantes sin cambios reales.
    const versions: { theme_name: string; order_index: number; questions: ExamQuestion[] }[] = [
      {
        theme_name: 'Ropa', order_index: 0,
        questions: [
          {
            order: 1, points: 7, title: 'CRUD de tienda de ropa contra la API',
            statement: 'Construye la pantalla de CRUD (accedida desde el primer botón de la pantalla principal) que consuma la API de práctica (ver ENUNCIADO.md/lib/services/api_service.dart) para gestionar el catálogo de una tienda de ropa. El recurso maneja los campos: prenda, talla, color, categoria, precio, stock y disponible. Debe permitir: (1) listar las prendas mostrando al menos prenda, categoria, precio y stock; (2) crear una prenda nueva desde un formulario con todos los campos; (3) editar una prenda existente; (4) eliminar una prenda. Usa las funciones ya provistas en ApiService (fetchItems, createItem, updateItem, deleteItem) y actualiza la lista en pantalla después de cada operación.',
          },
          {
            order: 2, points: 1.5, title: 'Valor total del inventario',
            statement: 'En la pantalla propia de la Pregunta 2 (accedida desde el segundo botón de la pantalla principal), calcula y muestra el valor total del inventario: la suma de precio × stock de todas las prendas con disponible == true.',
          },
          {
            order: 3, points: 1.5, title: 'Precio promedio de prendas disponibles',
            statement: 'En la pantalla propia de la Pregunta 3 (accedida desde el tercer botón de la pantalla principal), calcula y muestra el precio promedio de las prendas con disponible == true.',
          },
        ],
      },
      {
        theme_name: 'Libros', order_index: 1,
        questions: [
          {
            order: 1, points: 7, title: 'CRUD de biblioteca contra la API',
            statement: 'Construye la pantalla de CRUD (accedida desde el primer botón de la pantalla principal) que consuma la API de práctica (ver ENUNCIADO.md/lib/services/api_service.dart) para gestionar el catálogo de una biblioteca. El recurso maneja los campos: titulo, autor, genero, precio, ejemplares, anioPublicacion y disponible. Debe permitir: (1) listar los libros mostrando al menos titulo, autor, precio y ejemplares; (2) crear un libro nuevo desde un formulario con todos los campos; (3) editar un libro existente; (4) eliminar un libro. Usa las funciones ya provistas en ApiService y actualiza la lista en pantalla después de cada operación.',
          },
          {
            order: 2, points: 1.5, title: 'Libros agotados',
            statement: 'En la pantalla propia de la Pregunta 2 (accedida desde el segundo botón de la pantalla principal), cuenta cuántos libros tienen ejemplares igual a 0 ("agotados") y muestra ese total.',
          },
          {
            order: 3, points: 1.5, title: 'Precio promedio del catálogo',
            statement: 'En la pantalla propia de la Pregunta 3 (accedida desde el tercer botón de la pantalla principal), calcula y muestra el precio promedio de todos los libros del catálogo.',
          },
        ],
      },
      {
        theme_name: 'Farmacia', order_index: 2,
        questions: [
          {
            order: 1, points: 7, title: 'CRUD de farmacia contra la API',
            statement: 'Construye la pantalla de CRUD (accedida desde el primer botón de la pantalla principal) que consuma la API de práctica (ver ENUNCIADO.md/lib/services/api_service.dart) para gestionar el inventario de una farmacia. El recurso maneja los campos: medicamento, presentacion, laboratorio, precio, existencias, requiereReceta y fechaVencimiento. Debe permitir: (1) listar los medicamentos mostrando al menos medicamento, presentacion, precio y existencias; (2) crear un medicamento nuevo desde un formulario con todos los campos; (3) editar un medicamento existente; (4) eliminar un medicamento. Usa las funciones ya provistas en ApiService y actualiza la lista en pantalla después de cada operación.',
          },
          {
            order: 2, points: 1.5, title: 'Medicamentos con stock bajo',
            statement: 'En la pantalla propia de la Pregunta 2 (accedida desde el segundo botón de la pantalla principal), cuenta cuántos medicamentos tienen existencias menores a 5 unidades y muestra ese total.',
          },
          {
            order: 3, points: 1.5, title: 'Total con descuento por volumen',
            statement: 'En la pantalla propia de la Pregunta 3 (accedida desde el tercer botón de la pantalla principal), calcula y muestra la suma de los precios aplicando un 10% de descuento a los medicamentos cuyas existencias sean mayores a 20 unidades (el resto sin descuento).',
          },
        ],
      },
      {
        theme_name: 'Tareas', order_index: 3,
        questions: [
          {
            order: 1, points: 7, title: 'CRUD de lista de tareas contra la API',
            statement: 'Construye la pantalla de CRUD (accedida desde el primer botón de la pantalla principal) que consuma la API de práctica (ver ENUNCIADO.md/lib/services/api_service.dart) para gestionar una lista de tareas. El recurso maneja los campos: tarea, materia, prioridad, progreso, fechaLimite, responsable y completada. Debe permitir: (1) listar las tareas mostrando al menos tarea, materia, prioridad y progreso; (2) crear una tarea nueva desde un formulario con todos los campos; (3) editar una tarea existente; (4) eliminar una tarea. Usa las funciones ya provistas en ApiService y actualiza la lista en pantalla después de cada operación.',
          },
          {
            order: 2, points: 1.5, title: 'Contador de pendientes y completadas',
            statement: 'En la pantalla propia de la Pregunta 2 (accedida desde el segundo botón de la pantalla principal), cuenta cuántas tareas están completadas (`completada == true`) y cuántas están pendientes (`completada == false`), y muestra ambos totales.',
          },
          {
            order: 3, points: 1.5, title: 'Progreso promedio',
            statement: 'En la pantalla propia de la Pregunta 3 (accedida desde el tercer botón de la pantalla principal), calcula y muestra el progreso promedio (campo progreso) de todas las tareas.',
          },
        ],
      },
    ];

    // Upsert: si el template ya existe (deploys previos), actualiza su descripción/idioma y las
    // preguntas de cada variante en el lugar (conservando los IDs), en vez de saltarse el seed —
    // así los cambios de contenido llegan a producción sin necesidad de editar manualmente desde el
    // Admin.
    let template = await this.examTemplatesRepo.findOne({
      where: { name: templateName },
      relations: ['versions'],
    });

    if (!template) {
      template = await this.examTemplatesRepo.save(
        this.examTemplatesRepo.create({
          name: templateName,
          description,
          language: 'flutter',
          created_by: admin.id,
        }),
      );
      await this.examVersionsRepo.save(
        versions.map((v) =>
          this.examVersionsRepo.create({
            exam_template_id: template!.id,
            theme_name: v.theme_name,
            order_index: v.order_index,
            questions: v.questions,
          }),
        ),
      );
      return;
    }

    template.description = description;
    template.language = 'flutter';
    await this.examTemplatesRepo.save(template);

    const existingByTheme = new Map((template.versions ?? []).map((v) => [v.theme_name, v]));
    for (const v of versions) {
      const existing = existingByTheme.get(v.theme_name);
      if (existing) {
        existing.order_index = v.order_index;
        existing.questions = v.questions;
        await this.examVersionsRepo.save(existing);
      } else {
        await this.examVersionsRepo.save(
          this.examVersionsRepo.create({
            exam_template_id: template.id,
            theme_name: v.theme_name,
            order_index: v.order_index,
            questions: v.questions,
          }),
        );
      }
    }
  }

  private async seedExamTemplateFlutterSingle(admin: User) {
    const templateName = 'Programación IV — Flutter, CRUD contra API (Ejercicio único)';
    const description =
      'Examen de Flutter de una sola variante (Papelería), partiendo del ejemplo de referencia ToDo ' +
      '(ver ENUNCIADO.md): CRUD completo contra la API de práctica (7 pts) y 2 pantallas de cálculo ' +
      '(1.5 pts c/u).';

    // Una sola variante (Papelería). El `theme_name` define el segmento de URL
    // (`/practice-api/<slug>/<resource>`) y los 7 campos propios — ver `practice-variants.config.ts`
    // (clave `papeleria`). Mismo patrón de 3 preguntas (CRUD 7 pts + 2 cálculos 1.5 pts c/u = 10 pts)
    // que las variantes de `seedExamTemplateFlutter`.
    const version: { theme_name: string; order_index: number; questions: ExamQuestion[] } = {
      theme_name: 'Papelería',
      order_index: 0,
      questions: [
        {
          order: 1, points: 7, title: 'CRUD de papelería contra la API',
          statement: 'Construye el CRUD (duplicando/adaptando el ejemplo de referencia ToDo, ver ENUNCIADO.md) para gestionar el inventario de una papelería, consumiendo la API de práctica de tu variante. El recurso maneja los campos: producto, marca, categoria, precio, stock, codigo y disponible. Debe permitir: (1) listar los productos mostrando al menos producto, categoria, precio y stock; (2) crear un producto nuevo desde un formulario con todos los campos; (3) editar un producto existente; (4) eliminar un producto. Actualiza la lista en pantalla después de cada operación.',
        },
        {
          order: 2, points: 1.5, title: 'Valor total del inventario',
          statement: 'En tu propia pantalla de cálculo (duplicando/adaptando `todo_stat1_screen.dart`, ver ENUNCIADO.md), calcula y muestra el valor total del inventario: la suma de precio × stock de todos los productos con disponible == true.',
        },
        {
          order: 3, points: 1.5, title: 'Precio promedio de productos disponibles',
          statement: 'En tu propia pantalla de cálculo (duplicando/adaptando `todo_stat2_screen.dart`, ver ENUNCIADO.md), calcula y muestra el precio promedio de los productos con disponible == true.',
        },
      ],
    };

    // Upsert: mismo criterio que seedExamTemplateFlutter (conserva IDs si el template ya existe).
    let template = await this.examTemplatesRepo.findOne({
      where: { name: templateName },
      relations: ['versions'],
    });

    if (!template) {
      template = await this.examTemplatesRepo.save(
        this.examTemplatesRepo.create({
          name: templateName,
          description,
          language: 'flutter',
          created_by: admin.id,
        }),
      );
      await this.examVersionsRepo.save(
        this.examVersionsRepo.create({
          exam_template_id: template.id,
          theme_name: version.theme_name,
          order_index: version.order_index,
          questions: version.questions,
        }),
      );
      return;
    }

    template.description = description;
    template.language = 'flutter';
    await this.examTemplatesRepo.save(template);

    const existing = (template.versions ?? []).find((v) => v.theme_name === version.theme_name);
    if (existing) {
      existing.order_index = version.order_index;
      existing.questions = version.questions;
      await this.examVersionsRepo.save(existing);
    } else {
      await this.examVersionsRepo.save(
        this.examVersionsRepo.create({
          exam_template_id: template.id,
          theme_name: version.theme_name,
          order_index: version.order_index,
          questions: version.questions,
        }),
      );
    }
  }

  // ── Examen con variantes temáticas (Programación IV — NestJS, CRUD + Jest) ──
  private async seedExamTemplateNestJS(admin: User) {
    const templateName = 'Programación IV — NestJS, CRUD y Tests con Jest';
    const description =
      'Examen de NestJS con 5 variantes temáticas. Cada proyecto trae un módulo CRUD de referencia ' +
      'YA RESUELTO (servicio + controlador + 2 archivos de test) y dos módulos más (Categorías y ' +
      'Movimientos) también YA IMPLEMENTADOS (servicio + controlador), cada uno con una regla de ' +
      'negocio y un endpoint adicionales que NO están en el módulo de referencia. El alumno no ' +
      'programa CRUD: su único trabajo es escribir los 4 archivos de test que faltan, cubriendo ' +
      'también esos casos adicionales (copiar los tests de referencia cambiando nombres de ' +
      'variables no alcanza para cubrirlos).';

    // Cada variante solo cambia el recurso/los campos del módulo de referencia (ver
    // `practice-variants.config.ts`, mismas claves que usa el examen de Flutter). Los módulos
    // "Categorías" y "Movimientos" (ya implementados, con su regla/endpoint extra cada uno)
    // son siempre los mismos — ver `buildNestExamFiles` en `playground.service.ts`. Las
    // preguntas describen lo que se califica (también alimentan el rubric de `buildGradingPrompt`).
    const questions: ExamQuestion[] = [
      {
        order: 1, points: 4, title: 'Tests de Categorías',
        statement: 'Escribe `categorias.service.spec.ts` (mínimo 6 tests: los 5 básicos —listar iniciales, crear, encontrar por id, `NotFoundException` con id inexistente, actualizar/eliminar— más uno que verifique que crear una categoría con un `nombre` ya existente, sin importar mayúsculas/minúsculas, lanza `ConflictException`) y `categorias.controller.spec.ts` (mínimo 4 tests con `supertest`: los 3 básicos —`GET` lista 200, `POST` crea 201 con `id`, `GET /:id` inexistente 404— más uno de `GET /categorias/buscar?nombre=...` que verifique que solo devuelve las categorías cuyo nombre contiene el texto buscado).',
      },
      {
        order: 2, points: 4, title: 'Tests de Movimientos',
        statement: 'Escribe `movimientos.service.spec.ts` (mínimo 6 tests: los 5 básicos —igual que en Categorías— más uno que verifique que crear un movimiento con `cantidad` menor o igual a 0 lanza `BadRequestException`) y `movimientos.controller.spec.ts` (mínimo 4 tests con `supertest`: los 3 básicos más uno de `GET /movimientos/resumen` que verifique que `totalEntradas`, `totalSalidas` y `balance` se calculan correctamente a partir de movimientos creados en el propio test).',
      },
      {
        order: 3, points: 2, title: 'Cobertura de los casos adicionales (anti-copia)',
        statement: 'Categorías y Movimientos tienen cada uno una regla de negocio (`ConflictException` por nombre duplicado / `BadRequestException` por cantidad inválida) y un endpoint (`/categorias/buscar`, `/movimientos/resumen`) que NO existen en el módulo de referencia: los tests que solo copian los del recurso de referencia cambiando variables no los cubren y pierden estos puntos. Se evalúa que los 4 archivos de test incluyan casos explícitos para esa parte adicional de cada módulo.',
      },
    ];

    const versions: { theme_name: string; order_index: number }[] = [
      { theme_name: 'Ropa', order_index: 0 },
      { theme_name: 'Libros', order_index: 1 },
      { theme_name: 'Farmacia', order_index: 2 },
      { theme_name: 'Tareas', order_index: 3 },
      { theme_name: 'Papelería', order_index: 4 },
    ];

    // Upsert: mismo criterio que seedExamTemplateFlutter (conserva IDs si el template ya existe,
    // y refresca descripción/preguntas si cambian entre deploys).
    let template = await this.examTemplatesRepo.findOne({
      where: { name: templateName },
      relations: ['versions'],
    });

    if (!template) {
      template = await this.examTemplatesRepo.save(
        this.examTemplatesRepo.create({
          name: templateName,
          description,
          language: 'nestjs',
          created_by: admin.id,
        }),
      );
      await this.examVersionsRepo.save(
        versions.map((v) =>
          this.examVersionsRepo.create({
            exam_template_id: template!.id,
            theme_name: v.theme_name,
            order_index: v.order_index,
            questions,
          }),
        ),
      );
      return;
    }

    template.description = description;
    template.language = 'nestjs';
    await this.examTemplatesRepo.save(template);

    const existingByTheme = new Map((template.versions ?? []).map((v) => [v.theme_name, v]));
    for (const v of versions) {
      const existing = existingByTheme.get(v.theme_name);
      if (existing) {
        existing.order_index = v.order_index;
        existing.questions = questions;
        await this.examVersionsRepo.save(existing);
      } else {
        await this.examVersionsRepo.save(
          this.examVersionsRepo.create({
            exam_template_id: template.id,
            theme_name: v.theme_name,
            order_index: v.order_index,
            questions,
          }),
        );
      }
    }
  }

  // ── Examen con variantes temáticas (Programación IV — React, componentes + Vitest) ──
  private async seedExamTemplateReact(admin: User) {
    const templateName = 'Programación IV — React, componentes y Tests con Vitest';
    const description =
      'Examen de React + TypeScript con 4 variantes temáticas. Cada proyecto trae un componente y ' +
      'una página de referencia YA RESUELTOS (con sus 2 archivos de test como guía) y 2 páginas más ' +
      '(Registro, Búsqueda) y 2 componentes más (ContadorLimite, ToggleControl), todos YA ' +
      'IMPLEMENTADOS, cada uno con un comportamiento (validación, filtro, límites, estado derivado) ' +
      'que NO está en la pieza de referencia. El alumno no programa esas piezas: su único trabajo es ' +
      'escribir los 4 archivos de test que faltan, cubriendo también esos comportamientos (copiar los ' +
      'tests de referencia cambiando nombres de variables no alcanza para cubrirlos).';

    // Cada variante solo cambia el recurso/los campos del componente+página de referencia (ver
    // `practice-variants.config.ts`, mismas claves que usan los exámenes de Flutter/NestJS). Las 2
    // páginas y 2 componentes adicionales (ya implementados, cada uno con su comportamiento extra)
    // son siempre los mismos — ver `buildReactExamFiles` en `playground.service.ts`. Las preguntas
    // describen lo que se califica (también alimentan el rubric de `buildGradingPrompt`).
    const questions: ExamQuestion[] = [
      {
        order: 1, points: 4, title: 'Tests de páginas',
        statement: 'Escribe `RegistroPage.test.tsx` (mínimo 3 tests: la lista de contactos inicia vacía; al completar nombre y edad válidos y enviar el formulario, el contacto se agrega a `data-testid="lista-contactos"` y el formulario se limpia; al enviar con nombre vacío o edad inválida —no numérica o menor/igual a 0— se muestra un `role="alert"` y NO se agrega nada) y `BusquedaPage.test.tsx` (mínimo 3 tests: se renderizan los 4 productos iniciales; al escribir un texto en el input `#filtro` la lista se filtra, sin distinguir mayúsculas/minúsculas, y `data-testid="contador-resultados"` refleja la cantidad correcta; si el filtro no coincide con ningún producto se muestra "0 resultado(s)").',
      },
      {
        order: 2, points: 4, title: 'Tests de componentes',
        statement: 'Escribe `ContadorLimite.test.tsx` (mínimo 4 tests: valor inicial correcto; el botón `aria-label="Sumar"` incrementa el valor de `data-testid="valor-contador"`; el valor no baja del mínimo —el botón `aria-label="Restar"` se deshabilita en el mínimo—; el valor no sube del máximo —el botón `aria-label="Sumar"` se deshabilita en el máximo—) y `ToggleControl.test.tsx` (mínimo 3 tests: el input `aria-label="Campo editable"` empieza deshabilitado; al marcar el checkbox `#habilitar` el campo se habilita; al desmarcarlo el campo vuelve a deshabilitarse).',
      },
      {
        order: 3, points: 2, title: 'Cobertura de casos anti-copia',
        statement: 'RegistroPage, BusquedaPage, ContadorLimite y ToggleControl tienen cada uno un comportamiento (validación de formulario, filtro + contador derivado, límites min/max, estado derivado de un checkbox) que NO existe en la página/componente de referencia: los tests que solo copian los del recurso de referencia cambiando nombres no los cubren y pierden estos puntos. Se evalúa que los 4 archivos de test incluyan casos explícitos para ese comportamiento adicional de cada pieza.',
      },
    ];

    const versions: { theme_name: string; order_index: number }[] = [
      { theme_name: 'Ropa', order_index: 0 },
      { theme_name: 'Libros', order_index: 1 },
      { theme_name: 'Farmacia', order_index: 2 },
      { theme_name: 'Tareas', order_index: 3 },
    ];

    // Upsert: mismo criterio que seedExamTemplateFlutter (conserva IDs si el template ya existe,
    // y refresca descripción/preguntas si cambian entre deploys).
    let template = await this.examTemplatesRepo.findOne({
      where: { name: templateName },
      relations: ['versions'],
    });

    if (!template) {
      template = await this.examTemplatesRepo.save(
        this.examTemplatesRepo.create({
          name: templateName,
          description,
          language: 'react',
          created_by: admin.id,
        }),
      );
      await this.examVersionsRepo.save(
        versions.map((v) =>
          this.examVersionsRepo.create({
            exam_template_id: template!.id,
            theme_name: v.theme_name,
            order_index: v.order_index,
            questions,
          }),
        ),
      );
      return;
    }

    template.description = description;
    template.language = 'react';
    await this.examTemplatesRepo.save(template);

    const existingByTheme = new Map((template.versions ?? []).map((v) => [v.theme_name, v]));
    for (const v of versions) {
      const existing = existingByTheme.get(v.theme_name);
      if (existing) {
        existing.order_index = v.order_index;
        existing.questions = questions;
        await this.examVersionsRepo.save(existing);
      } else {
        await this.examVersionsRepo.save(
          this.examVersionsRepo.create({
            exam_template_id: template.id,
            theme_name: v.theme_name,
            order_index: v.order_index,
            questions,
          }),
        );
      }
    }
  }

  private async seedExamTemplateReactSingle(admin: User) {
    const templateName = 'Programación IV — React, componentes y Tests con Vitest (Ejercicio único)';
    const description =
      'Examen de React + TypeScript de una sola variante (Papelería): componente y página de ' +
      'referencia YA RESUELTOS (con sus 2 archivos de test como guía) y 2 páginas + 2 componentes ' +
      'más YA IMPLEMENTADOS, cada uno con un comportamiento adicional que el alumno debe cubrir con ' +
      'sus propios tests.';

    // Una sola variante (Papelería). Mismas `questions` que `seedExamTemplateReact` — ver ese
    // método para el detalle de lo que se evalúa en cada una.
    const questions: ExamQuestion[] = [
      {
        order: 1, points: 4, title: 'Tests de páginas',
        statement: 'Escribe `RegistroPage.test.tsx` (mínimo 3 tests: la lista de contactos inicia vacía; al completar nombre y edad válidos y enviar el formulario, el contacto se agrega a `data-testid="lista-contactos"` y el formulario se limpia; al enviar con nombre vacío o edad inválida —no numérica o menor/igual a 0— se muestra un `role="alert"` y NO se agrega nada) y `BusquedaPage.test.tsx` (mínimo 3 tests: se renderizan los 4 productos iniciales; al escribir un texto en el input `#filtro` la lista se filtra, sin distinguir mayúsculas/minúsculas, y `data-testid="contador-resultados"` refleja la cantidad correcta; si el filtro no coincide con ningún producto se muestra "0 resultado(s)").',
      },
      {
        order: 2, points: 4, title: 'Tests de componentes',
        statement: 'Escribe `ContadorLimite.test.tsx` (mínimo 4 tests: valor inicial correcto; el botón `aria-label="Sumar"` incrementa el valor de `data-testid="valor-contador"`; el valor no baja del mínimo —el botón `aria-label="Restar"` se deshabilita en el mínimo—; el valor no sube del máximo —el botón `aria-label="Sumar"` se deshabilita en el máximo—) y `ToggleControl.test.tsx` (mínimo 3 tests: el input `aria-label="Campo editable"` empieza deshabilitado; al marcar el checkbox `#habilitar` el campo se habilita; al desmarcarlo el campo vuelve a deshabilitarse).',
      },
      {
        order: 3, points: 2, title: 'Cobertura de casos anti-copia',
        statement: 'RegistroPage, BusquedaPage, ContadorLimite y ToggleControl tienen cada uno un comportamiento (validación de formulario, filtro + contador derivado, límites min/max, estado derivado de un checkbox) que NO existe en la página/componente de referencia: los tests que solo copian los del recurso de referencia cambiando nombres no los cubren y pierden estos puntos. Se evalúa que los 4 archivos de test incluyan casos explícitos para ese comportamiento adicional de cada pieza.',
      },
    ];

    const version: { theme_name: string; order_index: number } = { theme_name: 'Papelería', order_index: 0 };

    // Upsert: mismo criterio que seedExamTemplateFlutterSingle (conserva IDs si el template ya existe).
    let template = await this.examTemplatesRepo.findOne({
      where: { name: templateName },
      relations: ['versions'],
    });

    if (!template) {
      template = await this.examTemplatesRepo.save(
        this.examTemplatesRepo.create({
          name: templateName,
          description,
          language: 'react',
          created_by: admin.id,
        }),
      );
      await this.examVersionsRepo.save(
        this.examVersionsRepo.create({
          exam_template_id: template.id,
          theme_name: version.theme_name,
          order_index: version.order_index,
          questions,
        }),
      );
      return;
    }

    template.description = description;
    template.language = 'react';
    await this.examTemplatesRepo.save(template);

    const existing = (template.versions ?? []).find((v) => v.theme_name === version.theme_name);
    if (existing) {
      existing.order_index = version.order_index;
      existing.questions = questions;
      await this.examVersionsRepo.save(existing);
    } else {
      await this.examVersionsRepo.save(
        this.examVersionsRepo.create({
          exam_template_id: template.id,
          theme_name: version.theme_name,
          order_index: version.order_index,
          questions,
        }),
      );
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Helpers
  // ════════════════════════════════════════════════════════════════════════════

  private async makePage(lesson: Lesson, title: string, order: number, minutes: number, markdown: string) {
    const page = await this.pagesRepo.save(
      this.pagesRepo.create({ lesson, title, order, estimated_minutes: minutes, status: 'PUBLISHED' }),
    );
    await this.blocksRepo.save(
      this.blocksRepo.create({ page, type: 'markdown', order: 1, data: { markdown } }),
    );
    return page;
  }

  private async ensureRole(name: string, permissions: string[]) {
    let role = await this.rolesRepo.findOne({ where: { name } });
    if (!role) role = await this.rolesRepo.save(this.rolesRepo.create({ name, permissions }));
    return role;
  }

  private async ensureUser(
    email: string, password: string,
    firstName: string, lastName: string,
    role: Role, status: UserStatus = UserStatus.APPROVED,
  ) {
    const existing = await this.usersRepo.findOne({ where: { email } });
    if (existing) return existing;
    const password_hash = await bcrypt.hash(password, 10);
    return this.usersRepo.save(
      this.usersRepo.create({ email, password_hash, first_name: firstName, last_name: lastName, role, status, is_active: true }),
    );
  }
}
