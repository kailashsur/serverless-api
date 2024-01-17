

import express from 'express'
import cors from "cors"
import mongoose from 'mongoose';
import 'dotenv/config'

import User from './Schema/User.js'

const app = express();


let emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/; // regex for email
let passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{6,20}$/; // regex for password


app.use(express.json())
app.use(cors())
//TODO: mongoDB Connection-------------------------------
try {
    if (!process.env.DB_LOCATION) {
        throw new Error("MongoDB connection string is missing. Set DB_LOCATION environment variable.");
    }

    mongoose.connect(process.env.DB_LOCATION, {
        autoIndex: true,
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });

    console.log("Database Connection successful");
} catch (error) {
    console.error("MongoDB connection error:", error.message);
}


app.get("/", (req, res, next) => {
    return res.status(200).json({
        message: "Hello from root!",
    });
});

app.post("/signup", (req, res) => {
    let { fullname, email, password } = req.body;
    let username = fullname;

    let user = new User({
        personal_info: { fullname, email, password, username }
    })

    user.save().then((u) => {
        return res.status(200).json({ "code": "success saved" })
    }).catch(err => {

        if (err.code == 11000) {
            return res.status(500).json({ "error": "Email alredy exist" })
        }

        return res.status(500).json({ "error": err.message })
    })

    // return res.status(200).json({"status": "Okay"})
})

app.get("/path", (req, res, next) => {
    return res.status(200).json({
        message: "Hello from path!",
    });
});

app.use((req, res, next) => {
    return res.status(404).json({
        error: "Not Found",
    });
});


// module.exports = app;
// export default app;
export default app;