const User = require('../../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const authController = {
    async register(req, res) {
        try {
            const { username, password, nombre, apellido, email } = req.body;
            
            // Verificar si el usuario ya existe
            const existingUser = await User.findOne({ username });
            if (existingUser) {
                return res.status(400).json({ message: "El usuario ya existe" });
            }

            // Encriptar la contraseña
            const hashedPassword = await bcrypt.hash(password, 10);

            // Crear nuevo usuario
            const user = new User({
                username,
                password: hashedPassword,
                nombre,
                apellido,
                email,
                isActive: true,
                lastActive: new Date()
            });

            await user.save();

            // Generar token
            const token = jwt.sign(
                { id: user._id, username: user.username },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            res.status(201).json({ 
                message: "Usuario creado exitosamente",
                token,
                user: {
                    id: user._id,
                    username: user.username,
                    nombre: user.nombre,
                    apellido: user.apellido,
                    email: user.email,
                    isActive: user.isActive
                }
            });
        } catch (error) {
            console.error("Error en registro:", error);
            res.status(500).json({ message: "Error al crear el usuario" });
        }
    },

    async login(req, res) {
        try {
            const { username, password } = req.body;

            // Buscar usuario en la base de datos
            const user = await User.findOne({ username });
            if (!user) {
                return res.status(401).json({ message: "Credenciales inválidas" });
            }

            // Verificar contraseña
            const validPassword = await bcrypt.compare(password, user.password);
            if (!validPassword) {
                return res.status(401).json({ message: "Credenciales inválidas" });
            }

            // Actualizar estado de actividad
            user.isActive = true;
            user.lastActive = new Date();
            await user.save();

            // Generar token
            const token = jwt.sign(
                { id: user._id, username: user.username },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            res.status(200).json({ 
                message: "Login exitoso",
                token,
                user: {
                    id: user._id,
                    username: user.username,
                    nombre: user.nombre,
                    apellido: user.apellido,
                    email: user.email,
                    isActive: user.isActive
                }
            });
        } catch (error) {
            console.error("Error en login:", error);
            res.status(500).json({ message: "Error en el servidor" });
        }
    },

    async logout(req, res) {
        try {
            const userId = req.user.id;
            const user = await User.findById(userId);
            
            if (user) {
                user.isActive = false;
                await user.save();
            }

            res.status(200).json({ message: "Logout exitoso" });
        } catch (error) {
            console.error("Error en logout:", error);
            res.status(500).json({ message: "Error en el servidor" });
        }
    }
};

module.exports = authController; 