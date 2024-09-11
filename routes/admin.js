const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const Customer = require('../models/Customer'); 
const Admin = require('../models/Admin'); 
const moment = require('moment');
const crypto = require('crypto');
const nodemailer = require('nodemailer');



function requireLogin(req, res, next) {
    if (req.session.adminId) {
        next();
    } else {
        res.redirect('/admin/login');
    }
}


router.get('/register', (req, res) => {
    res.render('register');
});

router.post('/register', async (req, res) => {
    const { username, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const newAdmin = new Admin({ username, email, password: hashedPassword });
    await newAdmin.save();
    res.redirect('/admin/login');
});


// Admin Login Route
router.get('/login', (req, res) => {
    res.render('login');
});

router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    // Find admin by username or email
    const admin = await Admin.findOne({
        $or: [
            { username: username },
            { email: username } // Since user can input either username or email
        ]
    });

    // Check if admin exists and the password is correct
    if (admin && await bcrypt.compare(password, admin.password)) {
        req.session.adminId = admin._id;
        res.redirect('/admin/dashboard');
    } else {
        res.send('Invalid credentials');
    }
});


// Admin Logout
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/admin/login');
});

// Admin Dashboard Route (with search, pagination, and filter)
router.get('/dashboard', requireLogin, async (req, res) => {
    const { page = 1, search = '', month = '' } = req.query;
    const limit = 10;
    const skip = (page - 1) * limit;

    const query = {
        $or: [
            { username: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
        ]
    };

    if (month) {
        query.dateOfBirth = {
            $gte: moment().month(month - 1).startOf('month').toDate(),
            $lt: moment().month(month - 1).endOf('month').toDate(),
        };
    }

    const totalCustomers = await Customer.countDocuments(query);
    const customers = await Customer.find(query).skip(skip).limit(limit);
    const totalPages = Math.ceil(totalCustomers / limit);

    res.render('dashboard', { customers, search, month, page, totalPages });
});

// Edit Customer Route
router.get('/edit/:id', requireLogin, async (req, res) => {
    const customer = await Customer.findById(req.params.id);
    res.render('edit', { customer });
});

router.post('/edit/:id', requireLogin, async (req, res) => {
    const { username, email, dateOfBirth } = req.body;
    await Customer.findByIdAndUpdate(req.params.id, { username, email, dateOfBirth });
    res.redirect('/admin/dashboard');
});

// Delete Customer Route
router.post('/delete/:id', requireLogin, async (req, res) => {
    await Customer.findByIdAndDelete(req.params.id);
    res.redirect('/admin/dashboard');
});



// Forgot Password Route
router.get('/forgot-password', (req, res) => {
    res.render('forgot-password');
});

router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    const admin = await Admin.findOne({ email });
    if (!admin) {
        return res.send('Admin with this email does not exist');
    }

    // Generate a password reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = Date.now() + 3600000; // Token expires in 1 hour

    admin.resetPasswordToken = resetToken;
    admin.resetPasswordExpiry = resetTokenExpiry;
    await admin.save();

    // Send the email with the reset link
    const transporter = nodemailer.createTransport({
        service: 'outlook',
        auth: {
            user: process.env.EMAIL_USER, 
            pass: process.env.EMAIL_PASS, 
        },
    });

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: admin.email,
        subject: 'Password Reset',
        text: `You requested a password reset. Click the following link to reset your password: http://localhost:3000/admin/reset-password/${resetToken}`,
    };

    transporter.sendMail(mailOptions, (err, info) => {
        if (err) {
            console.error('Error sending email:', err);
        } else {
            console.log('Password reset email sent:', info.response);
            res.send('Password reset link has been sent to your email.');
        }
    });
});

// Reset Password Route
router.get('/reset-password/:token', async (req, res) => {
    const { token } = req.params;
    const admin = await Admin.findOne({
        resetPasswordToken: token,
        resetPasswordExpiry: { $gt: Date.now() },
    });

    if (!admin) {
        return res.send('Password reset token is invalid or has expired.');
    }

    res.render('reset-password', { token });
});

router.post('/reset-password/:token', async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;

    const admin = await Admin.findOne({
        resetPasswordToken: token,
        resetPasswordExpiry: { $gt: Date.now() },
    });

    if (!admin) {
        return res.send('Password reset token is invalid or has expired.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    admin.password = hashedPassword;
    admin.resetPasswordToken = undefined;
    admin.resetPasswordExpiry = undefined;
    await admin.save();

    res.redirect('/admin/login');
});


module.exports = router;
