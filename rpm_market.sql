USE rpm_market;
SHOW TABLES;
SELECT * FROM usuario;

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
  Servicio INT NOT NULL, -- antes referenciaba a prestadorservicio.IdServicio
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
  ConfirmacionUsuario enum('Pendiente','Recibido') DEFAULT 'Pendiente',
  ConfirmacionComercio enum('Pendiente','Entregado') DEFAULT 'Pendiente',
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

-- Tabla para registros pendientes de verificación
-- Los usuarios se crean aquí primero y solo se mueven a las tablas reales
-- cuando completan la verificación del código y crean su contraseña
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
  -- Campos específicos de perfil (JSON para flexibilidad)
  DatosPerfil TEXT,
  -- Verificación
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

INSERT INTO categoria (IdCategoria, NombreCategoria) VALUES
(1, 'Accesorios'),
(2, 'Repuestos'),
(3, 'Servicio mecanico'),
(4, 'Servicio de grua');


START TRANSACTION;

-- 1) Usuario administrador
INSERT INTO usuario (
  IdUsuario, TipoUsuario, Nombre, Apellido, Documento, Telefono, Correo, FotoPerfil, Estado, ContrasenaCreada
)
SELECT
  9001, 'Administrador', 'Admin', 'RPM', '90010001', '3000000000', 'admin@rpm.cpm', 'default-admin.jpg', 'Activo', 'Si'
WHERE NOT EXISTS (
  SELECT 1 FROM usuario WHERE Correo = 'admin@rpm.cpm'
);

-- 2) Credenciales administrador
-- Reemplaza el hash por uno real de bcrypt para: RPM2026@
INSERT INTO credenciales (
  Usuario, NombreUsuario, Contrasena, ContrasenaTemporal
)
SELECT
  9001, 'admin@rpm.cpm', '$2b$10$VhLHMPsGv1bAFuy563841uL2TCByD91qTuamg5IU2SpKvcnUTIO92', 'No'
WHERE NOT EXISTS (
  SELECT 1 FROM credenciales WHERE NombreUsuario = 'admin@rpm.cpm'
);

-- 3) Historial de contraseña (opcional pero recomendado)
INSERT INTO historial_contrasenas (Usuario, ContrasenaHash)
SELECT 9001, '$2b$10$VhLHMPsGv1bAFuy563841uL2TCByD91qTuamg5IU2SpKvcnUTIO92'
WHERE NOT EXISTS (
  SELECT 1 FROM historial_contrasenas WHERE Usuario = 9001
);

-- NATURAL: daniel@rpm.com
INSERT INTO usuario (
  IdUsuario, TipoUsuario, Nombre, Apellido, Documento, Telefono, Correo, FotoPerfil, Estado, ContrasenaCreada
)
SELECT 9101, 'Natural', 'Daniel', 'Rpm', '91010001', '3001000001', 'daniel@rpm.com', 'default-natural.jpg', 'Activo', 'Si'
WHERE NOT EXISTS (SELECT 1 FROM usuario WHERE Correo = 'daniel@rpm.com');

INSERT INTO perfilnatural (UsuarioNatural, Direccion, Barrio)
SELECT 9101, 'Calle 1 # 1-01', 'Centro'
WHERE NOT EXISTS (SELECT 1 FROM perfilnatural WHERE UsuarioNatural = 9101);

-- COMERCIANTE: sebastian@rpm.com
INSERT INTO usuario (
  IdUsuario, TipoUsuario, Nombre, Apellido, Documento, Telefono, Correo, FotoPerfil, Estado, ContrasenaCreada
)
SELECT 9102, 'Comerciante', 'Sebastian', 'Rpm', '91020002', '3002000002', 'sebastian@rpm.com', 'default-comercio.jpg', 'Activo', 'Si'
WHERE NOT EXISTS (SELECT 1 FROM usuario WHERE Correo = 'sebastian@rpm.com');

INSERT INTO comerciante (
  NitComercio, Comercio, NombreComercio, Direccion, Latitud, Longitud, Barrio, RedesSociales, DiasAtencion, HoraInicio, HoraFin
)
SELECT 8001001, 9102, 'Comercio Sebastian', 'Cra 2 # 2-02', 7.8895000, -72.4967000, 'Centro', '@sebastianrpm', 'Lunes-Sabado', '08:00:00', '18:00:00'
WHERE NOT EXISTS (SELECT 1 FROM comerciante WHERE Comercio = 9102);

-- PRESTADOR SERVICIO: nicolas@rpm.com
INSERT INTO usuario (
  IdUsuario, TipoUsuario, Nombre, Apellido, Documento, Telefono, Correo, FotoPerfil, Estado, ContrasenaCreada
)
SELECT 9103, 'PrestadorServicio', 'Nicolas', 'Rpm', '91030003', '3003000003', 'nicolas@rpm.com', 'default-servicio.jpg', 'Activo', 'Si'
WHERE NOT EXISTS (SELECT 1 FROM usuario WHERE Correo = 'nicolas@rpm.com');

INSERT INTO prestadorservicio (
  Usuario, Direccion, Barrio, RedesSociales, Certificado, DiasAtencion, HoraInicio, HoraFin
)
SELECT 9103, 'Av 3 # 3-03', 'Centro', '@nicolasrpm', 'certificado-9103.pdf', 'Lunes-Domingo', '06:00:00', '22:00:00'
WHERE NOT EXISTS (SELECT 1 FROM prestadorservicio WHERE Usuario = 9103);

-- CREDENCIALES (usar hash bcrypt real)
INSERT INTO credenciales (Usuario, NombreUsuario, Contrasena, ContrasenaTemporal)
SELECT 9101, 'daniel@rpm.com', '$2b$10$VhLHMPsGv1bAFuy563841uL2TCByD91qTuamg5IU2SpKvcnUTIO92', 'No'
WHERE NOT EXISTS (SELECT 1 FROM credenciales WHERE NombreUsuario = 'daniel@rpm.com');

INSERT INTO credenciales (Usuario, NombreUsuario, Contrasena, ContrasenaTemporal)
SELECT 9102, 'sebastian@rpm.com', '$2b$10$VhLHMPsGv1bAFuy563841uL2TCByD91qTuamg5IU2SpKvcnUTIO92', 'No'
WHERE NOT EXISTS (SELECT 1 FROM credenciales WHERE NombreUsuario = 'sebastian@rpm.com');

INSERT INTO credenciales (Usuario, NombreUsuario, Contrasena, ContrasenaTemporal)
SELECT 9103, 'nicolas@rpm.com', '$2b$10$VhLHMPsGv1bAFuy563841uL2TCByD91qTuamg5IU2SpKvcnUTIO92', 'No'
WHERE NOT EXISTS (SELECT 1 FROM credenciales WHERE NombreUsuario = 'nicolas@rpm.com');

COMMIT;



COMMIT;


USE rpm_market;

-- 1) Ver usuarios creados
SELECT IdUsuario, TipoUsuario, Nombre, Correo, Estado, ContrasenaCreada
FROM usuario
WHERE Correo IN ('daniel@rpm.com','sebastian@rpm.com','nicolas@rpm.com','admin@rpm.cpm');

-- 2) Ver credenciales creadas
SELECT IdCredencial, Usuario, NombreUsuario, ContrasenaTemporal
FROM credenciales
WHERE NombreUsuario IN ('daniel@rpm.com','sebastian@rpm.com','nicolas@rpm.com','admin@rpm.cpm');

-- 3) Ver perfiles por tipo
SELECT * FROM perfilnatural WHERE UsuarioNatural = 9101;
SELECT * FROM comerciante WHERE Comercio = 9102;
SELECT * FROM prestadorservicio WHERE Usuario = 9103;

-- 4) Ver categorías (las inserciones del .sql)
SELECT * FROM categoria ORDER BY IdCategoria;

---------------------------------------------------------------------------


USE rpm_market;
START TRANSACTION;

-- =========================
-- usuario (2+)
-- =========================
INSERT INTO usuario
(IdUsuario, TipoUsuario, Nombre, Apellido, Documento, Telefono, Correo, FotoPerfil, Estado, ContrasenaCreada)
VALUES
(71001,'Natural','Daniel','Lopez','NAT-71001','3007100001','daniel.test@rpm.com','natural1.jpg','Activo','Si'),
(71002,'Natural','Paula','Rios','NAT-71002','3007100002','paula.test@rpm.com','natural2.jpg','Activo','Si'),
(72001,'Comerciante','Sebastian','Mora','COM-72001','3007200001','sebastian.test@rpm.com','com1.jpg','Activo','Si'),
(72002,'Comerciante','Valentina','Diaz','COM-72002','3007200002','valentina.test@rpm.com','com2.jpg','Activo','Si'),
(73001,'PrestadorServicio','Nicolas','Perez','PRE-73001','3007300001','nicolas.test@rpm.com','pre1.jpg','Activo','Si'),
(73002,'PrestadorServicio','Andres','Cruz','PRE-73002','3007300002','andres.test@rpm.com','pre2.jpg','Activo','Si'),
(79001,'Administrador','Admin','Uno','ADM-79001','3007900001','admin1.test@rpm.com','adm1.jpg','Activo','Si'),
(79002,'Administrador','Admin','Dos','ADM-79002','3007900002','admin2.test@rpm.com','adm2.jpg','Activo','Si');

-- =========================
-- credenciales (2+)
-- Nota: hash bcrypt de prueba para "123456"
-- =========================
INSERT INTO credenciales
(Usuario, NombreUsuario, Contrasena, ContrasenaTemporal)
VALUES
(71001,'daniel.test@rpm.com','$2b$10$VhLHMPsGv1bAFuy563841uL2TCByD91qTuamg5IU2SpKvcnUTIO92','No'),
(71002,'paula.test@rpm.com','$2b$10$VhLHMPsGv1bAFuy563841uL2TCByD91qTuamg5IU2SpKvcnUTIO92','No'),
(72001,'sebastian.test@rpm.com','$2b$10$VhLHMPsGv1bAFuy563841uL2TCByD91qTuamg5IU2SpKvcnUTIO92','No'),
(72002,'valentina.test@rpm.com','$2b$10$VhLHMPsGv1bAFuy563841uL2TCByD91qTuamg5IU2SpKvcnUTIO92','No'),
(73001,'nicolas.test@rpm.com','$2b$10$VhLHMPsGv1bAFuy563841uL2TCByD91qTuamg5IU2SpKvcnUTIO92','No'),
(73002,'andres.test@rpm.com','$2b$10$VhLHMPsGv1bAFuy563841uL2TCByD91qTuamg5IU2SpKvcnUTIO92','No'),
(79001,'admin1.test@rpm.com','$2b$10$VhLHMPsGv1bAFuy563841uL2TCByD91qTuamg5IU2SpKvcnUTIO92','No'),
(79002,'admin2.test@rpm.com','$2b$10$VhLHMPsGv1bAFuy563841uL2TCByD91qTuamg5IU2SpKvcnUTIO92','No');

-- =========================
-- perfilnatural (2)
-- =========================
INSERT INTO perfilnatural (UsuarioNatural, Direccion, Barrio) VALUES
(71001,'Calle 10 # 20-30','Centro'),
(71002,'Carrera 5 # 11-22','La Playa');

-- =========================
-- comerciante (2)
-- =========================
INSERT INTO comerciante
(NitComercio, Comercio, NombreComercio, Direccion, Latitud, Longitud, Barrio, RedesSociales, DiasAtencion, HoraInicio, HoraFin)
VALUES
(82001,72001,'Moto Repuestos Sebas','Av 1 # 2-3',7.8895000,-72.4967000,'Centro','@sebasmotos','Lunes-Sabado','08:00:00','18:00:00'),
(82002,72002,'Taller Valen','Av 4 # 5-6',7.9000000,-72.5000000,'San Luis','@tallervalen','Lunes-Viernes','09:00:00','17:30:00');

-- =========================
-- prestadorservicio (2)
-- =========================
INSERT INTO prestadorservicio
(IdServicio, Usuario, Direccion, Barrio, RedesSociales, Certificado, DiasAtencion, HoraInicio, HoraFin)
VALUES
(83001,73001,'Calle 3 # 8-9','Centro','@gruanico','cert-83001.pdf','Lunes-Domingo','06:00:00','22:00:00'),
(83002,73002,'Carrera 9 # 1-2','San Mateo','@gruaandres','cert-83002.pdf','Lunes-Sabado','07:00:00','20:00:00');

-- =========================
-- publicacion (2)
-- =========================
INSERT INTO publicacion
(IdPublicacion, Comerciante, NombreProducto, Descripcion, Categoria, Precio, Stock, ImagenProducto)
VALUES
(84001,82001,'Casco Integral','Casco certificado',1,250000,10,'casco.jpg'),
(84002,82002,'Cambio de Aceite','Servicio completo',3,80000,50,'aceite.jpg');

-- =========================
-- producto (2)
-- =========================
INSERT INTO producto
(IdProducto, PublicacionComercio, NombreProducto, Descripcion, IdCategoria, Precio, Stock, ImagenProducto)
VALUES
(85001,84001,'Casco Integral X','Talla M',1,255000,8,'casco-x.jpg'),
(85002,84002,'Aceite 4T','Marca RPM',2,45000,30,'aceite-4t.jpg');

-- =========================
-- publicaciongrua (2)
-- =========================
INSERT INTO publicaciongrua
(IdPublicacionGrua, Servicio, DescripcionServicio, TarifaBase, ZonaCobertura, FotoPublicacion, TituloPublicacion)
VALUES
(86001,83001,'Servicio de grua urbana',50000,'Cucuta centro','grua1.jpg','Grua urbana 24/7'),
(86002,83002,'Traslado intermunicipal',90000,'Area metropolitana','grua2.jpg','Grua intermunicipal');

-- =========================
-- controlagendaservicios (2)
-- =========================
INSERT INTO controlagendaservicios
(IdSolicitudServicio, UsuarioNatural, PublicacionGrua, FechaServicio, HoraServicio, DireccionRecogida, Destino, ComentariosAdicionales, Estado, FechaModificadaPor, NotificacionVista)
VALUES
(87001,71001,86001,'2026-05-10','10:00:00','Calle 1','Taller Centro','Pinchazo','Pendiente',NULL,FALSE),
(87002,71002,86002,'2026-05-11','15:30:00','Av 5','Barrio Norte','Moto apagada','En revision','2026-05-06 12:00:00',TRUE);

-- =========================
-- historialservicios (2)
-- =========================
INSERT INTO historialservicios (IdHistorial, SolicitudServicio) VALUES
(88001,87001),
(88002,87002);

-- =========================
-- carrito (2)
-- =========================
INSERT INTO carrito
(IdCarrito, UsuarioNat, Publicacion, Cantidad, SubTotal, Estado)
VALUES
(89001,71001,84001,1,250000,'Pendiente'),
(89002,71002,84002,2,160000,'Procesado');

-- =========================
-- factura (2)
-- =========================
INSERT INTO factura
(IdFactura, Usuario, FechaCompra, TotalPago, MetodoPago, Estado)
VALUES
(90001,71001,'2026-05-06 10:00:00',250000,'Efectivo','Pago exitoso'),
(90002,71002,'2026-05-06 11:00:00',160000,'Tarjeta','Proceso pendiente');

-- =========================
-- detallefactura (2)
-- =========================
INSERT INTO detallefactura
(IdDetalleFactura, Factura, Publicacion, Cantidad, PrecioUnitario, Total, Estado, VisibleUsuario)
VALUES
(91001,90001,84001,1,250000,250000,'Pendiente',1),
(91002,90002,84002,2,80000,160000,'Pendiente',1);

-- =========================
-- detallefacturacomercio (2)
-- =========================
INSERT INTO detallefacturacomercio
(IdDetalleFacturaComercio, Factura, Publicacion, Cantidad, PrecioUnitario, Total, Estado, ConfirmacionUsuario, ConfirmacionComercio)
VALUES
(92001,90001,84001,1,250000,250000,'Pendiente','Pendiente','Pendiente'),
(92002,90002,84002,2,80000,160000,'Pendiente','Recibido','Entregado');

-- =========================
-- controlagendacomercio (2)
-- =========================
INSERT INTO controlagendacomercio
(IdSolicitud, Comercio, DetFacturacomercio, TipoServicio, ModoServicio, FechaServicio, HoraServicio, ComentariosAdicionales)
VALUES
(93001,72001,92001,3,'Visita al taller','2026-05-12','09:30:00','Revisión general'),
(93002,72002,92002,3,'Domicilio','2026-05-13','14:00:00','Cambio rápido');

-- =========================
-- centroayuda (2)
-- =========================
INSERT INTO centroayuda
(IdAyuda, Perfil, TipoSolicitud, Rol, Asunto, Descripcion, Respuesta, FechaRespuesta, Respondida)
VALUES
(94001,71001,'Sugerencia','Usuario Natural','Mejora app','Agregar filtros',NULL,NULL,'No'),
(94002,72001,'Queja','Comerciante','Publicación lenta','Demora al subir imagen','Estamos revisando','2026-05-06 13:00:00','Si');

-- =========================
-- opiniones (2)
-- =========================
INSERT INTO opiniones
(IdOpinion, UsuarioNatural, Publicacion, NombreUsuario, Comentario, Calificacion, FechaOpinion)
VALUES
(95001,71001,84001,'Daniel','Muy buen casco',5,'2026-05-06 14:00:00'),
(95002,71002,84002,'Paula','Buen servicio',4,'2026-05-06 14:30:00');

-- =========================
-- OpinionesGrua (2)
-- =========================
INSERT INTO OpinionesGrua
(IdOpinion, UsuarioNatural, PublicacionGrua, NombreUsuario, Comentario, Calificacion, Fecha)
VALUES
(96001,71001,86001,'Daniel','Llegó rápido',5,'2026-05-06 15:00:00'),
(96002,71002,86002,'Paula','Buen trato',4,'2026-05-06 15:20:00');

-- =========================
-- tokens_verificacion (2)
-- =========================
INSERT INTO tokens_verificacion
(IdToken, Usuario, Token, TipoToken, CodigoVerificacion, CodigoEnviado, CodigoVerificado, FechaCreacion, FechaExpiracion, Usado)
VALUES
(97001,71001,'tok_71001_a','RecuperarContrasena','1234','Si','No','2026-05-06 10:00:00','2026-05-06 12:00:00','No'),
(97002,72001,'tok_72001_b','CrearContrasena','5678','Si','Si','2026-05-06 10:30:00','2026-05-07 10:30:00','Si');

-- =========================
-- registros_pendientes (2)
-- =========================
INSERT INTO registros_pendientes
(IdRegistro, Token, IdUsuario, TipoUsuario, Nombre, Apellido, Documento, Telefono, Correo, FotoPerfil, DatosPerfil, CodigoVerificacion, CodigoEnviado, CodigoVerificado, FechaCreacion, FechaExpiracion, Estado)
VALUES
(98001,'pend_98001',81001,'Natural','Nuevo','Natural','DOC-98001','3010000001','nuevo.natural@rpm.com','n1.jpg','{\"Direccion\":\"Calle 7\",\"Barrio\":\"Centro\"}','1111','Si','No','2026-05-06 09:00:00','2026-05-07 09:00:00','Pendiente'),
(98002,'pend_98002',82001,'Comerciante','Nuevo','Comercio','DOC-98002','3010000002','nuevo.comercio@rpm.com','c1.jpg','{\"NombreComercio\":\"Nuevo Store\"}','2222','Si','Si','2026-05-06 09:15:00','2026-05-07 09:15:00','Completado');

-- =========================
-- historial_contrasenas (2)
-- =========================
INSERT INTO historial_contrasenas
(IdHistorial, Usuario, ContrasenaHash, FechaCambio)
VALUES
(99001,71001,'$2b$10$VhLHMPsGv1bAFuy563841uL2TCByD91qTuamg5IU2SpKvcnUTIO92','2026-05-06 08:00:00'),
(99002,72001,'$2b$10$VhLHMPsGv1bAFuy563841uL2TCByD91qTuamg5IU2SpKvcnUTIO92','2026-05-06 08:30:00');

COMMIT;