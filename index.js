const imagemin = require('imagemin');
const imageminMozjpeg = require('imagemin-mozjpeg');
const imageminPngquant = require('imagemin-pngquant');
var multer = require('multer');
var express = require('express');
var app = express();
var path = require('path');
var sharp = require('sharp');
app.set('port', (process.env.PORT || 5000));

var compress = multer.diskStorage({
  destination: function(req, file, callback) {
    
    callback(null, './uploads');
  },
  filename: function(req, file, callback) {
    console.log(file);
    callback(null, 'opt_' + file.originalname);
  }
})

var resize = multer.diskStorage({
  destination: function(req, file, callback) {
    
    callback(null, './uploads');
  },
  filename: function(req, file, callback) {
    console.log(file);
    callback(null, 'thumb_' + file.originalname);
  }
})

var optimOnly = multer({ storage: compress}, {limits: {fileSize: 10000}}).single('file');
var optimResize = multer({ storage: resize}, {limits: {fileSize: 10000}}).single('file');

app.all('*', function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.use(express.static(__dirname + '/public'));

// views is directory for all template files
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.get('/', function(request, response) {
  response.render('pages/index');
});

// Resizes PNG and JPG to some maximum width, then optimises. Use for (big) thumbnails.
app.post('/api/optimresize',function(req,res){
    optimResize(req,res,function(err) {
        if(err) {
            return res.end("Error uploading file: " + err);
        }
        //console.log(req);
        console.log("logging filename: " );
        var temppath = __dirname + '/resized/' + req.file.originalname;
        sharp(req.file.path).resize(700).withoutEnlargement(true).toFile(temppath).then( data => {
        
          imagemin([temppath], './compressed', {
            plugins : [
              imageminMozjpeg(),
              imageminPngquant({quality: '65-90'})
            ]
          }).then(files => {
            //console.log(files);
            console.log(__dirname + '/' + files[0].path)
            var ext = files[0].path.substring(files[0].path.lastIndexOf('.')+1, files[0].path.length).toLowerCase();
            var type = "";
            if(ext == 'png') {
              type = "image/png";
            } else if(ext == 'jpg' || ext == 'jpeg') {
              type = "image/jpeg";
            }
            var options = {
              headers: {
                'Content-Type' : type
              }
            }
            res.sendFile(__dirname + '/' + files[0].path, options);          
          
          }).catch(err => {
            console.log(err);
          });

        }).catch(err => {
          console.log(err);
        });

    });
});

// Optimises PNG and JPG, but no cropping. Use for storing original resolution.
app.post('/api/optimonly',function(req,res){
    optimOnly(req,res,function(err) {
        if(err) {
            return res.end("Error uploading file: " + err);
        }
        //console.log(req);
        console.log("logging filename: " );
        
          imagemin([req.file.path], './compressed', {
            plugins : [
              imageminMozjpeg(),
              imageminPngquant({quality: '65-90'})
            ]
          }).then(files => {
            //console.log(files);
            console.log(__dirname + '/' + files[0].path)
            var ext = files[0].path.substring(files[0].path.lastIndexOf('.')+1, files[0].path.length).toLowerCase();
            var type = "";
            if(ext == 'png') {
              type = "image/png";
            } else if(ext == 'jpg' || ext == 'jpeg') {
              type = "image/jpeg";
            }
            var options = {
              headers: {
                'Content-Type' : type
              }
            }
            res.sendFile(__dirname + '/' + files[0].path, options);          
          
          })

    });
});

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});


