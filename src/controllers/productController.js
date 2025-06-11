const Product = require('../models/Product');

const productController = {
    // Obtener todos los productos
    async getProducts(req, res) {
        try {
            const products = await Product.find();
            res.json(products);
        } catch (error) {
            console.error('Error al obtener productos:', error);
            res.status(500).json({ message: 'Error al obtener productos' });
        }
    },

    // Crear un nuevo producto
    async createProduct(req, res) {
        try {
            const { nombre, precio, cantidad } = req.body;
            
            const newProduct = new Product({
                nombre,
                precio,
                cantidad
            });
            
            await newProduct.save();
            res.status(201).json(newProduct);
        } catch (error) {
            console.error('Error al crear producto:', error);
            res.status(500).json({ message: 'Error al crear producto' });
        }
    },

    // Actualizar un producto
    async updateProduct(req, res) {
        try {
            const { id } = req.params;
            const { nombre, precio, cantidad } = req.body;
            
            const updatedProduct = await Product.findByIdAndUpdate(
                id,
                { nombre, precio, cantidad },
                { new: true }
            );
            
            if (!updatedProduct) {
                return res.status(404).json({ message: 'Producto no encontrado' });
            }
            
            res.json(updatedProduct);
        } catch (error) {
            console.error('Error al actualizar producto:', error);
            res.status(500).json({ message: 'Error al actualizar producto' });
        }
    },

    // Eliminar un producto
    async deleteProduct(req, res) {
        try {
            const { id } = req.params;
            const deletedProduct = await Product.findByIdAndDelete(id);
            
            if (!deletedProduct) {
                return res.status(404).json({ message: 'Producto no encontrado' });
            }
            
            res.json({ message: 'Producto eliminado exitosamente' });
        } catch (error) {
            console.error('Error al eliminar producto:', error);
            res.status(500).json({ message: 'Error al eliminar producto' });
        }
    }
};

module.exports = productController; 