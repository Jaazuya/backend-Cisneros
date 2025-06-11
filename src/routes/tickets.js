const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');

// Ruta para obtener todos los tickets (usando IDs de venta)
router.get('/tickets', ticketController.getTickets);

// Ruta para obtener un ticket específico (usando el ID de venta)
router.get('/tickets/:saleId', ticketController.getTicket);

// Ruta para generar PDF de un ticket específico (usando el ID de venta)
router.get('/tickets/:saleId/pdf', ticketController.generateTicketPDF);

module.exports = router; 