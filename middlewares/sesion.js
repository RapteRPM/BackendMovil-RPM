export function verificarSesion(req, res, next) {
  if (req.session && req.session.usuario) {
    next();
  } else {
    // Si es una petición API, devolver JSON 401 en lugar de redirigir
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'No autorizado', activa: false });
    }
    // Si es una petición de página HTML, redirigir
    res.redirect('/General/Ingreso.html');
  }
}

export function verificarAdmin(req, res, next) {
  if (req.session && req.session.usuario && req.session.usuario.tipo === "Administrador") {
    next();
  } else {
    if (req.path.startsWith('/api/')) {
      return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de administrador.', activa: false });
    }
    res.redirect('/General/Ingreso.html');
  }
}

export function evitarCache(req, res, next) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
}