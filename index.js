const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const app = express()
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;


// middleware
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  optionSuccessStatus: 200,
}
app.use(cors(corsOptions))
app.use(express.json());


// mongodb

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.uwjhzip.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {

    // collections
    const categoryCollection = client.db("medDB").collection('category');
    const categoryNameCollection = client.db("medDB").collection('categoryName');
    const usersCollection = client.db("medDB").collection('users');
    const cartCollection = client.db("medDB").collection('cart');
    const paymentCollection = client.db("medDB").collection("payments");

    // jwt relrated api
    app.post('/jwt',async(req,res)=>{
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET,{expiresIn: '365d'});
      res.send({token});
    })

    // middlewares
    const verifyToken = (req,res,next) =>{
      if(!req.headers.authorization){
        return res.status(401).send({message: 'unauthorized access'});
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
      })
    }

        // use verify admin after verifyToken
        const verifyAdmin = async (req, res, next) => {
          const email = req.decoded.email;
          const query = { email: email };
          const user = await usersCollection.findOne(query);
          const isAdmin = user?.role === 'admin';
          if (!isAdmin) {
            return res.status(403).send({ message: 'forbidden access' });
          }
          next();
        }

    // get all medicine data 
    app.get('/medicines',async(req,res)=>{
      const result = await categoryCollection.find().toArray()
      res.send(result)
    })
    // get a singel medicine data by id
    app.get('/medicine/:id', async(req,res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await categoryCollection.findOne(query)
      res.send(result);
    })
    // all medicine filter by category name
    app.get('/category', async(req,res)=>{
        const category = req.query.category;
        const result = await categoryCollection.find({category}).toArray();
        res.send(result)
    })

    // all category
    app.get('/categoryName', async(req,res)=>{
        const result = await categoryNameCollection.find().toArray();
        res.send(result)
    })
    // add medicine to the cart
    app.post('/cart', async(req,res)=>{
      const medicineData = req.body;
      const result = await cartCollection.insertOne(medicineData);
      res.send(result)
    })
    // get card data add by user filter by user email
    app.get('/userCart/:email', async (req,res)=>{
      const email = req.params.email;
      const query = {user_email: email};
      const result = await cartCollection.find(query).toArray();
      res.send(result)
    })
    // delete user all cart data by email
    app.delete('/deleteAllCart/:email', async(req,res)=>{
      const email = req.params.email;
      const query = {user_email: email};
      const result = await cartCollection.deleteMany(query)
      res.send(result)
    })
    // delete single item from cart by id
    app.delete('/deleteOneCart/:id', async(req,res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await cartCollection.deleteOne(query)
      res.send(result)
    })
    // increase count by +1
    app.put('/cart/increment/:id', async (req, res) => {
      try {
        const result = await cartCollection.findOneAndUpdate(
          { _id: new ObjectId(req.params.id) },
          { $inc: { count: 1 } },
          { returnOriginal: false }
        );
        res.json(result.value);
      } catch (error) {
        res.status(500).send(error);
      }
    });
     // Decrement item count
  app.put('/cart/decrement/:id', async (req, res) => {
    try {
      const item = await cartCollection.findOne({ _id: new ObjectId(req.params.id) });
      if (item.count > 1) {
        const result = await cartCollection.findOneAndUpdate(
          { _id: new ObjectId(req.params.id) },
          { $inc: { count: -1 } },
          { returnOriginal: false }
        );
        res.json(result.value);
      } else {
        res.status(400).json({ message: 'Count cannot be less than 1' });
      }
    } catch (error) {
      res.status(500).send(error);
    }
  });
      // users releted api
      app.post('/users',async(req,res)=>{
        const user = req.body;
        const query = {email: user.email};
        const existingUser = await usersCollection.findOne(query);
        if(existingUser){
          return res.send({message: 'user already exists', insertedId: null})
        }
        const result = await  usersCollection.insertOne(user);
        res.send(result);
      })

      app.get('/users',verifyToken,verifyAdmin, async (req, res) => {
        const result = await usersCollection.find().toArray();
        res.send(result);
      });
      // CHECK THE USER IS A ADMIN OR NOT
      app.get('/users/admin/:email', verifyToken, async (req, res) => {
        const email = req.params.email;
  
        if (email !== req.decoded.email) {
          return res.status(403).send({ message: 'forbidden access' })
        }
  
        const query = { email: email };
        const user = await usersCollection.findOne(query);
        let admin = false;
        if (user) {
          admin = user?.role === 'admin';
        }
        res.send({ admin });
      })
      
      // payments releted api
      // payment intent
    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log(amount, 'amount inside the intent')

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    });


    app.get('/payments/:email',verifyToken, async (req, res) => {
      const query = { email: req.params.email }
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    })

    app.post('/payments', async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);

      //  carefully delete each item from the cart
      console.log('payment info', payment);
      // get the id of cart items
      const cartIds = payment.cartInfo.map(item => item.itemId);

      const query = {
        _id: {
          $in: cartIds.map(id => new ObjectId(id))
        }
      };

      const deleteResult = await cartCollection.deleteMany(query);

      res.send({ paymentResult, deleteResult });
    })
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {

  }
}
run().catch(console.dir);



app.get('/', (req, res)=>{
    res.send('Med-Nust Is On Fire')
})

app.listen(port, ()=>{
    console.log(`Med-Nust is running on port: ${port}`);
})