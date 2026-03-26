# Configuración de Google OAuth

## Pasos para configurar Google OAuth

### 1. Crear proyecto en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita la API de Google+ (si no está habilitada)

### 2. Crear credenciales OAuth 2.0

1. En el menú izquierdo, ve a **APIs & Services** → **Credentials**
2. Haz clic en **+ CREATE CREDENTIALS** → **OAuth client ID**
3. Selecciona **Web application**
4. Configura los siguientes campos:

#### **Authorized JavaScript origins**
```
http://localhost:5173
http://localhost:3000
```

#### **Authorized redirect URIs**
```
http://localhost:3000/auth/google/callback
```

5. Haz clic en **Create**

### 3. Obtener las credenciales

Una vez creadas las credenciales, obtendrás:

- **Client ID**: `xxxxx.apps.googleusercontent.com`
- **Client Secret**: `xxxxxxxxxxxxxx`

### 4. Configurar variables de entorno

Crea un archivo `.env` en el backend con:

```bash
# Google OAuth
GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# Frontend URL
FRONTEND_URL=http://localhost:5173
```

### 5. Configurar frontend

Crea un archivo `.env` en el frontend con:

```bash
VITE_API_URL=http://localhost:3000
```

### 6. Ejecutar migraciones

```bash
npm run typeorm migration:run
```

### 7. Reiniciar servicios

```bash
# Backend
npm run start:dev

# Frontend
npm run dev
```

## Flujo de autenticación

1. Usuario hace clic en "Continuar con Google"
2. Redirección a Google para autenticación
3. Google redirige a `/auth/google/callback`
4. Backend crea/actualiza usuario y establece cookie
5. Redirección al frontend (`/admin`)
6. Usuario autenticado

## Características implementadas

- ✅ Login con Google OAuth 2.0
- ✅ Creación automática de usuarios nuevos
- ✅ Actualización de usuarios existentes
- ✅ Avatar de perfil de Google
- ✅ JWT cookie authentication
- ✅ Icono de ojo para mostrar/ocultar contraseña
- ✅ UI elegante con botón de Google

## Consideraciones de seguridad

- Los usuarios de Google se activan automáticamente (APPROVED)
- No tienen contraseña (password_hash vacío)
- Pueden hacer login posterior con email + contraseña si se registra
- Google ID único para evitar duplicados
