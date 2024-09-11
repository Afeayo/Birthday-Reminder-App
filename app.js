const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const nodeCron = require('node-cron');
const nodemailer = require('nodemailer');
const session = require('express-session');
const moment = require('moment');
const Customer = require('./models/Customer')
const adminRoutes = require('./routes/admin'); 
require('dotenv').config();  


const app = express();

// Database connection 
function connectDb(){
    mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('Connected to MongoDB Atlas');
    })
    .catch((error) => {
        console.error('Error connecting to MongoDB Atlas:', error);
    });
}
 connectDb()


app.set('view engine', 'ejs');


// Nodemailer transporter 
const transporter = nodemailer.createTransport({
    host: process.env.OUTLOOK_HOST,
    port: process.env.OUTLOOK_PORT,
    secure: false, 
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    tls: {
        rejectUnauthorized: false, 
    },
});

app.use(express.static('public')); 


app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'ajjsdssd',
    resave: false,
    saveUninitialized: true,
}));




// Cron job to run at 7 AM every day
nodeCron.schedule('0 7 * * *', async () => {
    const today = moment().startOf('day');
    const birthdayPeople = await Customer.find({
        dateOfBirth: {
            $gte: today.toDate(),
            $lt: moment(today).add(1, 'day').toDate(),
        },
    });

    birthdayPeople.forEach((person) => {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: person.email,
            subject: 'Happy Birthday!',
            text: `Dear ${person.username},\n\nWishing you a wonderful birthday! 🎉`,
        };

        transporter.sendMail(mailOptions, (err, info) => {
            if (err) {
                console.log(`Error sending email: ${err}`);
            } else {
                console.log(`Email sent: ${info.response}`);
            }
        });
    });
});

// Routes
app.use('/admin', adminRoutes); 

// Home route to collect user information
app.get('/', (req, res) => {
    res.render('index', { message: null });
});

// Handle form submission
app.post('/add-customer', async (req, res) => {
    const { username, email, dateOfBirth } = req.body;

    try {
        // Check if email already exists
        const existingCustomer = await Customer.findOne({ email });
        if (existingCustomer) {
            return res.render('index', { message: 'This email is already registered!' });
        }

        const customer = new Customer({ username, email, dateOfBirth });
        await customer.save();
        res.render('index', { message: 'Customer added successfully!' });
    } catch (err) {
        console.error('Error:', err);
        res.render('index', { message: 'Error saving customer!' });
    }
});



app.listen(8000, () => {
    console.log('Server is running on port 8000');
});
