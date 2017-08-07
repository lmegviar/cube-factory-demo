const AWS = require('aws-sdk');
AWS.config.update({
  region: "us-east-1",
});

const fs = require('fs');
const child_process = require('child_process');
const s3 = new AWS.S3();
const dynamodb = new AWS.DynamoDB();
const docClient = new AWS.DynamoDB.DocumentClient();
const bucket = 'cube-factory-demo';
const bucketUrl = 'http://cube-factory-demo.amazonaws.com';
const tempPath = null;


function createTempDir () {
  return new Promise((resolve, reject) => {
    fs.mkdtemp('cube', (err, path) => {
      if (err) {
        reject(err)
      }
      resolve(path);
    });
  });
}

function makeDataFile (path, data) {
  data = JSON.stringify(data);
  return new Promise((resolve, reject) => {
    fs.writeFile(path, data, (err) => {
      if (err) reject("Unable to write data to file." + JSON.stringify(err, null, 2));
      resolve();
    });  
  });
}

function getData (config, path) {
  var table = "DemoUsers";
  var ids = config.users;
  var path = path + '/user_data'

  return Promise.all(ids.map((id) => {
    let params = {
      TableName: table,
      Key: {
        "firstName": id
      }
    };
    return new Promise((resolve, reject) => {
      docClient.get(params, (err, data) => {
        if (err) {
          reject("Unable to read user data. Error JSON:" + JSON.stringify(err, null, 2));
        } else {
          console.log("Get data succeeded.", JSON.stringify(data));
          resolve(data);
        } 
      });
    });
  }))
  .then(arr => makeDataFile(path, arr.map(JSON.stringify).join("\n")));
}

function getTemplateApp (tempPath) {
  var params = {
    Bucket: bucket, 
    Key: "appTemplate/dummyApp.js"
  };
  var appPath = tempPath + '/app';
  console.log('appPath: ', appPath);
  var file = fs.createWriteStream(appPath);
  return new Promise((resolve, reject) => {
    s3.getObject(params).createReadStream().on('end', () => { 
      return resolve(); 
    }).on('error', (error) => { 
      return reject(error); 
    }).pipe(file)
  });
}

function zipApp (path, dataPath, appPath) {
  var zipCommand = 'zip -r ' + path + ' ' + dataPath + ' ' + appPath;
  return new Promise((resolve, reject) => {
    child_process.exec(zipCommand, (err) => {
      if (err) reject(console.err("Unable to zip files." + JSON.stringify(err, null, 2)));
      console.log('App zip succeeded.')
      resolve();
    });
  });
}

function pushBundleToCloud (path) {
  return new Promise ((resolve, reject) => {
    var stream = fs.createReadStream(path + '.zip')
    var key = "appInstances/" + path + '.zip';
    stream.on('error', reject);
    stream.on('open', function () {
      var params = {
        Body: stream,
        Bucket: bucket,
        Key: key,
        ACL: 'public-read'
      };
      s3.upload(params, (err, data) => {
        if (err) reject(err);
        else {
          console.log('Bundle push succeeded. Data: ', data);
          resolve(data); 
        }          
      });
    });  
  });
}

function clearTempDir (path) {
  var removeCommand1 = 'rm -r ' + path + ' ' + path + '.zip';
  child_process(removeCommand, (err) => {
    console.err("Unable to delete temp files.", JSON.stringify(err, null, 2));
 });
};

function buildApp (req, res) {
  var path = null;
  createTempDir()
  .then((tempPath) => {
    path = tempPath;
    return getData(req.body, tempPath);
  })
  .then(() => {
    return getTemplateApp(path);
  })
  .then(() => {
    var dataPath = path + '/user_data'
    var appPath = path + '/app'
    return zipApp(path, dataPath, appPath);
  })
  .then(() => {
    return pushBundleToCloud(path);
  })
  .then(() => {
    clearTempDir(path);
    var url = bucketUrl + '/instanceId';
    console.log('url: ', url);
    res.send(JSON.stringify({url: url}));
  })
  .catch(err => res.status(500).send(JSON.stringify(err)));
};

module.exports = {
  buildApp: buildApp
}

