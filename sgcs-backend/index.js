// index.js
const express = require('express');
const cors = require('cors');
const pool = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Servidor del SGCS operando correctamente.');
});

// librerías para encriptación y tokens
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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


app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});