import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  try {
    console.log('✅ PRUEBA COMPLETA DE ENDPOINTS (POST-FIXES)\n');
    
    const tests = [
      ['GET', '/health', null],
      ['GET', '/api/db-status', null],
      ['GET', '/api/categorias', null],
      ['GET', '/api/publicaciones_publicas', null],
      ['GET', '/api/historial?usuarioId=71001', null],
      ['GET', '/api/perfilNatural/71001', null],
      ['GET', '/api/perfilComerciante/72001', null],
      ['GET', '/api/marketplace-gruas', null],
      ['GET', '/api/detallePublicacion/84001', null],
      ['POST', '/api/login/demo', { username: 'usuario1', password: '123456' }]
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const [method, path, body] of tests) {
      try {
        const opts = { method };
        if (body) {
          opts.headers = { 'Content-Type': 'application/json' };
          opts.body = JSON.stringify(body);
        }
        
        const res = await fetch(`${BASE_URL}${path}`, opts);
        const status = res.status;
        
        if (status >= 200 && status < 400) {
          console.log(`✅ [${status}] ${method} ${path}`);
          passed++;
        } else {
          console.log(`⚠️  [${status}] ${method} ${path}`);
          failed++;
        }
      } catch (e) {
        console.log(`❌ [ERR] ${method} ${path}: ${e.message}`);
        failed++;
      }
    }
    
    console.log(`\n📊 Resultados: ${passed} exitosos, ${failed} con problemas`);
    
  } catch (e) {
    console.error('❌ Error general:', e.message);
  }
  
  process.exit(0);
}

runTests();
