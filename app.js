
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import jwt from 'jsonwebtoken';
import express from 'express'
import cors from "cors"
import mongoose from 'mongoose';
import 'dotenv/config';

import admin from 'firebase-admin'
import serviceAccountKey from './medium-clone-82f8c-firebase-adminsdk-5ihb8-8d03a2c2e1.json' assert { type: "json" }       // This things is very important to do, otherwise it will throw error
import { getAuth } from "firebase-admin/auth"
// import aws from "aws-sdk"
import appwriteServices from './appwrite.js'
import multer from 'multer';

import User from './Schema/User.js'
import Blog from './Schema/Blog.js';
import Comment from './Schema/Comment.js'
import Notification from './Schema/Notification.js'


const app = express();


let emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/; // regex for email
let passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{6,20}$/; // regex for password

admin.initializeApp({
    credential: admin.credential.cert(serviceAccountKey)
});

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

// setting up s3 bucket------------------------
// const s3 = new aws.S3({
//     region: 'ap-south-1',
//     accessKeyId: process.env.AWS_ACCESS_KEY,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
// })


// const date = new Date();
// const imageName = `${nanoid()}-${date.getTime()}.jpeg`

// return await s3.getSignedUrlPromise('putObject', {
//     Bucket: 'blog-medium-in',
//     Key: imageName,
//     Expires: 1000,
//     ContentType: "image/jpeg"
// })
const generateUploadURL = async () => {

    app.post('/img-url', async (req, res) => {
        try {
            let { img } = req.body;
            // Process the img data or perform any other necessary operations
            return img;
        } catch (error) {
            console.error('Error processing image URL:', error);
            //   res.status(500).send('Internal Server Error');
        }
    });
}

// aws end

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
        admin : user.admin,
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


// Upload image url route
app.get('/get-upload-url', async (req, res) => {
    await generateUploadURL()
        .then(url => {

            return res.status(200).json({ uploadURL: url })
        })
        .catch(err => {
            console.log(err.message);
            return res.status(500).json({ error: err.message })
        })
})

//TODO: -------------------Authentication Route-----------------------------------

app.post("/image-list", verifyJWT, async (req, res)=>{
    await appwriteServices.imageList()
    .then(({total, files}) =>{

        let filesArray = [];
        files.map( (img)=>{
            // console.log(img.$id);
            // console.log(img.name);
            let { href} = appwriteServices.getFilePreview(img.$id)
            filesArray.push({id : img.$id ,name : img.name, url : href})
        })

        return res.status(200).json({total : total, files : filesArray})
    })
    .catch(err=>{
        return res.status(500).json({error : err.message});
    })
})

//-------------------------------------------------------------------------------
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
    })
})

app.post("/signin", (req, res) => {

    let { email, password } = req.body;

    User.findOne({ "personal_info.email": email })
        .then(((user) => {
            if (!user) {

                return res.status(403).json({ "error": "Email not found" })
            }


            if (!user.google_auth) {

                bcrypt.compare(password, user.personal_info.password, (err, result) => {
                    if (err) {
                        return res.status(403).json({ "error": "Error occured while login please try again" })
                    }
                    if (!result) {
                        return res.status(403).json({ "error": "Incorect Password" })
                    } else {
                        return res.status(200).json(formateDatatoSend(user))
                    }
                })
            } else {
                return res.status(403).json({ "error": "Account was created using google. Try login with Google" })
            }

            // console.log(user);


            // return res.json({ " status ": "Got user document"})
        }))
        .catch(err => {
            console.log(err.message);
            return res.status(500).json({ "error": err.message })
        })
})

app.post("/google-auth", async (req, res) => {
    let { access_token } = req.body;
    // console.log("Access token is = ",access_token);

    getAuth().verifyIdToken(String(access_token)).
        then(async (decodedUser) => {

            let { email, name, picture } = decodedUser;

            picture = picture.replace("s96-c", "s384-c")

            let user = await User.findOne({ "personal_info.email": email }).select("personal_info.fullname personal_info.username personal_info.profile_img google_auth")
                .then((u) => {
                    return u || null
                }).catch(err => {
                    return res.status(500).json({ "error": err.message })
                })

            if (user) {       //we have to login
                if (!user.google_auth) {
                    return res.status(403).json({ "error": "This email was signed up without google. Please login with password to access the account" })
                }

            } else {  // signup

                let username = await generateUsername(email);

                user = new User({
                    personal_info: { fullname: name, email, profile_img: picture, username },
                    google_auth: true
                })

                await user.save()
                    .then((u) => {
                        user = u;
                    })
                    .catch(err => {
                        return res.status(500).json({ "error": err.message });
                    })

            }

            return res.status(200).json(formateDatatoSend(user))
        })
        .catch(err => {
            return res.status(500).json({ "error": "Failed to authenticate you with google. Try with some other google account" })
        })
})
//-------------------------------------------



//TODO: -------------------Blog Route-----------------------------------

// app.post("/latest-blogs", (req, res) => {

//     let { page } = req.body;
//     let max_limit = 5;

//     Blog.find({ draft: false })
//         .populate("author", " personal_info.profile_img personal_info.username personal_info.fullname -_id ")
//         .sort({ publishedAt: -1 })
//         .select("blog_id title description banner activity tags publishedAt -_id")
//         .skip((page - 1) * max_limit)
//         .limit(max_limit)
//         .then(blogs => {
//             return res.status(200).json({ blogs })
//         })
//         .catch(err => {
//             return res.status(500).json({ error: err.message })
//         })
// })


app.post("/all-latest-blogs-count", (req, res) => {
    Blog.countDocuments({ draft: false })
        .then(count => {
            return res.status(200).json({ totalDocs: count })
        })
        .catch(err => {
            console.log(err.message);
            return res.status(500).json({ error: err.message })
        })
})



app.get("/trending-blogs", (req, res) => {

    Blog.find({ draft: false })
        .populate("author", " personal_info.profile_img personal_info.username personal_info.fullname -_id ")
        .sort({ "activity.total_read": -1, "activity.total_likes": -1, " publishedAt": -1 })
        .select("blog_id title activity publishedAt -_id")
        .limit(5)
        .then(blogs => {
            return res.status(200).json({ blogs })
        })
        .catch(err => {
            return res.status(500).json({ error: err.message })
        })

})


//TODO: -------------------Search Routes-----------------------------------

app.post("/search-blogs", (req, res) => {

    let page = req.body.page;
    let { tags, query, author, limit, eliminate_blog } = req.body;
    // let tag = String(tags);



    let findQuery = { draft: false, title: RegExp(query, 'i') };

    if (tags) {
        findQuery = { draft: false, tags: tags, blog_id: { $ne: eliminate_blog } }

    } else if (query) {
        findQuery = { draft: false, title: new RegExp(query, 'i') }
    } else if (author) {
        findQuery = { author, draft: false }
    }

    let maxLimit = limit ? limit : 2;


    // this is the mongoos query

    Blog.find(findQuery)
        .populate("author", "personal_info.profile_img personal_info.username personal_info.fullname -_id")
        .sort({ publishedAt: -1 })
        .select("blog_id title description banner activity tags publishedAt -_id")
        .skip((page - 1) * maxLimit)
        .limit(maxLimit)
        .then(blogs => {
            return res.status(200).json({ blogs })
        })
        .catch(err => {
            return res.status(500).json({ error: err.message })
        })
})
//------------------------------------------

app.post('/search-blogs-count', (req, res) => {

    let { tags, author, query } = req.body;

    let findQuery;
    if (tags) {
        findQuery = { draft: false, tags: tags }

    } else if (query) {
        findQuery = { draft: false, title: new RegExp(query, 'i') }
    }
    else if (author) {
        findQuery = { author, draft: false }
    }

    Blog.countDocuments(findQuery)
        .then(count => {
            return res.status(200).json({ totalDocs: count })
        })
        .catch(err => {
            console.log(err.message);
            return res.status(500).json({ error: err.message })
        })
})
//-----------------------------------------

app.post("/search-users", (req, res) => {

    let { query } = req.body;

    User.find({ "personal_info.username": new RegExp(query, 'i') })
        .limit(50)
        .select("personal_info.fullname personal_info.username personal_info.profile_img -_id")
        .then(users => {
            return res.status(200).json({ users })
        })
        .catch(err => {
            return res.status(500).json({ error: err.message })
        })
})

//TODO: -------------------Profile Route-----------------------------------

app.post("/get-profile", (req, res) => {


    let { username } = req.body;

    User.findOne({ "personal_info.username": username })
        .select("-personal_info.password -google_auth -updatedAt -blogs _id -__v")
        .then(user => {
            return res.status(200).json(user);
        })
        .catch(err => {
            console.log(err);
            return res.status(500).json({ error: err.message });
        })
})

//TODO: ----------------------Profile Image Upload and Update to the database-----------------
app.post("/update-profile-img", verifyJWT, (req, res) => {
    let { url } = req.body;

    User.findOneAndUpdate({ _id: req.user }, { "personal_info.profile_img": url })
        .then(() => {
            return res.status(200).json({ profile_img: url })
        })
        .catch(err => {
            return res.status(500).json({ error: err.message });
        })
})

app.post("/update-profile", verifyJWT, (req, res) => {

    let { username, bio, social_links } = req.body;
    let bioLimit = 150;

    if (username.length < 3) {
        return res.status(403).json({ error: "Username should greater than 3 letter" })
    }

    if (bio.length > bioLimit) {
        return res.status(403).json({ error: `bio should be more than ${bioLimit}` })
    }

    let socialLinksArr = Object.keys(social_links);

    try {

        for (let i = 0; i < socialLinksArr; i++) {
            if (social_links[socialLinksArr[i]].length) {
                let hostname = new URL(social_links[socialLinksArr[i]]).hostname;

                if (!hostname.includes(`${socialLinksArr[i].com}`) && socialLinksArr[i] != 'website') {
                    return res.status(403).json({ error: `${socialLinksArr[i]} link is invalid` })
                }
            }
        }
    } catch (err) {
        return res.status(500).json({ error: "Provide url with http(s)" })
    }

    let updateObj = {
        "personal_info.username": username,
        "personal_info.bio": bio,
        social_links
    }

    User.findOneAndUpdate({ _id: req.user }, updateObj, {
        runValidators: true
    })
        .then(() => {
            return res.status(200).json({ username })
        })
        .catch(err => {
            if (err.code == 1100) {
                return res.status(409).json({ error: "username is already taken" })
            }
            return res.status(500).json({ error: err.message })
        })
})


//TODO: -------------------Blog Create Route-----------------------------------

app.post('/create-blog', verifyJWT, (req, res) => {
    // verifyJWT is a middleware

    let authorId = req.user;

    let { title, description, banner, tags, content, draft, id } = req.body;

    if (!title.length) {
        return res.status(403).json({ error: "You have to provide title to publish" })
    }

    if (!draft) {

        if (!description.length || description.length > 200) {
            return res.status(403).json({ error: "You have to write description under 200 character" })
        }
        if (!banner.length) {
            return res.status(403).json({ error: "You must provide banner" })
        }
        if (!content.blocks.length) {
            return res.status(403).json({ error: "You must be blog content" })
        }
        if (!tags.length || tags.length > 10) {
            return res.status(403).json({ error: "Provide tags to publish, Max 10" })
        }
    }




    // make all the tags into lower case bcz to prevent the duplicati
    tags = tags.map(tag => tag.toLowerCase());


    // lets create the slug from title i just removed +nanoid()
    let blog_id = id || title.replace(/[^a-zA-Z0-9]/g, ' ').replace(/\s+/g, "-").trim().toLowerCase();

    if (id) {

        Blog.findOneAndUpdate({ blog_id }, { title, description, banner, content, tags, draft: draft ? draft : false })
            .then(() => {
                return res.status(200).json({ id: blog_id });
            })
            .catch(err => {
                return res.status(500).json({ error: err.message });
            })

    } else {
        let blog = new Blog({
            title, description, banner, content, tags, author: authorId, blog_id, draft: Boolean(draft)
        })

        blog.save()
            .then(blog => {

                let incrementVal = draft ? 0 : 1;

                User.findOneAndUpdate({ _id: authorId }, { $inc: { "account_info.total_posts": incrementVal }, $push: { "blogs": blog._id } })
                    .then(user => {
                        return res.status(200).json({ id: blog.blog_id })
                    })
                    .catch(err => {
                        return res.status(500).json({ error: "Faild to update total post number" })
                    })
            })
            .catch(err => {
                return res.status(500).json({ error: err.message })
            })

    }



})

//TODO: -------------------Like Routes-----------------------------------

app.post("/get-blog", (req, res) => {

    let { blog_id, draft, mode } = req.body;

    let incrementVal = mode != 'edit' ? 1 : 0;

    Blog.findOneAndUpdate({ blog_id }, { $inc: { "activity.total_reads": incrementVal } })
        .populate("author", "personal_info.fullname personal_info.username personal_info.profile_img")
        .select("title description content banner activity publishedAt blog_id tags")
        .then(blog => {

            User.findOneAndUpdate({ "personal_info.username": blog.author.personal_info.username }, {
                $inc: { "account_info.total_reads": incrementVal }

            })
                .catch(err => {
                    return res.status(500).json({ error: err.message })
                })

            if (blog.draft && !draft) {
                return res.status(500).json({ error: "you can not access draft blogs" })
            }


            return res.status(200).json({ blog })
        })
        .catch(err => {
            return res.status(500).json({ error: err.message });
        })
})


app.post("/like-blog", verifyJWT, (req, res) => {

    let user_id = req.user;
    let { _id, isLikedByUser } = req.body;
    // console.log(isLikedByUser);

    let incrementVal = !isLikedByUser ? 1 : -1;

    Blog.findOneAndUpdate({ _id }, { $inc: { "activity.total_likes": incrementVal } })
        .then(blog => {

            if (!isLikedByUser) {
                let like = new Notification({
                    type: "like",
                    blog: _id,
                    notification_for: blog.author,
                    user: user_id
                })

                like.save().then(notification => {
                    return res.status(200).json({ liked_by_user: true })
                })
            }
            else {

                Notification.findOneAndDelete({ user: user_id, blog: _id, type: "like" })
                    .then(data => {
                        return res.status(200).json({ liked_by_user: false })
                    })
                    .catch(err => {
                        return res.status(500).json({ error: err.message })
                    })

            }
        })
})


app.post("/isliked-by-user", verifyJWT, (req, res) => {
    let user_id = req.user;

    let { _id } = req.body;

    Notification.exists({ user: user_id, type: "like", blog: _id })
        .then(result => {
            return res.status(200).json({ result });
        })
        .catch(err => {
            return res.status(500).json({ error: err.message })
        })

})

//TODO: -------------------Comment Routes-----------------------------------
app.post("/add-comment", verifyJWT, (req, res) => {
    let user_id = req.user;
    let { _id, comment, blog_author, replying_to } = req.body;

    if (!comment.length) {
        return res.status(403).json({ error: "Write something to comment" });
    }

    // Creating a comment doc
    let commentObj = {
        blog_id: _id,
        blog_author,
        comment,
        commented_by: user_id,

    }
    if (replying_to) {
        commentObj.parent = replying_to;
        commentObj.isReply = true;
    }

    new Comment(commentObj).save().then(async commentFile => {

        let { comment, commentedAt, children } = commentFile;

        Blog.findOneAndUpdate({ _id }, { $push: { "comments": commentFile._id }, $inc: { "activity.total_comments": 1, "activity.total_parent_comments": replying_to ? 0 : 1 } })
            .then(blog => {
                console.log("New comment created");
            })

        let notificationObj = {
            type: replying_to ? "reply" : "comment",
            blog: _id,
            notification_for: blog_author,
            user: user_id,
            comment: commentFile._id
        }

        if (replying_to) {

            notificationObj.replied_on_comment = replying_to;

            await Comment.findOneAndUpdate({ _id: replying_to }, { $push: { children: commentFile._id } })
                .then(replyingToCommentDoc => {
                    notificationObj.notification_for = replyingToCommentDoc.commented_by
                })
        }

        new Notification(notificationObj).save()
            .then(notification => console.log("new notification created"))

        return res.status(200).json({
            comment,
            commentedAt,
            _id: commentFile._id,
            user_id,
            children
        })
    })



})


app.post("/get-blog-comments", (req, res) => {

    let { blog_id, skip } = req.body;

    let maxLimit = 5;

    Comment.find({ blog_id, isReply: false })
        .populate("commented_by", "personal_info.username personal_info.fullname personal_info.profile_img")
        .skip(skip)
        .limit(maxLimit)
        .sort({
            'commentedAt': -1
        })
        .then(comment => {
            // console.log(comment, blog_id, skip);
            return res.status(200).json(comment);
        })
        .catch(err => {
            console.log(err.message);
            return res.status(500).json({ error: err.message });
        })
})


app.post("/get-replies", (req, res) => {
    let { _id, skip } = req.body;

    let maxLimit = 5;

    Comment.findOne({ _id })
        .populate({
            path: "children",
            options: {
                limit: maxLimit,
                skip: skip,
                sort: { 'commentedAt': -1 }
            },
            populate: {
                path: 'commented_by',
                select: "personal_info.profile_img personal_info.fullname personal_info.username"
            },
            select: "-blog_id -updatedAt"
        })
        .select("children")
        .then(doc => {
            return res.status(200).json({ replies: doc.children });
        })
        .catch(err => {
            return res.status(500).json({ error: err.message });
        })
})



//          comment delete section

const deleteComments = (_id) => {
    Comment.findOneAndDelete({ _id })
        .then(comment => {
            if (comment.parent) {
                Comment.findOneAndUpdate({ _id: comment.parent }, { $pull: { children: _id } })
                    .then(data => {
                        console.log('comment delete from parent');
                    })
                    .catch(err => {
                        console.log(err);
                    })
            }

            Notification.findOneAndDelete({ comment: _id })
                .then(notification => console.log("comment notification deleted"));

            Notification.findOneAndUpdate({ reply: _id })
                .then(notification => console.log('reply notification deleted'));

            Blog.findOneAndUpdate({ _id: comment.blog_id }, { $pull: { comments: _id }, $inc: { "activity.total_comments": -1 }, "activity.total_parent_comments": comment.parent ? 0 : -1 })
                .then(blog => {

                    if (comment.children.length) {
                        comment.children.map(replies => {
                            deleteComments(replies);
                        })
                    }
                })
        })
        .catch(err => {
            console.log(err.message);
        })
}
//          delete route 
app.post("/delete-comment", verifyJWT, (req, res) => {

    let user_id = req.user;
    let { _id } = req.body;

    Comment.findOne({ _id })
        .then(comment => {
            if (user_id == comment.commented_by || user_id == comment.blog_author) {

                deleteComments(_id);
                /*
                            on the above and down deleteComment() is not await fun because it work deleting work in backend
                
                            and in front end it shows done message
                */
                return res.status(200).json({ status: "Done" });

            } else {
                return res.status(403).json({ error: "Delete Faild" })
            }
        })
})
//-------------------------------------------


//TODO: --------------------Settings Route -------------------

// -----Change Password route---------------
app.post("/change-password", verifyJWT, (req, res) => {

    let { currentPassword, newPassword } = req.body;

    if (!passwordRegex.test(currentPassword) || !passwordRegex.test(newPassword)) {

        return res.status(403).json({ error: "Password should be 6 to 20 characters, a numeric, 1 lowercase & 1 Uppercase letters" })
    }

    User.findOne({ _id: req.user })
        .then(user => {

            if (user.google_auth) {
                return res.status(403).json({ error: "You can't change, You have loged in with Google" });
            }

            bcrypt.compare(currentPassword, user.personal_info.password, (err, result) => {
                if (err) {
                    return res.status(500).json({ error: "Error from password changing, please try again later" });
                }

                if (!result) {
                    return res.status(403).json({ error: "Incorect current password" });
                }

                bcrypt.hash(newPassword, 10, (err, hashed_password) => {
                    User.findOneAndUpdate({ _id: req.user }, { "personal_info.password": hashed_password })
                        .then(u => {
                            return res.status(200).json({ status: "Password Changed" });
                        })
                        .catch(err => {
                            return res.status(500).json({ error: "Error while saving new password" });
                        })
                })

            })
        })
        .catch(err => {
            console.log(err);
            return res.status(500).json({ error: "User not found" });
        })
})

//TODO: -------------------Server Start and Listening-----------------------------------

app.get("/new-notification", verifyJWT, (req, res)=>{

    let user_id = req.user;

    Notification.exists({ notification_for : user_id, seen : false, user:{ $ne: user_id } })
    .then(result =>{
        if(result){
            return res.status(200).json({new_notification_available : true})
        }
        else{
            return res.status(200).json({new_notification_available : false})
        }
    })
    .catch(err=>{
        console.log(err);
        return res.status(500).json({error : err.message})
    })
})

app.use((req, res, next) => {
    return res.status(404).json({
        error: "Not Found",
    });
});

export default app;
