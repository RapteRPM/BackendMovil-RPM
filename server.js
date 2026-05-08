// ===============================
// 📦 Importaciones
// ===============================
import { verificarSesion, evitarCache } from './middlewares/sesion.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import path from 'path';
import session from 'express-session';
import ExcelJS from 'exceljs';
import fs from 'fs';
import axios from 'axios';
import multer from 'multer';
import pool from './config/db.js'; // ✅ usamos pool, import moderno
import { crearCredenciales } from './controllers/credenciales.js';
import crypto from 'crypto'; // Para generar tokens seguros
import enviarCorreo from './controllers/enviarCorreo.js';
import bcrypt from 'bcrypt'; // Para hashear contraseñas
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;
const host = process.env.API_HOST || '0.0.0.0';

const parseCsvEnv = (value, fallback = []) => {
  if (!value) return fallback;
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const defaultOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4200',
  'http://127.0.0.1:4200',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://10.0.2.2:3000',
  'http://10.0.2.2:5500'
];

const allowedOrigins = Array.from(
  new Set([
    ...parseCsvEnv(process.env.FRONTEND_URLS),
    ...parseCsvEnv(process.env.WEB_FRONTEND_URLS),
    ...parseCsvEnv(process.env.MOBILE_FRONTEND_URLS),
    ...defaultOrigins
  ])
);

// ===============================
// 🌐 Configuración de CORS
// ===============================

const corsOptions = {
  origin: function (origin, callback) {
    // Permitir peticiones sin origin (ej: Postman, curl) en desarrollo
    if (!origin && process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    // En desarrollo, permitir todos los orígenes locales
    if (process.env.NODE_ENV === 'development' && origin) {
      if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
        return callback(null, true);
      }
    }
    
    // Verificar si el origin está en la lista permitida
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      console.log(`❌ CORS bloqueó petición desde: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Permitir envío de cookies/sesiones
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  exposedHeaders: ['set-cookie']
};

app.use(cors(corsOptions));

// Log para debugging CORS
app.use((req, res, next) => {
  const origin = req.headers.origin || 'sin origin';
  console.log(`📨 ${req.method} ${req.path} - Origin: ${origin}`);
  next();
});

// ===============================
// 🔐 Configuración de sesiones
// ===============================
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'clave-secreta-rpm',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.SESSION_COOKIE_SECURE === 'true',
      sameSite: process.env.SESSION_COOKIE_SAMESITE || 'lax',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000 // 24 horas
    },
  })
);

if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// Configuración general
app.use("/api/privado", verificarSesion); 
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Servir archivos de imágenes (uploads)
app.use("/imagen", express.static(path.join(__dirname, "public/imagen")));

// ===============================
// 🏥 Health Check para Railway
// ===============================
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    port: port,
    env: process.env.NODE_ENV || 'development'
  });
});

// ===============================
// 🔍 Diagnóstico DB para Railway
// ===============================
app.get('/api/db-status', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT COUNT(*) as total FROM usuario');
    const [publicaciones] = await pool.query('SELECT COUNT(*) as total FROM publicacion');
    const [gruas] = await pool.query('SELECT COUNT(*) as total FROM publicaciongrua');
    
    res.json({
      status: 'connected',
      database: process.env.DB_NAME || 'unknown',
      host: process.env.DB_HOST || 'localhost',
      usuarios: rows[0].total,
      publicaciones: publicaciones[0].total,
      gruas: gruas[0].total
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: err.message,
      database: process.env.DB_NAME || 'unknown',
      host: process.env.DB_HOST || 'localhost'
    });
  }
});

// ===============================
// 🧪 Test CORS - Endpoint de prueba
// ===============================
app.get('/api/test-cors', (req, res) => {
  res.json({
    success: true,
    message: 'CORS funcionando correctamente',
    origin: req.headers.origin || 'sin origin',
    timestamp: new Date().toISOString()
  });
});

app.post('/api/test-cors', (req, res) => {
  res.json({
    success: true,
    message: 'POST con CORS funcionando',
    data: req.body,
    origin: req.headers.origin || 'sin origin'
  });
});


// Evitar caché en respuestas API
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// ===============================
// 🏠 Ruta raíz - Información de la API
// ===============================
app.get('/', (req, res) => {
  res.json({
    nombre: 'RPM Market API',
    version: '2.0.0',
    descripcion: 'Backend API para RPM Market',
    estado: 'Operativo',
    frontend: 'https://github.com/RapteRPM/Perfil',
    endpoints: {
      health: '/health',
      dbStatus: '/api/db-status',
      autenticacion: {
        login: 'POST /api/login',
        logout: 'POST /api/logout',
        verificarSesion: 'GET /api/verificar-sesion'
      },
      usuarios: {
        listar: 'GET /api/usuarios',
        crear: 'POST /api/usuarios',
        actualizar: 'PUT /api/usuarios/:id',
        eliminar: 'DELETE /api/usuarios/:id'
      },
      publicaciones: {
        listar: 'GET /api/publicaciones',
        crear: 'POST /api/publicaciones',
        actualizar: 'PUT /api/publicaciones/:id',
        eliminar: 'DELETE /api/publicaciones/:id'
      },
      imagenes: 'GET /imagen/:ruta'
    },
    cors: {
      habilitado: true,
      origenes: allowedOrigins
    },
    documentacion: {
      backend: 'README-BACKEND.md',
      migracion: 'MIGRATION-GUIDE.md',
      ejemplosFrontend: 'FRONTEND-CONFIG-EXAMPLE.js'
    },
    mensaje: '✅ Este es un backend API. Use los endpoints listados arriba para interactuar con el servicio.'
  });
});

// ===============================
// 🧪 MODO DEMO - Login sin BD (para pruebas)
// ===============================
app.post('/api/login/demo', (req, res) => {
  const { username, password } = req.body;
  
  // Usuarios de demo (usando IDs reales de la BD)
  const usuariosDemo = {
    'usuario1': { password: '123456', tipo: 'Natural', id: 71001, nombre: 'Daniel' },
    'comerciante1': { password: '123456', tipo: 'Comerciante', id: 72001, nombre: 'Motor Plus' },
    'prestador1': { password: '123456', tipo: 'PrestadorServicio', id: 73001, nombre: 'Grúa Express' }
  };
  
  const usuario = usuariosDemo[username];
  
  if (!usuario) {
    return res.status(401).json({ error: 'Usuario no encontrado (demo)' });
  }
  
  if (usuario.password !== password) {
    return res.status(401).json({ error: 'Contraseña incorrecta (demo)' });
  }
  
  // Simular sesión
  req.session.usuario = {
    id: usuario.id,
    nombre: usuario.nombre,
    tipo: usuario.tipo
  };
  
  res.json({
    success: true,
    message: 'Login demo exitoso',
    tipo: usuario.tipo,
    usuario: usuario.nombre,
    idUsuario: usuario.id
  });
});

// ===============================
// 🔑 Login
// ===============================
app.post('/api/login', async (req, res) => {
  try {
    const body = req.body || {};
    const username = body.username || body.email || body.correo || body.nombreUsuario;
    const password = body.password || body.contrasena;

    console.log('🔐 Login body recibido:', {
      keys: Object.keys(body),
      tieneUsuario: Boolean(username),
      tienePassword: Boolean(password)
    });

    if (!username || !password) {
      return res.status(400).json({
        error: "Faltan datos",
        esperado: ["username o email", "password"]
      });
    }

    const query = `
      SELECT c.*, u.TipoUsuario, u.Nombre, u.Apellido, u.FotoPerfil, u.Estado, com.NombreComercio
      FROM credenciales c
      JOIN usuario u ON u.IdUsuario = c.Usuario
      LEFT JOIN comerciante com ON com.Comercio = c.Usuario
      WHERE TRIM(c.NombreUsuario) = TRIM(?)
    `;

    const results = await queryPromise(query, [username]);

    if (results.length === 0) {
      console.warn("⚠️ Usuario no encontrado:", username);
      return res.status(401).json({ error: "Usuario no encontrado" });
    }

    const usuario = results[0];
    console.log("🧠 Usuario encontrado:", usuario);

    // Verificar si el usuario tiene contraseña temporal (no ha completado el registro)
    if (usuario.ContrasenaTemporal === 'Si') {
      console.warn("⚠️ Usuario con contraseña temporal intentando iniciar sesión:", username);
      return res.status(403).json({ 
        error: "Debes completar tu registro creando tu contraseña. Revisa tu correo electrónico para obtener el enlace de activación.",
        requiereContrasena: true
      });
    }

    // Verificar si el usuario está activo (validar solo si el campo existe)
    if (usuario.Estado !== undefined && usuario.Estado === 'Inactivo') {
      console.warn("⚠️ Usuario inactivo intentando iniciar sesión:", username);
      return res.status(403).json({ 
        error: "Su cuenta está en revisión por un administrador. Por favor, vuelva a intentar en un lapso de 24 horas.",
        estado: 'Inactivo',
        requiereAprobacion: true
      });
    }

    const esValida = await bcrypt.compare(password, usuario.Contrasena);
    if (!esValida) {
      console.warn("⚠️ Contraseña incorrecta para:", username);
      return res.status(401).json({ error: "Contraseña incorrecta" });
    }

    // Obtener solo el primer nombre
    const primerNombre = usuario.Nombre ? usuario.Nombre.split(' ')[0] : usuario.NombreUsuario;

    req.session.usuario = {
      id: usuario.Usuario,
      nombre: primerNombre,
      nombreCompleto: usuario.Nombre || usuario.NombreUsuario,
      apellido: usuario.Apellido || '',
      tipo: usuario.TipoUsuario || "Natural",
      foto: usuario.FotoPerfil || '/imagen/imagen_perfil.png',
      nombreComercio: usuario.NombreComercio || null
    };

    console.log("✅ Usuario autenticado:", req.session.usuario);
    console.log("🔍 Session ID creado:", req.sessionID);
    
    // Forzar el guardado de la sesión antes de responder
    req.session.save((err) => {
      if (err) {
        console.error("❌ Error al guardar sesión:", err);
        return res.status(500).json({ error: "Error al crear sesión" });
      }
      
      console.log("✅ Sesión guardada correctamente");
      
      // Redirección automática para administradores
      let redirect = null;
      if (req.session.usuario.tipo === "Administrador") {
        redirect = "/Administrador/panel_admin.html";
      }
      
      res.json({
        success: true,
        message: "Inicio de sesión exitoso",
        tipo: req.session.usuario.tipo,
        usuario: req.session.usuario.nombre,
        idUsuario: req.session.usuario.id,
        redirect: redirect
      });
    });

  } catch (err) {
    console.error("❌ Error en la consulta SQL:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});


// ===============================
// 👤 Ruta para obtener datos del usuario actual
// ===============================
app.get('/api/usuario-actual', verificarSesion, async (req, res) => {
  const usuarioSesion = req.session.usuario;
  if (!usuarioSesion) {
    return res.status(401).json({ error: "No hay usuario activo" });
  }

  try {
    // 🔍 Obtenemos los datos del usuario (sin dependencia de credenciales)
    const userRows = await queryPromise(
      `SELECT u.IdUsuario, u.TipoUsuario, u.Nombre, u.Apellido, u.Documento, u.FotoPerfil
       FROM usuario u
       WHERE u.IdUsuario = ?`,
      [usuarioSesion.id]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const user = userRows[0];
    let nombreMostrar = `${user.Nombre} ${user.Apellido || ''}`.trim();

    // 🏪 Si es comerciante, obtener nombre del comercio
    if (user.TipoUsuario === "Comerciante") {
      const comercioRows = await queryPromise(
        `SELECT NombreComercio FROM comerciante WHERE Comercio = ?`,
        [usuarioSesion.id]
      );
      if (comercioRows.length > 0) {
        nombreMostrar = comercioRows[0].NombreComercio;
      }
    }

    // 🖼️ Ruta de la imagen - usar directamente de la BD
    const tipo = user.TipoUsuario;
    let fotoRutaFinal = user.FotoPerfil;
    
    // Si no hay foto o la ruta está vacía, usar imagen por defecto
    if (!fotoRutaFinal || fotoRutaFinal.trim() === '') {
      fotoRutaFinal = '/imagen/imagen_perfil.png';
    } else {
      // Asegurar que la ruta comience con /
      if (!fotoRutaFinal.startsWith('/')) {
        fotoRutaFinal = '/' + fotoRutaFinal;
      }
    }

    // ✅ Respuesta al frontend
    res.json({
      id: user.IdUsuario,
      nombre: nombreMostrar,
      tipo: tipo,
      foto: fotoRutaFinal,
    });

  } catch (err) {
    console.error("❌ Error al obtener usuario actual:", err);
    res.status(500).json({ error: "Error al obtener usuario actual" });
  }
});

//----------///
// SECCION DE RECUPERACION DE CONTRASEÑA//

app.get('/api/usuarios/cedula/:documento', async (req, res) => {
  const { documento } = req.params;

  try {
    const [rows] = await pool.query(
      'SELECT IdUsuario FROM usuario WHERE Documento = ?',
      [documento]
    );

    if (rows.length === 0) {
      return res.status(404).json({ msg: 'No se encontró ningún usuario con esa cédula.' });
    }

    res.json({ idUsuario: rows[0].IdUsuario });
  } catch (error) {
    console.error('Error buscando usuario por cédula:', error);
    res.status(500).json({ msg: 'Error del servidor.' });
  }
});

// API PARA CAMBIAR CONTRASEÑA
app.put('/api/usuarios/:id/contrasena', async (req, res) => {
  const { id } = req.params;
  const { nuevaContrasena } = req.body;

  // Validación estricta de contraseña
  if (!nuevaContrasena || nuevaContrasena.length < 6) {
    return res.status(400).json({ msg: 'La contraseña debe tener al menos 6 caracteres.' });
  }

  // Validar que tenga al menos una mayúscula
  if (!/[A-Z]/.test(nuevaContrasena)) {
    return res.status(400).json({ msg: 'La contraseña debe contener al menos una letra mayúscula.' });
  }

  // Validar que tenga al menos un número
  if (!/[0-9]/.test(nuevaContrasena)) {
    return res.status(400).json({ msg: 'La contraseña debe contener al menos un número.' });
  }

  // Validar que tenga al menos un carácter especial
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(nuevaContrasena)) {
    return res.status(400).json({ msg: 'La contraseña debe contener al menos un carácter especial (!@#$%^&*()_+-=[]{};\':"|,.<>?/).' });
  }

  try {
    console.log(`🔐 Actualizando contraseña para usuario: ${id}`);
    
    // Verificar si el usuario existe
    const [credencial] = await pool.query(
      'SELECT Usuario, Contrasena FROM credenciales WHERE Usuario = ?',
      [id]
    );

    if (!credencial || credencial.length === 0) {
      console.log(`⚠️ No se encontró el usuario ${id} en credenciales`);
      return res.status(404).json({ msg: 'Usuario no encontrado.' });
    }

    // Obtener el historial de contraseñas (últimas 5 contraseñas)
    const [historialContrasenas] = await pool.query(
      'SELECT ContrasenaHash FROM historial_contrasenas WHERE Usuario = ? ORDER BY FechaCambio DESC LIMIT 5',
      [id]
    );

    // Verificar si la nueva contraseña ya fue usada anteriormente
    for (const row of historialContrasenas) {
      const esIgual = await bcrypt.compare(nuevaContrasena, row.ContrasenaHash);
      if (esIgual) {
        console.log(`⚠️ La contraseña ya fue utilizada anteriormente por el usuario: ${id}`);
        return res.status(400).json({ 
          msg: 'Esta contraseña ya fue utilizada anteriormente. Por favor, elige una contraseña diferente.' 
        });
      }
    }

    // Hashear la nueva contraseña
    const hash = await bcrypt.hash(nuevaContrasena, 10);

    // Actualizar la contraseña en credenciales
    const [result] = await pool.query(
      "UPDATE credenciales SET Contrasena = ?, ContrasenaTemporal = 'No' WHERE Usuario = ?",
      [hash, id]
    );

    if (result.affectedRows === 0) {
      console.log(`⚠️ No se pudo actualizar la contraseña del usuario ${id}`);
      return res.status(500).json({ msg: 'No se pudo actualizar la contraseña.' });
    }

    // Guardar en el historial de contraseñas
    await pool.query(
      'INSERT INTO historial_contrasenas (Usuario, ContrasenaHash) VALUES (?, ?)',
      [id, hash]
    );

    // Destruir la sesión del usuario para forzar nuevo login
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.error('Error al destruir sesión:', err);
        } else {
          console.log(`🚪 Sesión cerrada para usuario: ${id}`);
        }
      });
    }

    // Limpiar la cookie de sesión
    res.clearCookie('connect.sid', {
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'lax'
    });

    console.log(`✅ Contraseña actualizada para usuario: ${id}`);
    res.json({ msg: 'Contraseña actualizada correctamente.', cerrarSesion: true });
  } catch (error) {
    console.error('❌ Error actualizando contraseña:', error);
    res.status(500).json({ msg: 'Error del servidor.' });
  }
});

// ===============================
// 🚪 Logout
// ===============================
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('❌ Error al cerrar sesión:', err);
      return res.status(500).send('Error al cerrar sesión');
    }

    // 🧹 Limpia cookies de sesión para mayor seguridad
    res.clearCookie('connect.sid', { path: '/' });

    // 🔄 Redirige al login con script para limpiar localStorage
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Cerrando sesión...</title>
      </head>
      <body>
        <script>
          // Limpiar localStorage
          localStorage.removeItem('usuarioActivo');
          localStorage.removeItem('productoCompra');
          localStorage.clear();
          
          // Limpiar sessionStorage
          sessionStorage.clear();
          
          // Evitar que se pueda volver atrás con caché
          window.history.pushState(null, '', window.location.href);
          window.onpopstate = function() {
            window.history.pushState(null, '', window.location.href);
          };
          
          // Redirigir al login
          window.location.replace('/General/Ingreso.html');
        </script>
      </body>
      </html>
    `);
  });
});

// ===============================
// 🧠 Verificar sesión activa
// ===============================
app.get('/api/verificar-sesion', (req, res) => {
  console.log("🔍 [verificar-sesion] Verificando sesión...");
  console.log("🔍 [verificar-sesion] Session ID:", req.sessionID);
  console.log("🔍 [verificar-sesion] Usuario en sesión:", req.session?.usuario ? 'SÍ' : 'NO');
  
  if (req.session?.usuario) {
    // Devolver los datos del usuario si hay sesión activa
    console.log("✅ [verificar-sesion] Sesión activa para:", req.session.usuario.nombre);
    res.json({
      activa: true,
      id: req.session.usuario.id,
      nombre: req.session.usuario.nombre,
      nombreCompleto: req.session.usuario.nombreCompleto || req.session.usuario.nombre,
      apellido: req.session.usuario.apellido || '',
      tipo: req.session.usuario.tipo,
      foto: req.session.usuario.foto || '/imagen/imagen_perfil.png',
      nombreComercio: req.session.usuario.nombreComercio || null
    });
  } else {
    console.log("⚠️ [verificar-sesion] No hay sesión activa");
    res.json({ activa: false });
  }
});

// ===============================
// 🏁 Iniciar servidor
// ===============================
app.listen(port, host, () => {
  console.log(`🚀 Backend API escuchando en: http://${host}:${port}`);
  console.log(`📡 CORS habilitado para ${allowedOrigins.length} origenes configurados`);
  console.log(`🔍 Health check: http://${host}:${port}/health`);
  console.log(`🗄️ DB Status: http://${host}:${port}/api/db-status`);
  console.log(`📱 Para Android emulador usa: http://10.0.2.2:${port}`);
  const interfaces = os.networkInterfaces();
  Object.entries(interfaces).forEach(([name, entries]) => {
    entries?.forEach((entry) => {
      if (entry.family === 'IPv4' && !entry.internal) {
        console.log(`🌐 ${name}: http://${entry.address}:${port}`);
      }
    });
  });
});

// ----------------------
// CONSULTAR HISTORIAL DE COMPRAS - USUARIO NATURAL
// ----------------------
app.get('/api/historial', async (req, res) => {
  const { fechaInicio, fechaFin, tipoProducto, ordenPrecio, usuarioId } = req.query;

  try {
    const paramsProductos = [];
    const paramsGruas = [];

    // Query para productos/servicios de comerciantes
    let queryProductos = `
      SELECT
        df.IdDetalleFactura AS idDetalleFactura,
        pub.NombreProducto AS producto,
        c.NombreCategoria AS categoria,
        f.FechaCompra AS fecha,
        df.Total AS precio,
        COALESCE(f.MetodoPago, 'Sin registro') AS metodoPago,
        COALESCE(f.Estado, df.Estado) AS estado,
        f.IdFactura AS idFactura,
        'producto' AS tipo,
        COALESCE(ca.FechaServicio, NULL) AS fechaEntrega,
        COALESCE(ca.HoraServicio, NULL) AS horaEntrega,
        COALESCE(ca.ModoServicio, NULL) AS modoEntrega,
        NULL AS fechaModificada,
        NULL AS notificacionVista,
        COALESCE(ca.IdSolicitud, NULL) AS idSolicitudComercio,
        uc.Telefono AS telefonoComercio,
        com.NombreComercio AS nombreComercio
      FROM detallefactura df
      LEFT JOIN factura f ON df.Factura = f.IdFactura
      INNER JOIN publicacion pub ON df.Publicacion = pub.IdPublicacion
      INNER JOIN categoria c ON pub.Categoria = c.IdCategoria
      LEFT JOIN detallefacturacomercio dfc ON df.IdDetalleFactura = dfc.IdDetalleFacturaComercio
      LEFT JOIN controlagendacomercio ca ON dfc.IdDetalleFacturaComercio = ca.DetFacturacomercio
      LEFT JOIN comerciante com ON ca.Comercio = com.NitComercio
      LEFT JOIN usuario uc ON com.Comercio = uc.IdUsuario
      WHERE df.VisibleUsuario = 1
    `;

    // Query para servicios de grúa
    let queryGruas = `
      SELECT
        cas.IdSolicitudServicio AS idDetalleFactura,
        pg.TituloPublicacion AS producto,
        'Servicio de grua' AS categoria,
        cas.FechaServicio AS fecha,
        CAST(pg.TarifaBase AS REAL) AS precio,
        'Servicio' AS metodoPago,
        cas.Estado AS estado,
        NULL AS idFactura,
        'grua' AS tipo,
        cas.FechaServicio AS fechaEntrega,
        cas.HoraServicio AS horaEntrega,
        cas.FechaModificadaPor AS fechaModificada,
        cas.NotificacionVista AS notificacionVista
      FROM controlagendaservicios cas
      INNER JOIN publicaciongrua pg ON cas.PublicacionGrua = pg.IdPublicacionGrua
      WHERE 1 = 1
    `;

    // Aplicar filtros para productos
    if (usuarioId) {
      queryProductos += ' AND f.Usuario = ?';
      paramsProductos.push(usuarioId);
      queryGruas += ' AND cas.UsuarioNatural = ?';
      paramsGruas.push(usuarioId);
    }
    
    if (fechaInicio) {
      queryProductos += ' AND f.FechaCompra >= ?';
      paramsProductos.push(fechaInicio);
      queryGruas += ' AND cas.FechaServicio >= ?';
      paramsGruas.push(fechaInicio);
    }
    
    if (fechaFin) {
      queryProductos += ' AND f.FechaCompra <= ?';
      paramsProductos.push(fechaFin);
      queryGruas += ' AND cas.FechaServicio <= ?';
      paramsGruas.push(fechaFin);
    }

    // Filtro de tipo de producto
    let incluirProductos = true;
    let incluirGruas = true;

    if (tipoProducto) {
      if (tipoProducto.toLowerCase() === 'servicio de grua') {
        incluirProductos = false;
      } else {
        incluirGruas = false;
        queryProductos += ' AND LOWER(c.NombreCategoria) = ?';
        paramsProductos.push(tipoProducto.toLowerCase());
      }
    }

    // Obtener resultados
    let results = [];
    
    if (incluirProductos && incluirGruas) {
      const resultadosProductos = await queryPromise(queryProductos, paramsProductos);
      const resultadosGruas = await queryPromise(queryGruas, paramsGruas);
      results = [...resultadosProductos, ...resultadosGruas];
    } else if (incluirProductos) {
      results = await queryPromise(queryProductos, paramsProductos);
    } else {
      results = await queryPromise(queryGruas, paramsGruas);
    }

    // Ordenamiento
    if (ordenPrecio === 'asc') {
      results.sort((a, b) => (a.precio || 0) - (b.precio || 0));
    } else if (ordenPrecio === 'desc') {
      results.sort((a, b) => (b.precio || 0) - (a.precio || 0));
    } else {
      results.sort((a, b) => {
        const fechaA = new Date(a.fecha || 0);
        const fechaB = new Date(b.fecha || 0);
        if (fechaB - fechaA !== 0) return fechaB - fechaA;
        return (b.idDetalleFactura || 0) - (a.idDetalleFactura || 0);
      });
    }

    console.log("📊 Consultando historial para usuario:", usuarioId);
    console.log(`✅ ${results.length} registros encontrados`);
    res.json(results);

  } catch (err) {
    console.error('❌ Error en la consulta de historial:', err);
    res.status(500).json({ error: 'Error en la consulta de historial' });
  }
});

// 🔹 Actualizar estado de DetalleFactura
app.put('/api/historial/estado/:id', async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;

  try {
    // 1️⃣ Obtener información del detalle para actualizar ambas tablas
    const detalle = await queryPromise(
      'SELECT Factura, Publicacion FROM detallefactura WHERE IdDetalleFactura = ?',
      [id]
    );

    if (!detalle || detalle.length === 0) {
      return res.status(404).json({ success: false, message: 'Detalle no encontrado.' });
    }

    const { Factura, Publicacion } = detalle[0];

    // 2️⃣ Actualizar detallefactura
    await queryPromise(
      'UPDATE detallefactura SET Estado = ? WHERE IdDetalleFactura = ?',
      [estado, id]
    );

    // 3️⃣ Actualizar detallefacturacomercio correspondiente (por Factura y Publicacion)
    // Si el estado es Finalizado, también actualizar ConfirmacionUsuario a 'Recibido'
    if (estado === 'Finalizado') {
      await queryPromise(
        'UPDATE detallefacturacomercio SET Estado = ?, ConfirmacionUsuario = ? WHERE Factura = ? AND Publicacion = ?',
        [estado, 'Recibido', Factura, Publicacion]
      );
    } else {
      await queryPromise(
        'UPDATE detallefacturacomercio SET Estado = ? WHERE Factura = ? AND Publicacion = ?',
        [estado, Factura, Publicacion]
      );
    }

    // 4️⃣ Si se marcó como Finalizado, verificar si toda la factura está finalizada
    if (estado === 'Finalizado') {
      const pendientes = await queryPromise(
        'SELECT COUNT(*) AS pendientes FROM detallefactura WHERE Factura = ? AND Estado != ?',
        [Factura, 'Finalizado']
      );

      if (pendientes && pendientes[0] && pendientes[0].pendientes === 0) {
        await queryPromise(
          'UPDATE factura SET Estado = ? WHERE IdFactura = ?',
          ['Pago exitoso', Factura]
        );
      }
    }

    res.status(200).json({
      success: true,
      message: `Estado del pedido #${id} actualizado a '${estado}'.`
    });

  } catch (error) {
    console.error('❌ Error al actualizar estado:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor.' });
  }
});

// ===============================
//  ACTUALIZAR ESTADO DE SOLICITUD DE GRÚA
// ===============================
app.put('/api/historial/grua/estado/:id', async (req, res) => {
    const { id } = req.params;
      const { estado } = req.body;

        try {
            // Verificar que la solicitud existe y obtener su estado actual
                const solicitud = await queryPromise(
                      'SELECT IdSolicitudServicio, Estado FROM controlagendaservicios WHERE IdSolicitudServicio = ?',
                            [id]
                                );

                                    if (!solicitud || solicitud.length === 0) {
                                          return res.status(404).json({ success: false, message: 'Solicitud de grúa no encontrada.' });
                                              }

                                                  const estadoActual = solicitud[0].Estado;

                                                      // Validar que no se puede modificar un servicio ya finalizado o cancelado
                                                          if (['Completado', 'Terminado', 'Cancelado', 'Rechazado'].includes(estadoActual)) {
                                                                return res.status(400).json({ 
                                                                        success: false, 
                                                                                message: `No se puede modificar un servicio que ya está ${estadoActual.toLowerCase()}.` 
                                                                                      });
                                                                                          }

                                                                                              // Validar que solo se pueda marcar como "Terminado"/"Completado" si está "Aceptado"
                                                                                                  if ((estado === 'Terminado' || estado === 'Completado') && estadoActual !== 'Aceptado') {
                                                                                                        return res.status(400).json({ 
                                                                                                                success: false, 
                                                                                                                        message: 'Solo puedes marcar como completado un servicio que ha sido aceptado por el prestador.' 
                                                                                                                              });
                                                                                                                                  }

                                                                                                                                      // Normalizar Terminado a Completado
                                                                                                                                          const estadoFinal = estado === 'Terminado' ? 'Completado' : estado;

                                                                                                                                              // Actualizar estado de la solicitud de grúa
                                                                                                                                                  await queryPromise(
                                                                                                                                                        'UPDATE controlagendaservicios SET Estado = ? WHERE IdSolicitudServicio = ?',
                                                                                                                                                              [estadoFinal, id]
                                                                                                                                                                  );

                                                                                                                                                                      res.status(200).json({
                                                                                                                                                                            success: true,
                                                                                                                                                                                  message: `Estado de la solicitud de grúa #${id} actualizado a '${estadoFinal}'.`
                                                                                                                                                                                      });

                                                                                                                                                                                        } catch (error) {
                                                                                                                                                                                            console.error('❌ Error al actualizar estado de grúa:', error);
                                                                                                                                                                                                res.status(500).json({ success: false, message: 'Error interno del servidor.' });
                                                                                                                                                                                                  }
                                                                                                                                                                                                  });

// ===============================
//  ELIMINAR SOLICITUD DE GRÚA
// ===============================
app.delete('/api/historial/grua/eliminar/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Verificar que la solicitud existe y está en un estado final
    const solicitud = await queryPromise(
      'SELECT IdSolicitudServicio, Estado FROM controlagendaservicios WHERE IdSolicitudServicio = ?',
      [id]
    );

    if (!solicitud || solicitud.length === 0) {
      return res.status(404).json({ success: false, message: 'Solicitud no encontrada.' });
    }

    const estado = solicitud[0].Estado;

    // Validar que solo se pueden eliminar servicios finalizados
    if (!['Completado', 'Terminado', 'Cancelado', 'Rechazado'].includes(estado)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Solo puedes eliminar servicios completados, cancelados o rechazados.' 
      });
    }

    // Eliminar físicamente el registro
    await queryPromise(
      'DELETE FROM controlagendaservicios WHERE IdSolicitudServicio = ?',
      [id]
    );

    res.json({ 
      success: true, 
      message: "Registro de servicio eliminado correctamente." 
    });

  } catch (error) {
    console.error('❌ Error al eliminar solicitud de grúa:', error);
    res.status(500).json({ success: false, message: 'Error al eliminar el registro.' });
  }
});


//ACTUALIZAR ESTADO VISIBLES
app.delete('/api/historial/eliminar/:idFactura', async (req, res) => {
  const { idFactura } = req.params;

  try {
    await queryPromise('UPDATE detallefactura SET VisibleUsuario = 0 WHERE factura = ?', [idFactura]);
    res.json({ success: true, message: "Registro ocultado correctamente." });
  } catch (err) {
    console.error("❌ Error al ocultar registro:", err);
    res.status(500).json({ success: false, message: "Error al ocultar registro." });
  }
});


// ===============================
//  DESCARGAR EXCEL HISTORIAL COMPRAS - USUARIO NATURAL
// ===============================
app.get('/api/historial/excel', async (req, res) => {
  const { fechaInicio, fechaFin, tipoProducto, ordenPrecio, usuarioId } = req.query;

  try {
    const paramsProductos = [];
    const paramsGruas = [];

    // Query para productos/servicios de comerciantes
    let queryProductos = `
      SELECT
        df.IdDetalleFactura AS idDetalleFactura,
        pub.NombreProducto AS producto,
        c.NombreCategoria AS categoria,
        f.FechaCompra AS fecha,
        df.Total AS total,
        COALESCE(f.MetodoPago, 'Sin registro') AS metodoPago,
        CASE
          WHEN f.Estado = 'Pago exitoso' THEN 'Finalizado'
          WHEN f.Estado = 'Proceso pendiente' AND df.Estado = 'Pendiente' THEN 'Pendiente'
          ELSE f.Estado
        END AS estado,
        f.IdFactura AS idFactura,
        'producto' AS tipo
      FROM detallefactura df
      LEFT JOIN factura f ON df.Factura = f.IdFactura
      INNER JOIN publicacion pub ON df.Publicacion = pub.IdPublicacion
      INNER JOIN categoria c ON pub.Categoria = c.IdCategoria
      WHERE df.VisibleUsuario = 1
    `;

    // Query para servicios de grúa
    let queryGruas = `
      SELECT
        cas.IdSolicitudServicio AS idDetalleFactura,
        pg.TituloPublicacion AS producto,
        'Servicio de grua' AS categoria,
        cas.FechaServicio AS fecha,
        CAST(pg.TarifaBase AS REAL) AS total,
        'Servicio' AS metodoPago,
        cas.Estado AS estado,
        NULL AS idFactura,
        'grua' AS tipo
      FROM controlagendaservicios cas
      INNER JOIN publicaciongrua pg ON cas.PublicacionGrua = pg.IdPublicacionGrua
      WHERE 1 = 1
    `;

    // Aplicar filtros
    if (usuarioId) {
      queryProductos += ' AND f.Usuario = ?';
      paramsProductos.push(usuarioId);
      queryGruas += ' AND cas.UsuarioNatural = ?';
      paramsGruas.push(usuarioId);
    }

    if (fechaInicio) {
      queryProductos += ' AND (f.FechaCompra >= ? OR f.FechaCompra IS NULL)';
      paramsProductos.push(fechaInicio);
      queryGruas += ' AND cas.FechaServicio >= ?';
      paramsGruas.push(fechaInicio);
    }

    if (fechaFin) {
      queryProductos += ' AND (f.FechaCompra <= ? OR f.FechaCompra IS NULL)';
      paramsProductos.push(fechaFin);
      queryGruas += ' AND cas.FechaServicio <= ?';
      paramsGruas.push(fechaFin);
    }

    // Filtro de tipo de producto
    let incluirProductos = true;
    let incluirGruas = true;

    if (tipoProducto) {
      if (tipoProducto.toLowerCase() === 'servicio de grua') {
        incluirProductos = false;
      } else {
        incluirGruas = false;
        queryProductos += ' AND LOWER(c.NombreCategoria) = ?';
        paramsProductos.push(tipoProducto.toLowerCase());
      }
    }

    // Obtener resultados
    let results = [];
    
    if (incluirProductos && incluirGruas) {
      const resultadosProductos = await queryPromise(queryProductos, paramsProductos);
      const resultadosGruas = await queryPromise(queryGruas, paramsGruas);
      results = [...resultadosProductos, ...resultadosGruas];
    } else if (incluirProductos) {
      results = await queryPromise(queryProductos, paramsProductos);
    } else {
      results = await queryPromise(queryGruas, paramsGruas);
    }

    // Ordenamiento
    if (ordenPrecio === 'asc') {
      results.sort((a, b) => (a.total || 0) - (b.total || 0));
    } else if (ordenPrecio === 'desc') {
      results.sort((a, b) => (b.total || 0) - (a.total || 0));
    } else {
      results.sort((a, b) => {
        const fechaA = new Date(a.fecha || 0);
        const fechaB = new Date(b.fecha || 0);
        if (fechaB - fechaA !== 0) return fechaB - fechaA;
        return (b.idDetalleFactura || 0) - (a.idDetalleFactura || 0);
      });
    }

    if (results.length === 0) {
      console.warn('⚠️ No hay datos para generar el Excel.');
      return res.status(404).send('No hay datos para generar el Excel.');
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Historial de Compras');

    worksheet.columns = [
      { header: '#', key: 'n', width: 5 },
      { header: 'ID Detalle', key: 'idDetalleFactura', width: 10 },
      { header: 'Producto', key: 'producto', width: 25 },
      { header: 'Categoría', key: 'categoria', width: 20 },
      { header: 'Fecha', key: 'fecha', width: 20 },
      { header: 'Total Pagado', key: 'total', width: 15 },
      { header: 'Método de Pago', key: 'metodoPago', width: 20 },
      { header: 'Estado', key: 'estado', width: 15 },
    ];

    results.forEach((row, i) => {
      worksheet.addRow({
        n: i + 1,
        idDetalleFactura: row.idDetalleFactura,
        producto: row.producto || '—',
        categoria: row.categoria || '—',
        fecha: row.fecha ? new Date(row.fecha).toISOString().split('T')[0] : '—',
        total: Number(row.total || 0),
        metodoPago: row.metodoPago || '—',
        estado: row.estado || '—'
      });
    });

    worksheet.getRow(1).font = { bold: true };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=historial_compras.xlsx');

    await workbook.xlsx.write(res);
    res.end();
    console.log(`📦 Excel generado con ${results.length} registros (productos + grúas)`);

  } catch (err) {
    console.error('❌ Error en consulta Excel:', err);
    res.status(500).send('Error al generar Excel');
  }
});

// ==============================
//  HISTORIAL DE VENTAS - USUARIO COMERCIANTE
// ==============================
app.get('/api/historial-ventas', async (req, res) => {
  const { fechaInicio, fechaFin, tipoProducto, ordenPrecio } = req.query;
  const usuario = req.session.usuario;

  if (!usuario || usuario.tipo !== 'Comerciante') {
    return res.status(403).json({ error: 'Acceso no autorizado. Solo disponible para comerciantes.' });
  }

  try {
    // 🔍 Obtener el NIT del comerciante logueado
    const comercianteRows = await queryPromise(
      'SELECT NitComercio FROM comerciante WHERE Comercio = ?',
      [usuario.id]
    );

    if (comercianteRows.length === 0) {
      return res.status(403).json({ error: 'No se encontró información del comerciante.' });
    }

    const nitComercio = comercianteRows[0].NitComercio;

    // 🧾 Consultar TODAS las ventas (sin filtro de confirmación en historial)
    let query = `
      SELECT 
        f.IdFactura AS idVenta,
        pub.NombreProducto AS producto,
        c.NombreCategoria AS categoria,
        u.Nombre AS comprador,
        f.FechaCompra AS fecha,
        dfc.Total AS total,
        dfc.Cantidad AS cantidad,
        f.MetodoPago AS metodoPago,
        dfc.Estado AS estado,
        dfc.ConfirmacionUsuario AS confirmacionUsuario,
        dfc.ConfirmacionComercio AS confirmacionComercio,
        ca.FechaServicio AS fechaEntrega,
        ca.HoraServicio AS horaEntrega,
        ca.ModoServicio AS modoEntrega
      FROM detallefacturacomercio dfc
      JOIN factura f ON dfc.Factura = f.IdFactura
      JOIN publicacion pub ON dfc.Publicacion = pub.IdPublicacion
      JOIN categoria c ON pub.Categoria = c.IdCategoria
      LEFT JOIN usuario u ON f.Usuario = u.IdUsuario
      LEFT JOIN controlagendacomercio ca ON dfc.IdDetalleFacturaComercio = ca.DetFacturacomercio
      WHERE pub.Comerciante = ?
    `;

    const params = [nitComercio];

    if (fechaInicio) {
      query += ' AND f.FechaCompra >= ?';
      params.push(fechaInicio);
    }

    if (fechaFin) {
      query += ' AND f.FechaCompra <= ?';
      params.push(fechaFin);
    }

    if (tipoProducto) {
      query += ' AND LOWER(c.NombreCategoria) = ?';
      params.push(tipoProducto.toLowerCase());
    }

    if (ordenPrecio === 'asc') query += ' ORDER BY dfc.Total ASC';
    else if (ordenPrecio === 'desc') query += ' ORDER BY dfc.Total DESC';
    else query += ' ORDER BY f.FechaCompra DESC, dfc.IdDetalleFacturaComercio DESC';

    const results = await queryPromise(query, params);
    res.json(results);
  } catch (err) {
    console.error('❌ Error en historial ventas:', err);
    res.status(500).json({ error: 'Error en la consulta de historial de ventas' });
  }
});



// ==============================
// HISTORIAL DE VENTAS (EXCEL) - COMERCIANTE
// ==============================
app.get('/api/historial-ventas/excel', async (req, res) => {
  const { fechaInicio, fechaFin, tipoProducto, ordenPrecio } = req.query;
  const usuario = req.session.usuario;

  if (!usuario || usuario.tipo !== 'Comerciante') {
    return res.status(403).send('Acceso no autorizado.');
  }

  try {
    // 🔍 Obtener el NIT del comerciante logueado
    const comercianteRows = await queryPromise(
      'SELECT NitComercio FROM comerciante WHERE Comercio = ?',
      [usuario.id]
    );

    if (comercianteRows.length === 0) {
      return res.status(403).json({ error: 'No se encontró información del comerciante.' });
    }

    const nitComercio = comercianteRows[0].NitComercio;
    const params = [nitComercio];

    // 🧾 Consultar TODAS las ventas (sin filtro de confirmación en historial)
    let query = `
      SELECT 
        f.IdFactura AS idVenta,
        pub.NombreProducto AS producto,
        c.NombreCategoria AS categoria,
        u.Nombre AS comprador,
        f.FechaCompra AS fecha,
        dfc.Cantidad AS cantidad,
        dfc.Total AS total,
        f.MetodoPago AS metodoPago,
        dfc.Estado AS estado,
        dfc.ConfirmacionUsuario AS confirmacionUsuario,
        dfc.ConfirmacionComercio AS confirmacionComercio
      FROM detallefacturacomercio dfc
      JOIN factura f ON dfc.Factura = f.IdFactura
      JOIN publicacion pub ON dfc.Publicacion = pub.IdPublicacion
      JOIN categoria c ON pub.Categoria = c.IdCategoria
      LEFT JOIN usuario u ON f.Usuario = u.IdUsuario
      WHERE pub.Comerciante = ?
    `;

    // 🔹 Filtros opcionales
    if (fechaInicio) {
      query += ' AND f.FechaCompra >= ?';
      params.push(fechaInicio);
    }
    if (fechaFin) {
      query += ' AND f.FechaCompra <= ?';
      params.push(fechaFin);
    }
    if (tipoProducto) {
      query += ' AND LOWER(c.NombreCategoria) = ?';
      params.push(tipoProducto.toLowerCase());
    }

    // 🔹 Orden
    if (ordenPrecio === 'asc') query += ' ORDER BY dfc.Total ASC';
    else if (ordenPrecio === 'desc') query += ' ORDER BY dfc.Total DESC';
    else query += ' ORDER BY f.FechaCompra DESC';

    const results = await queryPromise(query, params);

    if (results.length === 0) {
      return res.json({ success: false, mensaje: 'No hay datos para generar el Excel.' });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Historial Ventas');

    worksheet.columns = [
      { header: '#', key: 'n', width: 5 },
      { header: 'ID Venta', key: 'idVenta', width: 10 },
      { header: 'Producto', key: 'producto', width: 25 },
      { header: 'Categoría', key: 'categoria', width: 20 },
      { header: 'Comprador', key: 'comprador', width: 20 },
      { header: 'Fecha', key: 'fecha', width: 20 },
      { header: 'Cantidad', key: 'cantidad', width: 10 },
      { header: 'Total', key: 'total', width: 15 },
      { header: 'Pago', key: 'metodoPago', width: 20 },
      { header: 'Estado', key: 'estado', width: 20 }
    ];

    results.forEach((row, i) => {
      worksheet.addRow({
        n: i + 1,
        ...row,
        fecha: row.fecha ? new Date(row.fecha).toISOString().split('T')[0] : ''
      });
    });

    worksheet.getRow(1).font = { bold: true };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=historial_ventas.xlsx');

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error('❌ Error al generar Excel de ventas:', err);
    res.status(500).send('Error al generar Excel de ventas');
  }
});

//confirmacion del usuario natural
app.post("/api/confirmar-recibido", async (req, res) => {
  const { idDetalle } = req.body;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Actualizar confirmación del usuario
    await conn.query(`
      UPDATE detallefacturacomercio
      SET ConfirmacionUsuario = 'Recibido'
      WHERE IdDetalleFacturaComercio = ?
    `, [idDetalle]);

    // Verificar si ambas confirmaciones están completas
    const [[detalle]] = await conn.query(`
      SELECT Factura, ConfirmacionUsuario, ConfirmacionComercio
      FROM detallefacturacomercio
      WHERE IdDetalleFacturaComercio = ?
    `, [idDetalle]);

    if (detalle.ConfirmacionUsuario === 'Recibido' && detalle.ConfirmacionComercio === 'Entregado') {
      await conn.query(`
        UPDATE detallefacturacomercio
        SET Estado = 'Finalizado'
        WHERE IdDetalleFacturaComercio = ?
      `, [idDetalle]);

      await conn.query(`
        UPDATE detallefactura
        SET Estado = 'Finalizado'
        WHERE factura = ?
      `, [detalle.Factura]);
    }

    await conn.commit();
    res.json({ success: true, message: "Confirmación de recibido registrada." });
  } catch (err) {
    await conn.rollback();
    console.error("❌ Error al confirmar recibido:", err);
    res.status(500).json({ success: false, message: "Error al confirmar recibido." });
  } finally {
    conn.release();
  }
});

// ----------------------
// RUTA PARA OBTENER LOS TALLERES 
// ----------------------
app.get('/api/talleres', async (req, res) => {
  try {
    const rows = await queryPromise(`
      SELECT
        U.Nombre AS NombreVendedor,
        C.NombreComercio,
        C.Latitud,
        C.Longitud,
        C.HoraInicio,
        C.HoraFin,
        C.DiasAtencion,
        C.Barrio
      FROM comerciante C
      INNER JOIN usuario U ON C.Comercio = U.IdUsuario
    `, []);
    
    res.json(rows);
  } catch (err) {
    console.error('❌ Error al obtener ubicaciones:', err);
    res.status(500).json({ error: 'Error al obtener ubicaciones' });
  }
});


// ===============================
//  REGISTRO DE USUARIO-FORMULARIO
// ===============================
import fetch from 'node-fetch'; // si no lo tienes instalado: npm install node-fetch

const tempDir = path.join(process.cwd(), 'public', 'imagen', 'temp');
fs.mkdirSync(tempDir, { recursive: true });

// Guardamos primero en temp
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueName}${path.extname(file.originalname)}`);
  }
});
const upload = multer({ storage });

// Función auxiliar para consultas
const queryPromise = async (sql, params = []) => {
  const [rows] = await pool.query(sql, params);
  return rows;
};

// Ruta unificada de registro
// NOTA: Este endpoint ahora guarda los datos en registros_pendientes
// El usuario REAL solo se crea cuando completa la verificación del código
app.post(
  '/api/registro',
  upload.fields([
    { name: 'FotoPerfil', maxCount: 1 },
    { name: 'Certificado', maxCount: 1 },
  ]),
  async (req, res) => {
    console.log('🚀 === INICIO REGISTRO (PENDIENTE) === 🚀');
    try {
      const data = req.body || {};
      const files = req.files || {};

      console.log('📦 Datos recibidos:', data);
      console.log('📸 Archivos recibidos:', files);

      // Normalizar tipo de usuario
      const tipoKey = (data.TipoUsuario || '').toLowerCase();
      const tipoMap = {
        natural: 'Natural',
        comerciante: 'Comerciante',
        servicio: 'PrestadorServicios',
        prestadorservicio: 'PrestadorServicios',
      };
      const tipoFolder = tipoMap[tipoKey] || 'Otros';
      let tipoUsuarioSQL =
        tipoKey === 'natural'
          ? 'Natural'
          : tipoKey === 'comerciante'
          ? 'Comerciante'
          : 'PrestadorServicio';

      const idUsuarioValue = data.Usuario;
      const nombre = (data.Nombre || '').trim();
      const apellido = (data.Apellido || '').trim();

      const fotoPerfilFile = files.FotoPerfil ? files.FotoPerfil[0] : null;
      if (!fotoPerfilFile)
        return res.status(400).json({ error: 'Debe subir una foto de perfil' });

      // Verificar si ya existe el usuario por ID (en usuarios reales)
      const usuarioExistente = await queryPromise(
        'SELECT IdUsuario FROM usuario WHERE IdUsuario = ?',
        [idUsuarioValue]
      );
      if (usuarioExistente.length > 0) {
        console.log(`⚠️ Usuario ${idUsuarioValue} ya existe en la base de datos`);
        return res.status(409).json({ error: 'El número de documento ya está registrado. Por favor, utilice otro número de documento.' });
      }

      // Verificar si ya existe el correo (en usuarios reales)
      const correoExistente = await queryPromise(
        'SELECT IdUsuario FROM usuario WHERE Correo = ?',
        [data.Correo]
      );
      if (correoExistente.length > 0) {
        console.log(`⚠️ Correo ${data.Correo} ya está registrado en la base de datos`);
        return res.status(409).json({ error: 'El correo electrónico ya está registrado. Por favor, utilice otro correo.' });
      }

      // Verificar si hay un registro pendiente con el mismo documento o correo
      const pendienteExistente = await queryPromise(
        `SELECT IdRegistro FROM registros_pendientes 
         WHERE (IdUsuario = ? OR Correo = ?) AND Estado = 'Pendiente'`,
        [idUsuarioValue, data.Correo]
      );
      
      // Si existe un registro pendiente, lo eliminamos para permitir re-registro
      if (pendienteExistente.length > 0) {
        console.log(`🗑️ Eliminando registro pendiente anterior para ${idUsuarioValue}`);
        await queryPromise(
          `DELETE FROM registros_pendientes WHERE IdUsuario = ? OR Correo = ?`,
          [idUsuarioValue, data.Correo]
        );
      }

      // Mover la foto a carpeta temporal del usuario pendiente
      const pendingDir = path.join(
        process.cwd(),
        'public',
        'imagen',
        'pendientes',
        idUsuarioValue.toString()
      );
      fs.mkdirSync(pendingDir, { recursive: true });

      const fotoName = `${Date.now()}_${Math.round(Math.random() * 1e6)}${path.extname(fotoPerfilFile.originalname)}`;
      const fotoPath = path.join(pendingDir, fotoName);
      fs.renameSync(fotoPerfilFile.path, fotoPath);
      const fotoRuta = path.join('imagen', 'pendientes', idUsuarioValue.toString(), fotoName).replace(/\\/g, '/');

      // Preparar datos del perfil específico según tipo de usuario
      let datosPerfil = {};
      let certificadoRuta = null;

      if (tipoKey === 'natural') {
        datosPerfil = {
          Direccion: data.Direccion || null,
          Barrio: data.Barrio || null
        };
      } else if (tipoKey === 'comerciante') {
        datosPerfil = {
          NitComercio: data.NitComercio || null,
          NombreComercio: data.NombreComercio || null,
          Direccion: data.Direccion || null,
          Barrio: data.Barrio || null,
          RedesSociales: data.RedesSociales || null,
          DiasAtencion: data.DiasAtencion || null,
          HoraInicio: data.HoraInicio || null,
          HoraFin: data.HoraFin || null
        };
      } else if (tipoKey === 'servicio' || tipoKey === 'prestadorservicio' || tipoKey === 'prestadorservicios') {
        const certificadoFile = files.Certificado ? files.Certificado[0] : null;
        if (!certificadoFile)
          return res.status(400).json({ error: 'Debe subir un certificado válido' });

        const certName = `${Date.now()}_${Math.round(Math.random() * 1e6)}${path.extname(certificadoFile.originalname)}`;
        const certPath = path.join(pendingDir, certName);
        fs.renameSync(certificadoFile.path, certPath);
        certificadoRuta = path.join('imagen', 'pendientes', idUsuarioValue.toString(), certName).replace(/\\/g, '/');

        datosPerfil = {
          Direccion: data.Direccion || null,
          Barrio: data.Barrio || null,
          RedesSociales: data.RedesSociales || null,
          Certificado: certificadoRuta,
          DiasAtencion: data.DiasAtencion || null,
          HoraInicio: data.HoraInicio || null,
          HoraFin: data.HoraFin || null
        };
      }

      // Generar token único
      const token = generarToken();
      const fechaExpiracion = new Date();
      fechaExpiracion.setHours(fechaExpiracion.getHours() + 24); // 24 horas para completar

      // Guardar en registros_pendientes (NO en usuario)
      await queryPromise(
        `INSERT INTO registros_pendientes 
          (Token, IdUsuario, TipoUsuario, Nombre, Apellido, Documento, Telefono, Correo, FotoPerfil, DatosPerfil, FechaExpiracion)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          token,
          idUsuarioValue,
          tipoUsuarioSQL,
          nombre,
          apellido,
          idUsuarioValue,
          data.Telefono || null,
          data.Correo,
          fotoRuta,
          JSON.stringify(datosPerfil),
          fechaExpiracion.toISOString()
        ]
      );

      console.log(`📝 Registro PENDIENTE creado: ${idUsuarioValue} - Token: ${token.substring(0, 10)}...`);
      console.log(`⏳ El usuario se creará cuando complete la verificación del código`);

      // Determinar si requiere aprobación (para mostrar mensaje al usuario)
      const requiereAprobacion = (tipoUsuarioSQL === 'Comerciante' || tipoUsuarioSQL === 'PrestadorServicio');

      res.status(200).json({
        mensaje: `Registro iniciado. Ahora verifica tu correo y crea tu contraseña.`,
        usuario: idUsuarioValue,
        requiereAprobacion: requiereAprobacion,
        requiereContrasena: true,
        correo: data.Correo,
        token: token
      });

    } catch (error) {
      console.error('');
      console.error('='.repeat(60));
      console.error('❌❌❌ ERROR EN /api/registro ❌❌❌');
      console.error('='.repeat(60));
      console.error(error);
      console.error('='.repeat(60));
      console.error('');
      return res.status(500).json({ 
        error: 'Error al procesar registro',
        details: process.env.NODE_ENV === 'production' ? error.message : error.stack,
        code: error.code || 'UNKNOWN'
      });
    }
  }
);

// ===============================
// 🔐 SISTEMA DE VERIFICACIÓN Y CREACIÓN DE CONTRASEÑA POR CORREO
// ===============================

/**
 * Genera un token único y seguro
 */
function generarToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ===============================
// 🔐 SISTEMA DE VERIFICACIÓN POR CÓDIGO DE 4 DÍGITOS
// ===============================

/**
 * Genera un código de 4 dígitos aleatorio
 */
function generarCodigo4Digitos() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * POST /api/enviar-codigo-verificacion
 * Genera y envía un código de 4 dígitos al correo del usuario
 * Ahora busca primero en registros_pendientes
 */
app.post('/api/enviar-codigo-verificacion', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token requerido' });
    }

    // Primero buscar en registros_pendientes (nuevo flujo)
    let [registroPendiente] = await queryPromise(
      `SELECT * FROM registros_pendientes WHERE Token = ? AND Estado = 'Pendiente'`,
      [token]
    );

    if (registroPendiente) {
      // Verificar expiración
      const ahora = new Date();
      const fechaExpiracion = new Date(registroPendiente.FechaExpiracion);

      if (ahora > fechaExpiracion) {
        return res.status(400).json({ error: 'El enlace ha expirado. Por favor, regístrate nuevamente.' });
      }

      // Generar código de 4 dígitos
      const codigo = generarCodigo4Digitos();

      // Guardar código en la BD
      await queryPromise(
        `UPDATE registros_pendientes SET CodigoVerificacion = ?, CodigoEnviado = 'Si', CodigoVerificado = 'No' WHERE IdRegistro = ?`,
        [codigo, registroPendiente.IdRegistro]
      );

      // Enviar correo con el código
      const correoDestino = registroPendiente.Correo;
      const nombreUsuario = `${registroPendiente.Nombre} ${registroPendiente.Apellido}`;

      await enviarCorreo({
        to: correoDestino,
        subject: '🔐 Código de Verificación - RPM Market',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; background: linear-gradient(135deg, #d10000 0%, #a30000 100%); padding: 30px; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0;">🔐 Código de Verificación</h1>
            </div>
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px;">Hola <strong>${nombreUsuario}</strong>,</p>
              <p style="font-size: 16px;">Tu código de verificación para completar el registro en RPM Market es:</p>
              <div style="text-align: center; margin: 30px 0;">
                <span style="background: linear-gradient(135deg, #d10000 0%, #a30000 100%); color: white; font-size: 36px; font-weight: bold; padding: 15px 40px; border-radius: 10px; letter-spacing: 10px;">${codigo}</span>
              </div>
              <p style="font-size: 14px; color: #666;">Este código es válido por <strong>10 minutos</strong>.</p>
              <p style="font-size: 14px; color: #666;">Si no solicitaste este código, puedes ignorar este correo.</p>
              <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
              <p style="font-size: 12px; color: #999; text-align: center;">RPM Market - Tu mercado de repuestos y servicios</p>
            </div>
          </div>
        `
      });

      const correoOculto = correoDestino.replace(/(.{2})(.*)(@.*)/, '$1***$3');
      console.log(`📧 Código de verificación enviado a ${correoDestino} (registro pendiente)`);

      return res.json({
        success: true,
        mensaje: 'Código de verificación enviado',
        correo: correoOculto
      });
    }

    // Si no está en pendientes, buscar en tokens_verificacion (flujo antiguo para compatibilidad)
    const [tokenData] = await queryPromise(
      `SELECT t.*, u.Nombre, u.Apellido, u.Correo, u.TipoUsuario 
       FROM tokens_verificacion t
       JOIN usuario u ON t.Usuario = u.IdUsuario
       WHERE t.Token = ? AND t.TipoToken = 'CrearContrasena' AND t.Usado = 'No'`,
      [token]
    );

    if (!tokenData) {
      return res.status(404).json({ error: 'Token inválido o ya utilizado' });
    }

    // Verificar expiración del token
    const ahora = new Date();
    const fechaExpiracion = new Date(tokenData.FechaExpiracion);

    if (ahora > fechaExpiracion) {
      return res.status(400).json({ error: 'El token ha expirado. Solicita un nuevo enlace.' });
    }

    // Generar código de 4 dígitos
    const codigo = generarCodigo4Digitos();

    // Guardar código en la BD
    await queryPromise(
      `UPDATE tokens_verificacion SET CodigoVerificacion = ?, CodigoEnviado = 'Si', CodigoVerificado = 'No' WHERE IdToken = ?`,
      [codigo, tokenData.IdToken]
    );

    // Enviar correo con el código
    const correoDestino = tokenData.Correo;
    const nombreUsuario = `${tokenData.Nombre} ${tokenData.Apellido}`;

    await enviarCorreo({
      to: correoDestino,
      subject: '🔐 Código de Verificación - RPM Market',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; background: linear-gradient(135deg, #d10000 0%, #a30000 100%); padding: 30px; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">🔐 Código de Verificación</h1>
          </div>
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px;">Hola <strong>${nombreUsuario}</strong>,</p>
            <p style="font-size: 16px;">Tu código de verificación para completar el registro en RPM Market es:</p>
            <div style="text-align: center; margin: 30px 0;">
              <span style="background: linear-gradient(135deg, #d10000 0%, #a30000 100%); color: white; font-size: 36px; font-weight: bold; padding: 15px 40px; border-radius: 10px; letter-spacing: 10px;">${codigo}</span>
            </div>
            <p style="font-size: 14px; color: #666;">Este código es válido por <strong>10 minutos</strong>.</p>
            <p style="font-size: 14px; color: #666;">Si no solicitaste este código, puedes ignorar este correo.</p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            <p style="font-size: 12px; color: #999; text-align: center;">RPM Market - Tu mercado de repuestos y servicios</p>
          </div>
        </div>
      `
    });

    // Ocultar parte del correo para la respuesta
    const correoOculto = correoDestino.replace(/(.{2})(.*)(@.*)/, '$1***$3');

    console.log(`📧 Código de verificación enviado a ${correoDestino} para usuario ${tokenData.Usuario}`);

    res.json({
      success: true,
      mensaje: 'Código de verificación enviado',
      correo: correoOculto
    });

  } catch (error) {
    console.error('❌ Error al enviar código de verificación:', error);
    res.status(500).json({ error: 'Error al enviar el código de verificación' });
  }
});

/**
 * POST /api/verificar-codigo
 * Verifica si el código de 4 dígitos es correcto
 * Ahora busca primero en registros_pendientes
 */
app.post('/api/verificar-codigo', async (req, res) => {
  try {
    const { token, codigo } = req.body;

    if (!token || !codigo) {
      return res.status(400).json({ error: 'Token y código son requeridos' });
    }

    // Primero buscar en registros_pendientes
    let [registroPendiente] = await queryPromise(
      `SELECT * FROM registros_pendientes WHERE Token = ? AND Estado = 'Pendiente'`,
      [token]
    );

    if (registroPendiente) {
      // Verificar que se haya enviado un código
      if (registroPendiente.CodigoEnviado !== 'Si') {
        return res.status(400).json({ error: 'No se ha enviado un código de verificación' });
      }

      // Verificar código
      if (registroPendiente.CodigoVerificacion !== codigo) {
        return res.status(400).json({ error: 'Código incorrecto. Verifica e intenta nuevamente.' });
      }

      // Marcar código como verificado
      await queryPromise(
        `UPDATE registros_pendientes SET CodigoVerificado = 'Si' WHERE IdRegistro = ?`,
        [registroPendiente.IdRegistro]
      );

      console.log(`✅ Código verificado correctamente para registro pendiente ${registroPendiente.IdUsuario}`);

      return res.json({
        success: true,
        verificado: true,
        mensaje: 'Código verificado correctamente'
      });
    }

    // Si no está en pendientes, buscar en tokens_verificacion (flujo antiguo)
    const [tokenData] = await queryPromise(
      `SELECT * FROM tokens_verificacion 
       WHERE Token = ? AND TipoToken = 'CrearContrasena' AND Usado = 'No'`,
      [token]
    );

    if (!tokenData) {
      return res.status(404).json({ error: 'Token inválido o ya utilizado' });
    }

    // Verificar que se haya enviado un código
    if (tokenData.CodigoEnviado !== 'Si') {
      return res.status(400).json({ error: 'No se ha enviado un código de verificación' });
    }

    // Verificar código
    if (tokenData.CodigoVerificacion !== codigo) {
      return res.status(400).json({ error: 'Código incorrecto. Verifica e intenta nuevamente.' });
    }

    // Marcar código como verificado
    await queryPromise(
      `UPDATE tokens_verificacion SET CodigoVerificado = 'Si' WHERE IdToken = ?`,
      [tokenData.IdToken]
    );

    console.log(`✅ Código verificado correctamente para token ${token}`);

    res.json({
      success: true,
      verificado: true,
      mensaje: 'Código verificado correctamente'
    });

  } catch (error) {
    console.error('❌ Error al verificar código:', error);
    res.status(500).json({ error: 'Error al verificar el código' });
  }
});

/**
 * POST /api/reenviar-codigo
 * Genera y reenvía un nuevo código de 4 dígitos
 * Ahora busca primero en registros_pendientes
 */
app.post('/api/reenviar-codigo', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token requerido' });
    }

    // Primero buscar en registros_pendientes
    let [registroPendiente] = await queryPromise(
      `SELECT * FROM registros_pendientes WHERE Token = ? AND Estado = 'Pendiente'`,
      [token]
    );

    if (registroPendiente) {
      // Generar nuevo código
      const nuevoCodigo = generarCodigo4Digitos();

      // Actualizar en BD
      await queryPromise(
        `UPDATE registros_pendientes SET CodigoVerificacion = ?, CodigoVerificado = 'No' WHERE IdRegistro = ?`,
        [nuevoCodigo, registroPendiente.IdRegistro]
      );

      // Enviar correo
      await enviarCorreo({
        to: registroPendiente.Correo,
        subject: '🔐 Nuevo Código de Verificación - RPM Market',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; background: linear-gradient(135deg, #d10000 0%, #a30000 100%); padding: 30px; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0;">🔐 Nuevo Código</h1>
            </div>
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px;">Hola <strong>${registroPendiente.Nombre}</strong>,</p>
              <p style="font-size: 16px;">Tu nuevo código de verificación es:</p>
              <div style="text-align: center; margin: 30px 0;">
                <span style="background: linear-gradient(135deg, #d10000 0%, #a30000 100%); color: white; font-size: 36px; font-weight: bold; padding: 15px 40px; border-radius: 10px; letter-spacing: 10px;">${nuevoCodigo}</span>
              </div>
              <p style="font-size: 14px; color: #666;">Este código es válido por <strong>10 minutos</strong>.</p>
            </div>
          </div>
        `
      });

      const correoOculto = registroPendiente.Correo.replace(/(.{2})(.*)(@.*)/, '$1***$3');
      console.log(`📧 Nuevo código enviado a ${registroPendiente.Correo} (registro pendiente)`);

      return res.json({
        success: true,
        mensaje: 'Nuevo código enviado',
        correo: correoOculto
      });
    }

    // Si no está en pendientes, buscar en tokens_verificacion (flujo antiguo)
    const [tokenData] = await queryPromise(
      `SELECT t.*, u.Nombre, u.Apellido, u.Correo 
       FROM tokens_verificacion t
       JOIN usuario u ON t.Usuario = u.IdUsuario
       WHERE t.Token = ? AND t.TipoToken = 'CrearContrasena' AND t.Usado = 'No'`,
      [token]
    );

    if (!tokenData) {
      return res.status(404).json({ error: 'Token inválido o ya utilizado' });
    }

    // Generar nuevo código
    const nuevoCodigo = generarCodigo4Digitos();

    // Actualizar en BD
    await queryPromise(
      `UPDATE tokens_verificacion SET CodigoVerificacion = ?, CodigoVerificado = 'No' WHERE IdToken = ?`,
      [nuevoCodigo, tokenData.IdToken]
    );

    // Enviar correo
    await enviarCorreo({
      to: tokenData.Correo,
      subject: '🔐 Nuevo Código de Verificación - RPM Market',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; background: linear-gradient(135deg, #d10000 0%, #a30000 100%); padding: 30px; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">🔐 Nuevo Código</h1>
          </div>
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px;">Hola <strong>${tokenData.Nombre}</strong>,</p>
            <p style="font-size: 16px;">Tu nuevo código de verificación es:</p>
            <div style="text-align: center; margin: 30px 0;">
              <span style="background: linear-gradient(135deg, #d10000 0%, #a30000 100%); color: white; font-size: 36px; font-weight: bold; padding: 15px 40px; border-radius: 10px; letter-spacing: 10px;">${nuevoCodigo}</span>
            </div>
            <p style="font-size: 14px; color: #666;">Este código es válido por <strong>10 minutos</strong>.</p>
          </div>
        </div>
      `
    });

    const correoOculto = tokenData.Correo.replace(/(.{2})(.*)(@.*)/, '$1***$3');

    console.log(`📧 Nuevo código enviado a ${tokenData.Correo}`);

    res.json({
      success: true,
      mensaje: 'Nuevo código enviado',
      correo: correoOculto
    });

  } catch (error) {
    console.error('❌ Error al reenviar código:', error);
    res.status(500).json({ error: 'Error al reenviar el código' });
  }
});

/**
 * POST /api/verificar-token-contrasena
 * Verifica si un token es válido (ahora busca en registros_pendientes)
 */
app.post('/api/verificar-token-contrasena', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token requerido' });
    }

    // Buscar en registros_pendientes
    const [registroPendiente] = await queryPromise(
      `SELECT * FROM registros_pendientes 
       WHERE Token = ? AND Estado = 'Pendiente'`,
      [token]
    );

    if (registroPendiente) {
      // Verificar expiración
      const ahora = new Date();
      const fechaExpiracion = new Date(registroPendiente.FechaExpiracion);

      if (ahora > fechaExpiracion) {
        return res.status(400).json({ 
          valido: false, 
          error: 'El enlace ha expirado. Por favor, regístrate nuevamente.' 
        });
      }

      return res.json({
        valido: true,
        usuario: {
          id: registroPendiente.IdUsuario,
          nombre: registroPendiente.Nombre,
          apellido: registroPendiente.Apellido,
          tipoUsuario: registroPendiente.TipoUsuario,
          correo: registroPendiente.Correo
        }
      });
    }

    // Si no está en pendientes, buscar en tokens_verificacion (para recuperación de contraseña)
    const [tokenData] = await queryPromise(
      `SELECT t.*, u.Nombre, u.Apellido, u.TipoUsuario, u.Correo
       FROM tokens_verificacion t
       JOIN usuario u ON t.Usuario = u.IdUsuario
       WHERE t.Token = ? AND t.TipoToken = 'CrearContrasena' AND t.Usado = 'No'`,
      [token]
    );

    if (!tokenData) {
      return res.status(404).json({ 
        valido: false, 
        error: 'Token inválido o ya utilizado' 
      });
    }

    // Verificar expiración
    const ahora = new Date();
    const fechaExpiracion = new Date(tokenData.FechaExpiracion);

    if (ahora > fechaExpiracion) {
      return res.status(400).json({ 
        valido: false, 
        error: 'El token ha expirado. Solicita un nuevo enlace.' 
      });
    }

    res.json({
      valido: true,
      usuario: {
        id: tokenData.Usuario,
        nombre: tokenData.Nombre,
        apellido: tokenData.Apellido,
        tipoUsuario: tokenData.TipoUsuario,
        correo: tokenData.Correo
      }
    });

  } catch (error) {
    console.error('❌ Error al verificar token:', error);
    res.status(500).json({ error: 'Error al verificar el token' });
  }
});

/**
 * POST /api/crear-contrasena-con-token
 * CREA el usuario REAL desde registros_pendientes cuando se completa la verificación
 * Este es el paso final del registro - solo aquí se inserta en las tablas reales
 * REQUIERE: Código de verificación previamente validado
 */
app.post('/api/crear-contrasena-con-token', async (req, res) => {
  try {
    const { token, contrasena } = req.body;

    if (!token || !contrasena) {
      return res.status(400).json({ error: 'Token y contraseña son requeridos' });
    }

    // Primero buscar en registros_pendientes (nuevo flujo)
    let [registroPendiente] = await queryPromise(
      `SELECT * FROM registros_pendientes WHERE Token = ? AND Estado = 'Pendiente'`,
      [token]
    );

    if (registroPendiente) {
      // Verificar que el código haya sido verificado
      if (registroPendiente.CodigoVerificado !== 'Si') {
        return res.status(400).json({ error: 'Debes verificar tu código de correo electrónico primero' });
      }

      // Verificar expiración
      const ahora = new Date();
      const fechaExpiracion = new Date(registroPendiente.FechaExpiracion);

      if (ahora > fechaExpiracion) {
        return res.status(400).json({ error: 'El enlace ha expirado. Por favor, regístrate nuevamente.' });
      }

      console.log(`🚀 Creando usuario REAL desde registro pendiente: ${registroPendiente.IdUsuario}`);

      // Parsear datos del perfil
      const datosPerfil = JSON.parse(registroPendiente.DatosPerfil || '{}');

      // Determinar el estado inicial
      const estadoInicial = (registroPendiente.TipoUsuario === 'Comerciante' || registroPendiente.TipoUsuario === 'PrestadorServicio') 
        ? 'Inactivo' 
        : 'Activo';

      // Determinar carpeta según tipo de usuario
      const tipoFolderMap = {
        'Natural': 'Natural',
        'Comerciante': 'Comerciante',
        'PrestadorServicio': 'PrestadorServicios'
      };
      const tipoFolder = tipoFolderMap[registroPendiente.TipoUsuario] || 'Otros';

      // Mover archivos de pendientes a carpeta final
      const pendingDir = path.join(process.cwd(), 'public', 'imagen', 'pendientes', registroPendiente.IdUsuario.toString());
      const finalUserDir = path.join(process.cwd(), 'public', 'imagen', tipoFolder, registroPendiente.IdUsuario.toString());
      
      let fotoRutaFinal = registroPendiente.FotoPerfil;
      let certRutaFinal = datosPerfil.Certificado || null;

      try {
        // Crear carpeta final si no existe
        fs.mkdirSync(finalUserDir, { recursive: true });

        // Mover foto de perfil
        if (registroPendiente.FotoPerfil && registroPendiente.FotoPerfil.includes('pendientes')) {
          const fotoOriginal = path.join(process.cwd(), 'public', registroPendiente.FotoPerfil);
          if (fs.existsSync(fotoOriginal)) {
            const fotoNombre = path.basename(fotoOriginal);
            const fotoDestino = path.join(finalUserDir, fotoNombre);
            fs.renameSync(fotoOriginal, fotoDestino);
            fotoRutaFinal = path.join('imagen', tipoFolder, registroPendiente.IdUsuario.toString(), fotoNombre).replace(/\\/g, '/');
          }
        }

        // Mover certificado si existe (para prestadores)
        if (datosPerfil.Certificado && datosPerfil.Certificado.includes('pendientes')) {
          const certOriginal = path.join(process.cwd(), 'public', datosPerfil.Certificado);
          if (fs.existsSync(certOriginal)) {
            const certNombre = path.basename(certOriginal);
            const certDestino = path.join(finalUserDir, certNombre);
            fs.renameSync(certOriginal, certDestino);
            certRutaFinal = path.join('imagen', tipoFolder, registroPendiente.IdUsuario.toString(), certNombre).replace(/\\/g, '/');
          }
        }

        // Eliminar carpeta de pendientes si está vacía
        if (fs.existsSync(pendingDir)) {
          const archivos = fs.readdirSync(pendingDir);
          if (archivos.length === 0) {
            fs.rmdirSync(pendingDir);
          }
        }
      } catch (fileError) {
        console.warn('⚠️ Error moviendo archivos:', fileError.message);
        // Continuar con las rutas originales si hay error
      }

      // CREAR USUARIO REAL
      await queryPromise(
        `INSERT INTO usuario (IdUsuario, TipoUsuario, Nombre, Apellido, Documento, Telefono, Correo, FotoPerfil, Estado)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          registroPendiente.IdUsuario,
          registroPendiente.TipoUsuario,
          registroPendiente.Nombre,
          registroPendiente.Apellido,
          registroPendiente.Documento,
          registroPendiente.Telefono,
          registroPendiente.Correo,
          fotoRutaFinal,
          estadoInicial
        ]
      );
      console.log('✅ Usuario insertado en tabla usuario');

      // Hashear contraseña
      const hashContrasena = await bcrypt.hash(contrasena, 10);

      // CREAR CREDENCIALES
      await queryPromise(
        `INSERT INTO credenciales (Usuario, NombreUsuario, Contrasena, ContrasenaTemporal)
         VALUES (?, ?, ?, 'No')`,
        [registroPendiente.IdUsuario, registroPendiente.Correo, hashContrasena]
      );
      console.log('✅ Credenciales creadas');

      // CREAR PERFIL ESPECÍFICO según tipo de usuario
      if (registroPendiente.TipoUsuario === 'Natural') {
        await queryPromise(
          `INSERT INTO perfilnatural (UsuarioNatural, Direccion, Barrio)
           VALUES (?, ?, ?)`,
          [registroPendiente.IdUsuario, datosPerfil.Direccion || null, datosPerfil.Barrio || null]
        );
        console.log('✅ Perfil natural creado');

      } else if (registroPendiente.TipoUsuario === 'Comerciante') {
        // Geocodificar dirección
        const direccionCompleta = `${datosPerfil.Direccion || ''}, ${datosPerfil.Barrio || ''}, Bogotá, Colombia`;
        let latitud = 4.710989;
        let longitud = -74.072092;

        try {
          const geoResponse = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(direccionCompleta)}`,
            { headers: { 'User-Agent': 'RPM-Market/1.0 (contacto@rpm-market.com)' } }
          );
          const geoData = await geoResponse.json();
          if (geoData && geoData.length > 0) {
            latitud = parseFloat(geoData[0].lat);
            longitud = parseFloat(geoData[0].lon);
          }
        } catch (geoError) {
          console.warn('⚠️ Error geocodificando:', geoError.message);
        }

        await queryPromise(
          `INSERT INTO comerciante (NitComercio, Comercio, NombreComercio, Direccion, Barrio, RedesSociales, DiasAtencion, HoraInicio, HoraFin, Latitud, Longitud)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            datosPerfil.NitComercio || null,
            registroPendiente.IdUsuario,
            datosPerfil.NombreComercio || null,
            datosPerfil.Direccion || null,
            datosPerfil.Barrio || null,
            datosPerfil.RedesSociales || null,
            datosPerfil.DiasAtencion || null,
            datosPerfil.HoraInicio || null,
            datosPerfil.HoraFin || null,
            latitud,
            longitud
          ]
        );
        console.log('✅ Perfil comerciante creado');

      } else if (registroPendiente.TipoUsuario === 'PrestadorServicio') {
        await queryPromise(
          `INSERT INTO prestadorservicio (Usuario, Direccion, Barrio, RedesSociales, Certificado, DiasAtencion, HoraInicio, HoraFin)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            registroPendiente.IdUsuario,
            datosPerfil.Direccion || null,
            datosPerfil.Barrio || null,
            datosPerfil.RedesSociales || null,
            certRutaFinal || datosPerfil.Certificado,
            datosPerfil.DiasAtencion || null,
            datosPerfil.HoraInicio || null,
            datosPerfil.HoraFin || null
          ]
        );
        console.log('✅ Perfil prestador de servicio creado');
      }

      // Marcar registro pendiente como completado
      await queryPromise(
        `UPDATE registros_pendientes SET Estado = 'Completado' WHERE IdRegistro = ?`,
        [registroPendiente.IdRegistro]
      );

      console.log(`✅ Registro completado exitosamente para usuario: ${registroPendiente.IdUsuario}`);
      
      return res.json({ 
        success: true, 
        mensaje: 'Registro completado exitosamente. Ya puedes iniciar sesión.' 
      });
    }

    // FLUJO ANTIGUO: Si no está en pendientes, buscar en tokens_verificacion
    const [tokenData] = await queryPromise(
      `SELECT * FROM tokens_verificacion 
       WHERE Token = ? AND TipoToken = 'CrearContrasena' AND Usado = 'No'`,
      [token]
    );

    if (!tokenData) {
      return res.status(404).json({ error: 'Token inválido o ya utilizado' });
    }

    // Verificar que el código haya sido verificado
    if (tokenData.CodigoVerificado !== 'Si') {
      return res.status(400).json({ error: 'Debes verificar tu código de correo electrónico primero' });
    }

    // Verificar expiración
    const ahora = new Date();
    const fechaExpiracion = new Date(tokenData.FechaExpiracion);

    if (ahora > fechaExpiracion) {
      return res.status(400).json({ error: 'El token ha expirado' });
    }

    const idUsuario = tokenData.Usuario;

    // Verificar que el usuario tenga contraseña temporal
    const [credenciales] = await queryPromise(
      'SELECT * FROM credenciales WHERE Usuario = ?',
      [idUsuario]
    );

    if (!credenciales) {
      return res.status(404).json({ error: 'No se encontraron credenciales para este usuario' });
    }

    if (credenciales.ContrasenaTemporal === 'No') {
      return res.status(400).json({ error: 'Este usuario ya configuró su contraseña' });
    }

    // Hashear la nueva contraseña
    const hashNuevaContrasena = await bcrypt.hash(contrasena, 10);

    // ACTUALIZAR la contraseña (no crear nueva)
    await queryPromise(
      "UPDATE credenciales SET Contrasena = ?, ContrasenaTemporal = 'No' WHERE Usuario = ?",
      [hashNuevaContrasena, idUsuario]
    );

    // Marcar el token como usado
    await queryPromise(
      "UPDATE tokens_verificacion SET Usado = 'Si' WHERE IdToken = ?",
      [tokenData.IdToken]
    );

    console.log(`✅ Contraseña actualizada exitosamente para usuario: ${idUsuario}`);
    res.json({ 
      success: true, 
      mensaje: 'Contraseña configurada exitosamente. Ya puedes iniciar sesión.' 
    });

  } catch (error) {
    console.error('❌ Error al crear contraseña:', error);
    res.status(500).json({ error: 'Error al crear la contraseña', detalles: error.message });
  }
});


// ----------------------
// Helpers
// ----------------------
// 🧹 Elimina archivos temporales creados por Multer
function cleanupTempFiles(files, tempDir) {
  try {
    if (!files) return;
    Object.values(files).forEach(fileArr => {
      fileArr.forEach(f => {
        const filePath = path.join(tempDir, f.filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      });
    });
  } catch (e) {
    console.warn('⚠️ cleanupTempFiles error:', e.message);
  }
}

// 📍 Normaliza direcciones (por ejemplo: "Cra" → "Carrera", "Cl" → "Calle")
function normalizarDireccion(dir) {
  return (dir || '')
    .replace(/\bCra\b/gi, 'Carrera')
    .replace(/\bCl\b/gi, 'Calle')
    .replace(/\bAv\b/gi, 'Avenida');
}

// ---------------------- 
// SECCION PUBLICACIONES COMERCIANTE - VISUALIZACION PUBLICACION NATURAL- PUBLICACION PRESTADOR SERVICIO
// ----------------------
// ----------------------
// 📦 CREAR NUEVA PUBLICACIÓN - USUARIO COMERCIANTE
// ----------------------
// --- CONFIGURACIÓN MULTER PARA PUBLICACIONES ---
const storagePublicacion = multer.diskStorage({
  destination: (req, file, cb) => cb(null, tempDir),
  filename: (req, file, cb) => {
    const nombreUnico =
      Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname);
    cb(null, nombreUnico);
  }
});

const uploadPublicacion = multer({
  storage: storagePublicacion,
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB
});

// ===========================
// 📦 PUBLICAR PRODUCTO
// ===========================

app.post('/api/publicar', uploadPublicacion.array('imagenesProducto', 5), async (req, res) => {
  const usuario = req.session.usuario;

  // 🔒 Validación de acceso
  if (!usuario || usuario.tipo !== 'Comerciante') {
    cleanupTempFiles(req.files, tempDir);
    return res.status(403).json({ error: 'Acceso no autorizado. Solo comerciantes pueden publicar.' });
  }

  const { nombreProducto, categoriaProducto, precioProducto, cantidadProducto, descripcionProducto } = req.body;

  // 🧩 Validar campos
  if (!nombreProducto || !categoriaProducto || !precioProducto || !cantidadProducto || !descripcionProducto) {
    cleanupTempFiles(req.files, tempDir);
    return res.status(400).json({ error: 'Faltan datos obligatorios.' });
  }

  const connection = await pool.getConnection();

  try {
    // 🔹 Obtener NIT del comerciante asociado
    const [rowsComercio] = await connection.query(
      'SELECT NitComercio FROM comerciante WHERE Comercio = ? LIMIT 1',
      [usuario.id]
    );

    if (rowsComercio.length === 0) {
      cleanupTempFiles(req.files, tempDir);
      return res.status(404).json({ error: 'No se encontró el comercio asociado al usuario.' });
    }

    const nitComercio = rowsComercio[0].NitComercio;

    // 🔹 Buscar categoría
    const [rowsCategoria] = await connection.query(
      'SELECT IdCategoria FROM categoria WHERE LOWER(NombreCategoria) = LOWER(?) LIMIT 1',
      [categoriaProducto]
    );

    if (rowsCategoria.length === 0) {
      cleanupTempFiles(req.files, tempDir);
      return res.status(400).json({ error: `La categoría '${categoriaProducto}' no existe.` });
    }

    const idCategoria = rowsCategoria[0].IdCategoria;

    // 🔹 Primero insertamos una publicación "temporal" sin imágenes
    const [resultPub] = await connection.query(
      `
      INSERT INTO Publicacion (Comerciante, NombreProducto, Descripcion, Categoria, Precio, Stock, ImagenProducto)
      VALUES (?, ?, ?, ?, ?, ?, '[]')
      `,
      [nitComercio, nombreProducto, descripcionProducto, idCategoria, precioProducto, cantidadProducto]
    );

    const idPublicacion = resultPub.insertId;
    console.log('✅ Publicación creada con ID:', idPublicacion);

    // 🔹 Crear carpeta de la publicación usando su ID
    const carpetaPublicacion = path.join(
      process.cwd(),
      'public', 'imagen', 'Comerciante', usuario.id.toString(), 'publicaciones', idPublicacion.toString()
    );
    fs.mkdirSync(carpetaPublicacion, { recursive: true });

    // 🔹 Mover imágenes desde temp a carpeta específica
    const imagenes = [];
    if (Array.isArray(req.files) && req.files.length > 0) {
      req.files.forEach(file => {
        const destino = path.join(carpetaPublicacion, file.filename);
        fs.renameSync(file.path, destino);
        imagenes.push(
          path.join('imagen', 'Comerciante', usuario.id.toString(), 'publicaciones', idPublicacion.toString(), file.filename)
        );
      });
    }

    // 🔹 Si no hay imágenes, usar una por defecto
    const imagenFinal = imagenes.length > 0
      ? JSON.stringify(imagenes)
      : JSON.stringify(['/imagen/default_producto.jpg']);

    // 🔹 Actualizar publicación con rutas finales
    await connection.query(
      'UPDATE Publicacion SET ImagenProducto = ? WHERE IdPublicacion = ?',
      [imagenFinal, idPublicacion]
    );

    // 🔹 Insertar producto vinculado
    await connection.query(
      `
      INSERT INTO Producto (PublicacionComercio, NombreProducto, Descripcion, IdCategoria, Precio, Stock)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [idPublicacion, nombreProducto, descripcionProducto, idCategoria, precioProducto, cantidadProducto]
    );

    res.json({ mensaje: '✅ Publicación creada exitosamente', idPublicacion });

  } catch (err) {
    console.error('❌ Error en /api/publicar:', err);
    cleanupTempFiles(req.files, tempDir);
    res.status(500).json({ error: 'Error al registrar la publicación.' });
  } finally {
    connection.release();
  }
});



// REGISTRO / HISTORIAL DE PUBLICACIONES
// ----------------------
app.get('/api/publicaciones', async (req, res) => {
  try {
    const usuario = req.session.usuario;

    if (!usuario || usuario.tipo !== 'Comerciante') {
      return res.status(403).json({ error: 'Acceso no autorizado. Solo comerciantes pueden ver sus publicaciones.' });
    }

    console.log(`📋 Obteniendo publicaciones para comerciante: ${usuario.id}`);

    // 🔹 1. Buscar el NIT del comercio asociado al usuario
    const comercio = await queryPromise(
      'SELECT NitComercio FROM comerciante WHERE Comercio = ? LIMIT 1',
      [usuario.id]
    );

    if (!comercio || comercio.length === 0) {
      console.log(`⚠️ No se encontró comercio para usuario: ${usuario.id}`);
      return res.status(404).json({ error: 'No se encontró el comercio asociado a este usuario.' });
    }

    const nitComercio = comercio[0].NitComercio;
    console.log(`✅ NIT del comercio: ${nitComercio}`);

    // 🔹 2. Obtener publicaciones del comerciante
    const publicaciones = await queryPromise(
      `
        SELECT IdPublicacion, NombreProducto, Precio, ImagenProducto
        FROM publicacion
        WHERE comerciante = ?
        ORDER BY IdPublicacion DESC
      `,
      [nitComercio]
    );

    console.log(`✅ ${publicaciones.length} publicaciones encontradas`);
    res.json(publicaciones);
  } catch (err) {
    console.error('❌ Error al obtener las publicaciones:', err);
    res.status(500).json({ error: 'Error interno al obtener las publicaciones.' });
  }
});



// ELIMINAR PUBLICACIÓN Y SU CARPETA
// ----------------------
app.delete('/api/publicaciones/:id', async (req, res) => {
  try {
    const usuario = req.session.usuario;
    const idPublicacion = req.params.id;

    if (!usuario || usuario.tipo !== 'Comerciante') {
      return res.status(403).json({ error: 'Acceso no autorizado. Solo comerciantes pueden eliminar publicaciones.' });
    }

    // 🔹 1️⃣ Obtener el NIT del comercio asociado al usuario
    const [comercio] = await pool.query(
      'SELECT NitComercio FROM comerciante WHERE Comercio = ? LIMIT 1',
      [usuario.id]
    );

    if (!comercio || comercio.length === 0) {
      return res.status(404).json({ error: 'No se encontró el comercio asociado.' });
    }

    const nitComercio = comercio[0].NitComercio;

    // 🔹 2️⃣ Verificar que la publicación exista y obtener las imágenes
    const [publicacion] = await pool.query(
      'SELECT ImagenProducto FROM publicacion WHERE IdPublicacion = ? AND Comerciante = ?',
      [idPublicacion, nitComercio]
    );

    if (!publicacion || publicacion.length === 0) {
      return res.status(404).json({ error: 'No se encontró la publicación o no pertenece a tu comercio.' });
    }

    let imagenes = [];
    try {
      imagenes = JSON.parse(publicacion[0].ImagenProducto || '[]');
    } catch (parseErr) {
      console.warn('⚠️ No se pudieron parsear las imágenes:', parseErr);
    }

    // 🔹 3️⃣ Eliminar productos asociados
    await pool.query('DELETE FROM producto WHERE PublicacionComercio = ?', [idPublicacion]);

    // 🔹 4️⃣ Eliminar la publicación
    await pool.query('DELETE FROM publicacion WHERE IdPublicacion = ? AND Comerciante = ?', [
      idPublicacion,
      nitComercio
    ]);

    // 🔹 5️⃣ Eliminar carpeta completa de la publicación
    const carpetaPublicacion = path.join(
      __dirname,
      'public',
      'imagen',
      'Comerciante',
      usuario.id.toString(),
      'publicaciones',
      idPublicacion.toString()
    );

    try {
      if (fs.existsSync(carpetaPublicacion)) {
        fs.rmSync(carpetaPublicacion, { recursive: true, force: true });
        console.log(`🗑️ Carpeta eliminada correctamente: ${carpetaPublicacion}`);
      } else {
        console.warn('⚠️ Carpeta no encontrada (posiblemente ya eliminada):', carpetaPublicacion);
      }
    } catch (fsErr) {
      console.error('❌ Error al eliminar carpeta:', fsErr);
    }

    // 🔹 6️⃣ Confirmar eliminación
    res.json({
      mensaje: '✅ Publicación, productos asociados y carpeta eliminados exitosamente.'
    });
  } catch (err) {
    console.error('❌ Error al eliminar publicación:', err);
    res.status(500).json({ error: 'Error interno al eliminar la publicación.' });
  }
});


// 🟢 OBTENER UNA PUBLICACIÓN EN ESPECÍFICO POR ID - editar publicacion
app.get('/api/publicaciones/:id', async (req, res) => {
  try {
    const usuario = req.session.usuario;
    const idPublicacion = req.params.id;

    if (!usuario || usuario.tipo !== 'Comerciante') {
      return res.status(403).json({ error: 'Acceso no autorizado. Solo comerciantes pueden ver publicaciones.' });
    }

    // 🔹 1️⃣ Obtener el NIT del comercio asociado al usuario
    const [comercio] = await pool.query(
      'SELECT NitComercio FROM comerciante WHERE Comercio = ? LIMIT 1',
      [usuario.id]
    );

    if (!comercio || comercio.length === 0) {
      return res.status(404).json({ error: 'No se encontró el comercio asociado.' });
    }

    const nitComercio = comercio[0].NitComercio;

    // 🔹 2️⃣ Traer los datos completos de la publicación
    const queryPublicacion = `
      SELECT 
        IdPublicacion,
        NombreProducto,
        Descripcion,
        Categoria AS IdCategoria,
        (SELECT NombreCategoria FROM categoria WHERE IdCategoria = Publicacion.Categoria) AS NombreCategoria,
        Precio,
        ImagenProducto
      FROM publicacion
      WHERE IdPublicacion = ? AND Comerciante = ?
      LIMIT 1
    `;

    const [publicacion] = await pool.query(queryPublicacion, [idPublicacion, nitComercio]);

    if (!publicacion || publicacion.length === 0) {
      return res.status(404).json({ error: 'Publicación no encontrada o no pertenece al comerciante.' });
    }

    // 🔹 3️⃣ Parsear imágenes si existen
    const pub = publicacion[0];
    try {
      pub.ImagenProducto = JSON.parse(pub.ImagenProducto || '[]');
    } catch {
      pub.ImagenProducto = [];
    }

    // 🔹 4️⃣ Respuesta final
    res.json(pub);

  } catch (err) {
    console.error('❌ Error al obtener la publicación:', err);
    res.status(500).json({ error: 'Error interno al obtener la publicación.' });
  }
});

// ----------------------
// OBTENER TODAS LAS CATEGORÍAS
// ----------------------
app.get('/api/categorias', async (req, res) => {
  try {
    const [categorias] = await pool.query(
      'SELECT IdCategoria, NombreCategoria FROM categoria ORDER BY NombreCategoria ASC'
    );

    // 🔹 Filtramos categorías que contengan "grua"
    const categoriasFiltradas = categorias.filter(c =>
      !c.NombreCategoria.toLowerCase().includes('grua')
    );

    res.json(categoriasFiltradas);
  } catch (err) {
    console.error('❌ Error al obtener categorías:', err);
    res.status(500).json({ error: 'Error al obtener las categorías.' });
  }
});

// ----------------------
// EDITAR Y ACTUALIZAR UNA PUBLICACIÓN
// ----------------------

// 📂 MULTER PARA EDITAR PUBLICACIONES
const storageEditar = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, 'public', 'imagen', 'temp_editar');
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const uploadEditar = multer({ storage: storageEditar });

// 🟢 ACTUALIZAR PUBLICACIÓN
app.put('/api/publicaciones/:id', uploadEditar.array('imagenesNuevas', 10), async (req, res) => {
  try {
    const usuario = req.session.usuario;
    const idPublicacion = req.params.id;

    if (!usuario || usuario.tipo !== 'Comerciante') {
      return res.status(403).json({ error: 'Acceso no autorizado.' });
    }

    const { titulo, precio, categoria, descripcion } = req.body;

    let imagenesActuales = [];
    try {
      imagenesActuales = JSON.parse(req.body.imagenesActuales || '[]');
    } catch {
      imagenesActuales = [];
    }

    // 🔹 1️⃣ Obtener NIT del comerciante
    const [comercio] = await pool.query(
      'SELECT NitComercio FROM comerciante WHERE Comercio = ? LIMIT 1',
      [usuario.id]
    );

    if (!comercio || comercio.length === 0) {
      return res.status(404).json({ error: 'No se encontró el comercio asociado.' });
    }

    const nitComercio = comercio[0].NitComercio;

    // 🔹 2️⃣ Rutas de nuevas imágenes
    const nuevasImagenes = (req.files || []).map(f => f.path.replace(/\\/g, '/'));
    const todasLasImagenes = [...imagenesActuales, ...nuevasImagenes];
    const rutaBase = path.join(__dirname, 'public');

    // 🔹 3️⃣ Obtener imágenes anteriores para eliminar las que ya no están
    const [resultPub] = await pool.query(
      'SELECT ImagenProducto FROM publicacion WHERE IdPublicacion = ? AND Comerciante = ?',
      [idPublicacion, nitComercio]
    );

    if (!resultPub || resultPub.length === 0) {
      return res.status(404).json({ error: 'Publicación no encontrada o no pertenece al comerciante.' });
    }

    let anteriores = [];
    try {
      anteriores = JSON.parse(resultPub[0].ImagenProducto || '[]');
    } catch {
      anteriores = [];
    }

    // 🔹 4️⃣ Eliminar del disco las imágenes quitadas por el usuario
    const eliminadas = anteriores.filter(img => !imagenesActuales.includes(img));
    eliminadas.forEach(imgPath => {
      const fullPath = path.join(rutaBase, imgPath);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    });

    // 🔹 5️⃣ Actualizar la publicación en la base de datos
    const queryUpdate = `
      UPDATE Publicacion
      SET NombreProducto = ?, Precio = ?, Categoria = ?, Descripcion = ?, ImagenProducto = ?
      WHERE IdPublicacion = ? AND Comerciante = ?
    `;

    await pool.query(queryUpdate, [
      titulo,
      precio,
      categoria,
      descripcion,
      JSON.stringify(todasLasImagenes),
      idPublicacion,
      nitComercio,
    ]);

    console.log('✅ Publicación actualizada correctamente');
    res.json({ mensaje: 'Publicación actualizada correctamente.' });
  } catch (err) {
    console.error('❌ Error al actualizar publicación:', err);
    res.status(500).json({ error: 'Error interno al actualizar la publicación.' });
  }
});

// DASHBOARD USUARIO COMERCIANTE
// ----------------------

app.get('/api/dashboard/comerciante', async (req, res) => {
  try {
    // 🧩 Validar sesión activa
    if (!req.session || !req.session.usuario) {
      return res.status(401).json({ error: 'No has iniciado sesión.' });
    }

    const idUsuario = req.session.usuario.id;
    const { dia, categoria, anio } = req.query;
    
    console.log('📊 Cargando dashboard del comerciante:', idUsuario, 'Filtros:', { dia, categoria, anio });

    // 🔍 Obtener el NIT del comerciante logueado
    const comercianteRows = await queryPromise(
      'SELECT NitComercio FROM comerciante WHERE Comercio = ?',
      [idUsuario]
    );

    if (comercianteRows.length === 0) {
      return res.status(403).json({ error: 'No se encontró información del comerciante.' });
    }

    const nitComercio = comercianteRows[0].NitComercio;

    // 🧾 Consultar las ventas del comerciante usando detallefacturacomercio
    // SOLO contar como ventas cuando ConfirmacionUsuario = 'Recibido'
    let query = `
      SELECT 
        c.NombreComercio,
        cat.NombreCategoria,
        p.NombreProducto,
        COUNT(dfc.IdDetalleFacturaComercio) AS totalVentas,
        SUM(dfc.Total) AS totalRecaudado,
        DATE(f.FechaCompra) AS fechaCompra
      FROM detallefacturacomercio dfc
      INNER JOIN factura f ON dfc.Factura = f.IdFactura
      INNER JOIN publicacion p ON dfc.Publicacion = p.IdPublicacion
      INNER JOIN categoria cat ON p.Categoria = cat.IdCategoria
      INNER JOIN comerciante c ON p.Comerciante = c.NitComercio
      WHERE c.NitComercio = ? AND dfc.ConfirmacionUsuario = 'Recibido'
    `;
    
    const params = [nitComercio];
    
    // Agregar filtros dinámicos
    if (dia) {
      query += ' AND DATE(f.FechaCompra) = ?';
      params.push(dia);
    }
    
    if (categoria) {
      query += ' AND cat.NombreCategoria = ?';
      params.push(categoria);
    }
    
    if (anio) {
      query += ' AND YEAR(f.FechaCompra) = ?';
      params.push(anio);
    }
    
    query += `
      GROUP BY cat.NombreCategoria, p.NombreProducto, fechaCompra
      ORDER BY fechaCompra DESC
    `;

    const result = await queryPromise(query, params);

    // 💰 Calcular totales
    let totalVentas = 0;
    let totalRecaudado = 0;
    let ventasPorCategoria = {};
    let categorias = new Set();

    result.forEach(row => {
      totalVentas += row.totalVentas;
      totalRecaudado += row.totalRecaudado || 0;
      categorias.add(row.NombreCategoria);
      ventasPorCategoria[row.NombreCategoria] = (ventasPorCategoria[row.NombreCategoria] || 0) + (row.totalRecaudado || 0);
    });

    // 📅 Ventas del día y de la semana
    const hoy = new Date().toISOString().split('T')[0];
    const semanaPasada = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const ventasHoy = result
      .filter(r => r.fechaCompra === hoy)
      .reduce((acc, r) => acc + (r.totalRecaudado || 0), 0);

    const ventasSemana = result
      .filter(r => r.fechaCompra >= semanaPasada)
      .reduce((acc, r) => acc + (r.totalRecaudado || 0), 0);

    console.log('✅ Dashboard del comerciante cargado correctamente');

    // 📤 Respuesta final
    res.json({
      totalVentas,
      totalRecaudado,
      ventasHoy,
      ventasSemana,
      categorias: Array.from(categorias),
      ventasPorCategoria: Array.from(categorias).map(cat => ventasPorCategoria[cat] || 0)
    });

  } catch (error) {
    console.error('❌ Error en dashboard comerciante:', error);
    res.status(500).json({ error: 'Error en el servidor al obtener el dashboard del comerciante.' });
  }
});


//  EDITAR - ACTUALIZAR PERFIL COMERCIANTE
// ===============================
app.put(
  "/api/actualizarPerfilComerciante/:idUsuario",
  upload.single("FotoPerfil"),
  async (req, res) => {
    const { idUsuario } = req.params;
    const data = req.body || {};
    const nuevaFoto = req.file || null;

    try {
      // 1️⃣ Verificar si el usuario existe
      const [usuarioRows] = await pool.query(
        "SELECT FotoPerfil FROM usuario WHERE IdUsuario = ?",
        [idUsuario]
      );

      if (usuarioRows.length === 0) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      let rutaFotoFinal = usuarioRows[0].FotoPerfil;

      // 2️⃣ Si se sube una nueva foto de perfil
      if (nuevaFoto) {
        const tipoFolder = "Comerciante";
        const userFolder = path.join(
          __dirname,
          "public",
          "imagen",
          tipoFolder,
          idUsuario
        );

        // Crear carpeta si no existe
        fs.mkdirSync(userFolder, { recursive: true });

        // Eliminar foto anterior (si existe)
        if (rutaFotoFinal) {
          const rutaFotoAnterior = path.join(__dirname, "public", rutaFotoFinal);
          if (fs.existsSync(rutaFotoAnterior)) {
            fs.unlinkSync(rutaFotoAnterior);
          }
        }

        // Generar nuevo nombre único
        const nuevoNombreFoto = `${Date.now()}_${Math.round(
          Math.random() * 1e6
        )}${path.extname(nuevaFoto.originalname)}`;

        const rutaDestino = path.join(userFolder, nuevoNombreFoto);

        // Mover archivo desde la carpeta temporal
        fs.renameSync(nuevaFoto.path, rutaDestino);

        // Guardar ruta relativa (para mostrar en frontend)
        rutaFotoFinal = path
          .join("imagen", tipoFolder, idUsuario, nuevoNombreFoto)
          .replace(/\\/g, "/");

        // Actualizar campo de la foto en la base de datos
        await pool.query(
          "UPDATE usuario SET FotoPerfil = ? WHERE IdUsuario = ?",
          [rutaFotoFinal, idUsuario]
        );
      }

      // 3️⃣ Actualizar información básica del usuario
      await pool.query(
        `UPDATE usuario 
         SET Nombre = ?, Apellido = ?, Telefono = ?, Correo = ?
         WHERE IdUsuario = ?`,
        [
          data.Nombre || null,
          data.Apellido || null,
          data.Telefono || null,
          data.Correo || null,
          idUsuario,
        ]
      );

      // 4️⃣ Actualizar información del comercio asociado
      await pool.query(
        `UPDATE Comerciante
         SET NombreComercio = ?, NitComercio = ?, Direccion = ?, Barrio = ?, RedesSociales = ?,
             DiasAtencion = ?, HoraInicio = ?, HoraFin = ?
         WHERE Comercio = ?`,
        [
          data.NombreComercio || null,
          data.NitComercio || null,
          data.Direccion || null,
          data.Barrio || null,
          data.RedesSociales || null,
          data.DiasAtencion || null,
          data.HoraInicio || null,
          data.HoraFin || null,
          idUsuario,
        ]
      );

      // ✅ Respuesta final
      res.json({
        mensaje: "✅ Perfil actualizado correctamente",
        fotoPerfil: rutaFotoFinal,
      });
    } catch (error) {
      console.error("❌ Error al actualizar perfil comerciante:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  }
);

// 📋 OBTENER PERFIL DEL COMERCIANTE
// ===============================
app.get("/api/perfilComerciante/:idUsuario", async (req, res) => {
  const { idUsuario } = req.params;

  try {
    console.log(`📖 Obteniendo perfil comerciante para usuario: ${idUsuario}`);
    
    const rows = await queryPromise(
      `
      SELECT 
        u.IdUsuario,
        u.Nombre,
        u.Apellido,
        u.Telefono,
        u.Correo,
        u.FotoPerfil,
        c.NombreComercio,
        c.NitComercio,
        c.Direccion,
        c.Barrio,
        c.RedesSociales,
        c.DiasAtencion,
        c.HoraInicio,
        c.HoraFin
      FROM usuario u
      LEFT JOIN comerciante c ON u.IdUsuario = c.Comercio
      WHERE u.IdUsuario = ?
      `,
      [idUsuario]
    );

    if (!rows || rows.length === 0) {
      console.log(`⚠️ Comerciante no encontrado: ${idUsuario}`);
      return res.status(404).json({ error: "Comerciante no encontrado" });
    }

    console.log(`✅ Perfil comerciante encontrado:`, rows[0]);
    res.json(rows[0]);
  } catch (error) {
    console.error("❌ Error al obtener perfil del comerciante:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

///APARTADO DE CONTROL DE AGENDA - COMERCIANTE 

app.get('/api/citas-comerciante', async (req, res) => {
  const usuario = req.session?.usuario;

  if (!usuario) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  try {
    // 🔍 Obtener el NIT del comerciante logueado
    const comercianteRows = await queryPromise(
      'SELECT NitComercio FROM comerciante WHERE Comercio = ?',
      [usuario.id]
    );

    if (comercianteRows.length === 0) {
      return res.status(404).json({ error: 'Comerciante no encontrado' });
    }

    const nitComercio = comercianteRows[0].NitComercio;

    // 🧾 Obtener las citas/pedidos del comerciante desde controlagendacomercio
    const citas = await queryPromise(`
      SELECT 
        ca.IdSolicitud AS id,
        p.NombreProducto AS title,
        ca.FechaServicio AS fechaServicio,
        ca.HoraServicio AS horaServicio,
        ca.ModoServicio AS modoServicio,
        ca.ComentariosAdicionales AS comentarios,
        u.Nombre AS cliente,
        dfc.Cantidad AS cantidad,
        dfc.Total AS total,
        dfc.Estado AS estado,
        f.MetodoPago AS metodoPago,
        f.FechaCompra AS fechaCompra
      FROM controlagendacomercio ca
      JOIN detallefacturacomercio dfc ON ca.DetFacturacomercio = dfc.IdDetalleFacturaComercio
      JOIN factura f ON dfc.Factura = f.IdFactura
      JOIN publicacion p ON dfc.Publicacion = p.IdPublicacion
      LEFT JOIN usuario u ON f.Usuario = u.IdUsuario
      WHERE ca.Comercio = ?
      ORDER BY ca.FechaServicio DESC, f.FechaCompra DESC
    `, [nitComercio]);

    // Formatear datos para FullCalendar y lista
    const eventosFormateados = citas.map(cita => {
      // Solo incluir en calendario si tiene fecha confirmada
      const tieneFecha = cita.fechaServicio && cita.fechaServicio !== '';
      
      return {
        id: cita.id,
        title: `${cita.title} - ${cita.cliente || 'Cliente'}`,
        start: tieneFecha ? cita.fechaServicio : null, // null = no aparece en calendario
        extendedProps: {
          descripcion: `Cliente: ${cita.cliente || 'N/A'} | Cantidad: ${cita.cantidad} | Total: $${Number(cita.total || 0).toLocaleString()} | Estado: ${cita.estado}`,
          hora: cita.horaServicio || 'Sin confirmar',
          cliente: cita.cliente,
          cantidad: cita.cantidad,
          total: cita.total,
          estado: cita.estado,
          metodoPago: cita.metodoPago,
          modoServicio: cita.modoServicio,
          comentarios: cita.comentarios,
          fechaServicio: cita.fechaServicio,
          fechaCompra: cita.fechaCompra,
          tieneFecha: tieneFecha
        }
      };
    });

    res.json(eventosFormateados);
  } catch (error) {
    console.error('Error al obtener citas:', error);
    res.status(500).json({ error: 'Error al obtener citas' });
  }
});

// Endpoint para eliminar un pedido del control de agenda
app.delete('/api/eliminar-pedido/:id', async (req, res) => {
  const usuario = req.session?.usuario;
  const pedidoId = req.params.id;

  if (!usuario) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  try {
    // Eliminar de controlagendacomercio
    await queryPromise(
      'DELETE FROM controlagendacomercio WHERE IdSolicitud = ?',
      [pedidoId]
    );

    res.json({ message: '✅ Pedido eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar pedido:', error);
    res.status(500).json({ error: 'Error al eliminar pedido' });
  }
});

// Endpoint para actualizar fecha de entrega en contraentrega
app.put('/api/actualizar-fecha-pedido', async (req, res) => {
  const usuario = req.session?.usuario;
  const { id, fecha, hora } = req.body;

  if (!usuario) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  if (!id || !fecha || !hora) {
    return res.status(400).json({ error: 'Faltan datos requeridos' });
  }

  try {
    // Actualizar fecha y hora en controlagendacomercio
    // Marcar FechaModificadaPor y NotificacionVista = 0 para que el usuario vea la notificación
    const ahora = new Date().toISOString();
    await queryPromise(
      'UPDATE controlagendacomercio SET FechaServicio = ?, HoraServicio = ?, FechaModificadaPor = ?, NotificacionVista = 0 WHERE IdSolicitud = ?',
      [fecha, hora, ahora, id]
    );

    res.json({ 
      success: true,
      message: '✅ Fecha de entrega actualizada correctamente' 
    });
  } catch (error) {
    console.error('Error al actualizar fecha:', error);
    res.status(500).json({ error: 'Error al actualizar fecha' });
  }
});

// Endpoint para confirmar fecha de entrega (aceptar fecha propuesta por el cliente)
app.put('/api/confirmar-fecha-pedido', async (req, res) => {
  const usuario = req.session?.usuario;
  const { id, fecha, hora, confirmar } = req.body;

  if (!usuario) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  if (!id || !fecha || !hora) {
    return res.status(400).json({ error: 'Faltan datos requeridos' });
  }

  try {
    // Confirmar/actualizar fecha y hora en controlagendacomercio
    await queryPromise(
      'UPDATE controlagendacomercio SET FechaServicio = ?, HoraServicio = ? WHERE IdSolicitud = ?',
      [fecha, hora, id]
    );

    res.json({ 
      success: true,
      message: '✅ Fecha de entrega confirmada correctamente' 
    });
  } catch (error) {
    console.error('Error al confirmar fecha:', error);
    res.status(500).json({ error: 'Error al confirmar fecha' });
  }
});

// Endpoint para marcar notificación de cambio de fecha de comercio como vista
app.put('/api/comercio/notificacion-vista/:id', async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'ID de solicitud requerido' });
  }

  try {
    await queryPromise(
      'UPDATE controlagendacomercio SET NotificacionVista = 1 WHERE IdSolicitud = ?',
      [id]
    );

    res.json({ 
      success: true,
      message: 'Notificación marcada como vista' 
    });
  } catch (error) {
    console.error('Error al marcar notificación:', error);
    res.status(500).json({ error: 'Error al marcar notificación' });
  }
});

// ---------------------- 
// SECCION USUARIO NATURAL 
// ----------------------
// Ruta para editar y visualizar los datos del perfil

app.put("/api/actualizarPerfilNatural/:idUsuario", upload.single("FotoPerfil"), async (req, res) => {
  const { idUsuario } = req.params;
  const data = req.body || {};
  const nuevaFoto = req.file || null;

  try {
    console.log(`📝 Actualizando perfil natural para usuario: ${idUsuario}`);
    
    const usuarioRows = await queryPromise(
      "SELECT FotoPerfil FROM usuario WHERE IdUsuario = ?",
      [idUsuario]
    );

    if (!usuarioRows || usuarioRows.length === 0) {
      console.log(`⚠️ Usuario no encontrado: ${idUsuario}`);
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    let rutaFotoFinal = usuarioRows[0].FotoPerfil;

    if (nuevaFoto) {
      console.log(`📸 Nueva foto detectada: ${nuevaFoto.originalname}`);
      const tipoFolder = "Natural";
      const userFolder = path.join(__dirname, "public", "imagen", tipoFolder, idUsuario);
      fs.mkdirSync(userFolder, { recursive: true });

      if (rutaFotoFinal) {
        const rutaFotoAnterior = path.join(__dirname, "public", rutaFotoFinal);
        if (fs.existsSync(rutaFotoAnterior)) {
          fs.unlinkSync(rutaFotoAnterior);
          console.log(`🗑️ Foto anterior eliminada`);
        }
      }

      const nuevoNombreFoto = `${Date.now()}_${Math.round(Math.random() * 1e6)}${path.extname(nuevaFoto.originalname)}`;
      const rutaDestino = path.join(userFolder, nuevoNombreFoto);
      fs.renameSync(nuevaFoto.path, rutaDestino);

      rutaFotoFinal = path.join("imagen", tipoFolder, idUsuario, nuevoNombreFoto).replace(/\\/g, "/");

      await queryPromise("UPDATE usuario SET FotoPerfil = ? WHERE IdUsuario = ?", [rutaFotoFinal, idUsuario]);
      console.log(`✅ Foto actualizada: ${rutaFotoFinal}`);
    }

    await queryPromise(
      `UPDATE usuario 
       SET Nombre = ?, Apellido = ?, Telefono = ?, Correo = ?
       WHERE IdUsuario = ?`,
      [
        data.Nombre || null,
        data.Apellido || null,
        data.Telefono || null,
        data.Correo || null,
        idUsuario,
      ]
    );
    console.log(`✅ Datos de usuario actualizados`);

    // SQLite compatible: verificar si existe y luego UPDATE o INSERT
    const perfilExiste = await queryPromise(
      `SELECT UsuarioNatural FROM perfilnatural WHERE UsuarioNatural = ?`,
      [idUsuario]
    );

    if (perfilExiste && perfilExiste.length > 0) {
      await queryPromise(
        `UPDATE perfilnatural SET Direccion = ?, Barrio = ? WHERE UsuarioNatural = ?`,
        [data.Direccion || null, data.Barrio || null, idUsuario]
      );
      console.log(`✅ Perfil natural actualizado`);
    } else {
      await queryPromise(
        `INSERT INTO perfilnatural (UsuarioNatural, Direccion, Barrio) VALUES (?, ?, ?)`,
        [idUsuario, data.Direccion || null, data.Barrio || null]
      );
      console.log(`✅ Perfil natural creado`);
    }

    res.json({ mensaje: "✅ Perfil actualizado correctamente", fotoPerfil: rutaFotoFinal });
  } catch (error) {
    console.error("❌ Error al actualizar perfil natural:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});


//visualizacion del perfil 

app.get("/api/perfilNatural/:idUsuario", async (req, res) => {
  const { idUsuario } = req.params;

  try {
    console.log(`📖 Obteniendo perfil natural para usuario: ${idUsuario}`);
    
    const rows = await queryPromise(
      `SELECT 
         u.IdUsuario,
         u.Nombre,
         u.Apellido,
         u.Telefono,
         u.Correo,
         u.FotoPerfil,
         pn.Direccion,
         pn.Barrio
       FROM usuario u
       LEFT JOIN perfilnatural pn ON u.IdUsuario = pn.UsuarioNatural
       WHERE u.IdUsuario = ?`,
      [idUsuario]
    );

    if (!rows || rows.length === 0) {
      console.log(`⚠️ Perfil no encontrado para usuario: ${idUsuario}`);
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    console.log(`✅ Perfil encontrado para: ${rows[0].Nombre} ${rows[0].Apellido}`);
    res.json(rows[0]);
  } catch (error) {
    console.error("❌ Error al obtener perfil natural:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// ----------------------
// PUBLICACIONES PÚBLICAS (visibles para todos)

app.get('/api/publicaciones_publicas', async (req, res) => {
  try {
    const { categoria, limite } = req.query;
    console.log('📥 GET /api/publicaciones_publicas - categoria:', categoria, 'limite:', limite);

    let query = `
      SELECT 
        p.IdPublicacion,
        p.NombreProducto AS nombreProducto,
        p.Precio,
        (SELECT NombreCategoria FROM categoria WHERE IdCategoria = p.Categoria) AS categoria,
        p.ImagenProducto
      FROM publicacion p
      WHERE 1
    `;

    const params = [];

    // 🔹 Filtro opcional por categoría
    if (categoria && categoria.toLowerCase() !== 'todos') {
      query += ` AND p.Categoria = (SELECT IdCategoria FROM categoria WHERE LOWER(NombreCategoria) = LOWER(?))`;
      params.push(categoria);
    }

    // 🔹 Ordenar por las más recientes
    query += ` ORDER BY p.IdPublicacion DESC`;

    // 🔹 Límite opcional
    if (limite) {
      query += ` LIMIT ?`;
      params.push(parseInt(limite));
    }

    const [rows] = await pool.query(query, params);
    console.log(`✅ Encontradas ${rows.length} publicaciones`);

    // 🔹 Parsear imágenes y normalizar rutas
    const publicaciones = rows.map(pub => {
      let imagenes = [];
      try {
        imagenes = JSON.parse(pub.ImagenProducto || '[]');

        // Normalizar rutas: reemplazar backslashes y agregar /image/ si no existe
          imagenes = JSON.parse(pub.ImagenProducto || '[]');

          imagenes = imagenes.map(img => {
            let ruta = img.replace(/\\/g, '/').trim();

            // ✅ Elimina cualquier prefijo incorrecto como "Natural/"
            ruta = ruta.replace(/^Natural\//i, '');

            // ✅ Asegura que comience con "/imagen/"
            if (!ruta.startsWith('imagen/')) {
              ruta = 'imagen/' + ruta.replace(/^\/?imagen\//i, '');
            }

            return '/' + ruta;
          });



      } catch {
        imagenes = [];
      }

      return {
        idPublicacion: pub.IdPublicacion,
        nombreProducto: pub.nombreProducto,
        precio: pub.Precio,
        categoria: pub.categoria,
        imagenes
      };
    });

    res.json(publicaciones);

  } catch (error) {
    console.error('❌ Error al obtener publicaciones públicas:', error);
    res.status(500).json({ error: 'Error al obtener publicaciones públicas.' });
  }
});

// ============================
// Ruta API para detalle de publicación
// ============================
app.get('/api/detallePublicacion/:id', async (req, res) => {
    const idPublicacion = req.params.id;

    try {
        // Consulta principal de la publicación
        const [resultado] = await pool.query(
            `SELECT 
                p.IdPublicacion,
                p.NombreProducto,
                p.Descripcion,
                p.Precio,
                p.Stock,
                p.ImagenProducto,
                p.FechaPublicacion,
                c.NombreComercio,
                c.Comercio AS IdComerciante,
                c.Latitud,
                c.Longitud,
                c.Barrio,
                c.Direccion,
                c.DiasAtencion,
                c.HoraInicio,
                c.HoraFin,
                u.Nombre AS NombreUsuario,
                u.Apellido AS ApellidoUsuario,
                IFNULL(AVG(o.Calificacion), 0) AS CalificacionPromedio
            FROM publicacion p
            JOIN comerciante c ON p.Comerciante = c.NitComercio
            JOIN usuario u ON c.Comercio = u.IdUsuario
            LEFT JOIN opiniones o ON o.Publicacion = p.IdPublicacion
            WHERE p.IdPublicacion = ?
            GROUP BY p.IdPublicacion, c.NombreComercio, c.Latitud, c.Longitud, c.Barrio, c.Direccion, c.DiasAtencion, c.HoraInicio, c.HoraFin, u.Nombre, u.Apellido`,
            [idPublicacion]
        );

        if (resultado.length === 0) {
            return res.status(404).json({ msg: 'Publicación no encontrada' });
        }

        // Consulta de opiniones (sin respuestas - feature no implementada)
        const [opiniones] = await pool.query(
            `SELECT 
                o.IdOpinion, 
                o.Comentario, 
                o.Calificacion, 
                o.FechaOpinion, 
                u.Nombre, 
                u.Apellido
            FROM opiniones o
            JOIN usuario u ON o.UsuarioNatural = u.IdUsuario
            WHERE o.Publicacion = ?
            ORDER BY o.FechaOpinion DESC`,
            [idPublicacion]
        );

        // Guardar la imagen como string directamente (sin parse)
            let imagenes = [];
            try {
              imagenes = JSON.parse(resultado[0].ImagenProducto || '[]');

              imagenes = imagenes.map(img => {
                let ruta = img.replace(/\\/g, '/').trim();
                ruta = ruta.replace(/^Natural\//i, ''); // elimina prefijo incorrecto
                if (!ruta.startsWith('imagen/')) {
                  ruta = 'imagen/' + ruta.replace(/^\/?imagen\//i, '');
                }
                return '/' + ruta;
              });
            } catch {
              imagenes = ['/imagen/placeholder.png'];
            }

        // Enviar datos completos
          res.json({
            publicacion: {
              ...resultado[0],
              ImagenProducto: imagenes
            },
            opiniones
          });


    } catch (err) {
        console.error('Error en /api/detallePublicacion/:id', err);
        res.status(500).json({ msg: 'Error en el servidor' });
    }
});


//AGREGAR AL CARRITO//

// Middleware
app.use(express.urlencoded({ extended: true }));

// ✅ Ruta para agregar producto al carrito
app.post('/api/carrito', async (req, res) => {
    try {
        const { idUsuario, idPublicacion } = req.body;

        if (!idUsuario || !idPublicacion) {
            return res.status(400).json({ msg: 'Faltan datos necesarios' });
        }

        // 🔹 Consultar el precio del producto desde la publicación
        const [producto] = await pool.query(
            `SELECT Precio FROM publicacion WHERE IdPublicacion = ?`,
            [idPublicacion]
        );

        if (producto.length === 0) {
            return res.status(404).json({ msg: 'Publicación no encontrada' });
        }

        const precio = producto[0].Precio;

        // 🔹 Insertar en la tabla Carrito
        await pool.query(
            `INSERT INTO Carrito (UsuarioNat, Publicacion, Cantidad, SubTotal, Estado)
             VALUES (?, ?, 1, ?, 'Pendiente')`,
            [idUsuario, idPublicacion, precio]
        );

        res.json({ msg: 'Producto añadido al carrito correctamente' });
    } catch (err) {
        console.error('❌ Error al agregar al carrito:', err);
        res.status(500).json({ msg: 'Error al agregar el producto al carrito' });
    }
});

//AGREGAR OPINIONES//

app.post('/api/opiniones', async (req, res) => {
  try {
    const { usuarioId, idPublicacion, nombreUsuario, comentario, calificacion } = req.body;

    if (!usuarioId || !idPublicacion || !comentario || !calificacion) {
      return res.status(400).json({ error: 'Faltan datos obligatorios' });
    }

    // Insertar en la tabla Opiniones
    const [resultado] = await pool.query(
      `INSERT INTO Opiniones (UsuarioNatural, Publicacion, NombreUsuario, Comentario, Calificacion)
       VALUES (?, ?, ?, ?, ?)`,
      [usuarioId, idPublicacion, nombreUsuario, comentario, calificacion]
    );

    res.json({
      mensaje: '✅ Opinión guardada correctamente',
      idOpinion: resultado.insertId
    });

  } catch (error) {
    console.error('❌ Error al insertar opinión:', error);
    res.status(500).json({ error: 'Error en el servidor al guardar la opinión.' });
  }
});

// RESPONDER OPINIONES - COMERCIANTES
app.post('/api/opiniones/responder', async (req, res) => {
  try {
    const { idOpinion, idComerciante, respuesta } = req.body;

    if (!idOpinion || !idComerciante || !respuesta) {
      return res.status(400).json({ error: 'Faltan datos obligatorios' });
    }

    // Verificar que la opinión existe y pertenece a una publicación del comerciante
    const [opinion] = await pool.query(
      `SELECT o.IdOpinion, p.Comerciante 
       FROM opiniones o
       JOIN publicacion p ON o.Publicacion = p.IdPublicacion
       WHERE o.IdOpinion = ?`,
      [idOpinion]
    );

    if (opinion.length === 0) {
      return res.status(404).json({ error: 'Opinión no encontrada' });
    }

    // Verificar que el comerciante es el dueño de la publicación
    const [comerciante] = await pool.query(
      `SELECT NitComercio FROM comerciante WHERE Comercio = ?`,
      [idComerciante]
    );

    if (comerciante.length === 0 || comerciante[0].NitComercio !== opinion[0].Comerciante) {
      return res.status(403).json({ error: 'No tienes permiso para responder esta opinión' });
    }

    // Insertar la respuesta
    const [resultado] = await pool.query(
      `INSERT INTO respuestas_opiniones (IdOpinion, IdComerciante, Respuesta)
       VALUES (?, ?, ?)`,
      [idOpinion, idComerciante, respuesta]
    );

    res.json({
      mensaje: '✅ Respuesta guardada correctamente',
      idRespuesta: resultado.insertId
    });

  } catch (error) {
    console.error('❌ Error al insertar respuesta:', error);
    res.status(500).json({ error: 'Error en el servidor al guardar la respuesta.' });
  }
});

// VER CARRITO DE COMPRAS DEL USUARIO LOGUEADO - NATURAL
app.get('/api/carrito', async (req, res) => {
  try {
    const usuario = req.session.usuario;
    if (!usuario) return res.status(401).json({ msg: 'No hay usuario en sesión' });

    const [carrito] = await pool.query(`
      SELECT 
        c.IdCarrito,
        p.NombreProducto,
        p.Precio,
        c.Cantidad,
        (p.Precio * c.Cantidad) AS Total
      FROM Carrito c
      JOIN publicacion p ON c.Publicacion = p.IdPublicacion
      WHERE c.UsuarioNat = ? AND c.Estado = 'Pendiente'
    `, [usuario.id]);

    res.json(carrito);
  } catch (err) {
    console.error('❌ Error al obtener el carrito:', err);
    res.status(500).json({ msg: 'Error al obtener el carrito' });
  }
});


// 🔄 Actualizar cantidad de un producto en el carrito
app.put('/api/carrito/:id', async (req, res) => {
  const { id } = req.params;
  const { cantidad } = req.body;

  try {
    await pool.query(
      `UPDATE Carrito SET Cantidad = ?, SubTotal = (Cantidad * SubTotal / Cantidad) WHERE IdCarrito = ?`,
      [cantidad, id]
    );
    res.json({ msg: 'Cantidad actualizada' });
  } catch (err) {
    console.error('❌ Error al actualizar cantidad:', err);
    res.status(500).json({ msg: 'Error al actualizar cantidad' });
  }
});


// ❌ Eliminar producto del carrito
app.delete('/api/carrito/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM Carrito WHERE IdCarrito = ?', [id]);
    res.json({ msg: 'Producto eliminado' });
  } catch (err) {
    console.error('❌ Error al eliminar producto:', err);
    res.status(500).json({ msg: 'Error al eliminar producto' });
  }
});




// ✅ GET /api/proceso-compra
app.get('/api/proceso-compra', async (req, res) => {
  try {
    // Asegúrate de que el usuario venga de la sesión
    const usuarioSesion = req.session && req.session.usuario;
    if (!usuarioSesion) {
      return res.status(401).json({ msg: 'Usuario no autenticado' });
    }
    const idUsuarioNat = usuarioSesion.id;

    const [rows] = await pool.query(
      `SELECT
         c.IdCarrito,
         c.Cantidad,
         -- Preferimos calcular subtotal aquí para evitar inconsistencias
         (p.Precio * c.Cantidad) AS Subtotal,
         p.Precio,
         p.NombreProducto AS Producto,
         c.SubTotal AS SubTotalEnCarrito,
         cm.NombreComercio,
         cm.Direccion AS DireccionComercio,
         u.IdUsuario AS IdComercioUsuario,
         u.Nombre AS NombreUsuarioComercio,
         u.Apellido AS ApellidoUsuarioComercio
       FROM Carrito c
       JOIN publicacion p ON c.Publicacion = p.IdPublicacion
       JOIN comerciante cm ON p.Comerciante = cm.NitComercio
       JOIN usuario u ON cm.Comercio = u.IdUsuario
       WHERE c.UsuarioNat = ? AND c.Estado = 'Pendiente'`,
      [idUsuarioNat]
    );

    // Normalizar estructura que espera el frontend
    const resultado = rows.map(r => ({
      IdCarrito: r.IdCarrito,
      Cantidad: Number(r.Cantidad),
      Precio: Number(r.Precio),
      Subtotal: Number(r.Subtotal),
      Producto: r.Producto,
      // info del comercio por si la necesitas
      NombreComercio: r.NombreComercio,
      DireccionComercio: r.DireccionComercio,
      IdComercioUsuario: r.IdComercioUsuario,
      NombreUsuarioComercio: r.NombreUsuarioComercio,
      ApellidoUsuarioComercio: r.ApellidoUsuarioComercio
    }));

    res.json(resultado);
  } catch (err) {
    console.error('❌ Error en /api/proceso-compra:', err);
    res.status(500).json({ msg: 'Error al obtener productos para proceso de compra' });
  }
});


//PROCESO DE COMPRA//

app.post("/api/finalizar-compra", async (req, res) => {
  try {
    console.log("📦 Finalizando compra...");

    const usuarioSesion = req.session && req.session.usuario;
    const usuarioId = (usuarioSesion && usuarioSesion.id) || req.body.usuarioId || null;
    const metodoPago = req.body.metodoPago;
    const compraDirecta = req.body.compraDirecta; // Nueva: compra directa desde detalle

    console.log(`👤 Usuario: ${usuarioId}, 💳 Método: ${metodoPago}`);
    console.log(`🛍️ Compra directa:`, compraDirecta ? 'SÍ' : 'NO');

    if (!usuarioId || !metodoPago) {
      console.log("⚠️ Faltan datos: usuario o método de pago");
      return res.status(400).json({ message: "Faltan datos del usuario o método de pago." });
    }

    if (!['contraentrega', 'recoger'].includes(metodoPago)) {
      console.log(`⚠️ Método de pago no válido: ${metodoPago}`);
      return res.status(400).json({ message: "Método de pago no válido." });
    }

    let detallesParaInsertar = [];
    let totalCompra = 0;

    // 🆕 CASO 1: Compra directa (desde detalle de producto)
    if (compraDirecta && compraDirecta.idPublicacion) {
      console.log(`🛍️ Procesando compra directa del producto ID: ${compraDirecta.idPublicacion}`);

      // Obtener datos completos del producto y comercio
      const productoRows = await queryPromise(`
        SELECT 
          pub.IdPublicacion,
          pub.NombreProducto, 
          pub.Precio, 
          pub.Comerciante AS Comercio
        FROM publicacion pub
        WHERE pub.IdPublicacion = ?
      `, [compraDirecta.idPublicacion]);

      if (!productoRows || productoRows.length === 0) {
        return res.status(404).json({ message: "Producto no encontrado." });
      }

      const producto = productoRows[0];
      const cantidad = compraDirecta.cantidad || 1;
      const subtotal = Number(producto.Precio) * cantidad;

      totalCompra = subtotal;
      detallesParaInsertar.push({
        publicacion: producto.IdPublicacion,
        cantidad: cantidad,
        precioUnitario: producto.Precio,
        total: subtotal,
        comercio: producto.Comercio
      });

      console.log(`✅ Producto directo: ${producto.NombreProducto}, Total: $${subtotal}`);
    } 
    // CASO 2: Compra desde carrito
    else {
      console.log("🛒 Procesando compra desde carrito...");

      const carritoRows = await queryPromise(`
        SELECT 
          c.IdCarrito, 
          c.Cantidad, 
          pub.IdPublicacion,
          pub.NombreProducto, 
          pub.Precio, 
          (pub.Precio * c.Cantidad) AS Subtotal,
          pub.Comerciante AS Comercio
        FROM carrito c
        JOIN publicacion pub ON c.Publicacion = pub.IdPublicacion
        WHERE c.UsuarioNat = ? AND c.Estado = 'Pendiente'
      `, [usuarioId]);

      if (!carritoRows || carritoRows.length === 0) {
        console.log("⚠️ No hay productos en el carrito");
        return res.status(400).json({ message: "No hay productos pendientes en el carrito." });
      }

      console.log(`📋 ${carritoRows.length} productos en el carrito`);

      for (const item of carritoRows) {
        totalCompra += Number(item.Subtotal);
        detallesParaInsertar.push({
          publicacion: item.IdPublicacion,
          cantidad: item.Cantidad,
          precioUnitario: item.Precio,
          total: item.Subtotal,
          comercio: item.Comercio
        });
      }
    }

    console.log(`💰 Total de la compra: $${totalCompra}`);

    // 3️⃣ Insertar factura con estado "Proceso pendiente"
    const insertFactura = await queryPromise(
      `INSERT INTO factura (Usuario, TotalPago, MetodoPago, Estado, FechaCompra)
       VALUES (?, ?, ?, ?, datetime('now'))`,
      [usuarioId, totalCompra, metodoPago, 'Proceso pendiente']
    );

    const facturaId = insertFactura.lastID || insertFactura.insertId;
    console.log(`✅ Factura creada con ID: ${facturaId}`);

    // 4️⃣ Insertar detalles con estado "Pendiente"
    for (const detalle of detallesParaInsertar) {
      await queryPromise(
        `INSERT INTO detallefactura (Factura, Publicacion, Cantidad, PrecioUnitario, Total, Estado)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [facturaId, detalle.publicacion, detalle.cantidad, detalle.precioUnitario, detalle.total, 'Pendiente']
      );

      const insertDetalleComercio = await queryPromise(
        `INSERT INTO detallefacturacomercio (Factura, Publicacion, Cantidad, PrecioUnitario, Total, Estado)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [facturaId, detalle.publicacion, detalle.cantidad, detalle.precioUnitario, detalle.total, 'Pendiente']
      );

      const detalleComercioId = insertDetalleComercio.lastID || insertDetalleComercio.insertId;

      let modoServicio = metodoPago === "recoger" ? "Visita al taller" : "Domicilio";
      let tipoServicio = metodoPago === "recoger" ? 1 : 2;
      let fecha = req.body.fechaRecoger || null;
      let hora = req.body.horaRecoger || null;
      let comentarios = req.body.comentariosRecoger || null;

      await queryPromise(
        `INSERT INTO controlagendacomercio 
         (Comercio, DetFacturacomercio, TipoServicio, ModoServicio, FechaServicio, HoraServicio, ComentariosAdicionales)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [detalle.comercio, detalleComercioId, tipoServicio, modoServicio, fecha, hora, comentarios]
      );
    }

    // 5️⃣ Vaciar carrito solo si NO fue compra directa
    if (!compraDirecta) {
      await queryPromise(`DELETE FROM carrito WHERE UsuarioNat = ?`, [usuarioId]);
      console.log("🗑️ Carrito vaciado");
    }

    console.log("✅ Compra registrada con método:", metodoPago);

    // 6️⃣ Mensaje final
    let message = "";
    let redirect = null;

    if (metodoPago === "contraentrega") {
      message = "Su proceso se registró con éxito. Puede hacer seguimiento en 'Historial'.";
    } else if (metodoPago === "recoger") {
      message = "Su solicitud fue enviada al comercio con éxito.";
    }

    return res.json({ success: true, message, redirect });

  } catch (err) {
    console.error("❌ Error al finalizar compra:", err);
    res.status(500).json({ message: "Error al finalizar la compra", error: err.message });
  }
});

// 🔹 API: Obtener factura por ID - APARTADO DE MOSTRAR FACTURA DESPUES DE COMPRA USUARIO NATURAL
// ===============================
app.get('/api/factura/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // 1️⃣ Obtener datos de la factura y del comprador
    const [facturaRows] = await pool.query(`
      SELECT 
        f.IdFactura,
        f.FechaCompra,
        f.TotalPago,
        f.MetodoPago,
        f.Estado,
        u.Nombre AS NombreUsuario,
        u.Apellido AS ApellidoUsuario,
        u.Telefono,
        u.Correo
      FROM factura f
      LEFT JOIN usuario u ON f.Usuario = u.IdUsuario
      WHERE f.IdFactura = ?
    `, [id]);

    if (facturaRows.length === 0) {
      return res.status(404).json({ msg: 'Factura no encontrada' });
    }

    const factura = facturaRows[0];

    // 2️⃣ Obtener los productos asociados a la factura con datos del comercio
    const [detalleRows] = await pool.query(`
      SELECT 
        p.NombreProducto,
        df.Cantidad,
        df.PrecioUnitario,
        df.Total,
        com.NombreComercio,
        com.Direccion AS DireccionComercio
      FROM detallefactura df
      JOIN publicacion p ON df.Publicacion = p.IdPublicacion
      LEFT JOIN comerciante com ON p.Comerciante = com.NitComercio
      WHERE df.Factura = ?
    `, [id]);

    // 3️⃣ Enviar la respuesta
    res.json({
      factura,
      detalles: detalleRows
    });

  } catch (error) {
    console.error('❌ Error al obtener factura:', error);
    res.status(500).json({ msg: 'Error al obtener factura' });
  }
});

//------------------//
//SECCION GENERAL //
//------------------//

//APARTADO DE CENTRO DE AYUDA

app.post("/api/centro-ayuda", async (req, res) => {
  const { perfil, tipoSolicitud, rol, asunto, descripcion } = req.body;

  console.log('📩 Solicitud de centro de ayuda recibida:', { perfil, tipoSolicitud, rol, asunto });

  // Validación de datos
  if (!perfil) {
    console.log('⚠️ Perfil no proporcionado');
    return res.status(401).json({ error: "Debes iniciar sesión para hacer esta solicitud." });
  }

  // Validación de rol
  const rolesValidos = ["Usuario Natural", "Comerciante", "PrestadorServicio"];
  if (!rolesValidos.includes(rol)) {
    console.log('⚠️ Rol inválido:', rol);
    return res.status(400).json({ error: "Rol inválido. Selecciona una opción válida." });
  }

  try {
    const sql = `
      INSERT INTO centroayuda (Perfil, TipoSolicitud, Rol, Asunto, Descripcion)
      VALUES (?, ?, ?, ?, ?)
    `;
    await queryPromise(sql, [perfil, tipoSolicitud, rol, asunto, descripcion]);

    console.log('✅ Solicitud de ayuda registrada exitosamente');
    res.status(200).json({ message: "Solicitud registrada con éxito." });
  } catch (error) {
    console.error("❌ Error al insertar solicitud de ayuda:", error);
    res.status(500).json({ error: "Error al guardar la solicitud." });
  }
});



//----------///
// SECCION DE PRESTADOR DE SERVICIOS//
//-----------//
// ===============================
//  Perfil del Prestador de Servicios
app.get('/api/perfil-prestador', async (req, res) => {
  const usuarioSesion = req.session.usuario;
  if (!usuarioSesion || usuarioSesion.tipo !== "PrestadorServicio") {
    return res.status(401).json({ error: "No autorizado. Debes iniciar sesión como prestador de servicios." });
  }

  try {
    console.log("📊 Cargando perfil del prestador:", usuarioSesion.id);

    // 🔍 Datos del usuario
    const userRows = await queryPromise(
      `SELECT u.IdUsuario, u.Nombre, u.Documento, u.FotoPerfil
       FROM usuario u
       WHERE u.IdUsuario = ?`,
      [usuarioSesion.id]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const user = userRows[0];

    // 🖼️ Ruta de imagen
    let tipoCarpeta = usuarioSesion.tipo;
    if (tipoCarpeta === "PrestadorServicio") {
      tipoCarpeta = "PrestadorServicios"; // ✅ Corrección de nombre de carpeta
    }

    const rutaCarpeta = path.join(__dirname, 'public', 'imagen', tipoCarpeta, user.Documento.toString());
    let fotoRutaFinal = '/imagen/imagen_perfil.png'; // por defecto

    if (fs.existsSync(rutaCarpeta)) {
      const archivos = fs.readdirSync(rutaCarpeta);
      const archivoFoto = archivos.find(
        f => f.includes(user.FotoPerfil) || f.match(/\.(jpg|jpeg|png|webp)$/i)
      );
      if (archivoFoto) {
        fotoRutaFinal = `/imagen/${tipoCarpeta}/${user.Documento}/${archivoFoto}`;
      }
    } else {
      console.warn(`⚠️ Carpeta de usuario no encontrada: ${rutaCarpeta}`);
    }

    // 📊 Obtener IdServicio del prestador
    const servicioRows = await queryPromise(
      `SELECT IdServicio FROM prestadorservicio WHERE Usuario = ?`,
      [usuarioSesion.id]
    );

    let idServicio = null;
    if (servicioRows.length > 0) {
      idServicio = servicioRows[0].IdServicio;
    }

    // 📊 Calcular estadísticas desde OpinionesGrua
    let valoracionPromedio = "N/A";
    let totalOpiniones = 0;

    if (idServicio) {
      const opinionesRows = await queryPromise(
        `SELECT AVG(og.Calificacion) AS promedio, COUNT(*) AS total
         FROM opinionesgrua og
         JOIN publicaciongrua pg ON og.PublicacionGrua = pg.IdPublicacionGrua
         WHERE pg.Servicio = ?`,
        [idServicio]
      );

      if (opinionesRows.length > 0 && opinionesRows[0].promedio) {
        valoracionPromedio = parseFloat(opinionesRows[0].promedio).toFixed(1);
        totalOpiniones = opinionesRows[0].total;
      }
    }

    // 📋 Contar servicios agendados (pendientes, aceptados y completados)
    let pendientes = 0;
    let aceptados = 0;
    let completados = 0;

    if (idServicio) {
      const agendaRows = await queryPromise(
        `SELECT 
           SUM(CASE WHEN cas.Estado = 'Pendiente' THEN 1 ELSE 0 END) AS pendientes,
           SUM(CASE WHEN cas.Estado = 'Aceptado' THEN 1 ELSE 0 END) AS aceptados,
           SUM(CASE WHEN cas.Estado IN ('Terminado', 'Completado') THEN 1 ELSE 0 END) AS completados
         FROM controlagendaservicios cas
         JOIN publicaciongrua pg ON cas.PublicacionGrua = pg.IdPublicacionGrua
         WHERE pg.Servicio = ?`,
        [idServicio]
      );

      if (agendaRows.length > 0) {
        pendientes = agendaRows[0].pendientes || 0;
        aceptados = agendaRows[0].aceptados || 0;
        completados = agendaRows[0].completados || 0;
      }
    }

    // 📋 Últimas solicitudes de agenda de grúa
    const solicitudesRows = idServicio ? await queryPromise(
      `SELECT 
         cas.IdSolicitudServicio,
         u.Nombre AS Cliente,
         cas.DireccionRecogida AS Origen,
         cas.Destino AS Destino,
         cas.FechaServicio AS Fecha,
         cas.Estado
       FROM controlagendaservicios cas
       JOIN publicaciongrua pg ON cas.PublicacionGrua = pg.IdPublicacionGrua
       JOIN usuario u ON cas.UsuarioNatural = u.IdUsuario
       WHERE pg.Servicio = ?
       ORDER BY cas.FechaServicio DESC
       LIMIT 5`,
      [idServicio]
    ) : [];

    // ✅ Respuesta
    res.json({
      nombre: user.Nombre,
      foto: fotoRutaFinal,
      descripcion: "Prestador de servicio de grúa 24/7",
      estadisticas: {
        totalServicios: pendientes + aceptados + completados,
        pendientes: pendientes,
        aceptados: aceptados,
        completados: completados,
        valoracion: valoracionPromedio
      },
      solicitudes: solicitudesRows
    });

    console.log("✅ Perfil del prestador cargado correctamente");

  } catch (err) {
    console.error("❌ Error en perfil del prestador:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});
// ===============================
//  PUBLICACIONES GRUAS

// 📦 Configuración específica para publicaciones de grúa
const storagePublicacionPrestador = multer.diskStorage({
  destination: (req, file, cb) => {
    const usuario = req.session.usuario;
    const dir = path.join(__dirname, 'public', 'Publicaciones', usuario.id.toString());

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const nombreUnico = Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname);
    cb(null, nombreUnico);
  }
});

const uploadPublicacionPrestador = multer({
  storage: storagePublicacionPrestador,
  limits: { fileSize: 5 * 1024 * 1024 }
});



app.post('/api/publicar-grua', uploadPublicacionPrestador.array('imagenesGrua', 5), async (req, res) => {
  const usuario = req.session.usuario;

  // 🔒 Validación de acceso
  if (!usuario || usuario.tipo !== 'PrestadorServicio') {
    cleanupTempFiles(req.files, tempDirGrua);
    return res.status(403).json({ error: 'Acceso no autorizado. Solo prestadores pueden publicar.' });
  }

  const { titulo, descripcion, tarifa, zona } = req.body;

  // 🧩 Validar campos
  if (!titulo || !descripcion || !tarifa || !zona) {
    cleanupTempFiles(req.files, tempDirGrua);
    return res.status(400).json({ error: 'Faltan datos obligatorios.' });
  }

  try {
    // 🔹 Obtener ID del servicio del prestador
    const [rowsServicio] = await pool.query(
      'SELECT IdServicio FROM prestadorservicio WHERE usuario = ? LIMIT 1',
      [usuario.id]
    );

    if (rowsServicio.length === 0) {
      cleanupTempFiles(req.files, tempDirGrua);
      return res.status(404).json({ error: 'No se encontró el servicio asociado al usuario.' });
    }

    const idServicio = rowsServicio[0].IdServicio;

    // 🔹 Insertar publicación sin imágenes aún
    const [resultPub] = await pool.query(
      `INSERT INTO publicaciongrua (Servicio, TituloPublicacion, DescripcionServicio, TarifaBase, ZonaCobertura, FotoPublicacion)
       VALUES (?, ?, ?, ?, ?, '')`,
      [idServicio, titulo, descripcion, tarifa, zona]
    );

    const idPublicacion = resultPub.insertId;
    console.log('✅ Publicación de grúa creada con ID:', idPublicacion);

    // 🔹 Crear carpeta de la publicación
    const carpetaPublicacion = path.join(
      process.cwd(),
      'public', 'imagen', 'PrestadorServicios', usuario.id.toString(), 'publicaciones', idPublicacion.toString()
    );
    fs.mkdirSync(carpetaPublicacion, { recursive: true });

    // 🔹 Mover imágenes desde temp a carpeta específica
    const imagenes = [];

    if (Array.isArray(req.files) && req.files.length > 0) {
      req.files.forEach(file => {
        const destino = path.join(carpetaPublicacion, file.filename);
        fs.renameSync(file.path, destino);

        const rutaRelativa = path.posix.join(
          'imagen',
          'PrestadorServicios',
          usuario.id.toString(),
          'publicaciones',
          idPublicacion.toString(),
          file.filename
        );

        imagenes.push(rutaRelativa);
      });
    }

    // ✅ Guardar todas las rutas como JSON en FotoPublicacion
    const imagenFinal = imagenes.length > 0
      ? JSON.stringify(imagenes)
      : JSON.stringify(['/imagen/default_grua.jpg']);

    await pool.query(
      'UPDATE publicaciongrua SET FotoPublicacion = ? WHERE IdPublicacionGrua = ?',
      [imagenFinal, idPublicacion]
    );

    res.json({ mensaje: '✅ Publicación de grúa creada exitosamente', idPublicacion });

  } catch (err) {
    console.error('❌ Error en /api/publicar-grua:', err);
    cleanupTempFiles(req.files, tempDirGrua);
    res.status(500).json({ error: 'Error al registrar la publicación.' });
  }
});

/// REGISTRO O HISTORIAL DE PUBLICACIONES GRUAS//

app.get('/api/publicaciones-grua', async (req, res) => {
  try {
    const usuario = req.session.usuario;

    if (!usuario || usuario.tipo !== 'PrestadorServicio') {
      return res.status(403).json({ error: 'Acceso no autorizado. Solo prestadores pueden ver sus publicaciones.' });
    }

    const [servicio] = await pool.query(
      'SELECT IdServicio FROM prestadorservicio WHERE usuario = ? LIMIT 1',
      [usuario.id]
    );

    if (!servicio || servicio.length === 0) {
      return res.status(404).json({ error: 'No se encontró el servicio asociado.' });
    }

    const idServicio = servicio[0].IdServicio;

    const [publicaciones] = await pool.query(
      `SELECT 
         IdPublicacionGrua, 
         TituloPublicacion, 
         DescripcionServicio, 
         TarifaBase, 
         ZonaCobertura, 
         FotoPublicacion
       FROM publicaciongrua
       WHERE Servicio = ?
       ORDER BY IdPublicacionGrua DESC`,
      [idServicio]
    );

    res.json(publicaciones);
  } catch (err) {
    console.error('❌ Error al obtener publicaciones de grúa:', err);
    res.status(500).json({ error: 'Error interno al obtener las publicaciones.' });
  }
});

//ELIMINAR UNA PUBLICACION DE GRUA

app.delete('/api/publicaciones-grua/:id', async (req, res) => {
  try {
    const usuario = req.session.usuario;
    const idPublicacion = req.params.id;

    if (!usuario || usuario.tipo !== 'PrestadorServicio') {
      return res.status(403).json({ error: 'Acceso no autorizado. Solo prestadores pueden eliminar publicaciones.' });
    }

    // 🔹 1️⃣ Obtener el ID del servicio del prestador
    const [servicio] = await pool.query(
      'SELECT IdServicio FROM prestadorservicio WHERE usuario = ? LIMIT 1',
      [usuario.id]
    );

    if (!servicio || servicio.length === 0) {
      return res.status(404).json({ error: 'No se encontró el servicio asociado.' });
    }

    const idServicio = servicio[0].IdServicio;

    // 🔹 2️⃣ Verificar que la publicación exista y obtener las imágenes
    const [publicacion] = await pool.query(
      'SELECT FotoPublicacion FROM publicaciongrua WHERE IdPublicacionGrua = ? AND Servicio = ?',
      [idPublicacion, idServicio]
    );

    if (!publicacion || publicacion.length === 0) {
      return res.status(404).json({ error: 'No se encontró la publicación o no pertenece a tu servicio.' });
    }

    let imagenes = [];
    try {
      imagenes = JSON.parse(publicacion[0].FotoPublicacion || '[]');
    } catch (parseErr) {
      console.warn('⚠️ No se pudieron parsear las imágenes:', parseErr);
    }

    // 🔹 3️⃣ Eliminar la publicación
    await pool.query(
      'DELETE FROM publicaciongrua WHERE IdPublicacionGrua = ? AND Servicio = ?',
      [idPublicacion, idServicio]
    );

    // 🔹 4️⃣ Eliminar carpeta completa de la publicación
    const carpetaPublicacion = path.join(
      __dirname,
      'public',
      'imagen',
      'PrestadorServicios',
      usuario.id.toString(),
      'publicaciones',
      idPublicacion.toString()
    );

    try {
      if (fs.existsSync(carpetaPublicacion)) {
        fs.rmSync(carpetaPublicacion, { recursive: true, force: true });
        console.log(`🗑️ Carpeta eliminada correctamente: ${carpetaPublicacion}`);
      } else {
        console.warn('⚠️ Carpeta no encontrada (posiblemente ya eliminada):', carpetaPublicacion);
      }
    } catch (fsErr) {
      console.error('❌ Error al eliminar carpeta:', fsErr);
    }

    // 🔹 5️⃣ Confirmar eliminación
    res.json({
      mensaje: '✅ Publicación y carpeta eliminadas exitosamente.'
    });

  } catch (err) {
    console.error('❌ Error al eliminar publicación de grúa:', err);
    res.status(500).json({ error: 'Error interno al eliminar la publicación.' });
  }
});



//APARTADO DE EDITAR PUBLICACION GRUA - OBTENER DATOS PARA EDICIÓN
app.get('/api/publicaciones-grua/editar/:id', async (req, res) => {
  console.log("📥 Solicitud recibida para editar publicación");
  console.log("🔐 Usuario en sesión:", req.session.usuario);
  console.log("🔍 ID solicitado:", req.params.id);

  try {
    const usuario = req.session.usuario;
    const idPublicacion = req.params.id;

    if (!usuario || usuario.tipo !== 'PrestadorServicio') {
      return res.status(403).json({ error: 'Acceso no autorizado.' });
    }

    const servicioRows = await queryPromise(
      'SELECT IdServicio FROM prestadorservicio WHERE Usuario = ? LIMIT 1',
      [usuario.id]
    );

    if (servicioRows.length === 0) {
      return res.status(404).json({ error: 'No se encontró el servicio asociado.' });
    }

    const idServicio = servicioRows[0].IdServicio;

    const publicacionRows = await queryPromise(
      `SELECT 
        pg.IdPublicacionGrua,
        pg.TituloPublicacion,
        pg.DescripcionServicio,
        pg.TarifaBase,
        pg.ZonaCobertura,
        pg.FotoPublicacion
      FROM publicaciongrua pg
      WHERE pg.IdPublicacionGrua = ? AND pg.Servicio = ?
      LIMIT 1`,
      [idPublicacion, idServicio]
    );

    if (publicacionRows.length === 0) {
      return res.status(404).json({ error: 'Publicación no encontrada o no pertenece al prestador.' });
    }

    const pub = publicacionRows[0];
    try {
      pub.FotoPublicacion = JSON.parse(pub.FotoPublicacion || '[]');
    } catch {
      pub.FotoPublicacion = [];
    }

    res.json(pub);
  } catch (err) {
    console.error('❌ Error al obtener publicación de grúa:', err);
    res.status(500).json({ error: 'Error interno al obtener la publicación.' });
  }
});

///MODIFICAR Y/O ACTUALIZAR PUBLICACION

app.put('/api/publicaciones-grua/:id', uploadPublicacionPrestador.array('imagenesNuevas', 5), async (req, res) => {
  const usuario = req.session.usuario;
  const idPublicacion = req.params.id;

  if (!usuario || usuario.tipo !== 'PrestadorServicio') {
    cleanupTempFiles(req.files, tempDirGrua);
    return res.status(403).json({ error: 'Acceso no autorizado.' });
  }

  const { titulo, descripcion, tarifa, zona, imagenesActuales } = req.body;

  if (!titulo || !descripcion || !tarifa || !zona) {
    cleanupTempFiles(req.files, tempDirGrua);
    return res.status(400).json({ error: 'Faltan datos obligatorios.' });
  }

  try {
    const [servicioRows] = await pool.query(
      'SELECT IdServicio FROM prestadorservicio WHERE usuario = ? LIMIT 1',
      [usuario.id]
    );

    if (servicioRows.length === 0) {
      cleanupTempFiles(req.files, tempDirGrua);
      return res.status(404).json({ error: 'No se encontró el servicio asociado.' });
    }

    const idServicio = servicioRows[0].IdServicio;

    const [verificacion] = await pool.query(
      'SELECT IdPublicacionGrua FROM publicaciongrua WHERE IdPublicacionGrua = ? AND Servicio = ?',
      [idPublicacion, idServicio]
    );

    if (verificacion.length === 0) {
      cleanupTempFiles(req.files, tempDirGrua);
      return res.status(404).json({ error: 'Publicación no encontrada o no pertenece al prestador.' });
    }

    await pool.query(
      `UPDATE publicaciongrua 
       SET TituloPublicacion = ?, DescripcionServicio = ?, TarifaBase = ?, ZonaCobertura = ?
       WHERE IdPublicacionGrua = ?`,
      [titulo, descripcion, tarifa, zona, idPublicacion]
    );

    const carpetaPublicacion = path.join(
      process.cwd(),
      'public', 'imagen', 'PrestadorServicios', usuario.id.toString(), 'publicaciones', idPublicacion.toString()
    );
    fs.mkdirSync(carpetaPublicacion, { recursive: true });

    // Parsear las imágenes actuales que NO se eliminaron
    let imagenesMantenidas = [];
    try {
      imagenesMantenidas = imagenesActuales ? JSON.parse(imagenesActuales) : [];
    } catch (e) {
      imagenesMantenidas = [];
    }

    const nuevasImagenes = [...imagenesMantenidas];

    if (Array.isArray(req.files) && req.files.length > 0) {
      req.files.forEach(file => {
        const destino = path.join(carpetaPublicacion, file.filename);
        fs.renameSync(file.path, destino);

        const rutaRelativa = path.posix.join(
          'imagen',
          'PrestadorServicios',
          usuario.id.toString(),
          'publicaciones',
          idPublicacion.toString(),
          file.filename
        );

        nuevasImagenes.push(rutaRelativa);
      });
    }

    // Actualizar con todas las imágenes (mantenidas + nuevas)
    await pool.query(
      'UPDATE publicaciongrua SET FotoPublicacion = ? WHERE IdPublicacionGrua = ?',
      [JSON.stringify(nuevasImagenes), idPublicacion]
    );

    res.json({ mensaje: '✅ Publicación actualizada correctamente' });

  } catch (err) {
    console.error('❌ Error al actualizar publicación:', err);
    cleanupTempFiles(req.files, tempDirGrua);
    res.status(500).json({ error: 'Error interno al actualizar la publicación.' });
  }
});

/// EDITAR PERFIL PRESTADOR //


app.get("/api/perfilPrestador/:idUsuario", async (req, res) => {
  const { idUsuario } = req.params;

  try {
    const [rows] = await pool.query(
      `SELECT Nombre, Correo, Telefono, FotoPerfil FROM Usuario WHERE IdUsuario = ?`,
      [idUsuario]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("❌ Error al obtener perfil prestador:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

//ACTUALIZAR PERFIL PRESTADOR //

app.put("/api/actualizarPerfilPrestador/:idUsuario", uploadPublicacionPrestador.fields([
  { name: "FotoPerfil", maxCount: 1 },
  { name: "Certificado", maxCount: 1 }
]), async (req, res) => {
  const { idUsuario } = req.params;
  const data = req.body || {};
  const foto = req.files?.FotoPerfil?.[0] || null;
  const certificado = req.files?.Certificado?.[0] || null;

  try {
    const [usuarioRows] = await pool.query(
      "SELECT Nombre, Apellido, Correo, Telefono, FotoPerfil FROM Usuario WHERE IdUsuario = ?",
      [idUsuario]
    );

    if (usuarioRows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const datosActuales = usuarioRows[0];
    let rutaFotoFinal = datosActuales.FotoPerfil;

    // ✅ Procesar imagen de perfil
    if (foto) {
      const folder = path.join(__dirname, "public", "imagen", "PrestadorServicios", idUsuario);
      fs.mkdirSync(folder, { recursive: true });

      // Eliminar foto anterior
      if (rutaFotoFinal) {
        const rutaAnterior = path.join(__dirname, "public", rutaFotoFinal);
        if (fs.existsSync(rutaAnterior)) {
          fs.unlinkSync(rutaAnterior);
          console.log(`🗑️ Foto anterior eliminada: ${rutaAnterior}`);
        }
      }

      const nombreFoto = `${Date.now()}_${Math.round(Math.random() * 1e6)}${path.extname(foto.originalname)}`;
      const destino = path.join(folder, nombreFoto);
      fs.renameSync(foto.path, destino);

      rutaFotoFinal = path.join("imagen", "PrestadorServicios", idUsuario, nombreFoto).replace(/\\/g, "/");
      console.log(`✅ Nueva foto guardada: ${rutaFotoFinal}`);
    }
    
    // ✅ Procesar certificado
    let rutaCertificadoFinal = null;
    if (certificado) {
      const folder = path.join(__dirname, "public", "Imagen", "PrestadorServicios", idUsuario, "documentos");
      fs.mkdirSync(folder, { recursive: true });

      // Obtener ruta anterior desde prestadorservicio
      const [servicioRows] = await pool.query(
        "SELECT IdServicio, Certificado FROM prestadorservicio WHERE usuario = ? LIMIT 1",
        [idUsuario]
      );

      if (servicioRows.length === 0) {
        return res.status(404).json({ error: "No se encontró el servicio asociado al usuario." });
      }

      const idServicio = servicioRows[0].IdServicio;
      const rutaCertificadoAnterior = servicioRows[0].Certificado;

      // Eliminar certificado anterior
      if (rutaCertificadoAnterior) {
        const rutaCompleta = path.join(__dirname, "public", rutaCertificadoAnterior);
        if (fs.existsSync(rutaCompleta)) {
          fs.unlinkSync(rutaCompleta);
          console.log(`🗑️ Certificado anterior eliminado`);
        }
      }

      const nombreCertificado = `${Date.now()}_${Math.round(Math.random() * 1e6)}${path.extname(certificado.originalname)}`;
      const destino = path.join(folder, nombreCertificado);
      fs.renameSync(certificado.path, destino);

      rutaCertificadoFinal = path.join("Imagen", "PrestadorServicios", idUsuario, "documentos", nombreCertificado).replace(/\\/g, "/");

      await pool.query(
        "UPDATE prestadorservicio SET Certificado = ? WHERE IdServicio = ?",
        [rutaCertificadoFinal, idServicio]
      );
    }

    // ✅ Actualizar datos en la base
    await pool.query(
      `UPDATE Usuario 
      SET Nombre = ?, Apellido = ?, Correo = ?, Telefono = ?, FotoPerfil = ?
      WHERE IdUsuario = ?`,
      [
        data.Nombre || datosActuales.Nombre,
        data.Apellido || datosActuales.Apellido,
        data.Correo || datosActuales.Correo,
        data.Telefono || datosActuales.Telefono,
        rutaFotoFinal,
        idUsuario
      ]
    );

    console.log(`✅ Perfil prestador actualizado para usuario: ${idUsuario}`);

    res.json({ mensaje: "✅ Perfil actualizado correctamente", fotoPerfil: rutaFotoFinal, certificado: rutaCertificadoFinal });

  } catch (error) {
    console.error("❌ Error al actualizar perfil prestador:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

//HISTORIAL DE SERVICIOS -  PRESTADOR//

app.get("/api/historial-servicios/:idPrestador", async (req, res) => {
  const { idPrestador } = req.params;

  try {
    const [servicioRows] = await pool.query(
      "SELECT IdServicio FROM prestadorservicio WHERE usuario = ? LIMIT 1",
      [idPrestador]
    );

    if (servicioRows.length === 0) {
      return res.status(404).json({ error: "Prestador no encontrado" });
    }

    const idServicio = servicioRows[0].IdServicio;

    const [historial] = await pool.query(
      `SELECT 
         hs.IdHistorial,
         u.Nombre AS Cliente,
         pg.TituloPublicacion AS Servicio,
         CONCAT(cas.DireccionRecogida, IF(cas.Destino IS NOT NULL, CONCAT(' → ', cas.Destino), '')) AS Ubicacion,
         cas.FechaServicio AS Fecha,
         cas.Estado,
         pg.TarifaBase AS Total
       FROM historialservicios hs
       JOIN controlagendaservicios cas ON hs.SolicitudServicio = cas.IdSolicitudServicio
       JOIN publicaciongrua pg ON cas.PublicacionGrua = pg.IdPublicacionGrua
       JOIN usuario u ON cas.UsuarioNatural = u.IdUsuario
       WHERE pg.Servicio = ?
       ORDER BY cas.FechaServicio DESC`,
      [idServicio]
    );

    res.json(historial);
  } catch (err) {
    console.error("❌ Error al obtener historial de servicios:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

//AGENDA DE SERVICIOS/SOLICITUDES - USUARIO PRESTADOR//
app.get("/api/solicitudes-grua/:idPrestador", async (req, res) => {
  const { idPrestador } = req.params;

  try {
    const servicioRows = await queryPromise(
      "SELECT IdServicio FROM prestadorservicio WHERE usuario = ? LIMIT 1",
      [idPrestador]
    );

    if (servicioRows.length === 0) {
      return res.status(404).json({ error: "Prestador no encontrado" });
    }

    const idServicio = servicioRows[0].IdServicio;

    const solicitudes = await queryPromise(
      `SELECT 
         cas.IdSolicitudServicio,
         u.Nombre AS Cliente,
         pg.TituloPublicacion AS Servicio,
         cas.DireccionRecogida,
         cas.Destino,
         cas.FechaServicio,
         cas.Estado,
         cas.ComentariosAdicionales
       FROM controlagendaservicios cas
       JOIN publicaciongrua pg ON cas.PublicacionGrua = pg.IdPublicacionGrua
       JOIN usuario u ON cas.UsuarioNatural = u.IdUsuario
       WHERE pg.Servicio = ?
       ORDER BY cas.FechaServicio DESC`,
      [idServicio]
    );

    res.json(solicitudes);
  } catch (err) {
    console.error("❌ Error al obtener solicitudes:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// ===============================
//  ACTUALIZAR ESTADO DE SOLICITUD DE GRÚA - PRESTADOR
// ===============================
app.put('/api/solicitudes-grua/estado/:id', async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;

  // Validar que el estado sea válido
  const estadosValidos = ['Aceptado', 'Rechazado', 'Cancelado', 'Terminado', 'Finalizado', 'Completado'];
  
  if (!estadosValidos.includes(estado)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Estado no válido. Debe ser: Aceptado, Rechazado, Cancelado, Terminado, Finalizado o Completado' 
    });
  }

  try {
    // Verificar que la solicitud existe y obtener su estado actual
    const solicitud = await queryPromise(
      'SELECT IdSolicitudServicio, Estado FROM controlagendaservicios WHERE IdSolicitudServicio = ?',
      [id]
    );

    if (!solicitud || solicitud.length === 0) {
      return res.status(404).json({ success: false, message: 'Solicitud no encontrada.' });
    }

    const estadoActual = solicitud[0].Estado;

    // Validar que no se puede modificar un servicio ya finalizado o cancelado
    if (['Completado', 'Terminado', 'Cancelado', 'Rechazado'].includes(estadoActual)) {
      return res.status(400).json({ 
        success: false, 
        message: `No se puede modificar un servicio que ya está ${estadoActual.toLowerCase()}.` 
      });
    }

    // Validar transiciones de estado
    if ((estado === 'Terminado' || estado === 'Finalizado' || estado === 'Completado') && estadoActual !== 'Aceptado') {
      return res.status(400).json({ 
        success: false, 
        message: 'Solo puedes marcar como completado un servicio que ha sido aceptado.' 
      });
    }

    // Normalizar estados: Terminado/Finalizado -> Completado
    let estadoFinal = estado;
    if (estado === 'Terminado' || estado === 'Finalizado') {
      estadoFinal = 'Completado';
    }

    // Actualizar el estado
    await queryPromise(
      'UPDATE controlagendaservicios SET Estado = ? WHERE IdSolicitudServicio = ?',
      [estadoFinal, id]
    );

    res.status(200).json({
      success: true,
      message: `Solicitud #${id} ${estadoFinal.toLowerCase()} correctamente.`
    });

  } catch (error) {
    console.error('❌ Error al actualizar estado de solicitud:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor.' });
  }
});

// ===============================
//  ACTUALIZAR FECHA/HORA DE SOLICITUD DE GRÚA - PRESTADOR
// ===============================
app.put('/api/solicitudes-grua/fecha/:id', async (req, res) => {
  const { id } = req.params;
  const { fecha, hora } = req.body;

  if (!fecha || !hora) {
    return res.status(400).json({ 
      success: false, 
      message: 'Fecha y hora son obligatorias.' 
    });
  }

  try {
    // Verificar que la solicitud existe y obtener su estado
    const solicitud = await queryPromise(
      'SELECT IdSolicitudServicio, Estado FROM controlagendaservicios WHERE IdSolicitudServicio = ?',
      [id]
    );

    if (!solicitud || solicitud.length === 0) {
      return res.status(404).json({ success: false, message: 'Solicitud no encontrada.' });
    }

    const estadoActual = solicitud[0].Estado;

    // Validar que solo se puede modificar si está Pendiente o Aceptado
    if (!['Pendiente', 'Aceptado'].includes(estadoActual)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Solo puedes modificar la fecha de servicios pendientes o aceptados.' 
      });
    }

    // Actualizar fecha y hora, registrar modificación y resetear notificación
    // Usar datetime('now') para SQLite o NOW() para MySQL
    const fechaActual = new Date().toISOString().replace('T', ' ').substring(0, 19);
    await queryPromise(
      'UPDATE controlagendaservicios SET FechaServicio = ?, HoraServicio = ?, FechaModificadaPor = ?, NotificacionVista = 0 WHERE IdSolicitudServicio = ?',
      [fecha, hora, fechaActual, id]
    );

    res.status(200).json({
      success: true,
      message: `Fecha y hora actualizadas correctamente para la solicitud #${id}. El usuario será notificado del cambio.`
    });

  } catch (error) {
    console.error('❌ Error al actualizar fecha/hora de solicitud:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor.' });
  }
});

// 🔹 Marcar notificación de cambio de fecha como vista
app.put('/api/solicitudes-grua/notificacion-vista/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Usar 1 para SQLite en lugar de TRUE
    await queryPromise(
      'UPDATE controlagendaservicios SET NotificacionVista = 1 WHERE IdSolicitudServicio = ?',
      [id]
    );

    res.status(200).json({
      success: true,
      message: 'Notificación marcada como vista.'
    });
  } catch (error) {
    console.error('❌ Error al marcar notificación como vista:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor.' });
  }
});

//MARKETPLACE DE GRUAS - SOLO VISUALIZACION DE USUARIO NATURAL//

app.get("/api/marketplace-gruas", async (req, res) => {
  try {
    console.log('📥 GET /api/marketplace-gruas');
    const [publicaciones] = await pool.query(
      `SELECT 
         pg.IdPublicacionGrua,
         pg.TituloPublicacion,
         pg.DescripcionServicio,
         pg.ZonaCobertura,
         pg.FotoPublicacion,
         ps.Usuario
       FROM publicaciongrua pg
       JOIN prestadorservicio ps ON pg.Servicio = ps.IdServicio
       ORDER BY pg.IdPublicacionGrua DESC`
    );
    console.log(`✅ Encontradas ${publicaciones.length} grúas`);

    res.json(publicaciones);
  } catch (err) {
    console.error("❌ Error al obtener publicaciones:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

///DETALLE O VISUALIZACION DE EL DETALLE DE LA PUBLICACION DE GRUAS/// 
// 🔹 DETALLE PÚBLICO DE PUBLICACIÓN DE GRÚA (para usuarios naturales)
app.get("/api/publicaciones-grua/:id", async (req, res) => {
  const { id } = req.params;
  console.log("📥 Solicitud recibida con ID:", id);

  try {
    const rows = await queryPromise(
      `SELECT 
         pg.IdPublicacionGrua,
         pg.TituloPublicacion,
         pg.DescripcionServicio,
         pg.ZonaCobertura,
         pg.TarifaBase,
         pg.FotoPublicacion,
         ps.Usuario AS IdUsuario,
         u.Nombre AS NombrePrestador,
         u.Telefono,
         u.Correo
       FROM publicaciongrua pg
       JOIN prestadorservicio ps ON pg.Servicio = ps.IdServicio
       JOIN usuario u ON ps.Usuario = u.IdUsuario
       WHERE pg.IdPublicacionGrua = ?`,
      [id]
    );

    console.log("📊 Resultado de la consulta:", rows);

    if (rows.length === 0) {
      console.warn("⚠️ No se encontró publicación para el ID:", id);
      return res.status(404).json({ error: "Publicación no encontrada" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("❌ Error al obtener publicación:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});


//opiniones grua //
app.post('/api/opiniones-grua', async (req, res) => {
  try {
    const { usuarioId, idPublicacionGrua, nombreUsuario, comentario, calificacion } = req.body;

    if (!usuarioId || !idPublicacionGrua || !comentario || !calificacion) {
      return res.status(400).json({ error: 'Faltan datos obligatorios' });
    }

    const [resultado] = await pool.query(
      `INSERT INTO OpinionesGrua (UsuarioNatural, PublicacionGrua, NombreUsuario, Comentario, Calificacion)
       VALUES (?, ?, ?, ?, ?)`,
      [usuarioId, idPublicacionGrua, nombreUsuario, comentario, calificacion]
    );

    res.json({
      mensaje: '✅ Opinión guardada correctamente',
      idOpinion: resultado.insertId
    });
  } catch (error) {
    console.error('❌ Error al insertar opinión de grúa:', error);
    res.status(500).json({ error: 'Error en el servidor al guardar la opinión.' });
  }
});

app.get('/api/opiniones-grua/:idPublicacionGrua', async (req, res) => {
  const { idPublicacionGrua } = req.params;

  try {
    const opiniones = await queryPromise(
      `SELECT NombreUsuario, Comentario, Calificacion, Fecha
       FROM opinionesgrua
       WHERE PublicacionGrua = ?
       ORDER BY Fecha DESC`,
      [idPublicacionGrua]
    );

    res.json(opiniones);
  } catch (error) {
    console.error('❌ Error al obtener opiniones de grúa:', error);
    res.status(500).json({ error: 'Error en el servidor al consultar opiniones.' });
  }
});

// ===============================
// 🔹 Agendar Servicio de Grúa
// ===============================
app.post('/api/agendar-grua', async (req, res) => {
  try {
    const { usuarioId, idPublicacionGrua, fecha, hora, direccion, destino, detalle } = req.body;

    console.log("📅 Agendando servicio de grúa:", req.body);

    if (!usuarioId || !idPublicacionGrua || !fecha || !hora || !direccion) {
      return res.status(400).json({ error: 'Faltan datos obligatorios para agendar el servicio.' });
    }

    await queryPromise(
      `INSERT INTO controlagendaservicios 
       (UsuarioNatural, PublicacionGrua, FechaServicio, HoraServicio, DireccionRecogida, Destino, ComentariosAdicionales, Estado)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Pendiente')`,
      [usuarioId, idPublicacionGrua, fecha, hora, direccion, destino || null, detalle || null]
    );

    console.log("✅ Servicio agendado correctamente");
    res.json({ success: true, message: 'Servicio agendado con éxito.' });

  } catch (error) {
    console.error('❌ Error al agendar servicio de grúa:', error);
    res.status(500).json({ error: 'Error en el servidor al agendar el servicio.' });
  }
});

// ===============================
// 🔹 Historial de Servicios del Prestador
// ===============================
app.get('/api/historial-servicios-prestador/:usuarioId', async (req, res) => {
  const { usuarioId } = req.params;

  try {
    console.log("📊 Cargando historial de servicios para prestador:", usuarioId);

    // Obtener el IdServicio del prestador
    const servicioRows = await queryPromise(
      'SELECT IdServicio FROM prestadorservicio WHERE Usuario = ?',
      [usuarioId]
    );

    if (servicioRows.length === 0) {
      console.log("⚠️ No se encontró servicio asociado al prestador");
      return res.json([]);
    }

    const idServicio = servicioRows[0].IdServicio;

    // Obtener todos los servicios agendados
    const servicios = await queryPromise(
      `SELECT 
         cas.IdSolicitudServicio,
         u.Nombre AS Cliente,
         pg.TituloPublicacion AS Servicio,
         cas.DireccionRecogida AS Origen,
         cas.Destino,
         cas.FechaServicio AS Fecha,
         cas.HoraServicio AS Hora,
         cas.Estado,
         cas.FechaModificadaPor,
         cas.NotificacionVista
       FROM controlagendaservicios cas
       JOIN publicaciongrua pg ON cas.PublicacionGrua = pg.IdPublicacionGrua
       JOIN usuario u ON cas.UsuarioNatural = u.IdUsuario
       WHERE pg.Servicio = ?
       ORDER BY cas.FechaServicio DESC`,
      [idServicio]
    );

    console.log(`✅ ${servicios.length} servicios encontrados`);
    res.json(servicios);

  } catch (error) {
    console.error('❌ Error al obtener historial de servicios:', error);
    res.status(500).json({ error: 'Error en el servidor al consultar historial.' });
  }
});


//----------///
// SECCION DE ADMINISTRADOR //
//-----------//

// Middleware para verificar si es administrador
function verificarAdmin(req, res, next) {
  const usuarioSesion = req.session.usuario;
  console.log('🔐 Verificando admin - Usuario en sesión:', usuarioSesion);
  console.log('🔐 Tipo de usuario:', usuarioSesion?.tipo);
  
  if (!usuarioSesion || usuarioSesion.tipo !== "Administrador") {
    console.error('❌ Acceso denegado - No es administrador');
    return res.status(403).json({ error: "Acceso denegado. Solo administradores." });
  }
  
  console.log('✅ Administrador verificado');
  next();
}

// ===============================
// Obtener estadísticas del panel de admin
// ===============================
app.get('/api/admin/estadisticas', verificarAdmin, async (req, res) => {
  try {
    console.log("📊 Cargando estadísticas del panel de administración");

    // Total de usuarios
    const totalUsuarios = await queryPromise(
      'SELECT COUNT(*) as total FROM usuario'
    );

    // Total de publicaciones
    const totalPublicaciones = await queryPromise(
      'SELECT COUNT(*) as total FROM publicacion'
    );

    // Total de PQR pendientes (asumiendo que existe tabla centroayuda)
    const totalPQR = await queryPromise(
      'SELECT COUNT(*) as total FROM centroayuda'
    );

    // Ventas de hoy
    const hoy = new Date().toISOString().split('T')[0];
    const ventasHoy = await queryPromise(
      'SELECT COUNT(*) as total FROM factura WHERE DATE(FechaCompra) = ?',
      [hoy]
    );

    res.json({
      totalUsuarios: totalUsuarios[0].total,
      totalPublicaciones: totalPublicaciones[0].total,
      totalPQR: totalPQR[0].total,
      ventasHoy: ventasHoy[0].total
    });

  } catch (error) {
    console.error('❌ Error al obtener estadísticas:', error);
    res.status(500).json({ error: 'Error en el servidor al consultar estadísticas.' });
  }
});

// ===============================
// Obtener todos los usuarios
// ===============================
app.get('/api/admin/usuarios', verificarAdmin, async (req, res) => {
  try {
    console.log("👥 Cargando todos los usuarios");

    const usuarios = await queryPromise(
      `SELECT IdUsuario, TipoUsuario, Nombre, Apellido, Documento, 
              Telefono, Correo, FotoPerfil, Estado 
       FROM usuario 
       ORDER BY IdUsuario DESC`
    );

    res.json({ usuarios });

  } catch (error) {
    console.error('❌ Error al obtener usuarios:', error);
    res.status(500).json({ error: 'Error en el servidor al consultar usuarios.' });
  }
});

// ===============================
// Activar/Desactivar usuario
// ===============================
app.post('/api/admin/usuario/:id/toggle-estado', verificarAdmin, async (req, res) => {
  console.log('📥 POST /api/admin/usuario/:id/toggle-estado - Solicitud recibida');
  console.log('📋 Params:', req.params);
  console.log('📋 Body:', req.body);
  
  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (!estado || !['Activo', 'Inactivo'].includes(estado)) {
      console.error('❌ Estado inválido:', estado);
      return res.status(400).json({ error: 'Estado inválido. Debe ser Activo o Inactivo.' });
    }

    console.log(`🔄 Cambiando estado del usuario ${id} a ${estado}`);

    const [result] = await pool.query(
      'UPDATE usuario SET Estado = ? WHERE IdUsuario = ?',
      [estado, id]
    );
    
    console.log('✅ Resultado de actualización:', result);

    res.json({ 
      success: true, 
      message: `Usuario ${estado === 'Activo' ? 'activado' : 'desactivado'} correctamente` 
    });

  } catch (error) {
    console.error('❌ Error COMPLETO al cambiar estado del usuario:');
    console.error('❌ Mensaje:', error.message);
    console.error('❌ Stack:', error.stack);
    console.error('❌ Error completo:', error);
    res.status(500).json({ 
      error: 'Error en el servidor al actualizar estado.', 
      detalle: error.message 
    });
  }
});

// ===============================
// Eliminar usuario
// ===============================
app.delete('/api/admin/usuario/:id', verificarAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    console.log(`🗑️ Eliminando usuario ${id}`);

    // Verificar que el usuario existe
    const usuario = await queryPromise(
      'SELECT * FROM usuario WHERE IdUsuario = ?',
      [id]
    );

    if (usuario.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Eliminar registros relacionados en cascada
    console.log('🗑️ Eliminando registros relacionados...');
    
    // Función auxiliar para eliminar de forma segura con mejor manejo de errores
    const eliminarSeguro = async (query, params, descripcion) => {
      try {
        const result = await queryPromise(query, params);
        console.log(`✅ ${descripcion}`);
        return true;
      } catch (error) {
        console.log(`⚠️ ${descripcion} - ${error.message}`);
        return false;
      }
    };
    
    // 1. Eliminar tokens de verificación
    await eliminarSeguro('DELETE FROM tokens_verificacion WHERE Usuario = ?', [id], 'Tokens eliminados');
    
    // 2. Eliminar historial de contraseñas
    await eliminarSeguro('DELETE FROM historial_contrasenas WHERE Usuario = ?', [id], 'Historial contraseñas eliminado');
    
    // 3. Eliminar opiniones sobre publicaciones del usuario
    await eliminarSeguro('DELETE FROM opiniones WHERE UsuarioNatural = ?', [id], 'Opiniones eliminadas');
    
    // 4. Eliminar opiniones sobre grúas del usuario
    await eliminarSeguro('DELETE FROM OpinionesGrua WHERE UsuarioNatural = ?', [id], 'Opiniones grúas eliminadas');
    
    // 5. Eliminar PQRs
    await eliminarSeguro('DELETE FROM centroayuda WHERE Perfil = ?', [id], 'PQRs eliminadas');
    
    // 6. Obtener el NitComercio si es comerciante para eliminar sus publicaciones
    let nitComercio = null;
    try {
      const comerciante = await queryPromise('SELECT NitComercio FROM comerciante WHERE Comercio = ?', [id]);
      if (comerciante.length > 0) {
        nitComercio = comerciante[0].NitComercio;
        console.log(`📋 NitComercio encontrado: ${nitComercio}`);
      }
    } catch (error) {
      console.log(`⚠️ No se pudo obtener NitComercio - ${error.message}`);
    }
    
    // 7. Obtener IdServicio si es prestador de servicio
    let idServicio = null;
    try {
      const prestador = await queryPromise('SELECT IdServicio FROM prestadorservicio WHERE Usuario = ?', [id]);
      if (prestador.length > 0) {
        idServicio = prestador[0].IdServicio;
        console.log(`📋 IdServicio encontrado: ${idServicio}`);
      }
    } catch (error) {
      console.log(`⚠️ No se pudo obtener IdServicio - ${error.message}`);
    }
    
    // 8. Si es comerciante, eliminar sus publicaciones y dependencias
    if (nitComercio) {
      try {
        // Obtener IDs de publicaciones del comerciante
        const publicaciones = await queryPromise('SELECT IdPublicacion FROM publicacion WHERE Comerciante = ?', [nitComercio]);
        if (publicaciones.length > 0) {
          const pubIds = publicaciones.map(p => p.IdPublicacion);
          const placeholders = pubIds.map(() => '?').join(',');
          
          // Eliminar opiniones sobre estas publicaciones
          await eliminarSeguro(
            `DELETE FROM opiniones WHERE Publicacion IN (${placeholders})`,
            pubIds,
            'Opiniones de publicaciones eliminadas'
          );
          
          // Eliminar items del carrito con estas publicaciones
          await eliminarSeguro(
            `DELETE FROM carrito WHERE Publicacion IN (${placeholders})`,
            pubIds,
            'Items carrito de publicaciones eliminados'
          );
          
          // Eliminar detalles de factura con estas publicaciones
          await eliminarSeguro(
            `DELETE FROM detallefactura WHERE Publicacion IN (${placeholders})`,
            pubIds,
            'Detalles factura eliminados'
          );
          
          // Obtener detalles de factura comercio para eliminar agenda comercio
          const detallesComercio = await queryPromise(
            `SELECT IdDetalleFacturaComercio FROM detallefacturacomercio WHERE Publicacion IN (${placeholders})`,
            pubIds
          );
          if (detallesComercio.length > 0) {
            const detalleIds = detallesComercio.map(d => d.IdDetalleFacturaComercio);
            const placeholdersDetalle = detalleIds.map(() => '?').join(',');
            await eliminarSeguro(
              `DELETE FROM controlagendacomercio WHERE DetFacturacomercio IN (${placeholdersDetalle})`,
              detalleIds,
              'Agenda comercio por detalles eliminada'
            );
          }
          
          // Eliminar detalles de factura comercio
          await eliminarSeguro(
            `DELETE FROM detallefacturacomercio WHERE Publicacion IN (${placeholders})`,
            pubIds,
            'Detalles factura comercio eliminados'
          );
          
          // Eliminar productos asociados a estas publicaciones
          await eliminarSeguro(
            `DELETE FROM producto WHERE PublicacionComercio IN (${placeholders})`,
            pubIds,
            'Productos eliminados'
          );
        }
        
        // Finalmente eliminar las publicaciones
        await eliminarSeguro('DELETE FROM publicacion WHERE Comerciante = ?', [nitComercio], 'Publicaciones comerciante eliminadas');
      } catch (error) {
        console.log(`⚠️ Error en cascada de publicaciones comerciante - ${error.message}`);
      }
    }
    
    // 9. Si es prestador, eliminar sus publicaciones de grúa y dependencias
    if (idServicio) {
      try {
        // Obtener IDs de publicaciones de grúa
        const pubGruas = await queryPromise('SELECT IdPublicacionGrua FROM publicaciongrua WHERE Servicio = ?', [idServicio]);
        if (pubGruas.length > 0) {
          const gruaIds = pubGruas.map(g => g.IdPublicacionGrua);
          const placeholders = gruaIds.map(() => '?').join(',');
          
          // Eliminar opiniones sobre estas publicaciones de grúa
          await eliminarSeguro(
            `DELETE FROM OpinionesGrua WHERE PublicacionGrua IN (${placeholders})`,
            gruaIds,
            'Opiniones de grúas eliminadas'
          );
          
          // Obtener solicitudes de servicio para eliminar historial
          const solicitudes = await queryPromise(
            `SELECT IdSolicitudServicio FROM controlagendaservicios WHERE PublicacionGrua IN (${placeholders})`,
            gruaIds
          );
          if (solicitudes.length > 0) {
            const solIds = solicitudes.map(s => s.IdSolicitudServicio);
            const placeholdersSol = solIds.map(() => '?').join(',');
            await eliminarSeguro(
              `DELETE FROM historialservicios WHERE SolicitudServicio IN (${placeholdersSol})`,
              solIds,
              'Historial de servicios eliminado'
            );
          }
          
          // Eliminar solicitudes de servicio
          await eliminarSeguro(
            `DELETE FROM controlagendaservicios WHERE PublicacionGrua IN (${placeholders})`,
            gruaIds,
            'Solicitudes de servicio eliminadas'
          );
        }
        
        // Eliminar publicaciones de grúa
        await eliminarSeguro('DELETE FROM publicaciongrua WHERE Servicio = ?', [idServicio], 'Publicaciones grúa eliminadas');
      } catch (error) {
        console.log(`⚠️ Error en cascada de publicaciones grúa - ${error.message}`);
      }
    }
    
    // 10. Eliminar solicitudes de servicio del usuario natural (como cliente)
    try {
      const solicitudesUsuario = await queryPromise('SELECT IdSolicitudServicio FROM controlagendaservicios WHERE UsuarioNatural = ?', [id]);
      if (solicitudesUsuario.length > 0) {
        const solIds = solicitudesUsuario.map(s => s.IdSolicitudServicio);
        const placeholders = solIds.map(() => '?').join(',');
        await eliminarSeguro(
          `DELETE FROM historialservicios WHERE SolicitudServicio IN (${placeholders})`,
          solIds,
          'Historial de servicios usuario eliminado'
        );
      }
    } catch (error) {
      console.log(`⚠️ Error en historial servicios usuario - ${error.message}`);
    }
    await eliminarSeguro('DELETE FROM controlagendaservicios WHERE UsuarioNatural = ?', [id], 'Agenda servicios usuario eliminada');
    
    // 11. Eliminar carrito del usuario
    await eliminarSeguro('DELETE FROM carrito WHERE UsuarioNat = ?', [id], 'Carrito eliminado');
    
    // 12. Eliminar agenda comercio del usuario (si es comerciante por Comercio field)
    await eliminarSeguro('DELETE FROM controlagendacomercio WHERE Comercio = ?', [id], 'Agenda comercio eliminada');
    
    // 13. Obtener facturas del usuario y eliminar en cascada
    try {
      const facturas = await queryPromise('SELECT IdFactura FROM factura WHERE Usuario = ?', [id]);
      if (facturas.length > 0) {
        const facturaIds = facturas.map(f => f.IdFactura);
        const placeholders = facturaIds.map(() => '?').join(',');
        
        // Obtener detalles de factura comercio para eliminar agenda comercio
        const detallesComercio = await queryPromise(
          `SELECT IdDetalleFacturaComercio FROM detallefacturacomercio WHERE Factura IN (${placeholders})`,
          facturaIds
        );
        if (detallesComercio.length > 0) {
          const detalleIds = detallesComercio.map(d => d.IdDetalleFacturaComercio);
          const placeholdersDetalle = detalleIds.map(() => '?').join(',');
          await eliminarSeguro(
            `DELETE FROM controlagendacomercio WHERE DetFacturacomercio IN (${placeholdersDetalle})`,
            detalleIds,
            'Agenda comercio por facturas eliminada'
          );
        }
        
        await eliminarSeguro(
          `DELETE FROM detallefacturacomercio WHERE Factura IN (${placeholders})`,
          facturaIds,
          'Detalles factura comercio eliminados'
        );
        
        await eliminarSeguro(
          `DELETE FROM detallefactura WHERE Factura IN (${placeholders})`,
          facturaIds,
          'Detalles factura eliminados'
        );
      }
    } catch (error) {
      console.log(`⚠️ Error en cascada de facturas - ${error.message}`);
    }
    
    // 14. Eliminar facturas
    await eliminarSeguro('DELETE FROM factura WHERE Usuario = ?', [id], 'Facturas eliminadas');
    
    // 15. Eliminar perfil de prestador de servicio si existe
    await eliminarSeguro('DELETE FROM prestadorservicio WHERE Usuario = ?', [id], 'Perfil prestador eliminado');
    
    // 16. Eliminar perfil de comerciante si existe
    await eliminarSeguro('DELETE FROM comerciante WHERE Comercio = ?', [id], 'Perfil comerciante eliminado');
    
    // 17. Eliminar perfil natural si existe
    await eliminarSeguro('DELETE FROM perfilnatural WHERE UsuarioNatural = ?', [id], 'Perfil natural eliminado');
    
    // 18. Eliminar credenciales
    await eliminarSeguro('DELETE FROM credenciales WHERE Usuario = ?', [id], 'Credenciales eliminadas');
    
    // 19. Finalmente, eliminar el usuario
    await queryPromise('DELETE FROM usuario WHERE IdUsuario = ?', [id]);
    console.log('✅ Usuario eliminado de la tabla usuario');

    console.log('✅ Usuario y registros relacionados eliminados correctamente');

    res.json({ 
      success: true, 
      message: 'Usuario eliminado correctamente' 
    });

  } catch (error) {
    console.error('❌ Error al eliminar usuario:', error);
    res.status(500).json({ error: 'Error en el servidor al eliminar usuario.' });
  }
});

// ===============================
// Obtener todas las publicaciones
// ===============================
app.get('/api/admin/publicaciones', verificarAdmin, async (req, res) => {
  try {
    console.log("📦 Cargando todas las publicaciones (comercios y grúas)");

    // Consultar publicaciones de comercios
    const publicacionesComercios = await queryPromise(
      `SELECT p.IdPublicacion, 
              p.NombreProducto, 
              p.Precio, 
              p.ImagenProducto as ImagenPrincipal, 
              p.Stock as Estado, 
              COALESCE(u.Nombre || ' ' || u.Apellido, 'Doc: ' || p.Comerciante) as NombreComercio,
              p.Comerciante,
              u.TipoUsuario,
              0 as EsGrua
       FROM publicacion p
       LEFT JOIN usuario u ON p.Comerciante = u.Documento
       ORDER BY p.IdPublicacion DESC`
    );

    // Consultar publicaciones de grúas
    const publicacionesGruas = await queryPromise(
      `SELECT pg.IdPublicacionGrua as IdPublicacion,
              pg.TituloPublicacion as NombreProducto,
              pg.TarifaBase as Precio,
              pg.FotoPublicacion as ImagenPrincipal,
              1 as Estado,
              COALESCE(u.Nombre || ' ' || u.Apellido, 'Usuario: ' || ps.usuario) as NombreComercio,
              ps.usuario as Comerciante,
              u.TipoUsuario,
              1 as EsGrua
       FROM publicaciongrua pg
       JOIN prestadorservicio ps ON pg.Servicio = ps.IdServicio
       LEFT JOIN usuario u ON ps.usuario = u.IdUsuario
       ORDER BY pg.IdPublicacionGrua DESC`
    );

    // Combinar ambos arrays
    const publicaciones = [...publicacionesComercios, ...publicacionesGruas];
    
    console.log(`✅ Total publicaciones: ${publicaciones.length} (Comercios: ${publicacionesComercios.length}, Grúas: ${publicacionesGruas.length})`);

    res.json({ publicaciones });

  } catch (error) {
    console.error('❌ Error al obtener publicaciones:', error);
    res.status(500).json({ error: 'Error en el servidor al consultar publicaciones.' });
  }
});

// ===============================
// Eliminar publicación desde admin con observación
// ===============================
app.delete('/api/admin/publicacion/:id', verificarAdmin, async (req, res) => {
  const { id } = req.params;
  const { observacion, esGrua } = req.body;

  try {
    console.log(`🗑️ Admin eliminando publicación ${id} (Grúa: ${esGrua})`);

    if (!observacion || observacion.trim().length === 0) {
      return res.status(400).json({ error: 'La observación es requerida' });
    }

    let pub, correoUsuario, nombreUsuario, apellidoUsuario;

    // Determinar si es una publicación de grúa o comercio
    if (esGrua) {
      // Es una publicación de grúa
      const publicacionGrua = await queryPromise(
        `SELECT pg.*, u.Correo, u.Nombre, u.Apellido
         FROM publicaciongrua pg
         JOIN prestadorservicio ps ON pg.Servicio = ps.IdServicio
         JOIN usuario u ON ps.usuario = u.IdUsuario
         WHERE pg.IdPublicacionGrua = ?`,
        [id]
      );

      if (publicacionGrua.length === 0) {
        return res.status(404).json({ error: 'Publicación de grúa no encontrada' });
      }

      pub = publicacionGrua[0];
      correoUsuario = pub.Correo;
      nombreUsuario = pub.Nombre;
      apellidoUsuario = pub.Apellido;

      // Eliminar solicitudes relacionadas
      await queryPromise('DELETE FROM controlagendaservicios WHERE PublicacionGrua = ?', [id]);
      
      // Eliminar opiniones de grúa si existen (tabla OpinionesGrua)
      await queryPromise('DELETE FROM OpinionesGrua WHERE PublicacionGrua = ?', [id]);
      
      // Eliminar la publicación de grúa
      await queryPromise('DELETE FROM publicaciongrua WHERE IdPublicacionGrua = ?', [id]);

    } else {
      // Es una publicación de comercio
      const publicacion = await queryPromise(
        `SELECT p.*, u.Correo, u.Nombre, u.Apellido, com.NombreComercio
         FROM publicacion p
         JOIN comerciante com ON p.Comerciante = com.NitComercio
         JOIN usuario u ON com.Comercio = u.IdUsuario
         WHERE p.IdPublicacion = ?`,
        [id]
      );

      if (publicacion.length === 0) {
        return res.status(404).json({ error: 'Publicación no encontrada' });
      }

      pub = publicacion[0];
      correoUsuario = pub.Correo;
      nombreUsuario = pub.Nombre;
      apellidoUsuario = pub.Apellido;
      
      // Eliminar en orden correcto para evitar errores de FK
      // 1. Eliminar del carrito
      await queryPromise('DELETE FROM carrito WHERE Publicacion = ?', [id]);
      
      // 2. Obtener IDs de detallefacturacomercio para eliminar controlagendacomercio
      const detallesComercio = await queryPromise(
        'SELECT IdDetalleFacturaComercio FROM detallefacturacomercio WHERE Publicacion = ?', 
        [id]
      );
      
      // 3. Eliminar controlagendacomercio que referencian a detallefacturacomercio
      for (const detalle of detallesComercio) {
        await queryPromise('DELETE FROM controlagendacomercio WHERE DetFacturacomercio = ?', [detalle.IdDetalleFacturaComercio]);
      }
      
      // 4. Eliminar detalles de factura
      await queryPromise('DELETE FROM detallefactura WHERE Publicacion = ?', [id]);
      await queryPromise('DELETE FROM detallefacturacomercio WHERE Publicacion = ?', [id]);
      
      // 5. Eliminar opiniones relacionadas
      await queryPromise('DELETE FROM opiniones WHERE Publicacion = ?', [id]);
      
      // 6. Eliminar productos relacionados
      await queryPromise('DELETE FROM producto WHERE PublicacionComercio = ?', [id]);
      
      // 7. Finalmente eliminar la publicación
      await queryPromise('DELETE FROM publicacion WHERE IdPublicacion = ?', [id]);
    }

    // Enviar correo al usuario
    const nombreProducto = pub.TituloPublicacion || pub.NombreProducto;
    const precioProducto = pub.TarifaBase || pub.Precio;
    const tipoPublicacion = esGrua ? 'servicio de grúa' : 'producto';

    try {
      await enviarCorreo({
        to: correoUsuario,
        subject: '⚠️ Tu publicación ha sido eliminada - RPM Market',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5; }
              .header { background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: white; padding: 30px; }
              .footer { background: #333; color: white; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; }
              .alert-box { background: #ffe6e6; border-left: 4px solid #e74c3c; padding: 15px; margin: 20px 0; border-radius: 5px; }
              .product-info { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
              .observation-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>⚠️ Publicación Eliminada</h1>
              </div>
              <div class="content">
                <p>Hola <strong>${nombreUsuario} ${apellidoUsuario}</strong>,</p>
                
                <div class="alert-box">
                  <strong>⚠️ Notificación Importante:</strong>
                  <p>Te informamos que el equipo de administración de RPM Market ha eliminado una de tus publicaciones.</p>
                </div>
                
                <div class="product-info">
                  <h3>${esGrua ? '🚛' : '📦'} Detalles de la publicación eliminada:</h3>
                  <p><strong>Tipo:</strong> ${tipoPublicacion}</p>
                  <p><strong>${esGrua ? 'Servicio' : 'Producto'}:</strong> ${nombreProducto}</p>
                  <p><strong>${esGrua ? 'Tarifa' : 'Precio'}:</strong> $${Number(precioProducto).toLocaleString('es-CO')}</p>
                  <p><strong>ID Publicación:</strong> ${id}</p>
                </div>
                
                <div class="observation-box">
                  <h4>📝 Motivo de la eliminación:</h4>
                  <p>${observacion}</p>
                </div>
                
                <p>Si tienes alguna duda o deseas más información sobre esta decisión, por favor contáctanos respondiendo a este correo o a través de nuestros canales de atención.</p>
                
                <p>Si consideras que fue un error, puedes crear una nueva publicación siguiendo nuestras políticas y términos de uso.</p>
                
                <p style="margin-top: 20px;">
                  <strong>Gracias por tu comprensión.</strong><br>
                  <em>Equipo de RPM Market</em>
                </p>
              </div>
              <div class="footer">
                <p><strong>RPM Market</strong></p>
                <p>📧 rpmservice2026@gmail.com | 📞 301 403 8181</p>
                <p>© 2026 RPM Market - Todos los derechos reservados</p>
              </div>
            </div>
          </body>
          </html>
        `
      });
      console.log(`✅ Correo de notificación enviado a: ${correoUsuario}`);
    } catch (emailError) {
      console.warn('⚠️ Error al enviar correo de notificación:', emailError.message);
    }

    console.log('✅ Publicación eliminada correctamente');
    res.json({ 
      success: true, 
      message: 'Publicación eliminada y notificación enviada' 
    });

  } catch (error) {
    console.error('❌ Error al eliminar publicación:', error);
    res.status(500).json({ error: 'Error en el servidor al eliminar publicación.' });
  }
});

// ===============================
// Obtener todas las PQR (Centro de Ayuda)
// ===============================
app.get('/api/admin/pqr', verificarAdmin, async (req, res) => {
  try {
    console.log("📝 Cargando todas las PQR");

    const pqrs = await queryPromise(
      `SELECT ca.IdAyuda as IdCentroAyuda, 
              u.Correo as Perfil,
              ca.TipoSolicitud, 
              ca.Rol, 
              ca.Asunto, 
              ca.Descripcion,
              ca.Respuesta,
              ca.FechaRespuesta,
              ca.Respondida,
              (u.Nombre || ' ' || u.Apellido) as NombreUsuario,
              datetime('now') as FechaCreacion
       FROM centroayuda ca
       LEFT JOIN usuario u ON ca.Perfil = u.IdUsuario
       ORDER BY ca.IdAyuda DESC`
    );

    console.log("✅ PQR cargadas:", pqrs.length, "registros");
    res.json({ pqrs });

  } catch (error) {
    console.error('❌ Error al obtener PQR:', error);
    console.error('❌ Stack:', error.stack);
    res.status(500).json({ error: 'Error en el servidor al consultar PQR.' });
  }
});

// ===============================
// Responder una PQR y enviar notificación por correo
// ===============================
app.post('/api/admin/pqr/responder', verificarAdmin, async (req, res) => {
  try {
    const { idPQR, respuesta } = req.body;

    if (!idPQR || !respuesta) {
      return res.status(400).json({ error: 'ID de PQR y respuesta son requeridos' });
    }

    console.log(`📝 Respondiendo PQR ${idPQR}`);

    // Obtener información de la PQR y el usuario
    const pqrInfo = await queryPromise(
      `SELECT ca.*, u.Correo, u.Nombre, u.Apellido 
       FROM centroayuda ca
       LEFT JOIN usuario u ON ca.Perfil = u.IdUsuario
       WHERE ca.IdAyuda = ?`,
      [idPQR]
    );

    if (!pqrInfo || pqrInfo.length === 0) {
      return res.status(404).json({ error: 'PQR no encontrada' });
    }

    const pqr = pqrInfo[0];

    // Actualizar la PQR con la respuesta
    await queryPromise(
      `UPDATE centroayuda 
       SET Respuesta = ?, 
           FechaRespuesta = datetime('now'),
           Respondida = 1
       WHERE IdAyuda = ?`,
      [respuesta, idPQR]
    );

    console.log(`✅ PQR ${idPQR} respondida correctamente`);

    // Enviar correo de notificación si existe el correo del usuario
    if (pqr.Correo) {
      try {
        const nombreUsuario = `${pqr.Nombre || ''} ${pqr.Apellido || ''}`.trim() || 'Usuario';
        
        await enviarCorreo({
          to: pqr.Correo,
          subject: `Respuesta a tu ${pqr.TipoSolicitud}: ${pqr.Asunto}`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-left: 4px solid #667eea; }
                .footer { background: #333; color: white; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; }
                .badge { display: inline-block; padding: 5px 10px; border-radius: 5px; font-size: 12px; font-weight: bold; }
                .badge-queja { background: #dc3545; color: white; }
                .badge-reclamo { background: #ffc107; color: #333; }
                .badge-sugerencia { background: #17a2b8; color: white; }
                .respuesta-box { background: white; border-left: 4px solid #28a745; padding: 15px; margin: 15px 0; border-radius: 5px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>✅ Hemos Respondido tu Solicitud</h1>
                </div>
                <div class="content">
                  <p>Hola <strong>${nombreUsuario}</strong>,</p>
                  <p>Hemos revisado y respondido tu solicitud en el Centro de Ayuda de <strong>RPM Market</strong>.</p>
                  
                  <h3>📋 Detalles de tu solicitud:</h3>
                  <p><strong>Tipo:</strong> <span class="badge badge-${pqr.TipoSolicitud.toLowerCase()}">${pqr.TipoSolicitud}</span></p>
                  <p><strong>Asunto:</strong> ${pqr.Asunto}</p>
                  <p><strong>Tu mensaje:</strong></p>
                  <div style="background: #fff; padding: 15px; border-radius: 5px; margin: 10px 0;">
                    ${pqr.Descripcion}
                  </div>
                  
                  <h3>💬 Nuestra respuesta:</h3>
                  <div class="respuesta-box">
                    ${respuesta.replace(/\n/g, '<br>')}
                  </div>
                  
                  <p>Si tienes más preguntas o inquietudes, no dudes en contactarnos nuevamente.</p>
                  
                  <p>Gracias por confiar en <strong>RPM Market</strong>.</p>
                </div>
                <div class="footer">
                  <p><strong>RPM Market</strong></p>
                  <p>📧 Email: rpmservice2026@gmail.com | 📞 Teléfono: 301 403 8181</p>
                  <p style="font-size: 12px; margin-top: 10px;">Este es un correo automático, por favor no responder.</p>
                </div>
              </div>
            </body>
            </html>
          `
        });
        console.log(`📧 Notificación enviada a ${pqr.Correo}`);
      } catch (emailError) {
        console.warn('⚠️ No se pudo enviar el correo de notificación:', emailError.message);
        // Continuar aunque falle el envío del correo
      }
    }

    res.json({ 
      success: true, 
      message: 'PQR respondida correctamente',
      emailSent: !!pqr.Correo 
    });

  } catch (error) {
    console.error('❌ Error al responder PQR:', error);
    res.status(500).json({ error: 'Error en el servidor al responder PQR.' });
  }
});