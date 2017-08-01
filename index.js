var fs = require('fs');
var jimp = require('jimp');
var dotenv = require('dotenv');
var jsforce = require('jsforce');
var Promise = require('promise');
var exec = require('child-process-promise').exec;

dotenv.load();

var firstPic;

function start() {
  var caseId;
  var conn = new jsforce.Connection();
  if (fs.existsSync('current.jpg')) {
    console.log('Moving current.jpg to previous.jpg');
    fs.renameSync('current.jpg', 'previous.jpg');
  }
  console.log('Snapping a pic.');
  
  exec('raspistill -w 640 -h 480 -o current.jpg')
    .then(function(res) {
      console.log('Reading current.jpg into jimp');
      return jimp.read('current.jpg');
    })
    .then(function(res) {
      firstPic = res;
      console.log('First pic loaded... now onto second pic');
      return jimp.read('previous.jpg');
    })
    .then(function(res) {
      console.log('Second pic loaded... now performing diff');
      return diff = jimp.diff(firstPic, res);
    })
    .then(function(res) {
      console.log('Diff: '+diff.percent);
      if (diff.percent > 0.15) {
        conn.login(process.env.username, process.env.password)
          .then(function(res) {
            console.log('Success logging in as '+process.env.username);
            return conn.sobject('Case').create({
                Subject: 'Pic discrepancy found',
            })
          })
          .then(function(newSobj) {
            console.log('Case created. ',newSobj.id);
            caseId = newSobj.id;
            

            var fileType = 'image/jpeg';

            fs.readFile('current.jpg', function (err, filedata) {
              if (err){
                console.error(err);
              } else{
                var base64data = new Buffer(filedata).toString('base64');
                conn.sobject('Attachment').create({
                  ParentId: caseId,
                  Name : 'current.jpg',
                  Body: base64data,
                  ContentType : fileType,
                },
                function(err, uploadedAttachment) {
                  if (err) {
                    console.log('Error uploading file: '+err);
                  } else {
                    console.log('Uploaded attachment: ',uploadedAttachment);
                  }

                });
              }
            });
            
            fs.readFile('previous.jpg', function (err, filedata) {
              if (err){
                console.error(err);
              } else{
                var base64data = new Buffer(filedata).toString('base64');
                conn.sobject('Attachment').create({
                  ParentId: caseId,
                  Name : 'previous.jpg',
                  Body: base64data,
                  ContentType : fileType,
                },
                function(err, uploadedAttachment) {
                  if (err) {
                    console.log('Error uploading file: '+err);
                  } else {
                    console.log('Uploaded attachment: ',uploadedAttachment);
                  }

                });
              }
            });
            
          });
      } else {
        console.log('Image is pretty close at '+diff.percent);
      }
    }, function(err) {
      console.error('Error caught! '+err);
    })
    .then(function(res) {
      console.log('Sleeping for 30 seconds and going again!');
      setTimeout(start, 30000);
    });;
}

start();