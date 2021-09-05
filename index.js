const express = require('express');
const trackRoute = express.Router();
const multer = require('multer');

const mongoose = require('mongoose');

const {Readable} = require('stream')

const app = express();
app.use('/tracks', trackRoute);

let db;

mongoose.connect('mongodb://localhost/trackDB', (err, database) => {
    if(err){
        console.log(`Connection Failed`);
        process.exit(1);
    }
    db = database;
})

// Get tracks

trackRoute.get('/:trackID', (req, res) => {
    try {
      var trackID = new mongoose.mongo.ObjectId(req.params.trackID);
    } catch(err) {
      return res.status(400).json({ message: "Invalid trackID in URL parameter. Must be a single String of 12 bytes or a string of 24 hex characters" }); 
    }
    res.set('content-type', 'audio/mp3');
    res.set('accept-ranges', 'bytes');
  
    let bucket = new mongoose.mongo.GridFSBucket(db, {
      bucketName: 'tracks'
    });
  
    let downloadStream = bucket.openDownloadStream(trackID);

    // console.log(downloadStream);
  
    downloadStream.on('data', (chunk) => {
      return res.write(chunk);
    });
  
    downloadStream.on('error', (err) => {
      res.sendStatus(404);
    });
  
    downloadStream.on('end', () => {
      res.end();
    });
  });

// Post
trackRoute.post('/', (req, res) => {
    const storage = multer.memoryStorage()
    const upload = multer({storage: storage, limits: {fields: 1, fileSize: 12000000, files: 1, parts: 2}})
    upload.single('track')(req, res, (err) => {
        if(err){
            console.log(err);
            return res.status(400).json({message: 'upload validation Failed'})
        } else if(!req.body.name){
            return res.status(400).json({message: "No track name in request body"})
        }

        let trackName = req.body.name

        //convert buffer to Readable Streaming
        const readableTrackStream = new Readable();
        readableTrackStream.push(req.file.buffer)
        readableTrackStream.push(null)

        let bucket = new mongoose.mongo.GridFSBucket(db, {
            bucketName: 'tracks'
        })

        let uploadStream = bucket.openUploadStream(trackName);
        let id = uploadStream.id;
        readableTrackStream.pipe(uploadStream);

        uploadStream.on('error', err => {
            return res.status(500).json({message: "Error uploading file"})
        })

        uploadStream.on('finish', () => {
            return res.status(200).json({message: "File uploaded successfully, stored under id " + id})
        })
    })
})

app.listen(5000, console.log("Server Up"))