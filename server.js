const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos
app.use('/tickets', express.static(path.join(__dirname, 'tickets')));
app.use('/reportes', express.static(path.join(__dirname, 'reportes')));

// Modelo de Usuario
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});

const User = mongoose.model("User", userSchema);

// Conexión a MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log("Conectado a MongoDB Atlas"))
    .catch(err => console.error("Error conectando a MongoDB:", err));

// Importar rutas
const authRoutes = require('./src/routes/authRoutes');
const productRoutes = require('./src/routes/products');
const inventoryRoutes = require('./src/routes/inventory');
const salesRoutes = require('./src/routes/sales');
console.log('Rutas de ventas cargadas');

// Usar rutas
app.use('/api', authRoutes);
app.use('/api', productRoutes);
app.use('/api', inventoryRoutes);
app.use('/api', salesRoutes);

// Ruta principal
app.get("/", (req, res) => {
    res.send("Servidor de Autoservicio");
});

// Rutas para tickets y reportes
app.get('/tickets', (req, res) => {
    res.sendFile(path.join(__dirname, 'tickets', 'index.html'));
});

app.get('/reportes', (req, res) => {
    res.sendFile(path.join(__dirname, 'reportes', 'index.html'));
});

// Manejo de errores
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor corriendo en el puerto ${port}`);
});