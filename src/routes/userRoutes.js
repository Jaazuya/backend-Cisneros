const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');

// Ruta protegida para obtener usuarios
router.get('/users', authMiddleware, userController.getUsers);
// Ruta protegida para eliminar usuario
router.delete('/users/:id', authMiddleware, userController.deleteUser);
// Ruta protegida para actualizar usuario
router.put('/users/:id', authMiddleware, userController.updateUser);
// Ruta protegida para crear usuario
router.post('/users', authMiddleware, userController.createUser);

module.exports = router; 