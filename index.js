const imagemin = require('imagemin');
const imageminMozjpeg = require('imagemin-mozjpeg');
const imageminPngquant = require('imagemin-pngquant');
const fs = require('fs');
var multer = require('multer');
var express = require('express');
var app = express();
var path = require('path');
var sharp = require('sharp');
var bodyParser = require('body-parser');
var async = require('async');
var request = require('request');
 
app.all('*', function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', '*');
  next();
});


app.use(multer({ dest: './uploads'}).single('file'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));


app.post('/api/test', function(req, res) {
  console.log(req.body);
  res.send(req.body);
  
  /*
  request({
      url: 'https://www.googleapis.com/upload/storage/v1/b/' + req.body.storageBucket + '/o?uploadType=media&name=testName'
    })*/
  
})

app.post('/api/delete', function(req, res) {

  var gcloud = require('google-cloud')({
    projectID: req.body.storageBucket.split('.')[0],
    key: req.body.apiKey
  })
  var gcs = gcloud.storage();
  var bucket = gcs.bucket(req.body.storageBucket);
  
  bucket.exists(function(err, exists) {
    if(!err) {
      console.log("bucket exists");      
    } else {
      console.log("bucket doesn't exist: " + err);
    }
  })

  var target = bucket.file(req.query.target);

  target.delete(function(err, apiResponse) {
      if(err) {
        console.log(err)
        res.send(err);
      } else {
        console.log(apiResponse);
        res.send(apiResponse);
      }
    })
  
})


app.post('/api/upload', function(req, res) {
  
  console.log(req.body.apiKey);
  
  fs.writeFileSync('./tmpkey.json', JSON.stringify(req.body.keyfile), function(err) {
    if(err){
      console.log("File write error for keyfile: " + err);
      res.send("File write error for keyfile: " + err);
    } else {
      var gcloud = require('google-cloud')({
        projectID: req.body.storageBucket.split('.')[0],
        credentials: './tmpkey.json'
      })
    }
  })
  
  
  var gcs = gcloud.storage();
  var bucket = gcs.bucket(req.body.storageBucket);
  
  bucket.exists(function(err, exists) {
    if(!err) {
      console.log("bucket exists");      
    } else {
      console.log("bucket doesn't exist: " + err);
    }
  })
  
  if(parseInt(req.query.rsz) > 0) {
    var thumbsize = parseInt(req.query.rsz);
  } else {
    var thumbsize = 250;
  }
  if(req.query.dir.length) {
    var targetdir = req.query.dir + '/';
  } else {
    var targetdir = 'imgstore/';
  }
  var stamp = Date.now();

  
  if(req.file.mimetype == 'image/jpeg' || req.file.mimetype == 'image/png') {
  
    async.parallel({
      opt_max: function(callback) {
        //do things
        // No resizing, just optimise, upload, then return URL as result
        
        var outurl;
        sharp(req.file.path).withoutEnlargement(true).toBuffer(function(err, buff) {
          if(err) {
            res.send(err);
          } else {
            imagemin.buffer(buff, {
              plugins : [
                imageminMozjpeg(),
                imageminPngquant({quality: '65-90'})
              ]
            }).then(function(data){
              // Upload the optimised, unresized file
              var maxfile = bucket.file(targetdir + stamp + '_' + req.file.originalname);
              var maxstream = maxfile.createWriteStream({
                metadata: {
                  contentType: req.file.mimetype
                }
              })
              .on('error', function(err) { console.log(err)})
              .on('finish', function() {
                  maxfile.makePublic().then(function(data) {
                    outurl = 'https://storage.googleapis.com/' + req.body.storageBucket + '/' + targetdir + stamp + '_' + req.file.originalname;              
                    callback(null, outurl);
                  })
              })
              maxstream.end(data);        
            }, function(err) {
              console.log(err);
            })
          }
        });                
        
      },
      opt_thumb: function(callback) {
        //do things
        // Resize them optimise, upload, then return URL as result
        
        var outurl;
        sharp(req.file.path).resize(thumbsize).withoutEnlargement(true).toBuffer(function(err, buff) {
          if(err) {
            res.send(err);
          } else {
            imagemin.buffer(buff, {
              plugins : [
                imageminMozjpeg(),
                imageminPngquant({quality: '65-90'})
              ]
            }).then(function(data){
              // Upload the optimised, unresized file
              var thumbfile = bucket.file(targetdir + stamp + '_thumb_' + req.file.originalname);
              var thumbstream = thumbfile.createWriteStream({
                metadata: {
                  contentType: req.file.mimetype
                }
              })
              .on('error', function(err) { console.log(err)})
              .on('finish', function() {
                  thumbfile.makePublic().then(function(data) {
                    outurl = 'https://storage.googleapis.com/' + req.body.storageBucket + '/' + targetdir + stamp + '_thumb_' + req.file.originalname;              
                    callback(null, outurl);
                  })
              })
              thumbstream.end(data);        
            }, function(err) {
              console.log(err);
            })
          }
        });
        
        
      }
    },
    function(err, results) {
      // All functions finished.
      // results is: {opt_max: "result1", opt_thumb: "result2"}
      locationObj = results;
      locationObj.orig_name = req.file.originalname;
      locationObj.thumb_width = thumbsize
      res.send(locationObj);
      clearDir('./uploads', false);
    });
  
  } else if(req.file.mimetype == 'image/gif' || req.file.mimetype == 'image/bmp') {
    // No optimisation or thumbnailing; upload and return location in both opt_max and opt_thumb fields
    // TO DO
    var storedfile = bucket.file(targetdir + stamp + '_' + req.file.originalname);
    var storedstream = storedfile.createWriteStream({
      metadata: {
        contentType: req.file.mimetype
      }
    })
    .on('error', function(err) { console.log(err)})
    .on('finish', function() {
      storedfile.makePublic().then(function(data) {
        outobj = {
          opt_max: 'https://storage.googleapis.com/' + req.body.storageBucket + '/' + targetdir + stamp + '_' + req.file.originalname,
          opt_thumb: 'https://storage.googleapis.com/' + req.body.storageBucket + '/' + targetdir + stamp + '_' + req.file.originalname,
          orig_name: req.file.originalname,
          thumb_width: thumbsize
        }
        res.send(outobj);
        clearDir('./uploads', false);
      })
    })
    fs.readFile(req.file.path, function(err, data) {
      if(err){
        console.log(err);
      } else {
        storedstream.end(data);
      }
    })
  }
  

})


var clearDir = function(dirPath, removeSelf) {
  if (removeSelf === undefined)
    removeSelf = true;
  try { var files = fs.readdirSync(dirPath); }
  catch(e) { return; }
  if (files.length > 0)
    for (var i = 0; i < files.length; i++) {
      var filePath = dirPath + '/' + files[i];
      if (fs.statSync(filePath).isFile())
        fs.unlinkSync(filePath);
      else
        rmDir(filePath);
    }
  if (removeSelf)
    fs.rmdirSync(dirPath);
};



app.get('/', function(req, res) {
  //res.send('Got a GET request');
  res.sendFile(__dirname + "/index.html");
})


app.listen(process.env.PORT || 8086, function() {
  console.log('Listening on 8086');
})