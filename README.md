# Rifas Frontend

Frontend de la aplicación de **rifas**. Este proyecto está construido con **React + Vite** y consume un backend a través del prefijo `/api` (vía proxy en desarrollo/preview).

## Características

- Interfaz web para gestionar y participar en rifas.
- Navegación con rutas.
- Consumo de API y manejo de estado de datos.

## Tecnologías

- React 18
- Vite 5
- React Router
- TanStack React Query
- Axios
- Tailwind CSS
- React Hook Form

## Requisitos

- Node.js (recomendado: versión LTS)
- npm

## Instalación y ejecución

```bash
npm install
npm run dev
```

La app levanta por defecto en `http://localhost:5173`.

## Configuración de API Backend

El frontend se conecta al backend de dos maneras según el entorno:

### Desarrollo (`npm run dev`)

- Usa el **proxy de Vite** configurado en `vite.config.js`
- Por defecto apunta al backend en Vercel (ver `.env.development`)
- Variable: `VITE_API_PROXY_TARGET`
- Las peticiones a `/api/*` son redirigidas automáticamente al backend

### Producción (`npm run build`)

- Usa `VITE_API_URL` para apuntar directamente al backend (ver `.env.production`)
- No usa proxy, hace peticiones directas a la URL del backend

### Variables de entorno

**`.env.development`** (desarrollo):

```bash
VITE_API_PROXY_TARGET=https://rifas-backend-djv8bs9su-manriquerecinos-projects.vercel.app
```

**`.env.production`** (producción):

```bash
VITE_API_URL=https://rifas-backend-djv8bs9su-manriquerecinos-projects.vercel.app/api
```

### Para usar backend local

Crea un archivo `.env.development.local` (no se sube a git):

```bash
VITE_API_PROXY_TARGET=http://localhost:3001
```

## Scripts

```bash
npm run dev
npm run build
npm run preview
```

## Plantilla (React + Vite)

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

### React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

### Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
