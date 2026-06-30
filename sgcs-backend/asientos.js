// asientos.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const pool = require('./db');

// ==========================================================================
// 📷 CONFIGURACIÓN DE ALMACENAMIENTO DE IMÁGENES (MULTER)
// ==========================================================================
const storage = multer.diskStorage({
    destination: (req, file, cb) => { 
        cb(null, 'uploads/'); 
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'evidencia-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// ==========================================================================
// 🚀 ENDPOINT: POST /api/asientos/reportar
// Registra el reporte maestro, sus múltiples incidencias y la foto
// ==========================================================================
router.post('/reportar', upload.single('foto'), async (req, res) => {
    const { salaId, fila, numero, descripcion } = req.body;
    
    let listaIncidencias = [];
    try {
        if (req.body.incidencias) {
            listaIncidencias = JSON.parse(req.body.incidencias);
        } else if (req.body.estado) {
            listaIncidencias = [req.body.estado]; 
        } else {
            return res.status(400).json({ ok: false, mensaje: 'Falta el campo de incidencias o estado' });
        }
    } catch (jsonError) {
        console.error('Error al parsear el JSON de incidencias:', jsonError);
        return res.status(400).json({ ok: false, mensaje: 'El formato de incidencias enviado no es válido' });
    }
    
    const id_usuario = req.usuario ? req.usuario.id : 1; 

    try {
        await pool.query('BEGIN'); 
        const queryMaestro = `
            INSERT INTO reporte_sala (id_sala, fila, numero, id_usuario, fecha_reporte)
            VALUES ($1, $2, $3, $4, NOW()) RETURNING id_reporte;
        `;
        const resMaestro = await pool.query(queryMaestro, [salaId, fila, numero, id_usuario]);
        const id_reporte = resMaestro.rows[0].id_reporte;

        const queryDetalle = `
            INSERT INTO detalles_reporte (id_reporte, tipo_incidencia, descripcion)
            VALUES ($1, $2, $3);
        `;
        for (let incidencia of listaIncidencias) {
            await pool.query(queryDetalle, [id_reporte, incidencia, descripcion]);
        }

        if (req.file) {
            const url_foto = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
            const queryEvidencia = `
                INSERT INTO evidencias (id_reporte, url_foto, fecha_subida)
                VALUES ($1, $2, NOW());
            `;
            await pool.query(queryEvidencia, [id_reporte, url_foto]);
        }

        await pool.query('COMMIT'); 
        res.status(201).json({ ok: true, mensaje: 'Reporte múltiple e imágenes registradas con éxito.' });

    } catch (error) {
        await pool.query('ROLLBACK'); 
        console.error('Error al procesar el reporte múltiple:', error);
        res.status(500).json({ ok: false, mensaje: 'Error interno del servidor al guardar' });
    }
});

// ==========================================================================
// 🔍 ENDPOINT: GET /api/asientos/sala/:salaId
// Obtiene de forma óptima el estado más reciente de cada butaca de una sala
// ==========================================================================
router.get('/sala/:salaId', async (req, res) => {
    const { salaId } = req.params;

    try {
        const query = `
            SELECT DISTINCT ON (rs.fila, rs.numero)
                rs.fila,
                rs.numero,
                dr.tipo_incidencia AS estado,
                dr.descripcion,
                e.url_foto AS foto_url
            FROM reporte_sala rs
            INNER JOIN detalles_reporte dr ON rs.id_reporte = dr.id_reporte
            LEFT JOIN evidencias e ON rs.id_reporte = e.id_reporte
            WHERE rs.id_sala = $1
            ORDER BY rs.fila, rs.numero, rs.id_reporte DESC, dr.id_detalle DESC;
        `;

        const { rows } = await pool.query(query, [salaId]);

        const asientosMapa = {};
        rows.forEach(asiento => {
            asientosMapa[`${asiento.fila}-${asiento.numero}`] = {
                estado: asiento.estado,
                descripcion: asiento.descripcion,
                foto_url: asiento.foto_url
            };
        });

        res.json({
            ok: true,
            asientos: asientosMapa
        });

    } catch (error) {
        console.error('Error al obtener el estado de los asientos:', error);
        res.status(500).json({ ok: false, mensaje: 'Error al consultar los estados de la sala' });
    }
});

module.exports = router;