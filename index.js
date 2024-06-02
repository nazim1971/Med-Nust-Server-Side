const { MongoClient, ServerApiVersion } = require('mongodb');
const express = require('express');
const app = express()
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
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

    // jwt relrated api
    app.post('/jwt',async(req,res)=>{
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET,{expiresIn: '1h'});
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

    // all medicine
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

      app.get('/users',verifyToken, async (req, res) => {
        const result = await usersCollection.find().toArray();
        res.send(result);
      });

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