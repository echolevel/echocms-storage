# EchoCMS Storage

EchoCMS Storage Manager by Brendan Ratliff - (http://echolevel.co.uk).



## About

EchoCMS is a custom, lightweight CMS I wrote to drive my [portfolio website](http://echolevel.co.uk). While playing around with Google PageSpeed, and realising that unoptimised images were killing my scores, I decided to put together a server-side API that would resize and optimise/compress images, handle all the storage stuff, then return the URLs for me to store in my database.

The CMS is AngularJS driven and Firebase backed. Sadly, the Firebase module for Node.js does everything *except* for storage, so the google-cloud module has to handle all that stuff. It's a bit of a pain: you can, as far as I can tell, only authenticate it on a temporary/per-request basis using a service account keyfile. So EchoCMS (running on localhost) has a load of credentials saved in localstorage (necessary for other Firebase API stuff), along with the JSON contents of that service account keyfile. That JSON is sent along with the image uploads or delete requests, turned into a temp file on the Node server, used for auth, then deleted.

Not as elegant as I'd like, but it's been a nice way to learn about Node.JS and Express. I'll update this readme soon with details of how I'm making the requests from the CMS, in case it's of use to anybody.

Currently my site is hosted on RedHat Openshift while this storage API is running on Heroku and the database/files are on Firebase. Not many people look at my site, and I don't update it more than a dozen times a month, so it's a great sandbox for trying stuff out while keeping beneath all those free-tier thresholds. 

## Usage

You could clone it, initialise a Heroku app, then push it up there. Local testing can be done with Heroku, or just with Node.JS. I use [nodemon](https://github.com/remy/nodemon) to watch for changes and restart the server, but remember to set up an ignore on the ./uploads directory, otherwise the hacky-but-necessary renaming of the temporary keyfile will restart the process and kill the upload function.

You might also want to tighten up the CORS stuff for security if you want to hit this from a website on a static, Internet domain (rather than localhost).

My upload function in AngularJS is something like this:

```
$scope.upload = function(fileElement) {
    // from the a frontend file selector
    var file = document.getElementById(fileElement).files[0];
    
    // from a JSON string containing Google Cloud Storage service account keyfile contents
    var authblob = new Blob([$rootScope.config.keyfile], {type: 'application/json'});
    
    // 'rsz' to specify thumbnail width - omit to default to 250
    // 'dir' to specify a bucket subdirectory - omit to default to 'imgstore/'
    upUrl = 'https://your-app-domain.com/api/upload?rsz=700&dir=echoblog';

    // Create FormData as we're sending this to Multer
    userFile = new FormData();
    var fname = file.name;
    // 'files' is an array that Multer will handle
    userFile.append('files', file);
    userFile.append('files', authblob);
    userFile.append('storageBucket', $rootScope.config.storageBucket);
    
    $http.post(upUrl, userFile, {
      // This stuff might not be necessary...
      transformRequest: angular.identity,
      headers: {'Content-Type': undefined},
      responseType: 'json'
    }).success(function(data) {
      // Do something with the replies - the image's original filename (it's now prefixed with a timestamp),
      // the new public thumbnail URL, and the new public URL for the original-sized file - both optimised.
      // Note: PNG and JPG get optimised/resized; GIF and BMP don't. They're just uploaded directly.
      // Here, I'm adding them to a FirebaseArray binding synced to the database.
      $scope.imageStore.$add({
        'orig_name' : data.orig_name,
        'url_thumb'   : data.opt_thumb,
        'url_max'   : data.opt_max
      });

    }).error(function(data, status) {
      console.log("error: " + status);
    })
  }
  
```
