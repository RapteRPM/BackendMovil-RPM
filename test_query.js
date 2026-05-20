import mysql from 'mysql2/promise';
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'rpmmarket',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

(async () => {
  try {
    const conn = await pool.getConnection();
    
    // Primero, verificar estructura de tabla controlagendacomercio
    console.log('=== TABLE STRUCTURE ===');
    const [columns] = await conn.query(`DESCRIBE controlagendacomercio`);
    console.log('controlagendacomercio columns:', columns.map(c => c.Field));
    
    // Ahora verificar qué datos hay en factura para usuario 71001
    console.log('\n=== FACTURAS PARA USUARIO 71001 ===');
    const [facturas] = await conn.query('SELECT * FROM factura WHERE Usuario = ? LIMIT 2', ['71001']);
    console.log('Facturas found:', facturas.length);
    if (facturas.length > 0) {
      console.log('First factura:', facturas[0]);
    }
    
    console.log('Query successful!');
    console.log('Rows count:', results.length);
    if (results.length > 0) {
      console.log('First row:', results[0]);
    }
    
    conn.release();
    process.exit(0);
  } catch (e) {
    console.error('Query error:', e.message);
    console.error('Stack:', e.stack);
    process.exit(1);
  }
})();
