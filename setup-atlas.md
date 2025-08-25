# 🚀 Configuración de MongoDB Atlas

## Paso 1: Obtener la cadena de conexión

1. **Inicia sesión en MongoDB Atlas:**
   - Ve a: https://cloud.mongodb.com/
   - Inicia sesión con tu cuenta

2. **Selecciona tu cluster:**
   - Haz clic en "Connect" en tu cluster

3. **Elige el método de conexión:**
   - Selecciona "Connect your application"

4. **Copia la cadena de conexión:**
   - Se verá así: `mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority`

## Paso 2: Configurar el archivo .env

1. **Crea el archivo .env en la carpeta backend:**
   ```bash
   cd backend
   copy config.env.example .env
   ```

2. **Edita el archivo .env:**
   - Reemplaza `<username>` con tu nombre de usuario de MongoDB Atlas
   - Reemplaza `<password>` con tu contraseña de MongoDB Atlas
   - Reemplaza `<cluster>` con el nombre de tu cluster
   - Reemplaza `<database>` con el nombre de tu base de datos (ej: `innovadomprod`)

3. **Ejemplo del archivo .env:**
   ```env
   PORT=5000
   NODE_ENV=development
   MONGODB_URI=mongodb+srv://miUsuario:miPassword123@cluster0.abc123.mongodb.net/innovadomprod?retryWrites=true&w=majority
   JWT_SECRET=mi_jwt_secret_super_seguro_2024
   JWT_EXPIRE=30d
   FRONTEND_URL=http://localhost:5174
   ```

## Paso 3: Configurar la base de datos

1. **Crear la base de datos:**
   - En MongoDB Atlas, ve a "Browse Collections"
   - Crea una nueva base de datos llamada `innovadomprod`

2. **Configurar el usuario de la aplicación:**
   - Ve a "Database Access"
   - Asegúrate de que tu usuario tenga permisos de "Read and write to any database"

## Paso 4: Probar la conexión

1. **Ejecutar el backend:**
   ```bash
   cd backend
   npm run dev
   ```

2. **Verificar la conexión:**
   - Deberías ver: "✅ MongoDB Atlas conectado: [tu-cluster]"
   - Deberías ver: "📊 Base de datos: innovadomprod"

## Paso 5: Inicializar la base de datos

1. **Ejecutar el script de inicialización:**
   ```bash
   npm run init-db
   ```

2. **Verificar que se creó el usuario admin:**
   - Email: admin@innovadomprod.com
   - Password: admin123

## Solución de problemas comunes

### Error: "Authentication failed"
- Verifica que el usuario y contraseña sean correctos
- Asegúrate de que el usuario tenga permisos de lectura/escritura

### Error: "Network is unreachable"
- Verifica que tu IP esté en la lista blanca de MongoDB Atlas
- Ve a "Network Access" y agrega tu IP actual

### Error: "Invalid connection string"
- Verifica que la cadena de conexión esté completa
- Asegúrate de que no haya espacios extra

## Comandos útiles

```bash
# Verificar conexión
curl http://localhost:5000/

# Probar login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@innovadomprod.com","password":"admin123"}'
```
