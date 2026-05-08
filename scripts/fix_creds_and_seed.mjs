import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import fs from 'fs/promises';

const DB = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'rpm_market'
};

async function main() {
  const pool = mysql.createPool({ ...DB, waitForConnections: true, connectionLimit: 5 });
  const conn = await pool.getConnection();
  try {
    console.log('Conectando a DB', DB.database);
    const [rows] = await conn.query(`SELECT IdCredencial, Usuario, NombreUsuario, Contrasena FROM credenciales WHERE Contrasena LIKE '%REEMPLAZAR%' OR Contrasena LIKE '%HASH_%' OR Contrasena LIKE '%REEMPLAZAR_%' OR Contrasena IS NULL`);

    if (rows.length === 0) {
      console.log('No se encontraron credenciales con placeholders.');
    } else {
      console.log('Encontradas credenciales con placeholder:', rows.map(r => r.NombreUsuario));
      const newHash = await bcrypt.hash('123456', 10);
      console.log('Generado bcrypt para contraseña de prueba (123456):', newHash);

      for (const r of rows) {
        console.log('Actualizando credencial:', r.NombreUsuario);
        await conn.query('UPDATE credenciales SET Contrasena = ? WHERE IdCredencial = ?', [newHash, r.IdCredencial]);

        // Insertar en historial_contrasenas
        await conn.query('INSERT INTO historial_contrasenas (Usuario, ContrasenaHash) SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM historial_contrasenas WHERE Usuario = ? AND ContrasenaHash = ?)', [r.Usuario, newHash, r.Usuario, newHash]);
      }

      // Actualizar seed.sql reemplazando placeholders
      const seedPath = './seed.sql';
      try {
        let seed = await fs.readFile(seedPath, 'utf8');
        const placeholderPatterns = [
          /\$2b\$10\$REEMPLAZAR_HASH_BCRYPT_DE_RPM2026@/g,
          /\$2b\$10\$HASH_DANIEL123/g,
          /\$2b\$10\$HASH_SEBASTIAN123/g,
          /\$2b\$10\$HASH_NICOLAS123/g
        ];
        let replaced = seed;
        for (const pat of placeholderPatterns) replaced = replaced.replace(pat, newHash);

        if (replaced !== seed) {
          await fs.writeFile(seedPath, replaced, 'utf8');
          console.log('seed.sql actualizado con el nuevo hash.');
        } else {
          console.log('No se reemplazaron placeholders en seed.sql (no se detectaron).');
        }
      } catch (e) {
        console.warn('No se pudo leer/actualizar seed.sql:', e.message);
      }
    }

  } catch (e) {
    console.error('Error durante el proceso:', e);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

main().then(()=>console.log('Proceso finalizado')).catch(e=>{console.error(e);process.exit(1);});
