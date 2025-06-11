const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// Obtener todos los productos
router.get('/products', productController.getProducts);

// Crear un nuevo producto
router.post('/products', productController.createProduct);

// Actualizar un producto
router.put('/products/:id', productController.updateProduct);

// Eliminar un producto
router.delete('/products/:id', productController.deleteProduct);

module.exports = router;
