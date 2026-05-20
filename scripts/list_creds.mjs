import mysql from 'mysql2/promise';

const DB = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'rpmmarket'
};

(async ()=>{
  const pool = mysql.createPool({ ...DB, waitForConnections: true, connectionLimit: 5 });
  const conn = await pool.getConnection();
  try{
    const [rows] = await conn.query("SELECT IdCredencial, Usuario, NombreUsuario, Contrasena FROM credenciales WHERE NombreUsuario LIKE '%sebastian%' OR NombreUsuario LIKE '%daniel%' OR NombreUsuario LIKE '%nicolas%' OR NombreUsuario LIKE '%admin%'");
    console.log('credenciales encontradas:', rows.length);
    console.table(rows.map(r=>({IdCredencial:r.IdCredencial, Usuario:r.Usuario, NombreUsuario:r.NombreUsuario, Contrasena:r.Contrasena})));
  }catch(e){console.error(e)}finally{conn.release(); await pool.end();}
})();
