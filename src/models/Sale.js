const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
    numeroTicket: {
        type: String,
        unique: true,
        sparse: true // Permite múltiples documentos con numeroTicket null
    },
    productos: [{
        producto: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        cantidad: {
            type: Number,
            required: true,
            min: 1
        },
        precioUnitario: {
            type: Number,
            required: true
        },
        subtotal: {
            type: Number,
            required: true
        }
    }],
    total: {
        type: Number,
        required: true
    },
    fecha: {
        type: Date,
        default: Date.now
    },
    observaciones: {
        type: String
    },
    estado: {
        type: String,
        enum: ['completada', 'cancelada', 'pendiente'],
        default: 'completada'
    },
    pdfUrl: { // Nuevo campo para guardar la URL del PDF
        type: String,
        required: false // No es requerido al inicio
    }
}, {
    timestamps: true
});

// Prevenir OverwriteModelError
const Sale = mongoose.models.Sale || mongoose.model('Sale', saleSchema);

// Opcional: añadir un log para ver cuando se instancia el modelo (para depuración)
saleSchema.post('init', function(doc) {
    console.log('Instancia de Sale inicializada/encontrada:', doc._id);
});

saleSchema.post('validate', function(doc) {
    console.log('Validación de Sale completada para ticket:', doc.numeroTicket);
});

module.exports = Sale; 