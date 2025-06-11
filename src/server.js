const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require('path');
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Conexión a MongoDB Atlas
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log("Conectado a MongoDB Atlas");
    } catch (err) {
        console.error("Error conectando a MongoDB:", err);
        process.exit(1);
    }
};

connectDB();

// Importar rutas
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const productRoutes = require('./routes/products');
const inventoryRoutes = require('./routes/inventory');
const saleRoutes = require('./routes/sales');
const ticketRoutes = require('./routes/tickets');
const reportRoutes = require('./routes/reports');

// Usar rutas
app.use('/api', authRoutes);
app.use('/api', userRoutes);
app.use('/api', productRoutes);
app.use('/api', inventoryRoutes);
app.use('/api', saleRoutes);
app.use('/api', ticketRoutes);
app.use('/api', reportRoutes);

// Ruta principal
app.get("/", (req, res) => {
    res.send("Hello World");
});

// Manejo de errores
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

// Servir archivos estáticos
app.use('/tickets', express.static(path.join(__dirname, '../tickets')));
app.use('/reports', express.static(path.join(__dirname, '../reports')));

// Iniciar el servidor
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
}); 