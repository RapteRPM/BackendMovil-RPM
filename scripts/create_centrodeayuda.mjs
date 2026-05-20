import pool from '../config/db.js';

async function run() {
  try {
    const sql = `CREATE TABLE IF NOT EXISTS centrodeayuda (
      IdAyuda INT AUTO_INCREMENT PRIMARY KEY,
      Perfil INT,
      TipoSolicitud VARCHAR(100),
      Rol VARCHAR(50),
      Asunto VARCHAR(255),
      Descripcion TEXT,
      Respuesta TEXT,
      FechaRespuesta DATETIME NULL,
      Respondida VARCHAR(10) DEFAULT 'No',
      FechaCreacion DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;

    const [result] = await pool.query(sql);
    console.log('Tabla centrodeayuda creada o ya existía.');
    process.exit(0);
  } catch (err) {
    console.error('Error creando tabla centrodeayuda:', err);
    process.exit(1);
  }
}

run();
