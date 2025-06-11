const User = require('../../models/User');
const bcrypt = require('bcryptjs');

const userController = {
    async getUsers(req, res) {
        try {
            const users = await User.find({}, '-password');
            // Actualizar estado de actividad basado en lastActive
            const now = new Date();
            const inactiveThreshold = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutos

            const updatedUsers = users.map(user => {
                if (user.lastActive < inactiveThreshold) {
                    user.isActive = false;
                    user.save();
                }
                return user;
            });

            res.json(updatedUsers);
        } catch (error) {
            res.status(500).json({ message: 'Error al obtener usuarios' });
        }
    },
    async deleteUser(req, res) {
        try {
            const { id } = req.params;
            console.log('Intentando eliminar usuario con id:', id);
            const deleted = await User.findByIdAndDelete(id);
            if (!deleted) {
                return res.status(404).json({ message: 'Usuario no encontrado' });
            }
            res.json({ message: 'Usuario eliminado correctamente' });
        } catch (error) {
            console.error('Error al eliminar usuario:', error);
            res.status(500).json({ message: 'Error al eliminar usuario' });
        }
    },
    async updateUser(req, res) {
        try {
            const { id } = req.params;
            const { nombre, apellido, email, username } = req.body;
            const updated = await User.findByIdAndUpdate(
                id,
                { nombre, apellido, email, username },
                { new: true, runValidators: true }
            );
            if (!updated) {
                return res.status(404).json({ message: 'Usuario no encontrado' });
            }
            res.json(updated);
        } catch (error) {
            res.status(500).json({ message: 'Error al actualizar usuario' });
        }
    },
    async createUser(req, res) {
        try {
            const { nombre, apellido, email, username, password } = req.body;
            const exists = await User.findOne({ username });
            if (exists) {
                return res.status(400).json({ message: 'El usuario ya existe' });
            }
            
            // Encriptar la contraseña
            const hashedPassword = await bcrypt.hash(password, 10);
            
            const newUser = new User({ 
                nombre, 
                apellido, 
                email, 
                username, 
                password: hashedPassword 
            });
            await newUser.save();
            
            // No enviar la contraseña en la respuesta
            const userResponse = {
                id: newUser._id,
                nombre: newUser.nombre,
                apellido: newUser.apellido,
                email: newUser.email,
                username: newUser.username
            };
            
            res.status(201).json(userResponse);
        } catch (error) {
            console.error('Error al crear usuario:', error);
            res.status(500).json({ message: 'Error al crear usuario' });
        }
    }
};

module.exports = userController; 