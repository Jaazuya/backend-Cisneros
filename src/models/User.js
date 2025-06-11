const mongoose = require('mongoose');

// Verificar si el modelo ya existe
const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({
    username: { 
        type: String, 
        required: true, 
        unique: true 
    },
    password: { 
        type: String, 
        required: true 
    }
}));

module.exports = User; 