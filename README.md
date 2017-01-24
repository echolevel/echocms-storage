# EchoCMS Storage

EchoCMS Storage Manager by Brendan Ratliff - (http://echolevel.co.uk).



## About

EchoCMS is a custom, lightweight CMS I wrote to drive my [portfolio website](http://echolevel.co.uk). While playing around with Google PageSpeed, and realising that unoptimised images were killing my scores, I decided to put together a server-side API that would resize and optimise/compress images, handle all the storage stuff, then return the URLs for me to store in my database.

The CMS is AngularJS driven and Firebase backed. Sadly, the Firebase module for Node.js does everything *except* for storage, so the google-cloud module has to handle all that stuff. It's a bit of a pain: you can, as far as I can tell, only authenticate it on a temporary/per-request basis using a service account keyfile. So EchoCMS (running on localhost) has a load of credentials saved in localstorage (necessary for other Firebase API stuff), along with the JSON contents of that service account keyfile. That JSON is sent along with the image uploads or delete requests, turned into a temp file on the Node server, used for auth, then deleted.

Not as elegant as I'd like, but it's been a nice way to learn about Node.JS and Express. I'll update this readme soon with details of how I'm making the requests from the CMS, in case it's of use to anybody.

Currently my site is hosted on RedHat Openshift while this storage API is running on Heroku and the database/files are on Firebase. Not many people look at my site, and I don't update it more than a dozen times a month, so it's a great sandbox for trying stuff out while keeping beneath all those free-tier thresholds. 
