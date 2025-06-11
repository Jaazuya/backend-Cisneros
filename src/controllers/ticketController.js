const Sale = require('../models/Sale');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const ticketController = {
    // Obtener todas las ventas para listado de tickets
    async getTickets(req, res) {
        try {
            console.log('Obteniendo todas las ventas para listado de tickets...');
            const sales = await Sale.find()
                .populate('productos.producto', 'nombre')
                .select('_id numeroTicket total fecha')
                .sort({ fecha: -1 });
            console.log(`Ventas encontradas para tickets: ${sales.length}`);
            res.json(sales);
        } catch (error) {
            console.error('Error al obtener ventas para tickets:', error);
            res.status(500).json({ message: 'Error al obtener tickets' });
        }
    },

    // Obtener los datos de una venta específica (para mostrar en frontend si es necesario)
    async getTicket(req, res) {
        try {
            const { saleId } = req.params;
            console.log(`Obteniendo datos de venta para ID: ${saleId}`);

            if (!mongoose.Types.ObjectId.isValid(saleId)) {
                 return res.status(400).json({ message: 'ID de venta inválido' });
            }

            const sale = await Sale.findById(saleId)
                .populate('productos.producto', 'nombre precio');

            if (!sale) {
                return res.status(404).json({ message: 'Venta no encontrada' });
            }

            res.json(sale);
        } catch (error) {
            console.error('Error al obtener datos de venta por ID:', error);
            res.status(500).json({ message: 'Error al obtener datos de ticket' });
        }
    },

    // Generar y/o enviar PDF de un ticket específico (fuerza descarga)
    async generateTicketPDF(req, res) {
        try {
            const { saleId } = req.params;
            console.log(`Procesando solicitud de PDF para ID de venta: ${saleId}`);

            if (!mongoose.Types.ObjectId.isValid(saleId)) {
                 return res.status(400).json({ message: 'ID de venta inválido' });
            }

            const sale = await Sale.findById(saleId)
                .populate('productos.producto', 'nombre precio');

            if (!sale) {
                return res.status(404).json({ message: 'Venta no encontrada' });
            }

            const ticketsDir = path.join(__dirname, '../../tickets');
            const filename = `ticket_${saleId}.pdf`;
            const filePath = path.join(ticketsDir, filename);

            // Verificar si el archivo PDF ya existe
            if (fs.existsSync(filePath)) {
                console.log(`PDF para venta ${saleId} ya existe. Enviando archivo.`);
                 // Si existe, simplemente enviarlo para descarga
                 res.setHeader('Content-Type', 'application/pdf');
                 res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
                 return res.download(filePath, filename, (err) => {
                     if(err) console.error(`Error al descargar el PDF existente ${filePath}:`, err);
                 });
            }

            // Si no existe, generar el PDF (esto no debería pasar si createSale funciona, pero es un respaldo)
            console.log(`PDF para venta ${saleId} no encontrado. Generando ahora...`);

            const doc = new PDFDocument();

            if (!fs.existsSync(ticketsDir)) {
                fs.mkdirSync(ticketsDir, { recursive: true });
            }

            const stream = fs.createWriteStream(filePath);

            stream.on('finish', () => {
                 console.log(`PDF para venta ${saleId} generado en ${filePath}. Enviando archivo.`);
                 // Una vez generado, enviarlo para descarga
                 res.setHeader('Content-Type', 'application/pdf');
                 res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
                 res.download(filePath, filename, (err) => {
                     if(err) console.error(`Error al descargar el PDF recién generado ${filePath}:`, err);
                      // Opcional: eliminar el archivo después de la descarga si no quieres guardarlos permanentemente
                      // fs.unlink(filePath, (unlinkErr) => { if (unlinkErr) console.error('Error al eliminar PDF:', unlinkErr); });
                 });
            });

             stream.on('error', (streamError) => {
                 console.error(`Error en el stream de escritura del PDF para venta ${saleId}:`, streamError);
                 res.status(500).json({ message: 'Error al generar el PDF' });
             });

            doc.pipe(stream);

            // Contenido del PDF
            doc.fontSize(25).text('Ticket de Venta', { align: 'center' });
            doc.moveDown();
            doc.fontSize(12).text(`Número: ${sale.numeroTicket || sale._id}`, { align: 'center' });
            doc.text(`Fecha: ${new Date(sale.fecha).toLocaleString()}`, { align: 'center' });
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
            sale.productos.forEach(item => {
                doc.text(item.producto.nombre, itemX, y);
                doc.text(item.cantidad.toString(), quantityX, y);
                doc.text(`$${item.precioUnitario.toFixed(2)}`, priceX, y);
                doc.text(`$${item.subtotal.toFixed(2)}`, subtotalX, y);
                y += 20;
            });

            doc.y = y + 10;
            doc.fontSize(16).text(`Total: $${sale.total.toFixed(2)}`, { align: 'right' });
            doc.moveDown();

            if (sale.observaciones) {
                doc.fontSize(12).text(`Observaciones: ${sale.observaciones}`);
                doc.moveDown();
            }

            doc.fontSize(12).text('¡Gracias por su compra!', { align: 'center' });

            doc.end(); // Finaliza el PDF y el stream

        } catch (error) {
            console.error('Error al generar/enviar PDF del ticket:', error);
            res.status(500).json({ message: 'Error al generar/enviar PDF del ticket' });
        }
    }
};

module.exports = ticketController; 