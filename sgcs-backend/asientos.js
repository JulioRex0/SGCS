const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const pool = require('./db');
const jwt = require('jsonwebtoken');
const fs = require('fs');

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
// ENDPOINT: POST /api/asientos/reportar
// ==========================================================================
router.post('/reportar', upload.array('fotos', 5), async (req, res) => {
    const { salaId, fila, numero, descripcion, eliminarFotosExistentes } = req.body;

    let idUsuario = null;
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'tu_firma_secreta');
            idUsuario = decoded.id || decoded.id_usuario;
        }
    } catch (e) {
        console.error('No se pudo extraer el usuario del token:', e.message);
    }

    if (!idUsuario) {
        idUsuario = 1;
    }

    let incidencias = [];
    try {
        if (typeof req.body.incidencias === 'string') {
            incidencias = JSON.parse(req.body.incidencias);
        } else if (Array.isArray(req.body.incidencias)) {
            incidencias = req.body.incidencias;
        }
    } catch (e) {
        incidencias = [req.body.estado || 'limpio'];
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const tieneMantenimiento = incidencias.includes('mantenimiento');
        const tieneSuciedad = incidencias.some(i => i && i.startsWith('sucio'));

        let estadoMaestro = 'limpio';
        if (tieneMantenimiento && tieneSuciedad) {
            estadoMaestro = 'mixto-mantenimiento-sucio';
        } else if (tieneMantenimiento) {
            estadoMaestro = 'mantenimiento';
        } else if (tieneSuciedad) {
            estadoMaestro = 'sucio';
        }

        const buscarQuery = `
            SELECT id_reporte FROM reporte_sala 
            WHERE id_sala = $1 AND fila = $2 AND numero = $3;
        `;
        const existeReporte = await client.query(buscarQuery, [salaId, fila, numero]);

        let idReporte;

        if (existeReporte.rows.length > 0) {
            idReporte = existeReporte.rows[0].id_reporte;

            const usuarioRes = await client.query('SELECT rol FROM usuarios WHERE id_usuario = $1', [idUsuario]);
            const rolUsuario = usuarioRes.rows[0]?.rol?.toLowerCase().trim();

            if (rolUsuario !== 'supervisor') {
                // Consultamos si el reporte existente tiene algún tipo de suciedad
                const detallesPrevios = await client.query(
                    'SELECT tipo_incidencia FROM detalles_reporte WHERE id_reporte = $1', 
                    [idReporte]
                );
                const listaPrevias = detallesPrevios.rows.map(r => r.tipo_incidencia);
                const teniaSuciedad = listaPrevias.some(i => i && i.startsWith('sucio'));

                // Si tenía suciedad asignada previamente, se le bloquea al operativo.
                if (teniaSuciedad) {
                    await client.query('ROLLBACK');
                    return res.status(403).json({ error: 'Acción no permitida. Las butacas con suciedad solo pueden ser modificadas por un supervisor.' });
                }
            }

            const updateQuery = `
                UPDATE reporte_sala 
                SET fecha_reporte = NOW(), id_usuario = $2
                WHERE id_reporte = $1;
            `;
            await client.query(updateQuery, [idReporte, idUsuario]);
        } else {
            const insertQuery = `
                INSERT INTO reporte_sala (id_sala, fila, numero, id_usuario, fecha_reporte)
                VALUES ($1, $2, $3, $4, NOW())
                RETURNING id_reporte;
            `;
            const resInsert = await client.query(insertQuery, [salaId, fila, numero, idUsuario]);
            idReporte = resInsert.rows[0].id_reporte;
        }

        await client.query('DELETE FROM detalles_reporte WHERE id_reporte = $1', [idReporte]);

        const queryDetalle = `
            INSERT INTO detalles_reporte (id_reporte, tipo_incidencia, descripcion)
            VALUES ($1, $2, $3);
        `;
        for (const incidencia of incidencias) {
            await client.query(queryDetalle, [idReporte, incidencia, descripcion || '']);
        }

        // PROCESAMIENTO MULTI-FOTO EN DISCO Y BASE DE DATOS
        if (eliminarFotosExistentes === 'true') {
            const resFotos = await client.query('SELECT url_foto FROM evidencias WHERE id_reporte = $1', [idReporte]);
            resFotos.rows.forEach(row => {
                if (row.url_foto && fs.existsSync(row.url_foto)) {
                    fs.unlinkSync(row.url_foto);
                }
            });
            await client.query('DELETE FROM evidencias WHERE id_reporte = $1', [idReporte]);
        }

        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const urlFoto = file.path.replace(/\\/g, '/');
                const queryEvidencia = `
                    INSERT INTO evidencias (id_reporte, url_foto, fecha_subida)
                    VALUES ($1, $2, NOW());
                `;
                await client.query(queryEvidencia, [idReporte, urlFoto]);
            }
            console.log(`${req.files.length} fotos guardadas con éxito.`);
        }

        await client.query('COMMIT');
        res.status(200).json({ message: 'Reporte guardado con éxito', estado: estadoMaestro });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al guardar reporte:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    } finally {
        client.release();
    }
});

// ==========================================================================
// ENDPOINT: GET /api/asientos/sala/:salaId
// ==========================================================================
router.get('/sala/:salaId', async (req, res) => {
    const { salaId } = req.params;

    try {
        const query = `
            SELECT 
                rs.fila, 
                rs.numero, 
                ARRAY_AGG(DISTINCT dr.tipo_incidencia) as incidencias,
                MAX(dr.descripcion) as descripcion,
                ARRAY_AGG(DISTINCT ev.url_foto) FILTER (WHERE ev.url_foto IS NOT NULL) as fotos
            FROM reporte_sala rs
            LEFT JOIN detalles_reporte dr ON rs.id_reporte = dr.id_reporte
            LEFT JOIN evidencias ev ON rs.id_reporte = ev.id_reporte
            WHERE rs.id_sala = $1
            GROUP BY rs.id_reporte, rs.fila, rs.numero;
        `;

        const resultado = await pool.query(query, [salaId]);
        const asientosMapa = {};

        resultado.rows.forEach(row => {
            const llave = `${row.fila}-${row.numero}`;
            const lista = row.incidencias || [];

            const listaSuciedades = lista.filter(i => i && i.startsWith('sucio'));
            const tieneMantenimiento = lista.includes('mantenimiento');
            const tieneSuciedad = listaSuciedades.length > 0;

            let estadoCalculado = 'limpio';

            if (tieneMantenimiento && tieneSuciedad) {
                estadoCalculado = 'mixto-mantenimiento-sucio';
            } else if (tieneMantenimiento) {
                estadoCalculado = 'mantenimiento';
            } else if (tieneSuciedad) {
                if (listaSuciedades.length >= 2) {
                    estadoCalculado = 'sucio';
                } else {
                    estadoCalculado = listaSuciedades[0];
                }
            }

            asientosMapa[llave] = {
                estado: estadoCalculado,
                incidencias: lista,
                descripcion: row.descripcion || '',
                url_fotos: row.fotos || [] 
            };
        });

        res.status(200).json({ asientos: asientosMapa });

    } catch (error) {
        console.error('Error al obtener el estado de la sala:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ==========================================================================
// ENDPOINT: POST /api/asientos/liberar-butaca
// ==========================================================================
router.post('/liberar-butaca', async (req, res) => {
    const { salaId, fila, numero } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const buscarReporte = `
            SELECT id_reporte FROM reporte_sala 
            WHERE id_sala = $1 AND fila = $2 AND numero = $3;
        `;
        const resReporte = await client.query(buscarReporte, [salaId, fila, numero]);

        if (resReporte.rows.length > 0) {
            const idReporte = resReporte.rows[0].id_reporte;

            const resFotos = await client.query('SELECT url_foto FROM evidencias WHERE id_reporte = $1', [idReporte]);
            resFotos.rows.forEach(row => {
                if (row.url_foto && fs.existsSync(row.url_foto)) {
                    fs.unlinkSync(row.url_foto);
                }
            });

            await client.query('DELETE FROM evidencias WHERE id_reporte = $1', [idReporte]);
            await client.query('DELETE FROM detalles_reporte WHERE id_reporte = $1', [idReporte]);
            await client.query('DELETE FROM reporte_sala WHERE id_reporte = $1', [idReporte]);
        }

        await client.query('COMMIT');
        res.status(200).json({ message: 'Butaca individual limpiada y liberada del almacenamiento.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al limpiar la butaca de forma individual:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    } finally {
        client.release();
    }
});

// ==========================================================================
// ENDPOINT: DELETE /api/asientos/sala/:salaId/liberar
// ==========================================================================
router.delete('/sala/:salaId/liberar', async (req, res) => {
    const { salaId } = req.params;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const buscarReportesQuery = `SELECT id_reporte FROM reporte_sala WHERE id_sala = $1;`;
        const reportesRes = await client.query(buscarReportesQuery, [salaId]);

        if (reportesRes.rows.length > 0) {
            const idsReportes = reportesRes.rows.map(r => r.id_reporte);

            const fotosRes = await client.query(`SELECT url_foto FROM evidencias WHERE id_reporte = ANY($1);`, [idsReportes]);
            fotosRes.rows.forEach(row => {
                if (row.url_foto && fs.existsSync(row.url_foto)) {
                    fs.unlinkSync(row.url_foto);
                }
            });

            await client.query(`DELETE FROM evidencias WHERE id_reporte = ANY($1);`, [idsReportes]);

            const borrarDetallesQuery = `
                DELETE FROM detalles_reporte 
                WHERE id_reporte = ANY($1) AND tipo_incidencia LIKE 'sucio%';
            `;
            await client.query(borrarDetallesQuery, [idsReportes]);

            const limpiarReportesVaciosQuery = `
                DELETE FROM reporte_sala 
                WHERE id_sala = $1 AND id_reporte NOT IN (
                    SELECT DISTINCT id_reporte FROM detalles_reporte
                );
            `;
            await client.query(limpiarReportesVaciosQuery, [salaId]);
        }

        await client.query('COMMIT');
        res.status(200).json({ message: 'Sala liberada de suciedad de forma masiva y espacio en disco purgado.' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al liberar la sala masivamente:', error);
        res.status(500).json({ error: 'Error interno del servidor al liberar la sala' });
    } finally {
        client.release();
    }
});

module.exports = router;