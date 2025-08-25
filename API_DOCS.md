# 📚 Documentación de la API - Innovadomprod

## 🔗 Base URL
```
http://localhost:5000/api
```

## 🔐 Autenticación

La API utiliza JWT (JSON Web Tokens) para la autenticación. Incluye el token en el header de todas las peticiones:

```
Authorization: Bearer <token>
```

## 📋 Endpoints

### 🔑 Autenticación

#### POST /auth/login
Iniciar sesión de usuario.

**Body:**
```json
{
  "email": "usuario@ejemplo.com",
  "password": "contraseña123"
}
```

**Respuesta exitosa:**
```json
{
  "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
  "name": "Usuario Ejemplo",
  "email": "usuario@ejemplo.com",
  "role": "user",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### POST /auth/register
Registrar nuevo usuario.

**Body:**
```json
{
  "name": "Nuevo Usuario",
  "email": "nuevo@ejemplo.com",
  "password": "contraseña123",
  "role": "user"
}
```

#### GET /auth/profile
Obtener perfil del usuario autenticado.

**Headers:** `Authorization: Bearer <token>`

#### PUT /auth/profile
Actualizar perfil del usuario.

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "name": "Nombre Actualizado",
  "profile": {
    "phone": "+1234567890",
    "address": "Dirección actualizada"
  }
}
```

### 📦 Productos

#### GET /products
Obtener lista de productos con paginación y filtros.

**Query Parameters:**
- `page` (number): Página actual (default: 1)
- `limit` (number): Productos por página (default: 10)
- `search` (string): Búsqueda por nombre o descripción
- `category` (string): Filtrar por categoría
- `supplier` (string): Filtrar por proveedor

**Headers:** `Authorization: Bearer <token>`

**Respuesta:**
```json
{
  "products": [...],
  "totalPages": 5,
  "currentPage": 1,
  "total": 50
}
```

#### GET /products/:id
Obtener producto por ID.

**Headers:** `Authorization: Bearer <token>`

#### POST /products
Crear nuevo producto (requiere rol Manager/Admin).

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "name": "Producto Ejemplo",
  "description": "Descripción del producto",
  "sku": "PROD-001",
  "category": "materia_prima",
  "unit": "kg",
  "price": 25.50,
  "cost": 20.00,
  "stock": 100,
  "minStock": 10
}
```

#### PUT /products/:id
Actualizar producto (requiere rol Manager/Admin).

**Headers:** `Authorization: Bearer <token>`

#### DELETE /products/:id
Eliminar producto (soft delete, requiere rol Manager/Admin).

**Headers:** `Authorization: Bearer <token>`

#### PUT /products/:id/stock
Actualizar stock de un producto.

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "quantity": 50,
  "operation": "add"
}
```

**Operaciones disponibles:**
- `add`: Agregar stock
- `subtract`: Restar stock

#### GET /products/low-stock
Obtener productos con stock bajo.

**Headers:** `Authorization: Bearer <token>`

### 👥 Clientes

#### GET /clients
Obtener lista de clientes.

**Query Parameters:**
- `page` (number): Página actual
- `limit` (number): Clientes por página
- `search` (string): Búsqueda por nombre o email
- `type` (string): Filtrar por tipo

**Headers:** `Authorization: Bearer <token>`

#### POST /clients
Crear nuevo cliente (requiere rol Manager/Admin).

**Body:**
```json
{
  "name": "Cliente Ejemplo",
  "email": "cliente@ejemplo.com",
  "phone": "+1234567890",
  "type": "empresa",
  "address": {
    "street": "Calle Principal 123",
    "city": "Ciudad",
    "state": "Estado",
    "zipCode": "12345"
  }
}
```

### 🏢 Proveedores

#### GET /suppliers
Obtener lista de proveedores.

**Query Parameters:**
- `page` (number): Página actual
- `limit` (number): Proveedores por página
- `search` (string): Búsqueda por nombre o email
- `type` (string): Filtrar por tipo

**Headers:** `Authorization: Bearer <token>`

#### POST /suppliers
Crear nuevo proveedor (requiere rol Manager/Admin).

**Body:**
```json
{
  "name": "Proveedor Ejemplo",
  "email": "proveedor@ejemplo.com",
  "phone": "+1234567890",
  "type": "materia_prima",
  "address": {
    "street": "Calle Proveedor 456",
    "city": "Ciudad",
    "state": "Estado"
  }
}
```

### 📖 Recetas

#### GET /recipes
Obtener lista de recetas.

**Query Parameters:**
- `page` (number): Página actual
- `limit` (number): Recetas por página
- `search` (string): Búsqueda por nombre o descripción
- `category` (string): Filtrar por categoría
- `difficulty` (string): Filtrar por dificultad

**Headers:** `Authorization: Bearer <token>`

#### POST /recipes
Crear nueva receta (requiere rol Manager/Admin).

**Body:**
```json
{
  "name": "Receta Ejemplo",
  "description": "Descripción de la receta",
  "category": "bebida",
  "difficulty": "medio",
  "preparationTime": 30,
  "cookingTime": 15,
  "servings": 4,
  "ingredients": [
    {
      "product": "64f8a1b2c3d4e5f6a7b8c9d0",
      "quantity": 2,
      "unit": "kg"
    }
  ],
  "instructions": [
    {
      "step": 1,
      "description": "Mezclar ingredientes",
      "time": 10
    }
  ]
}
```

#### GET /recipes/:id/cost
Calcular costo de una receta.

**Headers:** `Authorization: Bearer <token>`

### 💰 Ventas

#### GET /sales
Obtener lista de ventas.

**Query Parameters:**
- `page` (number): Página actual
- `limit` (number): Ventas por página
- `startDate` (string): Fecha de inicio (YYYY-MM-DD)
- `endDate` (string): Fecha de fin (YYYY-MM-DD)
- `paymentStatus` (string): Estado del pago
- `client` (string): ID del cliente

**Headers:** `Authorization: Bearer <token>`

#### POST /sales
Crear nueva venta (requiere rol Manager/Admin).

**Body:**
```json
{
  "client": "64f8a1b2c3d4e5f6a7b8c9d0",
  "items": [
    {
      "product": "64f8a1b2c3d4e5f6a7b8c9d0",
      "quantity": 2,
      "unitPrice": 25.50,
      "discount": 0
    }
  ],
  "paymentMethod": "efectivo",
  "notes": "Venta al contado"
}
```

#### PUT /sales/:id/payment-status
Actualizar estado de pago de una venta.

**Body:**
```json
{
  "paymentStatus": "pagado"
}
```

**Estados disponibles:**
- `pendiente`
- `pagado`
- `parcial`
- `cancelado`

#### GET /sales/stats/summary
Obtener estadísticas de ventas.

**Query Parameters:**
- `startDate` (string): Fecha de inicio
- `endDate` (string): Fecha de fin

### 📊 Inventario

#### GET /inventory/summary
Obtener resumen del inventario.

**Headers:** `Authorization: Bearer <token>`

**Respuesta:**
```json
{
  "totalProducts": 150,
  "lowStockProducts": 12,
  "outOfStockProducts": 3,
  "totalValue": 15420.75
}
```

#### GET /inventory/low-stock
Obtener productos con stock bajo.

**Headers:** `Authorization: Bearer <token>`

#### PUT /inventory/:id/adjust
Ajustar stock de un producto (requiere rol Manager/Admin).

**Body:**
```json
{
  "quantity": 50,
  "reason": "Ajuste de inventario",
  "notes": "Conteo físico realizado"
}
```

### 👤 Usuarios (Solo Admin)

#### GET /users
Obtener lista de usuarios (requiere rol Admin).

**Headers:** `Authorization: Bearer <token>`

#### PUT /users/:id
Actualizar usuario (requiere rol Admin).

#### DELETE /users/:id
Desactivar usuario (requiere rol Admin).

## 🔒 Códigos de Estado HTTP

- `200` - OK: Petición exitosa
- `201` - Created: Recurso creado exitosamente
- `400` - Bad Request: Error en los datos enviados
- `401` - Unauthorized: No autenticado
- `403` - Forbidden: No autorizado para la acción
- `404` - Not Found: Recurso no encontrado
- `500` - Internal Server Error: Error del servidor

## 📝 Ejemplos de Uso

### Ejemplo de Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@innovadomprod.com",
    "password": "admin123"
  }'
```

### Ejemplo de Crear Producto
```bash
curl -X POST http://localhost:5000/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "Harina de Trigo",
    "description": "Harina de trigo para panadería",
    "sku": "HAR-001",
    "category": "materia_prima",
    "unit": "kg",
    "price": 2.50,
    "cost": 2.00,
    "stock": 1000,
    "minStock": 100
  }'
```

## 🚀 Próximas Funcionalidades

- [ ] Sistema de notificaciones en tiempo real
- [ ] API GraphQL
- [ ] Webhooks para integraciones
- [ ] Sistema de auditoría
- [ ] Exportación de datos (PDF, Excel)
- [ ] Integración con pasarelas de pago
- [ ] Sistema de backup automático

---

**Para más información, consulta el README principal del proyecto.**
