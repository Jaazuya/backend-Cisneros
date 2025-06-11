const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');

// Obtener reporte de ventas
router.get('/reports/sales', reportController.getSalesReport);

// Generar PDF del reporte
router.get('/reports/sales/pdf', reportController.generateReportPDF);

module.exports = router; 