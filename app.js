
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import jwt from 'jsonwebtoken';

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
//---------------------

const verifyJWT = (req, res, next) => {

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(" ")[1];
    if (token == null) {
        return res.status(401).json({ "error": "No access token" })
    }

    jwt.verify(token, process.env.SECRET_ACCESS_KEY, (err, user) => {
        if (err) {
            return res.status(403).json({ error: "Access token is invalid" })
        }

        req.user = user.id

        next()
    })

}

const formateDatatoSend = (user) => {

    const access_token = jwt.sign({ id: user._id }, process.env.SECRET_ACCESS_KEY);

    return {
        access_token,
        profile_img: user.personal_info.profile_img,
        username: user.personal_info.username,
        fullname: user.personal_info.fullname,
    }
}

const generateUsername = async (email) => {
    let username = email.split("@")[0]; // 'as@gmail.com -> [as, gmail]->as

    let isUsernameNotUnique = await User.exists({ "personal_info.username": username }).then((result) => result)

    isUsernameNotUnique ? username += nanoid().substring(0, 5) : "";
    return username
}




app.get("/", (req, res, next) => {
    return res.status(200).json({
        message: "Hello from root!",
    });
});

app.post("/signup", (req, res) => {
    let { fullname, email, password } = req.body;

    // validating the data from frontend
    if (fullname.length < 3) {
        return res.status(403).json({ "error": "fullname must at least 3 letter long" })
    }
    if (!email.length) {
        return res.status(403).json({ "error": "Enter Email" })
    }
    if (!emailRegex.test(email)) {
        return res.status(403).json({ "Error": "Email is invalid" })
    }
    if (!passwordRegex.test(password)) {
        return res.status(403).json({ "Error": "Password should be 6 to 20 characters long with a numeric, 1 lowercase and 1 uppercase letters" })
    }

    bcrypt.hash(password, 10, async (err, hashed_password) => {

        let password = hashed_password.toString()
        let username = await generateUsername(email) // 'as@gmail.com -> [as, gmail]->as

        let user = new User({
            personal_info: { fullname, email, password, username }
        })

        user.save().then((u) => {
            return res.status(200).json(formateDatatoSend(u))
        }).catch(err => {

            if (err.code == 11000) {
                return res.status(500).json({ "error": "Email alredy exist" })
            }

            return res.status(500).json({ "error": err.message })
        })

        // console.log(password);
    })


    // return res.status(200).json({"status": "Okay"})

})



app.use((req, res, next) => {
    return res.status(404).json({
        error: "Not Found",
    });
});

export default app;