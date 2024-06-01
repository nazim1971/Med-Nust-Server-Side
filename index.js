const { MongoClient, ServerApiVersion } = require('mongodb');
const express = require('express');
const app = express()
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000;


// middleware
app.use(cors());
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