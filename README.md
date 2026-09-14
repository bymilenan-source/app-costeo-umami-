# Costeo UMAMI

App de costeo, recetas y facturación para pasteleras y pequeños emprendimientos
de comida. Construida con **Next.js** + **Supabase** (Postgres + Auth), con
cuentas de usuaria privadas, panel de administración, sub-recetas, insumos
separados de ingredientes y modo de factura fiscal (RNC/NCF).

## 1. Desarrollo local

```bash
npm install
cp .env.example .env.local   # completa con los valores de tu proyecto Supabase
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## 2. Crear el proyecto en Supabase (una sola vez)

1. Entra a [app.supabase.com](https://app.supabase.com) y crea una cuenta / un proyecto nuevo (plan gratuito).
2. En **Project Settings → API**, copia:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (¡secreta, nunca la subas a git ni la pongas en el navegador!)
3. Ve a **SQL Editor** y pega el contenido completo de `supabase/migrations/0001_init.sql`. Ejecútalo.
   Esto crea todas las tablas, la seguridad por fila (RLS) y el trigger que crea
   automáticamente un perfil cada vez que se registra una usuaria.
4. En **Authentication → Providers**, deja solo "Email" habilitado (no se
   necesita registro público: las cuentas las crea la administradora desde el
   panel admin de la app).

### Crear tu propia cuenta de administradora

1. En **Authentication → Users** de Supabase, crea tu usuaria (tu correo +
   una contraseña), o regístrala desde el panel admin una vez tengas otra
   cuenta admin.
2. En **SQL Editor**, ejecuta (cambia el correo):
   ```sql
   update public.profiles set role = 'owner', subscription_status = 'active'
   where email = 'tu-correo@ejemplo.com';
   ```
3. Entra a la app con ese correo → verás el enlace "Panel admin" en el header.

Desde el panel admin puedes crear cuentas para tus usuarias (correo +
contraseña temporal), ver sus fechas de pago/vencimiento y activar o
desactivar su acceso.

## 3. Desplegar en Vercel con tu propio dominio

1. Sube este repositorio a GitHub (si no lo está ya).
2. Entra a [vercel.com](https://vercel.com), crea una cuenta e importa el repositorio.
3. En **Environment Variables** del proyecto en Vercel, agrega las mismas tres
   variables de `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
4. Despliega. Vercel te da un link tipo `tu-app.vercel.app` funcionando de inmediato.
5. Compra tu dominio (Namecheap, Google Domains, GoDaddy, etc. — el
   presupuesto estimado es de US$8–15 el registro inicial + US$15–20/año en
   renovación).
6. En Vercel: **Project → Settings → Domains** → agrega tu dominio. Vercel te
   da los registros DNS (A/CNAME) que debes copiar a la configuración de tu
   dominio en el registrador. La propagación puede tardar unas horas.
7. Cuando el dominio quede activo, tu app vive ahí de forma permanente,
   accesible desde cualquier navegador (celular incluido), sin depender de
   ninguna plataforma externa para el uso diario.

**Costos aproximados** (igual a lo estimado en la especificación): Vercel y
Supabase en plan gratuito mientras el número de usuarias sea bajo; cuando se
supere el plan gratuito, unos US$25–45/mes combinados. El dominio es aparte
(ver punto 5).

## 4. Estructura del proyecto

- `supabase/migrations/0001_init.sql` — esquema completo de base de datos y seguridad (RLS).
- `lib/costing.ts` — cálculo de costos, incluyendo sub-recetas anidadas con detección de ciclos.
- `lib/supabase/` — clientes de Supabase (navegador, servidor, admin).
- `app/page.tsx` — landing pública + formulario de solicitud de suscripción.
- `app/login/page.tsx` — inicio de sesión.
- `app/dashboard/` — la app en sí (Resumen, Ingredientes, Insumos, Recetas, Pedidos/Facturas, Mi Negocio), protegida por sesión y por estado de suscripción.
- `app/admin/` — panel de administración (solo para el rol `owner`).

## 5. Modelo de datos clave

- **Ingredientes e insumos** viven en una sola tabla `supplies` distinguidos
  por `kind` (`ingrediente` | `insumo`), para que el costo de comida y el de
  empaque siempre se muestren en líneas separadas.
- **Sub-recetas**: una receta puede usar otra receta guardada como
  componente (`recipe_components`), indicando qué fracción de esa receta se
  usa (ej. `0.25` = 1/4 de la receta). El costo se recalcula recursivamente.
- **Factura fiscal**: cada pedido guarda su propio `invoice_mode`
  (`simple` | `fiscal`) y, si es fiscal, el campo `ncf` se escribe a mano por
  la usuaria — nunca se autogenera ni se autoincrementa, tal como lo pide la
  especificación (cada negocio maneja su propia numeración autorizada por la DGII).

## 6. Antes de lanzar

Antes del lanzamiento comercial, probar con 2-3 usuarias reales (no solo la
administradora) durante al menos una semana para detectar fricciones de uso,
según lo indicado en la especificación original del proyecto.
