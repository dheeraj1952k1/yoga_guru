const express = require("express");
const app = express();
const jwt = require('jsonwebtoken');

const cors = require("cors");
require("dotenv").config();
const stripe = require("stripe")("process.env.PAYMENT_SECRET");
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());


//verify jwt token
const verifyJWT = (req, res, next)=>{
  const authorization = req.headers.authorization;
  if(!authorization){
    return res.status(401).send({message:'Unauthorized token'})
  }
  const token = authorization?.split(' ')[1];
  jwt.verify(token,process.env.ASSESS_SECRET, (err, decoded)=>{
     if(err){
      return res.status(403).send({message:'Forbidden access'})
     }
     req.decoded = decoded;
    next(); 
  })
}



// MongoDB connection
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@yoga-guru.y0ikt68.mongodb.net/?retryWrites=true&w=majority&appName=yoga-guru`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  connectTimeoutMS: 10000, // 10 seconds
  socketTimeoutMS: 45000, // 45 seconds
});

async function connectToDatabase() {
  try {
    await client.connect();
    console.log("Connected to MongoDB!");

    const database = client.db("yoga-guru");
    const classesCollection = database.collection("classes");
    const userCollection = database.collection("users");
    const cartCollection = database.collection("cart");
    const paymentCollection = database.collection("payments");
    const enrolledCollection = database.collection("enrolled");
    const appliedCollection = database.collection("applied");

    //Routes for users
   app.post("/api/set-token", async(req, res)=>{
    const user= req.body;
    const token = jwt.sign(user, process.env.ASSESS_SECRET,{
      expiresIn:'24h'
    });
    res.send({token})
   })

   // middleware for admin and instructor
   const verifyAdmin = async(req, res, next) =>{
       const email = req.decoded.email;
       const query = {email:email};
       const user = await userCollection.findOne(query);

       if(user.role === 'admin'){
        next(); 
       }else{
        return res.status(401).send({message:'Unauthorized access'})
       }
   }

   const verifyInstructor = async(req, res)=>{   
    const email = req.decoded.email;
    const query = {email:email};
    const user = await userCollection.findOne(query);
    if(user.role === 'instructor'){
      next();
    }else{
      return res.status(401).send({message:'Unauthorized access'})
    }
   }
    app.post("/new-user", async (req, res) => {
      const newUser = req.body;
      const result = await userCollection.insertOne(newUser);
      res.send(result);
    });

    //get all users
    app.get("/users", async (req, res) => {
      const result = await userCollection.find({}).toArray();
      res.send(result);
    });

    //get user by id
    app.get("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const user = await userCollection.findOne(query);
      res.send(user);
    });

    // GET USER BY EMAIL
    app.get("/user/:email",verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    // Delete a user

    app.delete("/delete-user/:id", verifyJWT,verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    // UPDATE USER
    app.put("/update-user/:id",verifyJWT, verifyAdmin,async (req, res) => {
      const id = req.params.id;
      const updatedUser = req.body;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.option,
          address: updatedUser.address,
          phone: updatedUser.phone,
          about: updatedUser.about,
          photoUrl: updatedUser.photoUrl,
          skills: updatedUser.skills ? updatedUser.skills : null,
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      res.send(result);
    });

    // Classes routes here ----------------------------
    app.post("/new-class",verifyJWT,verifyInstructor, async (req, res) => {
      try {
        const newClass = req.body;
        const result = await classesCollection.insertOne(newClass);
        res.send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Failed to create new class" });
      }
    });

    app.get("/classes", async (req, res) => {
      try {
        const result = await classesCollection
          .find({ status: "approved" })
          .toArray();
        res.send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Failed to fetch classes" });
      }
    });

    // Get classes by instructor email
    app.get("/classes/:email",verifyJWT,verifyInstructor, async (req, res) => {
      try {
        const email = req.params.email;
        const result = await classesCollection
          .find({ instructorEmail: email })
          .toArray();
        res.send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Failed to fetch classes" });
      }
    });

    // Managing classes
    app.get("/classes-manage", async (req, res) => {
      try {
        const result = await classesCollection.find().toArray();
        res.send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Failed to manage classes" });
      }
    });

    // Update class status and reason
    app.patch("/change-status/:id",verifyJWT,verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const { status, reason } = req.body;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = { $set: { status, reason } };
        const result = await classesCollection.updateOne(filter, updateDoc);
        res.send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Failed to change status" });
      }
    });

    // Get approved classes
    app.get("/approved-classes", async (req, res) => {
      try {
        const result = await classesCollection
          .find({ status: "approved" })
          .toArray();
        res.send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Failed to fetch approved classes" });
      }
    });

    // Get single class details
    app.get("/class/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await classesCollection.findOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Failed to fetch class details" });
      }
    });

    // Update class details (all data)
    app.put("/update-class/:id",verifyJWT,verifyInstructor, async (req, res) => {
      try {
        const id = req.params.id;
        const updateClass = req.body;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            name: updateClass.name,
            description: updateClass.description,
            price: updateClass.price,
            availableSeats: parseInt(updateClass.availableSeats),
            videoLink: updateClass.videoLink,
            status: "pending",
          },
        };
        const result = await classesCollection.updateOne(filter, updateDoc);
        res.send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Failed to update class" });
      }
    });

    // Cart routes---------------------------------
    app.post("/add-to-cart",verifyJWT, async (req, res) => {
      try {
        const newCartItem = req.body;
        const result = await cartCollection.insertOne(newCartItem);
        res.send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Failed to add to cart" });
      }
    });

    // Get cart item by id
    app.get("/cart-item/:id", verifyJWT, async (req, res) => {
      try {
        const id = req.params.id;
        const email = req.body.email;
        const query = { classId: id, userEmail: email };
        const projection = { classId: 1 };
        const result = await cartCollection.findOne(query, { projection });
        res.send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Failed to fetch cart item" });
      }
    });

    // Cart info by user email
    app.get("/cart/:email",verifyJWT, async (req, res) => {
      try {
        const email = req.params.email;
        const query = { userMail: email };
        const projection = { classId: 1 };
        const carts = await cartCollection
          .find(query, { projection })
          .toArray();
        const classIds = carts.map((cart) => new ObjectId(cart.classId));
        const result = await classesCollection
          .find({ _id: { $in: classIds } })
          .toArray();
        res.send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Failed to fetch cart info" });
      }
    });

    // Deleting cart item
    app.delete("/delete-cart-item/:id",verifyJWT, async (req, res) => {
      try {
        const id = req.params.id;
        const query = { classId: id };
        const result = await cartCollection.deleteOne(query);
        res.send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Failed to delete cart item" });
      }
    });

    //PAYMENTS ROUTES
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price) * 100;
      const paymentIntent = await stripe.paymentIntents({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });
    //post a payment infor to db

    app.post("/payment-info",verifyJWT, async (req, res) => {
      const paymentInfo = req.body;
      const classesId = paymentInfo.classId;
      const userEmail = paymentInfo.userEmail;
      const singleClassId = req.query.classId;
      let query;
      if (singleClassId) {
        query = { classId: singleClassId, userMail: userEmail };
      } else {
        query = { classId: { $in: classesId } };
      }

      const classQuery = {
        _id: { $in: classesId.map((id) => new ObjectId(id)) },
      };
      const classes = await classesCollection.find(classQuery).toArray();
      const newEnrolledData = {
        userEmail: userEmail,
        classId: singleClassId.map((id) => new ObjectId(id)),
        transactionId: paymentInfo.transactionId,
      };
      const updatedDoc = {
        $set: {
          totalEnrolled:
            classes.reduce(
              (total, current) => total + current.totalEnrolled,
              0
            ) + 1 || 0,
          availableSeats:
            classes.reduce(
              (total, current) => total + current.availableSeats,
              0
            ) - 1 || 0,
        },
      };

      const updatedResult = await classesCollection.updateMany(
        classQuery,
        updatedDoc,
        { upsert: true }
      );
      const enrolledResult = await enrolledCollection.insertOne(
        newEnrolledData
      );
      const deletedResult = await cartCollection.deleteMany(query);
      const paymentResult = await paymentCollection.insertOnne(paymentInfo);

      res.send({ paymentResult, deletedResult, enrolledResult, updatedResult });
    });

    // get payment history

    app.get("/payment-history/:email", async (req, res) => {
      const email = req.params.email;
      const query = { userEmail: email };
      const result = await paymentCollection
        .find(query)
        .sort({ date: -1 })
        .toArray();
      res.send(result);
    });

    //payment history length
    app.get("/payment-history-length/:email", async (req, res) => {
      const email = req.params.email;
      const query = { userEmail: email };
      const total = await paymentCollection.countDocuments(query);
      res.send({ total });
    });

    //Enrollment routes
    app.get("/popular_classes", async (req, res) => {
      const result = await classesCollection
        .find()
        .sort({ totalEnrolled: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });

    app.get("/popular-instructors", async (req, res) => {
      const pipeline = [
        {
          $group: {
            _id: "$instructorEmail",
            totalEnrolled: { $sum: "$totalEnrolled" },
          },
        },
        {
          $loolup: {
            from: "users",
            localField: "_id",
            foreignField: "email",
            as: "instructor",
          },
        },
        {
          $project: {
            _id: 0,
            instructor: {
              $arrayElemAt: ["$instructor", 0],
            },
            totalEnrolled: 1,
          },
        },
        {
          $sort: {
            totalEnrolled: -1,
          },
        },
        {
          $limit: 6,
        },
      ];

      const result = await classesCollection.aggregate(pipeline).toArray();
      res.send(result);
    });

    //admin status
    app.get("/admin-status",verifyJWT,verifyAdmin, async (req, res) => {
      const approvedClasses = (
        await classesCollection.find({ status: "approved" })
      ).toArray().length;
      const pendingClasses = (
        await (await classesCollection.find({ status: "pending" })).toArray()
      ).length;
      const instructors = (
        await userCollection.find({ role: "instructor" })
      ).toArray().length;
      const totalClasses = (await classesCollection.find().toArray()).length;
      const totalEnrolled = (await enrolledCollection.find().toArray()).length;

      const result = {
        approvedClasses,
        pendingClasses,
        instructors,
        totalClasses,
        totalEnrolled,
      };
      res.send(result);
    });

    app.get("/enrolled-classes", async (req, res) => {
      const email = req.params.email;
      const query = { userEmail: email };
      const pipeline = [
        {
          $match: query,
        },
        {
          $lookup: {
            from: "classes",
            localField: "classesId",
            foreignField: "_id",
            as: "classes",
          },
        },
        {
          $unwind: "$classes",
        },
        {
          $lookup: {
            from: "users",
            localField: "classes.instructorEmail",
            foreignField: "email",
            as: "instructor",
          },
        },
        {
          $project: {
            _id: 0,
            instructor: {
              $arrayElemAt: ["$instructor", 0],
            },
            classes: 1,
          },
        },
      ];
      const result = await enrolledCollection.aggregate(pipeline).toArray();
      res.send(result);
    });

    // get all instructor
    app.get("/instructors", async (req, res) => {
      const result = await userCollection
        .find({ role: "instructor" })
        .toArray();
      res.send(result);
    });

    app.get("enrolled-classes/:email",verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { userEmail: email };
      const pipeline = [
        {
          $match: query,
        },
        {
          $lookup: {
            from: "classes",
            localField: "classesId",
            foreignField: "_id",
            as: "classes",
          },
        },
        {
          $unwind: "$classes",
        },
        {
          $lookup: {
            from: "users",
            localField: "classes.instructorEmail",
            foreignField: "email",
            as: "instructor",
          },
        },
        {
          $project: {
            _id: 0,
            classes: 1,
            instructor: {
              $arrayElemAt: ["$instructor", 0],
            },
          },
        },
      ];
      const result = await enrolledCollection.aggregate(pipeline).toArray();
      res.send(result);
    });

    // Applied route
    app.post("/as-instructor", async (req, res) => {
      const data = req.body;
      const result = await appliedCollection.insertOne(data);
      res.send(result);
    });
    app.get("/applied-instructors/:email", async (req, res) => {
      const email = req.params.email;
      const result = await appliedCollection.findOne({ email });
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } catch (err) {
    console.error("Failed to connect to MongoDB", err);
  }
}

connectToDatabase();

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send({ error: "Something went wrong!" });
});

app.get("/", (req, res) => {
  res.send("Hello Developers 2025");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
