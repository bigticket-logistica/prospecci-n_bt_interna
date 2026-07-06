# Portal Terceros · Bigticket

Portal web donde una empresa transportista (Tercero) inicia sesión con correo y
contraseña y envía a certificar **conductores** o **vehículos**. Los datos se
guardan en Supabase y luego se validan contra las fuentes oficiales (Nubarium).

Stack: Vite + React + Supabase. Despliegue: GitHub → Vercel.

---

## 1. Base de datos (Supabase)

En el SQL Editor de tu proyecto, corre en este orden:

1. `certificaciones_terceros_schema.sql` (el modelo de tablas que ya tienes).
2. `sql/portal_auth_y_storage.sql` (vínculo de usuarios, RLS y storage).

Luego:

- **Authentication → Providers**: deja habilitado **Email**. Desactiva
  "Confirm email" si quieres que los accesos que crees funcionen de inmediato.
- **Storage → New bucket**: crea uno **privado** llamado `certificaciones-docs`.
- **Dar de alta una empresa**:
  1. Authentication → Users → Add user (correo + contraseña).
  2. Copia su UID.
  3. En SQL Editor:
     ```sql
     insert into tercero_usuarios (auth_user_id, tercero_id)
     values ('UID_DEL_USUARIO', 'TERCERO_ID_DE_LA_EMPRESA');
     ```

## 2. Variables de entorno

Copia `.env.example` a `.env` y completa:

```
VITE_SUPABASE_URL=https://psvdtgjvognbmxfvqbaa.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key_publica
```

La anon key está en Supabase → Project Settings → API. Es pública (segura para
el navegador); la protección real la da el RLS.

## 3. Correr en local

```bash
npm install
npm run dev
```

Abre http://localhost:5173

## 4. Subir a GitHub

```bash
git init
git add .
git commit -m "Portal Terceros - certificación de conductores y vehículos"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/portal-terceros.git
git push -u origin main
```

> El `.gitignore` ya excluye `.env` y `node_modules`. Nunca subas el `.env`.

## 5. Desplegar en Vercel

1. vercel.com → Add New → Project → importa el repo de GitHub.
2. Framework: **Vite** (lo detecta solo).
3. En **Environment Variables** agrega `VITE_SUPABASE_URL` y
   `VITE_SUPABASE_ANON_KEY` con los mismos valores del `.env`.
4. Deploy.

---

## Qué hace hoy y qué sigue

- **Hoy**: login, listado de certificaciones de la empresa, y envío de
  conductor o vehículo con carga de documentos. Cada envío queda en estado
  `enviado`.
- **Siguiente paso**: el motor de validación (n8n + Nubarium) toma los envíos
  en `enviado`, valida CURP/RFC/INE/REPUVE, y actualiza el estado y el semáforo.
