import fetch from 'node-fetch';

const BASE = 'http://localhost:3000';

async function doRequest(path, opts = {}){
  try{
    const res = await fetch(`${BASE}${path}`, opts);
    const text = await res.text();
    let body;
    try{ body = JSON.parse(text); } catch(e){ body = text; }
    return { status: res.status, ok: res.ok, body, headers: res.headers.raw() };
  }catch(e){ return { error: e.message }; }
}

async function main(){
  const results = [];

  // Public endpoints
  const publicPaths = [
    ['/health','GET'],
    ['/api/db-status','GET'],
    ['/api/categorias','GET'],
    ['/api/publicaciones_publicas','GET'],
    ['/api/marketplace-gruas','GET'],
    ['/api/detallePublicacion/84001','GET'],
    ['/api/detallePublicacion/84002','GET']
  ];

  for(const [p,m] of publicPaths){
    results.push({path:p, method:m, result: await doRequest(p, { method: m })});
  }

  // Test CORS POST
  results.push({path:'/api/test-cors (POST)', method:'POST', result: await doRequest('/api/test-cors', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({hello:'world'}) })});

  // Try demo login (no cookie handling)
  results.push({path:'/api/login/demo', method:'POST', result: await doRequest('/api/login/demo', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: 'comerciante1', password: '123456' }) })});

  // Real login to get session cookie
  const loginRes = await doRequest('/api/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email: 'sebastian.test@rpm.com', password: '123456' }) });
  results.push({path:'/api/login', method:'POST', result: loginRes});

  let cookie = null;
  if (loginRes && loginRes.headers && loginRes.headers['set-cookie']){
    cookie = loginRes.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
  }

  // Authenticated endpoints using cookie
  const authPaths = [
    ['/api/usuario-actual','GET'],
    ['/api/historial?usuarioId=71001','GET'],
    ['/api/perfilNatural/71001','GET'],
    ['/api/perfilComerciante/72001','GET'],
    ['/api/perfilPrestador/73001','GET']
  ];

  for(const [p,m] of authPaths){
    const opts = { method: m, headers: {'Content-Type':'application/json'} };
    if (cookie) opts.headers['Cookie'] = cookie;
    results.push({path:p, method:m, result: await doRequest(p, opts)});
  }

  // Test protected action: obtener publicaciones del comerciante (mis publicaciones)
  const optsPub = { method: 'GET', headers: {'Content-Type':'application/json'} };
  if (cookie) optsPub.headers['Cookie'] = cookie;
  results.push({path:'/api/publicaciones','method':'GET', result: await doRequest('/api/publicaciones', optsPub)});

  // minimal create publicacion test -> endpoint is '/api/publicar' and expects multipart/form-data
  try {
    // Get categories to use a valid category name
    const categoriasRes = await doRequest('/api/categorias', { method: 'GET' });
    let categoriaNombre = 'Otros';
    if (categoriasRes && categoriasRes.body && Array.isArray(categoriasRes.body) && categoriasRes.body.length > 0) {
      categoriaNombre = categoriasRes.body[0].NombreCategoria || categoriasRes.body[0].nombre_categoria || categoriaNombre;
    }

    const FormDataGlobal = globalThis.FormData;
    const form = new FormDataGlobal();
    form.append('nombreProducto', 'Test Mobile');
    form.append('descripcionProducto', 'Creada por script');
    form.append('categoriaProducto', categoriaNombre);
    form.append('precioProducto', '10000');
    form.append('cantidadProducto', '5');

    const optsCreate = { method: 'POST', body: form, headers: {} };
    if (cookie) optsCreate.headers['Cookie'] = cookie;
    results.push({path:'/api/publicar (crear)','method':'POST', result: await doRequest('/api/publicar', optsCreate)});
  } catch (e) {
    results.push({path:'/api/publicar (crear)','method':'POST', result: { error: 'FormData no disponible en este entorno: ' + e.message }});
  }

  // summarize
  console.log('\n==== Test summary ====');
  for(const r of results){
    const status = r.result && r.result.status ? r.result.status : 'ERR';
    const ok = r.result && (r.result.ok || (r.result.status && r.result.status>=200 && r.result.status<400));
    console.log(`${r.method} ${r.path} -> ${status} ${ok ? 'OK' : 'FAIL'}`);
  }

  // print details for failures
  console.log('\n==== Details ====');
  for(const r of results){
    const status = r.result && r.result.status ? r.result.status : 'ERR';
    if (!(r.result && (r.result.ok || (r.result.status && r.result.status>=200 && r.result.status<400)))){
      console.log('\n--', r.method, r.path, '->', status);
      console.log(r.result);
    }
  }

  process.exit(0);
}

main();
