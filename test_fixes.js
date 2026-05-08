import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  try {
    console.log('🧪 EJECUTANDO PRUEBAS DE ENDPOINTS REPARADOS\n');

    // Test 1: GET /api/historial (sin sesión)
    console.log('Test 1️⃣ : GET /api/historial?usuarioId=71001');
    const res1 = await fetch(`${BASE_URL}/api/historial?usuarioId=71001`);
    const data1 = await res1.json();
    console.log(`Status: ${res1.status}`);
    console.log(`Response:`, JSON.stringify(data1, null, 2));
    console.log('---\n');

    // Test 2: GET /api/usuario-actual (sin sesión, debería fallar con 401)
    console.log('Test 2️⃣ : GET /api/usuario-actual (sin sesión)');
    const res2 = await fetch(`${BASE_URL}/api/usuario-actual`);
    const data2 = await res2.json();
    console.log(`Status: ${res2.status} (esperado 401 sin sesión)`);
    console.log(`Response:`, JSON.stringify(data2, null, 2));
    console.log('---\n');

    // Test 3: First login para obtener sesión
    console.log('Test 3️⃣ : POST /api/login/demo');
    const resLogin = await fetch(`${BASE_URL}/api/login/demo`, { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'usuario1', password: '123456' })
    });
    const dataLogin = await resLogin.json();
    console.log(`Status: ${resLogin.status}`);
    console.log(`Response:`, JSON.stringify(dataLogin, null, 2));
    
    // Obtener cookies
    const cookies = resLogin.headers.raw()['set-cookie'];
    console.log('Cookies recibidas:', cookies ? 'Sí' : 'No');
    console.log('---\n');

    // Test 4: Ahora intentar /api/usuario-actual CON sesión
    if (cookies) {
      console.log('Test 4️⃣ : GET /api/usuario-actual (CON sesión)');
      const res4 = await fetch(`${BASE_URL}/api/usuario-actual`, {
        headers: {
          'Cookie': cookies.join('; ')
        }
      });
      const data4 = await res4.json();
      console.log(`Status: ${res4.status}`);
      console.log(`Response:`, JSON.stringify(data4, null, 2));
    }

  } catch (e) {
    console.error('❌ Error:', e.message);
  }
  
  process.exit(0);
}

runTests();
