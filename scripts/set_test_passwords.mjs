import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import fs from 'fs/promises';

const DB = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'rpm_market'
};

const targets = [
  'daniel.test@rpm.com',
  'paula.test@rpm.com',
  'sebastian.test@rpm.com',
  'valentina.test@rpm.com',
  'nicolas.test@rpm.com',
  'andres.test@rpm.com',
  'admin1.test@rpm.com',
  'admin2.test@rpm.com',
  'daniel@rpm.com',
  'sebastian@rpm.com',
  'nicolas@rpm.com'
];

async function main(){
  const pool = mysql.createPool({ ...DB, waitForConnections: true, connectionLimit: 5 });
  const conn = await pool.getConnection();
  try{
    console.log('Conectando a DB', DB.database);
    const [hashRows] = await conn.query('SELECT DISTINCT Contrasena FROM credenciales LIMIT 1');
    const oldHash = (hashRows[0] && hashRows[0].Contrasena) ? hashRows[0].Contrasena : null;
    console.log('Hash de ejemplo encontrado en BD:', oldHash);

    const newHash = await bcrypt.hash('123456', 10);
    console.log('Nuevo hash generado para contraseña "123456":', newHash);

    for(const name of targets){
      console.log('Actualizando credencial para:', name);
      const [res] = await conn.query('UPDATE credenciales SET Contrasena = ? WHERE NombreUsuario = ?', [newHash, name]);
      if (res.affectedRows > 0) {
        // actualizar historial
        await conn.query('INSERT INTO historial_contrasenas (Usuario, ContrasenaHash) SELECT Usuario, ? FROM credenciales WHERE NombreUsuario = ? AND NOT EXISTS (SELECT 1 FROM historial_contrasenas h WHERE h.Usuario = credenciales.Usuario AND h.ContrasenaHash = ?)', [newHash, name, newHash]);
        console.log('-> actualizado');
      } else {
        console.log('-> no existe en credenciales, saltando');
      }
    }

    // Actualizar seed.sql reemplazando el hash antiguo por el nuevo (si existe)
    if (oldHash) {
      try{
        const seedPath = './seed.sql';
        let seed = await fs.readFile(seedPath, 'utf8');
        if (seed.includes(oldHash)){
          seed = seed.split(oldHash).join(newHash);
          await fs.writeFile(seedPath, seed, 'utf8');
          console.log('seed.sql actualizado (oldHash -> newHash)');
        } else {
          // También reemplazar algunos placeholders comunes si existen
          const patterns = ['REEMPLAZAR_HASH_BCRYPT_DE_RPM2026@','HASH_DANIEL123','HASH_SEBASTIAN123','HASH_NICOLAS123'];
          let replaced = false;
          for(const p of patterns){
            if (seed.includes(p)){
              seed = seed.split(p).join(newHash);
              replaced = true;
            }
          }
          if (replaced){
            await fs.writeFile(seedPath, seed, 'utf8');
            console.log('seed.sql actualizado reemplazando placeholders por newHash');
          } else {
            console.log('seed.sql no contenía el hash antiguo ni placeholders esperados.');
          }
        }
      }catch(e){console.warn('Error actualizando seed.sql:', e.message)}
    }

  }catch(e){console.error(e);process.exit(1);}finally{conn.release();await pool.end();}
  console.log('Proceso finalizado');
}

main();
