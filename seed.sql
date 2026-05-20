USE rpmmarket;
START TRANSACTION;

INSERT INTO categoria (IdCategoria, NombreCategoria) VALUES
(1, 'Accesorios'),
(2, 'Repuestos'),
(3, 'Servicio mecanico'),
(4, 'Servicio de grua');

INSERT INTO usuario (
  IdUsuario, TipoUsuario, Nombre, Apellido, Documento, Telefono, Correo, FotoPerfil, Estado, ContrasenaCreada
)
SELECT
  9001, 'Administrador', 'Admin', 'RPM', '90010001', '3000000000', 'admin@rpm.cpm', 'default-admin.jpg', 'Activo', 'Si'
WHERE NOT EXISTS (
  SELECT 1 FROM usuario WHERE Correo = 'admin@rpm.cpm'
);

INSERT INTO credenciales (
  Usuario, NombreUsuario, Contrasena, ContrasenaTemporal
)
SELECT
  9001, 'admin@rpm.cpm', '$2b$10$IpRY4kM.dfyA58hhM5ak1ehScOWjcrauCaomRNWzMwDEdv90SdGmi', 'No'
WHERE NOT EXISTS (
  SELECT 1 FROM credenciales WHERE NombreUsuario = 'admin@rpm.cpm'
);

INSERT INTO historial_contrasenas (Usuario, ContrasenaHash)
SELECT 9001, '$2b$10$IpRY4kM.dfyA58hhM5ak1ehScOWjcrauCaomRNWzMwDEdv90SdGmi'
WHERE NOT EXISTS (
  SELECT 1 FROM historial_contrasenas WHERE Usuario = 9001
);

INSERT INTO usuario (
  IdUsuario, TipoUsuario, Nombre, Apellido, Documento, Telefono, Correo, FotoPerfil, Estado, ContrasenaCreada
)
SELECT 9101, 'Natural', 'Daniel', 'Rpm', '91010001', '3001000001', 'daniel@rpm.com', 'default-natural.jpg', 'Activo', 'Si'
WHERE NOT EXISTS (SELECT 1 FROM usuario WHERE Correo = 'daniel@rpm.com');

INSERT INTO perfilnatural (UsuarioNatural, Direccion, Barrio)
SELECT 9101, 'Calle 1 # 1-01', 'Centro'
WHERE NOT EXISTS (SELECT 1 FROM perfilnatural WHERE UsuarioNatural = 9101);

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

INSERT INTO credenciales (Usuario, NombreUsuario, Contrasena, ContrasenaTemporal)
SELECT 9101, 'daniel@rpm.com', '$2b$10$IpRY4kM.dfyA58hhM5ak1ehScOWjcrauCaomRNWzMwDEdv90SdGmi', 'No'
WHERE NOT EXISTS (SELECT 1 FROM credenciales WHERE NombreUsuario = 'daniel@rpm.com');

INSERT INTO credenciales (Usuario, NombreUsuario, Contrasena, ContrasenaTemporal)
SELECT 9102, 'sebastian@rpm.com', '$2b$10$IpRY4kM.dfyA58hhM5ak1ehScOWjcrauCaomRNWzMwDEdv90SdGmi', 'No'
WHERE NOT EXISTS (SELECT 1 FROM credenciales WHERE NombreUsuario = 'sebastian@rpm.com');

INSERT INTO credenciales (Usuario, NombreUsuario, Contrasena, ContrasenaTemporal)
SELECT 9103, 'nicolas@rpm.com', '$2b$10$IpRY4kM.dfyA58hhM5ak1ehScOWjcrauCaomRNWzMwDEdv90SdGmi', 'No'
WHERE NOT EXISTS (SELECT 1 FROM credenciales WHERE NombreUsuario = 'nicolas@rpm.com');

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

INSERT INTO credenciales
(Usuario, NombreUsuario, Contrasena, ContrasenaTemporal)
VALUES
(71001,'daniel.test@rpm.com','$2b$10$IpRY4kM.dfyA58hhM5ak1ehScOWjcrauCaomRNWzMwDEdv90SdGmi','No'),
(71002,'paula.test@rpm.com','$2b$10$IpRY4kM.dfyA58hhM5ak1ehScOWjcrauCaomRNWzMwDEdv90SdGmi','No'),
(72001,'sebastian.test@rpm.com','$2b$10$IpRY4kM.dfyA58hhM5ak1ehScOWjcrauCaomRNWzMwDEdv90SdGmi','No'),
(72002,'valentina.test@rpm.com','$2b$10$IpRY4kM.dfyA58hhM5ak1ehScOWjcrauCaomRNWzMwDEdv90SdGmi','No'),
(73001,'nicolas.test@rpm.com','$2b$10$IpRY4kM.dfyA58hhM5ak1ehScOWjcrauCaomRNWzMwDEdv90SdGmi','No'),
(73002,'andres.test@rpm.com','$2b$10$IpRY4kM.dfyA58hhM5ak1ehScOWjcrauCaomRNWzMwDEdv90SdGmi','No'),
(79001,'admin1.test@rpm.com','$2b$10$IpRY4kM.dfyA58hhM5ak1ehScOWjcrauCaomRNWzMwDEdv90SdGmi','No'),
(79002,'admin2.test@rpm.com','$2b$10$IpRY4kM.dfyA58hhM5ak1ehScOWjcrauCaomRNWzMwDEdv90SdGmi','No');

INSERT INTO perfilnatural (UsuarioNatural, Direccion, Barrio) VALUES
(71001,'Calle 10 # 20-30','Centro'),
(71002,'Carrera 5 # 11-22','La Playa');

INSERT INTO comerciante
(NitComercio, Comercio, NombreComercio, Direccion, Latitud, Longitud, Barrio, RedesSociales, DiasAtencion, HoraInicio, HoraFin)
VALUES
(82001,72001,'Moto Repuestos Sebas','Av 1 # 2-3',7.8895000,-72.4967000,'Centro','@sebasmotos','Lunes-Sabado','08:00:00','18:00:00'),
(82002,72002,'Taller Valen','Av 4 # 5-6',7.9000000,-72.5000000,'San Luis','@tallervalen','Lunes-Viernes','09:00:00','17:30:00');

INSERT INTO prestadorservicio
(IdServicio, Usuario, Direccion, Barrio, RedesSociales, Certificado, DiasAtencion, HoraInicio, HoraFin)
VALUES
(83001,73001,'Calle 3 # 8-9','Centro','@gruanico','cert-83001.pdf','Lunes-Domingo','06:00:00','22:00:00'),
(83002,73002,'Carrera 9 # 1-2','San Mateo','@gruaandres','cert-83002.pdf','Lunes-Sabado','07:00:00','20:00:00');

INSERT INTO publicacion
(IdPublicacion, Comerciante, NombreProducto, Descripcion, Categoria, Precio, Stock, ImagenProducto)
VALUES
(84001,82001,'Casco Integral','Casco certificado',1,250000,10,'casco.jpg'),
(84002,82002,'Cambio de Aceite','Servicio completo',3,80000,50,'aceite.jpg');

INSERT INTO producto
(IdProducto, PublicacionComercio, NombreProducto, Descripcion, IdCategoria, Precio, Stock, ImagenProducto)
VALUES
(85001,84001,'Casco Integral X','Talla M',1,255000,8,'casco-x.jpg'),
(85002,84002,'Aceite 4T','Marca RPM',2,45000,30,'aceite-4t.jpg');

INSERT INTO publicaciongrua
(IdPublicacionGrua, Servicio, DescripcionServicio, TarifaBase, ZonaCobertura, FotoPublicacion, TituloPublicacion)
VALUES
(86001,83001,'Servicio de grua urbana',50000,'Cucuta centro','grua1.jpg','Grua urbana 24/7'),
(86002,83002,'Traslado intermunicipal',90000,'Area metropolitana','grua2.jpg','Grua intermunicipal');

INSERT INTO controlagendaservicios
(IdSolicitudServicio, UsuarioNatural, PublicacionGrua, FechaServicio, HoraServicio, DireccionRecogida, Destino, ComentariosAdicionales, Estado, FechaModificadaPor, NotificacionVista)
VALUES
(87001,71001,86001,'2026-05-10','10:00:00','Calle 1','Taller Centro','Pinchazo','Pendiente',NULL,FALSE),
(87002,71002,86002,'2026-05-11','15:30:00','Av 5','Barrio Norte','Moto apagada','En revision','2026-05-06 12:00:00',TRUE);

INSERT INTO historialservicios (IdHistorial, SolicitudServicio) VALUES
(88001,87001),
(88002,87002);

INSERT INTO carrito
(IdCarrito, UsuarioNat, Publicacion, Cantidad, SubTotal, Estado)
VALUES
(89001,71001,84001,1,250000,'Pendiente'),
(89002,71002,84002,2,160000,'Procesado');

INSERT INTO factura
(IdFactura, Usuario, FechaCompra, TotalPago, MetodoPago, Estado)
VALUES
(90001,71001,'2026-05-06 10:00:00',250000,'Efectivo','Pago exitoso'),
(90002,71002,'2026-05-06 11:00:00',160000,'Tarjeta','Proceso pendiente');

INSERT INTO detallefactura
(IdDetalleFactura, Factura, Publicacion, Cantidad, PrecioUnitario, Total, Estado, VisibleUsuario)
VALUES
(91001,90001,84001,1,250000,250000,'Pendiente',1),
(91002,90002,84002,2,80000,160000,'Pendiente',1);

INSERT INTO detallefacturacomercio
(IdDetalleFacturaComercio, Factura, Publicacion, Cantidad, PrecioUnitario, Total, Estado, ConfirmacionUsuario, ConfirmacionComercio)
VALUES
(92001,90001,84001,1,250000,250000,'Pendiente','Pendiente','Pendiente'),
(92002,90002,84002,2,80000,160000,'Pendiente','Recibido','Entregado');

INSERT INTO controlagendacomercio
(IdSolicitud, Comercio, DetFacturacomercio, TipoServicio, ModoServicio, FechaServicio, HoraServicio, ComentariosAdicionales)
VALUES
(93001,72001,92001,3,'Visita al taller','2026-05-12','09:30:00','Revisión general'),
(93002,72002,92002,3,'Domicilio','2026-05-13','14:00:00','Cambio rápido');

INSERT INTO centroayuda
(IdAyuda, Perfil, TipoSolicitud, Rol, Asunto, Descripcion, Respuesta, FechaRespuesta, Respondida)
VALUES
(94001,71001,'Sugerencia','Usuario Natural','Mejora app','Agregar filtros',NULL,NULL,'No'),
(94002,72001,'Queja','Comerciante','Publicación lenta','Demora al subir imagen','Estamos revisando','2026-05-06 13:00:00','Si');

INSERT INTO opiniones
(IdOpinion, UsuarioNatural, Publicacion, NombreUsuario, Comentario, Calificacion, FechaOpinion)
VALUES
(95001,71001,84001,'Daniel','Muy buen casco',5,'2026-05-06 14:00:00'),
(95002,71002,84002,'Paula','Buen servicio',4,'2026-05-06 14:30:00');

INSERT INTO OpinionesGrua
(IdOpinion, UsuarioNatural, PublicacionGrua, NombreUsuario, Comentario, Calificacion, Fecha)
VALUES
(96001,71001,86001,'Daniel','Llegó rápido',5,'2026-05-06 15:00:00'),
(96002,71002,86002,'Paula','Buen trato',4,'2026-05-06 15:20:00');

INSERT INTO tokens_verificacion
(IdToken, Usuario, Token, TipoToken, CodigoVerificacion, CodigoEnviado, CodigoVerificado, FechaCreacion, FechaExpiracion, Usado)
VALUES
(97001,71001,'tok_71001_a','RecuperarContrasena','1234','Si','No','2026-05-06 10:00:00','2026-05-06 12:00:00','No'),
(97002,72001,'tok_72001_b','CrearContrasena','5678','Si','Si','2026-05-06 10:30:00','2026-05-07 10:30:00','Si');

INSERT INTO registros_pendientes
(IdRegistro, Token, IdUsuario, TipoUsuario, Nombre, Apellido, Documento, Telefono, Correo, FotoPerfil, DatosPerfil, CodigoVerificacion, CodigoEnviado, CodigoVerificado, FechaCreacion, FechaExpiracion, Estado)
VALUES
(98001,'pend_98001',81001,'Natural','Nuevo','Natural','DOC-98001','3010000001','nuevo.natural@rpm.com','n1.jpg','{"Direccion":"Calle 7","Barrio":"Centro"}','1111','Si','No','2026-05-06 09:00:00','2026-05-07 09:00:00','Pendiente'),
(98002,'pend_98002',82001,'Comerciante','Nuevo','Comercio','DOC-98002','3010000002','nuevo.comercio@rpm.com','c1.jpg','{"NombreComercio":"Nuevo Store"}','2222','Si','Si','2026-05-06 09:15:00','2026-05-07 09:15:00','Completado');

INSERT INTO historial_contrasenas
(IdHistorial, Usuario, ContrasenaHash, FechaCambio)
VALUES
(99001,71001,'$2b$10$IpRY4kM.dfyA58hhM5ak1ehScOWjcrauCaomRNWzMwDEdv90SdGmi','2026-05-06 08:00:00'),
(99002,72001,'$2b$10$IpRY4kM.dfyA58hhM5ak1ehScOWjcrauCaomRNWzMwDEdv90SdGmi','2026-05-06 08:30:00');

COMMIT;