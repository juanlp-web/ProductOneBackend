# 📋 Instalación de MongoDB en Windows

## Opción 1: Instalador Oficial (Recomendado)

1. **Descargar MongoDB Community Server:**
   - Ve a: https://www.mongodb.com/try/download/community
   - Selecciona: Windows x64
   - Descarga el archivo .msi

2. **Instalar MongoDB:**
   - Ejecuta el archivo .msi descargado
   - Sigue el asistente de instalación
   - Selecciona "Complete" installation
   - Marca "Install MongoDB as a Service"
   - Completa la instalación

3. **Verificar instalación:**
   - MongoDB se ejecutará como servicio automáticamente
   - Puerto por defecto: 27017

## Opción 2: Chocolatey (Si tienes Chocolatey instalado)

```bash
choco install mongodb
```

## Opción 3: Docker (Si tienes Docker instalado)

```bash
docker run -d --name mongodb -p 27017:27017 mongo:latest
```

## Verificar que MongoDB esté funcionando

```bash
# Verificar si el puerto 27017 está abierto
netstat -ano | findstr :27017

# Conectar usando MongoDB Compass o mongo shell
mongodb://localhost:27017
```

## Configuración del proyecto

Una vez instalado MongoDB:

1. **Inicializar la base de datos:**
   ```bash
   cd backend
   npm run init-db
   ```

2. **Credenciales por defecto:**
   - Email: admin@innovadomprod.com
   - Password: admin123

3. **Reiniciar el backend:**
   ```bash
   npm run dev
   ```
