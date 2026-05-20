import pool from '../config/db.js';

(async () => {
  try {
    const [rows] = await pool.query(
      'SELECT IdAyuda, Perfil, TipoSolicitud, Rol, Asunto, Descripcion, Respondida, FechaCreacion FROM centrodeayuda WHERE Perfil = ? ORDER BY IdAyuda DESC LIMIT 50',
      [73001]
    );
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Error querying centrodeayuda:', err);
    process.exit(1);
  }
})();