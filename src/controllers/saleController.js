const Sale = require('../models/Sale');
const Product = require('../models/Product');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const saleController = {
    // Obtener todas las ventas
    async getSales(req, res) {
        try {
            console.log('Obteniendo todas las ventas...');
            const sales = await Sale.find()
                .populate('productos.producto', 'nombre precio')
                .sort({ fecha: -1 });
            console.log(`Ventas encontradas: ${sales.length}`);
            res.json(sales);
        } catch (error) {
            console.error('Error al obtener ventas:', error);
            res.status(500).json({ message: 'Error al obtener ventas' });
        }
    },

    // Crear una nueva venta
    async createSale(req, res) {
        try {
            console.log('Creando nueva venta...');
            console.log('Datos recibidos:', req.body);

            const { productos, total } = req.body;

            if (!productos || !Array.isArray(productos) || productos.length === 0) {
                console.error('Error de validación: No hay productos en la venta');
                return res.status(400).json({
                    message: 'La venta debe incluir al menos un producto'
                });
            }

            // Validar el total (aunque el backend lo recalcula, es buena práctica validar el input inicial)
            if (total === undefined || total === null || total <= 0) { // Permitir total = 0 para casos especiales si es necesario, pero validar > 0 para ventas normales
                 console.error('Error de validación: Total de venta no válido o faltante');
                 return res.status(400).json({ 
                     message: 'El total de la venta proporcionado no es válido' 
                 });
            }

            const productosVenta = [];
            let totalCalculado = 0;

            console.log('Iniciando procesamiento de productos...');
            // Validar y procesar cada producto
            for (const item of productos) {
                console.log(`Procesando producto con ID: ${item.producto}, cantidad: ${item.cantidad}`);
                if (!item.producto || !item.cantidad) {
                    console.error('Error de validación: Producto o cantidad faltante en un item');
                    return res.status(400).json({
                        message: 'Cada producto debe tener un ID y una cantidad'
                    });
                }

                // Asegurarse de que el ID del producto es un ObjectId válido antes de buscar
                if (!mongoose.Types.ObjectId.isValid(item.producto)) {
                    console.error(`Error de validación: ID de producto inválido: ${item.producto}`);
                    return res.status(400).json({ message: 'ID de producto inválido' });
                }

                const producto = await Product.findById(item.producto);

                if (!producto) {
                    console.error(`Error: Producto no encontrado con ID ${item.producto}`);
                    return res.status(404).json({
                        message: `Producto no encontrado: ${item.producto}`
                    });
                }

                // Usar el precio del producto de la BD en lugar del que viene en el body para mayor seguridad/consistencia
                const itemPrecioUnitario = producto.precio;
                const subtotal = itemPrecioUnitario * item.cantidad;
                totalCalculado += subtotal;

                // Verificar stock
                if (producto.cantidad < item.cantidad) {
                    console.error(`Error: Stock insuficiente para ${producto.nombre}. Disponible: ${producto.cantidad}`);
                    return res.status(400).json({
                        message: `Stock insuficiente para ${producto.nombre}. Disponible: ${producto.cantidad}`
                    });
                }

                productosVenta.push({
                    producto: producto._id,
                    cantidad: item.cantidad,
                    precioUnitario: itemPrecioUnitario,
                    subtotal: subtotal
                });

                // Actualizar el stock del producto
                console.log(`Actualizando stock para ${producto.nombre}. Nuevo stock: ${producto.cantidad - item.cantidad}`);
                producto.cantidad -= item.cantidad;
                await producto.save();
                console.log(`Stock de ${producto.nombre} actualizado.`);
            }

            console.log('Productos procesados. Total calculado:', totalCalculado);
            // Verificar que el total coincida (usando una pequeña tolerancia para flotantes)
            if (Math.abs(totalCalculado - total) > 0.01) {
                console.error(`Error de validación: El total calculado ($${totalCalculado.toFixed(2)}) no coincide con el total proporcionado ($${total.toFixed(2)})`);
                return res.status(400).json({
                    message: 'El total calculado no coincide con el total proporcionado'
                });
            }

            console.log('Creando instancia de nueva venta...');
            // Crear la venta (sin numeroTicket por ahora)
            const newSale = new Sale({
                productos: productosVenta,
                total: totalCalculado
            });

            console.log('Guardando nueva venta (primer guardado)...');
            await newSale.save(); // Primer guardado para obtener el _id
            console.log('Venta guardada con ID:', newSale._id);

            // --- Generar PDF del ticket automáticamente después del primer guardado ---
            // Ejecutar la generación de PDF y el guardado de pdfUrl de forma asíncrona pero sin bloquear la respuesta INICIAL
            // Esto significa que la respuesta al frontend puede llegar antes de que el PDF esté listo.
            // El frontend deberá manejar el caso donde pdfUrl es temporalmente nulo o usar la ruta de generación bajo demanda.
            (async () => {
                try {
                    console.log(`Iniciando generación de PDF en segundo plano para venta: ${newSale._id}...`);
                    const doc = new PDFDocument();
                    const ticketsDir = path.join(__dirname, '../../tickets');

                    if (!fs.existsSync(ticketsDir)) {
                        fs.mkdirSync(ticketsDir, { recursive: true });
                    }

                    const filename = `ticket_${newSale._id}.pdf`;
                    const filePath = path.join(ticketsDir, filename);
                    const stream = fs.createWriteStream(filePath);

                    stream.on('finish', async () => {
                        try {
                            console.log(`PDF para venta ${newSale._id} generado y guardado en ${filePath}.`);
                            const pdfUrl = `/tickets/${filename}`;
                            // Cargar el documento de venta nuevamente para actualizarlo con la url del PDF
                            const saleToUpdate = await Sale.findById(newSale._id);
                            if(saleToUpdate) {
                                saleToUpdate.pdfUrl = pdfUrl;
                                console.log(`Actualizando venta ${saleToUpdate._id} con pdfUrl: ${saleToUpdate.pdfUrl}... (segundo guardado)`);
                                await saleToUpdate.save();
                                console.log(`Venta ${saleToUpdate._id} actualizada exitosamente.`);
                            } else {
                                console.error(`Error: Venta ${newSale._id} no encontrada para actualizar con pdfUrl.`);
                            }
                        } catch (updateError) {
                            console.error(`Error al actualizar la venta ${newSale._id} con pdfUrl:`, updateError);
                        }
                    });

                    stream.on('error', (streamError) => {
                         console.error(`Error en el stream de escritura del PDF para venta ${newSale._id}:`, streamError);
                    });

                    doc.pipe(stream);

                    // Contenido del PDF
                    doc.fontSize(25).text('Ticket de Venta', { align: 'center' });
                    doc.moveDown();
                    doc.fontSize(12).text(`Número: ${newSale.numeroTicket || newSale._id}`, { align: 'center' });
                    doc.text(`Fecha: ${new Date(newSale.fecha).toLocaleString()}`, { align: 'center' });
                    doc.moveDown();

                    const tableTop = doc.y;
                    const itemX = 50;
                    const quantityX = 250;
                    const priceX = 350;
                    const subtotalX = 450;

                    doc.fontSize(12).text('Producto', itemX, tableTop);
                    doc.text('Cantidad', quantityX, tableTop);
                    doc.text('Precio Unit.', priceX, tableTop);
                    doc.text('Subtotal', subtotalX, tableTop);
                    doc.moveDown();

                    let y = doc.y;
                     // Para el PDF, necesitamos los detalles del producto (nombre). Populamos la venta recién guardada.
                    const saleWithProductDetails = await Sale.findById(newSale._id).populate('productos.producto', 'nombre');
                    if (!saleWithProductDetails) {
                         console.error('Error al obtener detalles de la venta para generar PDF');
                    } else {
                         saleWithProductDetails.productos.forEach(item => {
                             doc.text(item.producto.nombre, itemX, y);
                             doc.text(item.cantidad.toString(), quantityX, y);
                             doc.text(`$${item.precioUnitario.toFixed(2)}`, priceX, y);
                             doc.text(`$${item.subtotal.toFixed(2)}`, subtotalX, y);
                             y += 20;
                         });
                    }

                    doc.y = y + 10;
                    doc.fontSize(16).text(`Total: $${newSale.total.toFixed(2)}`, { align: 'right' });
                    doc.moveDown();

                    if (newSale.observaciones) {
                        doc.fontSize(12).text(`Observaciones: ${newSale.observaciones}`);
                        doc.moveDown();
                    }

                    doc.fontSize(12).text('¡Gracias por su compra!', { align: 'center' });

                    doc.end(); // Finaliza el PDF y el stream

                } catch (pdfGenError) {
                     console.error(`Error en la generación de PDF para venta ${newSale._id}:`, pdfGenError);
                }
            })(); // Ejecutar la función asíncrona inmediatamente

            // Obtener la venta (puede que la pdfUrl aún no esté si el PDF no ha terminado)
            const saleDetailsForResponse = await Sale.findById(newSale._id)
                .populate('productos.producto', 'nombre precio');

            console.log('Preparando respuesta para el frontend con detalles de la venta (puede que pdfUrl sea nulo inicialmente):', saleDetailsForResponse);
            res.status(201).json(saleDetailsForResponse); // Responder inmediatamente con lo que tenemos

        } catch (error) {
            console.error('Error interno al crear venta:', error);
            res.status(500).json({
                message: 'Error al crear venta',
                error: error.message
            });
        }
    },

    // Obtener una venta específica
    async getSale(req, res) {
        try {
            const { id } = req.params;
            console.log(`Obteniendo venta: ${id}`);

            // Popula productos para asegurar que los detalles estén disponibles si es necesario
            const sale = await Sale.findById(id)
                .populate('productos.producto', 'nombre precio');

            if (!sale) {
                return res.status(404).json({ message: 'Venta no encontrada' });
            }

            res.json(sale);
        } catch (error) {
            console.error('Error al obtener venta:', error);
            res.status(500).json({ message: 'Error al obtener venta' });
        }
    },

    // Generar reporte de ventas
    async generateSalesReport(req, res) {
        try {
            const { fechaInicio, fechaFin } = req.query;
            console.log('Generando reporte de ventas...');
            console.log('Filtros:', { fechaInicio, fechaFin });

            let query = {};
            if (fechaInicio && fechaFin) {
                query.fecha = {
                    $gte: new Date(fechaInicio),
                    $lte: new Date(fechaFin)
                };
            }

            const sales = await Sale.find(query)
                .populate('productos.producto', 'nombre precio')
                .sort({ fecha: -1 });

            console.log(`Ventas encontradas para el reporte: ${sales.length}`);

            const reporte = {
                totalVentas: sales.length,
                ventasPorProducto: {},
                totalIngresos: 0
            };

            sales.forEach(venta => {
                reporte.totalIngresos += venta.total;
                venta.productos.forEach(item => {
                    const nombreProducto = item.producto.nombre;
                    if (!reporte.ventasPorProducto[nombreProducto]) {
                        reporte.ventasPorProducto[nombreProducto] = {
                            cantidad: 0,
                            ingresos: 0
                        };
                    }
                    reporte.ventasPorProducto[nombreProducto].cantidad += item.cantidad;
                    reporte.ventasPorProducto[nombreProducto].ingresos += item.subtotal;
                });
            });

            // Generar el HTML del reporte
            const reporteHtml = generateReporteHtml(reporte, sales);
            
            // Guardar el reporte en un archivo
            const reportesDir = path.join(__dirname, '../../reportes');
            if (!fs.existsSync(reportesDir)) {
                fs.mkdirSync(reportesDir, { recursive: true });
            }
            
            const reportePath = path.join(reportesDir, `reporte_${new Date().toISOString().split('T')[0]}.html`);
            fs.writeFileSync(reportePath, reporteHtml);

            console.log('Reporte generado exitosamente');
            res.json({
                ...reporte,
                reporteUrl: `/reportes/reporte_${new Date().toISOString().split('T')[0]}.html`
            });
        } catch (error) {
            console.error('Error al generar reporte de ventas:', error);
            res.status(500).json({ message: 'Error al generar reporte de ventas' });
        }
    }
};

// Función para generar el HTML del ticket
function generateTicketHtml(venta) {
    return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Ticket de Venta ${venta.numeroTicket}</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
            }
            .ticket {
                border: 1px solid #ddd;
                padding: 20px;
                border-radius: 5px;
            }
            .header {
                text-align: center;
                margin-bottom: 20px;
            }
            .productos {
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
            }
            .productos th, .productos td {
                border: 1px solid #ddd;
                padding: 8px;
                text-align: left;
            }
            .total {
                text-align: right;
                font-weight: bold;
                margin-top: 20px;
            }
            .footer {
                text-align: center;
                margin-top: 20px;
                font-size: 0.8em;
                color: #666;
            }
        </style>
    </head>
    <body>
        <div class="ticket">
            <div class="header">
                <h1>Ticket de Venta</h1>
                <p>Número: ${venta.numeroTicket}</p>
                <p>Fecha: ${new Date(venta.fecha).toLocaleString()}</p>
            </div>
            <table class="productos">
                <thead>
                    <tr>
                        <th>Producto</th>
                        <th>Cantidad</th>
                        <th>Precio Unit.</th>
                        <th>Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${venta.productos.map(item => `
                        <tr>
                            <td>${item.producto.nombre}</td>
                            <td>${item.cantidad}</td>
                            <td>$${item.precioUnitario}</td>
                            <td>$${item.subtotal}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div class="total">
                <p>Total: $${venta.total}</p>
            </div>
            ${venta.observaciones ? `
                <div class="observaciones">
                    <p><strong>Observaciones:</strong> ${venta.observaciones}</p>
                </div>
            ` : ''}
            <div class="footer">
                <p>¡Gracias por su compra!</p>
            </div>
        </div>
    </body>
    </html>
    `;
}

// Función para generar el HTML del reporte
function generateReporteHtml(reporte, ventas) {
    return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reporte de Ventas</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                max-width: 1200px;
                margin: 0 auto;
                padding: 20px;
            }
            .reporte {
                border: 1px solid #ddd;
                padding: 20px;
                border-radius: 5px;
            }
            .header {
                text-align: center;
                margin-bottom: 20px;
            }
            .resumen {
                margin: 20px 0;
                padding: 20px;
                background-color: #f9f9f9;
                border-radius: 5px;
            }
            .ventas {
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
            }
            .ventas th, .ventas td {
                border: 1px solid #ddd;
                padding: 8px;
                text-align: left;
            }
            .productos {
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
            }
            .productos th, .productos td {
                border: 1px solid #ddd;
                padding: 8px;
                text-align: left;
            }
        </style>
    </head>
    <body>
        <div class="reporte">
            <div class="header">
                <h1>Reporte de Ventas</h1>
                <p>Fecha de generación: ${new Date().toLocaleString()}</p>
            </div>
            
            <div class="resumen">
                <h2>Resumen</h2>
                <p>Total de ventas: ${reporte.totalVentas}</p>
                <p>Total de ingresos: $${reporte.totalIngresos}</p>
            </div>

            <h2>Ventas por Producto</h2>
            <table class="productos">
                <thead>
                    <tr>
                        <th>Producto</th>
                        <th>Cantidad Vendida</th>
                        <th>Ingresos</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(reporte.ventasPorProducto).map(([producto, datos]) => `
                        <tr>
                            <td>${producto}</td>
                            <td>${datos.cantidad}</td>
                            <td>$${datos.ingresos}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <h2>Detalle de Ventas</h2>
            <table class="ventas">
                <thead>
                    <tr>
                        <th>Ticket</th>
                        <th>Fecha</th>
                        <th>Total</th>
                        <th>Estado</th>
                    </tr>
                </thead>
                <tbody>
                    ${ventas.map(venta => `
                        <tr>
                            <td>${venta.numeroTicket}</td>
                            <td>${new Date(venta.fecha).toLocaleString()}</td>
                            <td>$${venta.total}</td>
                            <td>${venta.estado}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    </body>
    </html>
    `;
}

module.exports = saleController; 