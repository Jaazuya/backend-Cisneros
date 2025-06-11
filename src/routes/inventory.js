const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');

// Obtener todo el inventario
router.get('/inventory', inventoryController.getInventory);

// Crear nuevo registro de inventario
router.post('/inventory', inventoryController.createInventory);

// Actualizar registro de inventario
router.put('/inventory/:id', inventoryController.updateInventory);

// Generar reporte PDF
router.get('/inventory/report', inventoryController.generateReport);

// Limpiar inventario
router.delete('/inventory/clear', inventoryController.clearInventory);

module.exports = router; 