const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
    producto: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    existenciaFisica: {
        type: Number,
        required: true,
        min: 0
    },
    diferencia: {
        type: Number,
        default: 0
    },
    fechaConteo: {
        type: Date,
        default: Date.now
    },
    observaciones: {
        type: String
    }
}, {
    timestamps: true
});

// Prevenir OverwriteModelError
const Inventory = mongoose.models.Inventory || mongoose.model('Inventory', inventorySchema);

module.exports = Inventory; 