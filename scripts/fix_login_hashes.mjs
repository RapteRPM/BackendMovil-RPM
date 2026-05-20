import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'rpmmarket'
});

const targetUsers = [
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
  'nicolas@rpm.com',
  'admin@rpm.cpm'
];

const plainPassword = '123456';
const hash = await bcrypt.hash(plainPassword, 10);

const [existing] = await connection.query(
  'SELECT NombreUsuario FROM credenciales WHERE NombreUsuario IN (?)',
  [targetUsers]
);

if (existing.length === 0) {
  console.log('No se encontraron usuarios objetivo en credenciales.');
  await connection.end();
  process.exit(0);
}

const usersToUpdate = existing.map((row) => row.NombreUsuario);

await connection.query(
  'UPDATE credenciales SET Contrasena = ?, ContrasenaTemporal = ? WHERE NombreUsuario IN (?)',
  [hash, 'No', usersToUpdate]
);

const [updated] = await connection.query(
  'SELECT NombreUsuario, ContrasenaTemporal FROM credenciales WHERE NombreUsuario IN (?) ORDER BY NombreUsuario',
  [usersToUpdate]
);

console.log('✅ Hashes actualizados para login de pruebas.');
console.log(`Contraseña de prueba para estos usuarios: ${plainPassword}`);
console.table(updated);

await connection.end();
