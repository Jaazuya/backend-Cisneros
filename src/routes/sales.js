const express = require('express');
const router = express.Router();
const saleController = require('../controllers/saleController');

// Obtener todas las ventas
router.get('/sales', saleController.getSales);

// Crear una nueva venta
router.post('/sales', saleController.createSale);

// Obtener una venta específica
router.get('/sales/:id', saleController.getSale);

// Generar reporte de ventas
router.get('/sales/report', saleController.generateSalesReport);

module.exports = router; 