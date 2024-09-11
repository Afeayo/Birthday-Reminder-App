const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true, // Enforcing unique email
    },
    dateOfBirth: {
        type: Date,
        required: true,
    },
});
const Customer = mongoose.model('Customer', customerSchema);

module.exports = Customer;
