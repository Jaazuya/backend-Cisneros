const Inventory = require('../models/Inventory');
const Product = require('../models/Product');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const inventoryController = {
    // Obtener todo el inventario con detalles de productos
    async getInventory(req, res) {
        try {
            const inventory = await Inventory.find()
                .populate('producto', 'nombre precio cantidad')
                .sort({ fechaConteo: -1 });
            res.json(inventory);
        } catch (error) {
            console.error('Error al obtener inventario:', error);
            res.status(500).json({ message: 'Error al obtener inventario' });
        }
    },

    // Crear nuevo registro de inventario
    async createInventory(req, res) {
        try {
            const { producto, existenciaFisica, observaciones } = req.body;
            
            // Obtener el producto
            const productoEncontrado = await Product.findById(producto);
            if (!productoEncontrado) {
                return res.status(404).json({ message: 'Producto no encontrado' });
            }

            // Calcular la diferencia
            const diferencia = existenciaFisica - productoEncontrado.cantidad;

            const newInventory = new Inventory({
                producto,
                existenciaFisica,
                diferencia,
                observaciones
            });

            await newInventory.save();

            // Actualizar la cantidad del producto
            productoEncontrado.cantidad = existenciaFisica;
            await productoEncontrado.save();

            res.status(201).json(newInventory);
        } catch (error) {
            console.error('Error al crear inventario:', error);
            res.status(500).json({ message: 'Error al crear inventario' });
        }
    },

    // Actualizar registro de inventario
    async updateInventory(req, res) {
        try {
            const { id } = req.params;
            const { existenciaFisica, observaciones } = req.body;
            
            console.log('Actualizando inventario:', { id, existenciaFisica, observaciones });
            
            // Obtener el registro de inventario
            const inventory = await Inventory.findById(id).populate('producto');
            if (!inventory) {
                console.log('Inventario no encontrado:', id);
                return res.status(404).json({ message: 'Registro de inventario no encontrado' });
            }

            // Obtener el producto
            const producto = await Product.findById(inventory.producto._id);
            if (!producto) {
                console.log('Producto no encontrado:', inventory.producto._id);
                return res.status(404).json({ message: 'Producto no encontrado' });
            }

            // Calcular la nueva diferencia
            const diferencia = existenciaFisica - producto.cantidad;

            // Actualizar el registro de inventario
            inventory.existenciaFisica = existenciaFisica;
            inventory.diferencia = diferencia;
            if (observaciones) inventory.observaciones = observaciones;
            await inventory.save();

            // Actualizar la cantidad del producto
            producto.cantidad = existenciaFisica;
            await producto.save();

            // Obtener el inventario actualizado con los datos del producto
            const updatedInventory = await Inventory.findById(id).populate('producto');
            console.log('Inventario actualizado:', updatedInventory);

            res.json(updatedInventory);
        } catch (error) {
            console.error('Error al actualizar inventario:', error);
            res.status(500).json({ message: 'Error al actualizar inventario: ' + error.message });
        }
    },

    // Generar reporte PDF
    async generateReport(req, res) {
        try {
            console.log('Iniciando generación de reporte...');
            
            // Obtener todos los productos primero
            const productos = await Product.find({}, 'nombre precio cantidad').lean();
            console.log('Productos encontrados:', productos);
            
            if (!productos || productos.length === 0) {
                console.log('No se encontraron productos');
                return res.status(404).json({ message: 'No hay productos registrados para generar el reporte' });
            }

            // Obtener el inventario
            const inventory = await Inventory.find()
                .populate('producto', 'nombre precio cantidad')
                .sort({ fechaConteo: -1 })
                .lean();
            console.log('Registros de inventario encontrados:', inventory);

            const doc = new PDFDocument();
            const fileName = `inventario_${new Date().toISOString().split('T')[0]}.pdf`;
            const reportsDir = path.join(__dirname, '../../reports');
            const filePath = path.join(reportsDir, fileName);

            console.log('Creando directorio de reports si no existe...');
            // Asegurarse de que el directorio existe
            if (!fs.existsSync(reportsDir)) {
                fs.mkdirSync(reportsDir, { recursive: true });
                console.log('Directorio de reports creado');
            }

            console.log('Configurando stream de escritura...');
            // Configurar el stream de escritura
            const stream = fs.createWriteStream(filePath);
            doc.pipe(stream);

            // Agregar contenido al PDF
            doc.fontSize(20).text('Reporte de Inventario', { align: 'center' });
            doc.moveDown();
            doc.fontSize(12).text(`Fecha de generación: ${new Date().toLocaleString()}`);
            doc.moveDown();

            // Tabla de inventario
            let y = 150;
            doc.fontSize(10);
            
            // Encabezados
            doc.text('Producto', 50, y);
            doc.text('Precio', 200, y);
            doc.text('Existencia Sistema', 300, y);
            doc.text('Existencia Física', 400, y);
            doc.text('Diferencia', 500, y);
            y += 20;

            // Línea separadora
            doc.moveTo(50, y).lineTo(550, y).stroke();
            y += 10;

            // Crear un mapa de inventario para búsqueda rápida
            const inventoryMap = new Map();
            inventory.forEach(item => {
                if (item.producto) {
                    inventoryMap.set(item.producto._id.toString(), item);
                }
            });

            console.log('Generando contenido del PDF...');
            // Mostrar todos los productos
            for (const producto of productos) {
                const inventoryItem = inventoryMap.get(producto._id.toString());
                console.log('Procesando producto:', {
                    id: producto._id,
                    nombre: producto.nombre,
                    precio: producto.precio,
                    cantidad: producto.cantidad,
                    tieneInventario: !!inventoryItem
                });
                
                // Si llegamos al final de la página, crear una nueva
                if (y > 700) {
                    doc.addPage();
                    y = 50;
                }

                doc.text(producto.nombre, 50, y);
                doc.text(`$${producto.precio}`, 200, y);
                doc.text(producto.cantidad.toString(), 300, y);
                
                if (inventoryItem) {
                    doc.text(inventoryItem.existenciaFisica.toString(), 400, y);
                    doc.text(inventoryItem.diferencia.toString(), 500, y);
                } else {
                    doc.text('No contado', 400, y);
                    doc.text('N/A', 500, y);
                }
                
                y += 20;
            }

            // Agregar resumen al final
            doc.addPage();
            y = 50;
            doc.fontSize(14).text('Resumen del Inventario', { align: 'center' });
            doc.moveDown();
            
            const totalProductos = productos.length;
            const productosContados = inventoryMap.size;
            const productosNoContados = totalProductos - productosContados;
            
            doc.fontSize(12);
            doc.text(`Total de Productos: ${totalProductos}`, 50, y);
            y += 20;
            doc.text(`Productos Contados: ${productosContados}`, 50, y);
            y += 20;
            doc.text(`Productos No Contados: ${productosNoContados}`, 50, y);

            // Agregar lista de productos no contados
            if (productosNoContados > 0) {
                y += 30;
                doc.fontSize(14).text('Productos Pendientes de Conteo:', 50, y);
                y += 20;
                doc.fontSize(10);
                
                for (const producto of productos) {
                    if (!inventoryMap.has(producto._id.toString())) {
                        if (y > 700) {
                            doc.addPage();
                            y = 50;
                        }
                        doc.text(`• ${producto.nombre} (Existencia en sistema: ${producto.cantidad})`, 50, y);
                        y += 15;
                    }
                }
            }

            console.log('Finalizando PDF...');
            // Finalizar el PDF
            doc.end();

            // Enviar el archivo
            stream.on('finish', () => {
                console.log('PDF generado exitosamente, enviando archivo...');
                res.download(filePath, fileName, (err) => {
                    if (err) {
                        console.error('Error al enviar el archivo:', err);
                        res.status(500).json({ message: 'Error al generar el reporte' });
                    }
                    // Eliminar el archivo después de enviarlo
                    fs.unlink(filePath, (err) => {
                        if (err) console.error('Error al eliminar el archivo:', err);
                    });
                });
            });

            // Manejar errores del stream
            stream.on('error', (err) => {
                console.error('Error en el stream:', err);
                res.status(500).json({ message: 'Error al generar el reporte' });
            });

        } catch (error) {
            console.error('Error al generar reporte:', error);
            res.status(500).json({ message: 'Error al generar el reporte: ' + error.message });
        }
    },

    // Limpiar inventarios
    async clearInventory(req, res) {
        try {
            // Eliminar todos los registros de inventario
            await Inventory.deleteMany({});
            
            // Restaurar las cantidades de los productos a 0
            await Product.updateMany({}, { cantidad: 0 });
            
            res.json({ message: 'Inventario limpiado exitosamente' });
        } catch (error) {
            console.error('Error al limpiar inventario:', error);
            res.status(500).json({ message: 'Error al limpiar el inventario' });
        }
    }
};

module.exports = inventoryController; 