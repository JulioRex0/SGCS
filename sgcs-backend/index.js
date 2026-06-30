// index.js
const express = require('express');
const cors = require('cors');
const path = require('path'); 
const pool = require('./db');
require('dotenv').config();

// Librerías para encriptación y tokens
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => {
    res.send('Servidor del SGCS operando correctamente.');
});

const rutasAsientos = require('./asientos'); 
app.use('/api/asientos', rutasAsientos);

app.listen(PORT, () => {
    console.log(`Servidor backend corriendo en http://localhost:${PORT}`);
});

// POST inicio de sesión
app.post('/api/login', async (req, res) => {
    const { num_empleado, password } = req.body;


    if (!num_empleado || !password) {
        return res.status(400).json({ error: 'Por favor, ingresa tu usuario y contraseña.' });
    }

    try {
        const usuarioQuery = await pool.query(
            'SELECT * FROM usuarios WHERE num_empleado = $1 AND activo = true',
            [num_empleado]
        );

        if (usuarioQuery.rows.length === 0) {
            return res.status(401).json({ error: 'El número de empleado o la contraseña son incorrectos.' });
        }

        const usuario = usuarioQuery.rows[0];

        console.log("Datos del usuario de la Base de Datos:", usuario);

        const passwordCorrecto = await bcrypt.compare(password, usuario.password_hash);

        if (!passwordCorrecto) {
            return res.status(401).json({ error: 'El número de empleado o la contraseña son incorrectos.' });
        }


        const token = jwt.sign(
            { id_usuario: usuario.id_usuario, rol: usuario.rol },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({
            mensaje: '¡Inicio de sesión exitoso!',
            token,
            usuario: {
                num_empleado: usuario.num_empleado,
                nombre: usuario.nombre,
                rol: usuario.rol
            }
        });

    } catch (error) {
        console.error('Error en el servidor durante el login:', error);
        res.status(500).json({ error: 'Hubo un error interno en el servidor.' });
    }
});
//Fin del POST inicio de sesión

// POST Registro de nuevos empleados
app.post('/api/registro', async (req, res) => {
    const { num_empleado, nombre, password } = req.body;

    if (!num_empleado || !nombre || !password) {
        return res.status(400).json({ error: 'Por favor, rellena todos los campos obligatorios.' });
    }

    try {
        // Verificar si el número de empleado ya existe
        const existeQuery = await pool.query(
            'SELECT id_usuario FROM usuarios WHERE num_empleado = $1',
            [num_empleado]
        );

        if (existeQuery.rows.length > 0) {
            return res.status(400).json({ error: 'Este número de empleado ya está registrado.' });
        }

        // Encriptación de contraseña
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const nuevoUsuario = await pool.query(
            "INSERT INTO usuarios (num_empleado, nombre, password_hash, rol, activo) VALUES ($1, $2, $3, 'operativo', true) RETURNING id_usuario, nombre",
            [num_empleado, nombre, passwordHash]
        );

        res.status(201).json({
            mensaje: '¡Usuario registrado con éxito!',
            usuario: nuevoUsuario.rows[0]
        });

    } catch (error) {
        console.error('Error en el servidor durante el registro:', error);

        res.status(500).json({ error: error.message || 'Hubo un error al registrar al usuario.' });
    }
});

// PUT Actualizar únicamente el nombre del usuario logueado
app.put('/api/usuarios/:num_empleado', async (req, res) => {
    const { num_empleado } = req.params;
    const { nombre } = req.body;

    if (!nombre || nombre.trim() === '') {
        return res.status(400).json({ error: 'El nombre es obligatorio.' });
    }

    try {
        const resultado = await pool.query(
            'UPDATE usuarios SET nombre = $1 WHERE num_empleado = $2 RETURNING num_empleado, nombre, rol',
            [nombre, num_empleado]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        res.json({
            mensaje: '¡Perfil actualizado correctamente!',
            usuario: resultado.rows[0]
        });
    } catch (error) {
        console.error('Error al actualizar usuario en la base de datos:', error);
        res.status(500).json({ error: 'Hubo un error interno al guardar el nuevo nombre.' });
    }
});

// GET - Obtener todos los usuarios de la base de datos (Ordenados por nombre)
app.get('/api/usuarios', async (req, res) => {
    try {
        const resultado = await pool.query(
            'SELECT num_empleado, nombre, rol FROM usuarios ORDER BY nombre ASC'
        );
        
        console.log(`[BD] Usuarios enviados al frontend: ${resultado.rows.length} registros.`);
        res.json(resultado.rows);
    } catch (error) {
        console.error('Error al obtener usuarios en la BD:', error);
        res.status(500).json({ error: 'Error interno del servidor al consultar usuarios.' });
    }
});

// PUT - Actualizar exclusivamente el ROL de un usuario específico
app.put('/api/usuarios/:num_empleado/rol', async (req, res) => {
    const { num_empleado } = req.params;
    const { rol } = req.body;

    // Validación de roles permitidos
    if (!rol || !['supervisor', 'operativo'].includes(rol.toLowerCase())) {
        return res.status(400).json({ error: 'El rol especificado no es válido.' });
    }

    try {
        const resultado = await pool.query(
            'UPDATE usuarios SET rol = $1 WHERE num_empleado = $2 RETURNING num_empleado, nombre, rol',
            [rol.toLowerCase(), num_empleado]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: 'El empleado no existe.' });
        }

        res.json({
            mensaje: '¡Rol actualizado de forma exitosa!',
            usuario: resultado.rows[0]
        });
    } catch (error) {
        console.error('Error al actualizar rol en la BD:', error);
        res.status(500).json({ error: 'Error interno al actualizar el rol en la base de datos.' });
    }
});

// GET - Obtener la estructura y estados de una sala específica
app.get('/api/salas/:id', async (req, res) => {
    const { id } = req.params;

    try {
        // 1. Obtener los datos básicos de la sala
        const salaQuery = await pool.query(
            'SELECT id, numero, distribucion_filas FROM salas WHERE numero = $1', 
            [id]
        );

        if (salaQuery.rows.length === 0) {
            return res.status(404).json({ error: 'La sala especificada no existe.' });
        }

        const sala = salaQuery.rows[0];

        const asientosQuery = await pool.query(
            'SELECT fila, numero, estado FROM asientos_status WHERE sala_id = $1 AND estado != \'limpio\'',
            [sala.id]
        );

        const asientosMapa = {};
        asientosQuery.rows.forEach(asiento => {
            const llave = `${asiento.fila.trim()}-${asiento.numero}`;
            asientosMapa[llave] = { estado: asiento.estado };
        });

        res.json({
            sala: {
                id: sala.id,
                numero: sala.numero,
                distribucion_filas: sala.distribucion_filas
            },
            asientos: asientosMapa
        });

    } catch (error) {
        console.error('Error al obtener los detalles de la sala:', error);
        res.status(500).json({ error: 'Error interno del servidor al consultar la sala.' });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor de Cinépolis corriendo localmente en http://localhost:${PORT}`);
});