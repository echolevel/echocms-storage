/*
  EchoCMS Storage Manager by Brendan Ratliff - http://echolevel.co.uk


  API for generating thumbnails and optimising/compressing JPG/PNG files then uploading them to Google Cloud Storage
  and returning publicly accessible filenames. GIF, BMP and audio/video files are uploaded directly with no processing.
  POST requests to /upload take an image file, a target GCS bucket name and the contents of a Google service account
  authentication keyfile. Requests to /delete take the bucket name, the keyfile, and the URL of the file to be deleted.

  Written for my AngularJS/Firebase CMS web app. The Node Firebase package does everything except Storage, which is why
  I had to use the incredibly frustrating google-cloud package.... Having to upload the keyfile data then write it to 
  a temp file is a pain on the client-side and an ungraceful solution on the server-side, but that's just how it is.

*/

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
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.use(multer({ dest: './uploads'}).array('files', 2));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));


app.post('/api/upload', function(req, res) {
    
    var projID = req.body.storageBucket.split('.')[0];
    
    // The contents of a Google Cloud service account keyfile are written to a file (otherwise google-cloud refuses
    // to accept the credentials). The file needs a .json extension, even if the mimetype is properly set. What a 
    // pain. It's written to a temp directory but deleted along with temporary image files later in this block.
    fs.rename(req.files[1].path, './uploads/' + projID + '_auth.json', function(err) {
      if(err) console.log("Error renaming json file " + err);
    })
  
    var gcloud = require('google-cloud')({
      projectID: req.body.storageBucket.split('.')[0],
      keyFilename: './uploads/' + projID + '_auth.json'
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
      // Default thumbnail width if not specified as a request param
      var thumbsize = 250;
    }
    if(req.query.dir.length) {
      var targetdir = req.query.dir + '/';
    } else {
      // Default bucket subdirectory if not specified as a request param
      var targetdir = 'imgstore/';
    }
    var stamp = Date.now();
  
    
    if(req.files[0].mimetype == 'image/jpeg' || req.files[0].mimetype == 'image/png') {
    
      async.parallel({
        opt_max: function(callback) {

          // No resizing, just optimise, upload, then return URL as result
          
          var outurl;
          sharp(req.files[0].path).withoutEnlargement(true).toBuffer(function(err, buff) {
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
                var maxfile = bucket.file(targetdir + stamp + '_' + req.files[0].originalname);
                var maxstream = maxfile.createWriteStream({
                  metadata: {
                    contentType: req.files[0].mimetype
                  }
                })
                .on('error', function(err) { console.log(err)})
                .on('finish', function() {
                    maxfile.makePublic().then(function(data) {
                      outurl = 'https://storage.googleapis.com/' + req.body.storageBucket + '/' + targetdir + stamp + '_' + req.files[0].originalname;              
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

          // Resize them optimise, upload, then return URL as result
          
          var outurl;
          sharp(req.files[0].path).resize(thumbsize).withoutEnlargement(true).toBuffer(function(err, buff) {
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
                var thumbfile = bucket.file(targetdir + stamp + '_thumb_' + req.files[0].originalname);
                var thumbstream = thumbfile.createWriteStream({
                  metadata: {
                    contentType: req.files[0].mimetype
                  }
                })
                .on('error', function(err) { console.log(err)})
                .on('finish', function() {
                    thumbfile.makePublic().then(function(data) {
                      outurl = 'https://storage.googleapis.com/' + req.body.storageBucket + '/' + targetdir + stamp + '_thumb_' + req.files[0].originalname;              
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
        // All processing functions finished.
        // results is: {opt_max: "result1", opt_thumb: "result2"}
        locationObj = results;
        locationObj.orig_name = req.files[0].originalname;
        locationObj.thumb_width = thumbsize
        res.send(locationObj);
        clearDir('./uploads', false);
      });
    
    } else if(req.files[0].mimetype == 'image/gif' || req.files[0].mimetype == 'image/bmp') {
      // No optimisation or thumbnailing; upload and return location in both opt_max and opt_thumb fields
      var storedfile = bucket.file(targetdir + stamp + '_' + req.files[0].originalname);
      var storedstream = storedfile.createWriteStream({
        metadata: {
          contentType: req.files[0].mimetype
        }
      })
      .on('error', function(err) { console.log(err)})
      .on('finish', function() {
        storedfile.makePublic().then(function(data) {
          outobj = {
            opt_max: 'https://storage.googleapis.com/' + req.body.storageBucket + '/' + targetdir + stamp + '_' + req.files[0].originalname,
            opt_thumb: 'https://storage.googleapis.com/' + req.body.storageBucket + '/' + targetdir + stamp + '_' + req.files[0].originalname,
            orig_name: req.files[0].originalname,
            thumb_width: thumbsize
          }
          res.send(outobj);
          clearDir('./uploads', false);
        })
      })
      fs.readFile(req.files[0].path, function(err, data) {
        if(err){
          console.log(err);
        } else {
          storedstream.end(data);
        }
      })
    }

})


app.post('/api/delete', function(req, res) {

  var projID = req.body.storageBucket.split('.')[0];
  
  fs.rename(req.files[0].path, './uploads/' + projID + '_auth.json', function(err) {
    if(err) console.log("Error renaming json file " + err);
  })

  var gcloud = require('google-cloud')({
    projectID: req.body.storageBucket.split('.')[0],
    keyFilename: './uploads/' + projID + '_auth.json'
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
  res.send('Nothing is here.');  
})


app.listen(process.env.PORT || 8086, function() {
  console.log('Listening on' + process.env.PORT || 8086);
})