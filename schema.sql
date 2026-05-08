USE rpm_market;

CREATE TABLE usuario (
  IdUsuario INT PRIMARY KEY,
  TipoUsuario ENUM('Natural','Comerciante','PrestadorServicio','Administrador') NOT NULL,
  Nombre VARCHAR(50) NOT NULL,
  Apellido VARCHAR(50) NOT NULL,
  Documento VARCHAR(20) NOT NULL,
  Telefono VARCHAR(20) NOT NULL,
  Correo VARCHAR(100) NOT NULL UNIQUE,
  FotoPerfil VARCHAR(255) NOT NULL,
  Estado ENUM('Activo','Inactivo') DEFAULT 'Activo',
  ContrasenaCreada ENUM('Si','No') DEFAULT 'Si'
);

CREATE TABLE credenciales (
  IdCredencial INT PRIMARY KEY AUTO_INCREMENT,
  Usuario INT NOT NULL,
  NombreUsuario VARCHAR(50) NOT NULL,
  Contrasena VARCHAR(255) NOT NULL,
  ContrasenaTemporal ENUM('Si','No') DEFAULT 'No',
  CONSTRAINT credenciales FOREIGN KEY (Usuario) REFERENCES usuario (IdUsuario)
);

CREATE TABLE categoria (
  IdCategoria INT NOT NULL PRIMARY KEY,
  NombreCategoria ENUM('Accesorios','Repuestos','Servicio mecanico','Servicio de grua') NOT NULL UNIQUE
);

CREATE TABLE perfilnatural (
  UsuarioNatural INT PRIMARY KEY,
  Direccion VARCHAR(200) DEFAULT NULL,
  Barrio VARCHAR(50) DEFAULT NULL,
  CONSTRAINT perfilnatural FOREIGN KEY (UsuarioNatural) REFERENCES usuario (IdUsuario)
);

CREATE TABLE comerciante (
  NitComercio INT PRIMARY KEY,
  Comercio INT NOT NULL,
  NombreComercio VARCHAR(100) NOT NULL,
  Direccion VARCHAR(200) NOT NULL,
  Latitud DECIMAL(10,7) NOT NULL,
  Longitud DECIMAL(10,7) NOT NULL,
  Barrio VARCHAR(50) NOT NULL,
  RedesSociales VARCHAR(255) DEFAULT NULL,
  DiasAtencion VARCHAR(50) NOT NULL,
  HoraInicio TIME NOT NULL,
  HoraFin TIME NOT NULL,
  CONSTRAINT comerciante FOREIGN KEY (Comercio) REFERENCES usuario (IdUsuario)
);

CREATE TABLE prestadorservicio (
  IdServicio INT PRIMARY KEY AUTO_INCREMENT,
  Usuario INT NOT NULL,
  Direccion VARCHAR(200) DEFAULT NULL,
  Barrio VARCHAR(50) DEFAULT NULL,
  RedesSociales VARCHAR(255) DEFAULT NULL,
  Certificado VARCHAR(255) NOT NULL,
  DiasAtencion VARCHAR(50) DEFAULT NULL,
  HoraInicio TIME DEFAULT NULL,
  HoraFin TIME DEFAULT NULL,
  CONSTRAINT fk_usuario FOREIGN KEY (Usuario) REFERENCES usuario (IdUsuario)
);

CREATE TABLE publicacion (
  IdPublicacion INT PRIMARY KEY AUTO_INCREMENT,
  Comerciante INT NOT NULL,
  NombreProducto VARCHAR(100) NOT NULL,
  Descripcion TEXT,
  Categoria INT NOT NULL,
  Precio DECIMAL(12,2) NOT NULL,
  Stock INT DEFAULT '0',
  ImagenProducto TEXT NOT NULL,
  FechaPublicacion DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT publicacion FOREIGN KEY (Comerciante) REFERENCES comerciante (NitComercio),
  CONSTRAINT publicacion_categoria FOREIGN KEY (Categoria) REFERENCES categoria (IdCategoria)
);

CREATE TABLE producto (
  IdProducto INT PRIMARY KEY AUTO_INCREMENT,
  PublicacionComercio INT NOT NULL,
  NombreProducto VARCHAR(100) NOT NULL,
  Descripcion TEXT,
  IdCategoria INT NOT NULL,
  Precio DECIMAL(12,2) NOT NULL,
  Stock INT DEFAULT '0',
  ImagenProducto TEXT,
  FechaPublicacion DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT producto FOREIGN KEY (PublicacionComercio) REFERENCES publicacion (IdPublicacion)
);

CREATE TABLE publicaciongrua (
  IdPublicacionGrua INT PRIMARY KEY AUTO_INCREMENT,
  Servicio INT NOT NULL,
  DescripcionServicio TEXT,
  TarifaBase DECIMAL(12,2) DEFAULT NULL,
  ZonaCobertura VARCHAR(255) NOT NULL,
  FotoPublicacion TEXT NOT NULL,
  TituloPublicacion VARCHAR(255),
  CONSTRAINT fk_servicio FOREIGN KEY (Servicio) REFERENCES prestadorservicio (IdServicio)
);

CREATE TABLE controlagendaservicios (
  IdSolicitudServicio INT PRIMARY KEY AUTO_INCREMENT,
  UsuarioNatural INT NOT NULL,
  PublicacionGrua INT NOT NULL,
  FechaServicio DATE DEFAULT NULL,
  HoraServicio TIME DEFAULT NULL,
  DireccionRecogida VARCHAR(200) DEFAULT NULL,
  Destino VARCHAR(200) DEFAULT NULL,
  ComentariosAdicionales TEXT,
  Estado ENUM('Pendiente','Finalizado','En revision','Cancelado') DEFAULT 'Pendiente',
  FechaModificadaPor DATETIME DEFAULT NULL,
  NotificacionVista BOOLEAN DEFAULT FALSE,
  CONSTRAINT controlagendaservicios FOREIGN KEY (PublicacionGrua) REFERENCES publicaciongrua (IdPublicacionGrua)
);

CREATE TABLE historialservicios (
  IdHistorial INT PRIMARY KEY AUTO_INCREMENT,
  SolicitudServicio INT NOT NULL,
  CONSTRAINT historialservicios FOREIGN KEY (SolicitudServicio) REFERENCES controlagendaservicios (IdSolicitudServicio)
);

CREATE TABLE carrito (
  IdCarrito INT PRIMARY KEY AUTO_INCREMENT,
  UsuarioNat INT NOT NULL,
  Publicacion INT NOT NULL,
  Cantidad INT DEFAULT '1',
  SubTotal DECIMAL(12,2) NOT NULL,
  Estado ENUM('Pendiente','Procesado') DEFAULT 'Pendiente',
  CONSTRAINT carrito_usuario FOREIGN KEY (UsuarioNat) REFERENCES usuario (IdUsuario),
  CONSTRAINT carrito_publicacion FOREIGN KEY (Publicacion) REFERENCES publicacion (IdPublicacion)
);

CREATE TABLE factura (
  IdFactura INT PRIMARY KEY AUTO_INCREMENT,
  Usuario INT DEFAULT NULL,
  FechaCompra DATETIME DEFAULT CURRENT_TIMESTAMP,
  TotalPago DECIMAL(12,2) DEFAULT NULL,
  MetodoPago VARCHAR(50) DEFAULT NULL,
  Estado ENUM('Pago exitoso','Pago rechazado','Proceso pendiente') DEFAULT 'Proceso pendiente',
  CONSTRAINT factura FOREIGN KEY (Usuario) REFERENCES usuario (IdUsuario)
);

CREATE TABLE detallefactura (
  IdDetalleFactura INT PRIMARY KEY AUTO_INCREMENT,
  Factura INT NOT NULL,
  Publicacion INT DEFAULT NULL,
  Cantidad INT DEFAULT '1',
  PrecioUnitario DECIMAL(12,2) DEFAULT NULL,
  Total DECIMAL(12,2) DEFAULT NULL,
  Estado VARCHAR(50) DEFAULT 'Pendiente',
  VisibleUsuario BOOLEAN DEFAULT 1,
  CONSTRAINT detallefactura_factura FOREIGN KEY (Factura) REFERENCES factura (IdFactura),
  CONSTRAINT detallefactura_publicacion FOREIGN KEY (Publicacion) REFERENCES publicacion (IdPublicacion)
);

CREATE TABLE detallefacturacomercio (
  IdDetalleFacturaComercio INT PRIMARY KEY AUTO_INCREMENT,
  Factura INT NOT NULL,
  Publicacion INT DEFAULT NULL,
  Cantidad INT DEFAULT '1',
  PrecioUnitario DECIMAL(12,2) DEFAULT NULL,
  Total DECIMAL(12,2) DEFAULT NULL,
  Estado VARCHAR(50) DEFAULT 'Pendiente',
  ConfirmacionUsuario ENUM('Pendiente','Recibido') DEFAULT 'Pendiente',
  ConfirmacionComercio ENUM('Pendiente','Entregado') DEFAULT 'Pendiente',
  CONSTRAINT detallefacturacomerciante FOREIGN KEY (Factura) REFERENCES factura (IdFactura),
  CONSTRAINT detallefacturacomerciante_pub FOREIGN KEY (Publicacion) REFERENCES publicacion (IdPublicacion)
);

CREATE TABLE controlagendacomercio (
  IdSolicitud INT PRIMARY KEY AUTO_INCREMENT,
  Comercio INT NOT NULL,
  DetFacturacomercio INT NOT NULL,
  TipoServicio INT NOT NULL,
  ModoServicio ENUM('Visita al taller','Domicilio') DEFAULT 'Visita al taller',
  FechaServicio DATE DEFAULT NULL,
  HoraServicio TIME DEFAULT NULL,
  ComentariosAdicionales TEXT,
  CONSTRAINT controlagendacomercio_detalle FOREIGN KEY (detFacturacomercio) REFERENCES detallefacturacomercio (IdDetalleFacturaComercio)
);

CREATE TABLE centroayuda (
  IdAyuda INT PRIMARY KEY AUTO_INCREMENT,
  Perfil INT NOT NULL,
  TipoSolicitud ENUM('Sugerencia','Queja','Reclamo') NOT NULL,
  Rol ENUM('Usuario Natural','Comerciante','PrestadorServicio') NOT NULL,
  Asunto VARCHAR(100) DEFAULT NULL,
  Descripcion TEXT,
  Respuesta TEXT DEFAULT NULL,
  FechaRespuesta DATETIME DEFAULT NULL,
  Respondida ENUM('Si', 'No') DEFAULT 'No',
  FechaCreacion DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT centroayuda FOREIGN KEY (Perfil) REFERENCES usuario (IdUsuario)
);

CREATE TABLE opiniones (
  IdOpinion INT PRIMARY KEY AUTO_INCREMENT,
  UsuarioNatural INT NOT NULL,
  Publicacion INT NOT NULL,
  NombreUsuario VARCHAR(50) DEFAULT NULL,
  Comentario TEXT,
  Calificacion INT DEFAULT NULL,
  FechaOpinion DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT opiniones_usuario FOREIGN KEY (UsuarioNatural) REFERENCES usuario (IdUsuario),
  CONSTRAINT opiniones_publicacion FOREIGN KEY (Publicacion) REFERENCES publicacion (IdPublicacion),
  CONSTRAINT opiniones_calificacion CHECK (Calificacion BETWEEN 1 AND 5)
);

CREATE TABLE OpinionesGrua (
  IdOpinion INT PRIMARY KEY AUTO_INCREMENT,
  UsuarioNatural INT NOT NULL,
  PublicacionGrua INT NOT NULL,
  NombreUsuario VARCHAR(100),
  Comentario TEXT,
  Calificacion INT CHECK (Calificacion BETWEEN 1 AND 5),
  Fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_usuario_grua FOREIGN KEY (UsuarioNatural) REFERENCES usuario (IdUsuario),
  CONSTRAINT fk_publicacion_grua FOREIGN KEY (PublicacionGrua) REFERENCES publicaciongrua (IdPublicacionGrua)
);

CREATE TABLE tokens_verificacion (
  IdToken INT PRIMARY KEY AUTO_INCREMENT,
  Usuario INT NOT NULL,
  Token VARCHAR(100) NOT NULL UNIQUE,
  TipoToken ENUM('CrearContrasena','RecuperarContrasena') NOT NULL,
  CodigoVerificacion VARCHAR(4) DEFAULT NULL,
  CodigoEnviado ENUM('Si','No') DEFAULT 'No',
  CodigoVerificado ENUM('Si','No') DEFAULT 'No',
  FechaCreacion DATETIME DEFAULT CURRENT_TIMESTAMP,
  FechaExpiracion DATETIME NOT NULL,
  Usado ENUM('Si','No') DEFAULT 'No',
  CONSTRAINT fk_token_usuario FOREIGN KEY (Usuario) REFERENCES usuario (IdUsuario) ON DELETE CASCADE
);

CREATE TABLE registros_pendientes (
  IdRegistro INT PRIMARY KEY AUTO_INCREMENT,
  Token VARCHAR(100) NOT NULL UNIQUE,
  IdUsuario INT NOT NULL,
  TipoUsuario VARCHAR(30) NOT NULL,
  Nombre VARCHAR(50) NOT NULL,
  Apellido VARCHAR(50) NOT NULL,
  Documento VARCHAR(20) NOT NULL,
  Telefono VARCHAR(20),
  Correo VARCHAR(100) NOT NULL,
  FotoPerfil VARCHAR(255) NOT NULL,
  DatosPerfil TEXT,
  CodigoVerificacion VARCHAR(4) DEFAULT NULL,
  CodigoEnviado ENUM('Si','No') DEFAULT 'No',
  CodigoVerificado ENUM('Si','No') DEFAULT 'No',
  FechaCreacion DATETIME DEFAULT CURRENT_TIMESTAMP,
  FechaExpiracion DATETIME NOT NULL,
  Estado ENUM('Pendiente','Completado','Expirado') DEFAULT 'Pendiente'
);

CREATE TABLE historial_contrasenas (
  IdHistorial INT PRIMARY KEY AUTO_INCREMENT,
  Usuario INT NOT NULL,
  ContrasenaHash VARCHAR(255) NOT NULL,
  FechaCambio DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_historial_usuario FOREIGN KEY (Usuario) REFERENCES usuario (IdUsuario)
);