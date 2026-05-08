import 'dotenv/config';
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let usarSQLite = false;
let sqliteDb = null;
let mysqlPool = null;
let Database = null;

// Detectar si estamos en modo desarrollo o producción
const isProduction = process.env.NODE_ENV === 'production';
const permitirSQLiteFallback = process.env.SQLITE_FALLBACK === 'true' || !isProduction;
// ⚠️ SOLO insertar datos de prueba si se configura explícitamente
const insertarDatosPrueba = process.env.INSERTAR_DATOS_PRUEBA === 'true';

// Función auxiliar para restaurar datos de prueba (DESHABILITADA por seguridad)
const restaurarDatosVacios = (db) => {
  // ⚠️ NUNCA restaurar datos de prueba automáticamente
  // Esto evita sobrescribir datos reales con datos falsos
  
  if (!insertarDatosPrueba) {
    try {
      const count = db.prepare('SELECT COUNT(*) as total FROM usuario').get();
      console.log(`📊 Base de datos SQLite: ${count.total} usuarios encontrados`);
      if (count.total === 0) {
        console.warn('⚠️ Base de datos vacía. Use INSERTAR_DATOS_PRUEBA=true para crear datos de prueba');
      }
    } catch (err) {
      console.warn('⚠️ No se pudo verificar datos:', err.message);
    }
    return;
  }

  console.log('⚠️ INSERTAR_DATOS_PRUEBA=true detectado. Insertando datos de prueba...');
  
  try {
    const count = db.prepare('SELECT COUNT(*) as total FROM usuario').get();
    if (count.total > 0) {
      console.log('📊 Ya hay usuarios en la BD. No se insertarán datos de prueba.');
      return;
    }
    
    // Insertar usuario administrador
    db.prepare(`
      INSERT INTO usuario (IdUsuario, TipoUsuario, Nombre, Apellido, Documento, Telefono, Correo, FotoPerfil, Estado)
      VALUES (999999999, 'Administrador', 'Administrador', 'Sistema', '999999999', '3000000000', 'admin@rpm.com', 'imagen/imagen_perfil.png', 'Activo')
    `).run();

    db.prepare(`
      INSERT INTO credenciales (Usuario, NombreUsuario, Contrasena)
      VALUES (999999999, 'admin@rpm.com', '$2b$10$Auy9be68AJYCQq9KVKUYOOsPX7/0LbPwr9lN1Ewc1w0t/B1j5B/g6')
    `).run();

    // Insertar usuario natural
    db.prepare(`
      INSERT INTO usuario (IdUsuario, TipoUsuario, Nombre, Apellido, Documento, Telefono, Correo, FotoPerfil, Estado)
      VALUES (123456789, 'Natural', 'Juan', 'Pérez', '123456789', '3001234567', 'juan@test.com', 'imagen/imagen_perfil.png', 'Activo')
    `).run();

    db.prepare(`
      INSERT INTO credenciales (Usuario, NombreUsuario, Contrasena)
      VALUES (123456789, 'juan@test.com', '$2b$10$Auy9be68AJYCQq9KVKUYOOsPX7/0LbPwr9lN1Ewc1w0t/B1j5B/g6')
    `).run();

    db.prepare(`
      INSERT INTO perfilnatural (UsuarioNatural, Direccion, Barrio)
      VALUES (123456789, 'Calle 123 #45-67', 'Centro')
    `).run();

    // Insertar usuario comerciante
    db.prepare(`
      INSERT INTO usuario (IdUsuario, TipoUsuario, Nombre, Apellido, Documento, Telefono, Correo, FotoPerfil, Estado)
      VALUES (987654321, 'Comerciante', 'María', 'González', '987654321', '3009876543', 'maria@test.com', 'imagen/imagen_perfil.png', 'Activo')
    `).run();

    db.prepare(`
      INSERT INTO credenciales (Usuario, NombreUsuario, Contrasena)
      VALUES (987654321, 'maria@test.com', '$2b$10$Auy9be68AJYCQq9KVKUYOOsPX7/0LbPwr9lN1Ewc1w0t/B1j5B/g6')
    `).run();

    db.prepare(`
      INSERT INTO comerciante (NitComercio, Comercio, NombreComercio, Direccion, Barrio, DiasAtencion, HoraInicio, HoraFin, Latitud, Longitud)
      VALUES ('900123456', 987654321, 'Repuestos María', 'Avenida 68 #45-12', 'Kennedy', 'Lunes a Sábado', '08:00', '18:00', 4.6097, -74.0817)
    `).run();

    // Insertar usuario prestador inactivo
    db.prepare(`
      INSERT INTO usuario (IdUsuario, TipoUsuario, Nombre, Apellido, Documento, Telefono, Correo, FotoPerfil, Estado)
      VALUES (555555555, 'PrestadorServicio', 'Carlos', 'Ramírez', '555555555', '3005555555', 'carlos@test.com', 'imagen/imagen_perfil.png', 'Inactivo')
    `).run();

    db.prepare(`
      INSERT INTO credenciales (Usuario, NombreUsuario, Contrasena)
      VALUES (555555555, 'carlos@test.com', '$2b$10$Auy9be68AJYCQq9KVKUYOOsPX7/0LbPwr9lN1Ewc1w0t/B1j5B/g6')
    `).run();

    db.prepare(`
      INSERT INTO prestadorservicio (Usuario, Direccion, Barrio, Certificado, DiasAtencion, HoraInicio, HoraFin)
      VALUES (555555555, 'Calle 80 #10-20', 'Suba', 'imagen/certificado.pdf', 'Todos los días', '00:00', '23:59')
    `).run();

    console.log('✅ Datos de prueba insertados (contraseña: 123456)');
  } catch (err) {
    console.warn('⚠️ No se pudo insertar datos de prueba:', err.message);
  }
};

const cargarDatabaseSQLite = async () => {
  if (Database) {
    return Database;
  }

  const modulo = await import('better-sqlite3');
  Database = modulo.default;
  return Database;
};

// Intentar conectar a MySQL primero
try {
  mysqlPool = mysql.createPool({
    host: process.env.DB_HOST || process.env.MYSQL_HOST || 'localhost',
    user: process.env.DB_USER || process.env.MYSQL_USER || 'root',
    password: process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || 'root',
    database: process.env.DB_NAME || process.env.MYSQL_DATABASE || 'rpm_market',
    port: process.env.DB_PORT || process.env.MYSQL_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  const connection = await mysqlPool.getConnection();
  console.log('✅ Conectado a MySQL con ID ' + connection.threadId);
  connection.release();
  usarSQLite = false;
} catch (err) {
  // ⚠️ En producción, NO usar SQLite como fallback a menos que se configure explícitamente
  if (isProduction && !permitirSQLiteFallback) {
    console.error('❌ ERROR CRÍTICO: MySQL no disponible en PRODUCCIÓN');
    console.error('❌ No se permite usar SQLite como fallback en producción');
    console.error('❌ Configure SQLITE_FALLBACK=true para habilitar (NO RECOMENDADO)');
    throw new Error('Base de datos MySQL no disponible. El servicio no puede iniciar.');
  }

  console.warn('⚠️ MySQL no disponible, usando SQLite como fallback');
  if (!isProduction) {
    console.warn('📝 NOTA: Esto es aceptable en DESARROLLO, pero NO en PRODUCCIÓN');
  }
  usarSQLite = true;
  
  // Crear base de datos SQLite
  try {
    const SQLiteDatabase = await cargarDatabaseSQLite();
    const dbPath = path.join(__dirname, '../rpm_market.db');
    sqliteDb = new SQLiteDatabase(dbPath);
    console.log('✅ Base de datos SQLite creada en:', dbPath);
  } catch (sqliteLoadErr) {
    console.error('❌ No se pudo cargar better-sqlite3 para el fallback SQLite:', sqliteLoadErr.message);
    throw new Error('No se pudo iniciar MySQL ni SQLite. Revisa la conexión a MySQL o reinstala better-sqlite3.');
  }
  
  // Leer y ejecutar el script SQL si la BD está vacía
  try {
    const sqlScript = fs.readFileSync(path.join(__dirname, '../rpm_market.sql'), 'utf-8');
    
    // Adaptar SQL de MySQL a SQLite
    const sqliteScript = sqlScript
      .replace(/INT PRIMARY KEY AUTO_INCREMENT/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
      .replace(/AUTO_INCREMENT/gi, 'AUTOINCREMENT')
      .replace(/ENUM\([^)]+\)/gi, 'TEXT')
      .replace(/DATETIME DEFAULT CURRENT_TIMESTAMP/gi, 'TEXT DEFAULT CURRENT_TIMESTAMP')
      .replace(/TIME/gi, 'TEXT')
      .replace(/DATE/gi, 'TEXT')
      .replace(/DECIMAL\(\d+,\d+\)/gi, 'REAL')
      .replace(/VARCHAR\(\d+\)/gi, 'TEXT')
      .replace(/TEXT,/gi, 'TEXT,')
      .replace(/CONSTRAINT [^\s]+ FOREIGN KEY/gi, 'FOREIGN KEY')
      .replace(/CONSTRAINT [^\s]+ CHECK/gi, 'CHECK');
    
    // Ejecutar statements uno por uno
    const statements = sqliteScript.split(';').filter(s => s.trim());
    statements.forEach(statement => {
      if (statement.trim()) {
        try {
          sqliteDb.exec(statement + ';');
        } catch (execErr) {
          // Ignorar errores comunes de inicialización
          if (!execErr.message.includes('already exists') && 
              !execErr.message.includes('UNIQUE constraint failed')) {
            console.warn('⚠️ Error en statement SQL:', execErr.message);
          }
        }
      }
    });
    
    console.log('✅ Esquema SQLite inicializado desde rpm_market.sql');
    
    // Restaurar datos si la BD está vacía
    restaurarDatosVacios(sqliteDb);
  } catch (sqlErr) {
    console.error('❌ Error al inicializar esquema SQLite:', sqlErr.message);
  }
}

// Wrapper para hacer compatible la API de MySQL con SQLite
const pool = {
  async query(sql, params = []) {
    if (usarSQLite) {
      try {
        // Convertir placeholders de MySQL (?) a SQLite
        const isSelect = sql.trim().toUpperCase().startsWith('SELECT');
        
        if (isSelect) {
          const stmt = sqliteDb.prepare(sql);
          const rows = stmt.all(...params);
          return [rows, null];
        } else {
          const stmt = sqliteDb.prepare(sql);
          const result = stmt.run(...params);
          return [{
            affectedRows: result.changes,
            insertId: result.lastInsertRowid
          }, null];
        }
      } catch (err) {
        console.error('❌ Error SQLite query:', err.message);
        throw err;
      }
    } else {
      return mysqlPool.query(sql, params);
    }
  },
  
  async getConnection() {
    if (usarSQLite) {
      return {
        query: pool.query,
        release: () => {},
        beginTransaction: () => Promise.resolve(),
        commit: () => Promise.resolve(),
        rollback: () => Promise.resolve()
      };
    } else {
      return mysqlPool.getConnection();
    }
  }
};

export default pool;
