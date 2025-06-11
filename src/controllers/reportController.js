const Sale = require('../models/Sale');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const reportController = {
    // Obtener reporte de ventas
    async getSalesReport(req, res) {
        try {
            const { startDate, endDate, type } = req.query;
            let query = {};

            // Filtrar por fechas si se proporcionan
            if (startDate && endDate) {
                query.fecha = {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                };
            }

            const sales = await Sale.find(query)
                .populate('productos.producto', 'nombre precio')
                .sort({ fecha: -1 });

            // Agrupar ventas según el tipo de reporte
            let groupedSales = sales;
            if (type === 'daily') {
                groupedSales = groupByDate(sales, 'day');
            } else if (type === 'weekly') {
                groupedSales = groupByDate(sales, 'week');
            } else if (type === 'monthly') {
                groupedSales = groupByDate(sales, 'month');
            }

            res.json(groupedSales);
        } catch (error) {
            console.error('Error al obtener reporte:', error);
            res.status(500).json({ message: 'Error al obtener reporte' });
        }
    },

    // Generar PDF del reporte
    async generateReportPDF(req, res) {
        try {
            const { startDate, endDate, type } = req.query;
            let query = {};

            if (startDate && endDate) {
                query.fecha = {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                };
            }

            const sales = await Sale.find(query)
                .populate('productos.producto', 'nombre precio')
                .sort({ fecha: -1 });

            const doc = new PDFDocument();
            const fileName = `reporte_${new Date().toISOString().split('T')[0]}.pdf`;
            const reportsDir = path.join(__dirname, '../../reports');
            const filePath = path.join(reportsDir, fileName);

            if (!fs.existsSync(reportsDir)) {
                fs.mkdirSync(reportsDir, { recursive: true });
            }

            const stream = fs.createWriteStream(filePath);
            doc.pipe(stream);

            // Título del reporte
            doc.fontSize(20).text('Reporte de Ventas', { align: 'center' });
            doc.moveDown();
            doc.fontSize(12).text(`Período: ${startDate} - ${endDate}`);
            doc.text(`Tipo: ${type}`);
            doc.moveDown();

            // Resumen
            const totalVentas = sales.reduce((sum, sale) => sum + sale.total, 0);
            const totalProductos = sales.reduce((sum, sale) => 
                sum + sale.productos.reduce((pSum, p) => pSum + p.cantidad, 0), 0);
            const promedioVenta = sales.length > 0 ? totalVentas / sales.length : 0;

            doc.fontSize(14).text('Resumen', { underline: true });
            doc.fontSize(12);
            doc.text(`Total de Ventas: $${totalVentas.toFixed(2)}`);
            doc.text(`Total de Productos Vendidos: ${totalProductos}`);
            doc.text(`Promedio por Venta: $${promedioVenta.toFixed(2)}`);
            doc.moveDown();

            // Tabla de ventas
            let y = 250;
            doc.fontSize(10);
            
            // Encabezados
            doc.text('Fecha', 50, y);
            doc.text('Ticket', 150, y);
            doc.text('Productos', 250, y);
            doc.text('Total', 450, y);
            y += 20;

            // Línea separadora
            doc.moveTo(50, y).lineTo(550, y).stroke();
            y += 10;

            // Ventas
            sales.forEach(sale => {
                if (y > 700) {
                    doc.addPage();
                    y = 50;
                }

                doc.text(new Date(sale.fecha).toLocaleString(), 50, y);
                doc.text(sale.numeroTicket, 150, y);
                doc.text(sale.productos.map(p => `${p.producto.nombre} (${p.cantidad})`).join(', '), 250, y);
                doc.text(`$${sale.total}`, 450, y);
                y += 20;
            });

            doc.end();

            stream.on('finish', () => {
                res.download(filePath, fileName, (err) => {
                    if (err) {
                        console.error('Error al enviar el archivo:', err);
                        res.status(500).json({ message: 'Error al generar el reporte' });
                    }
                    fs.unlink(filePath, (err) => {
                        if (err) console.error('Error al eliminar el archivo:', err);
                    });
                });
            });

        } catch (error) {
            console.error('Error al generar reporte PDF:', error);
            res.status(500).json({ message: 'Error al generar el reporte' });
        }
    }
};

// Función auxiliar para agrupar ventas por fecha
function groupByDate(sales, type) {
    const groups = {};
    
    sales.forEach(sale => {
        const date = new Date(sale.fecha);
        let key;
        
        if (type === 'day') {
            key = date.toISOString().split('T')[0];
        } else if (type === 'week') {
            const week = getWeekNumber(date);
            key = `${date.getFullYear()}-W${week}`;
        } else if (type === 'month') {
            key = `${date.getFullYear()}-${date.getMonth() + 1}`;
        }

        if (!groups[key]) {
            groups[key] = {
                fecha: key,
                ventas: [],
                total: 0,
                productos: 0
            };
        }

        groups[key].ventas.push(sale);
        groups[key].total += sale.total;
        groups[key].productos += sale.productos.reduce((sum, p) => sum + p.cantidad, 0);
    });

    return Object.values(groups);
}

// Función auxiliar para obtener el número de semana
function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

module.exports = reportController; 