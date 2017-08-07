const fs = require('fs');
const child_process = require('child_process');
const AWS = require('aws-sdk');
const AdmZip = require('adm-zip');

const s3 = new AWS.S3();
const dynamodb = new AWS.DynamoDB();
const docClient = new AWS.DynamoDB.DocumentClient();
const bucket = 'cube-factory-demo';
const bucketUrl = 'http://cube-factory-demo.amazonaws.com';
const instanceId = Date.now().toString();

function createTempDir () {
  return new Promise((resolve, reject) => 
    fs.mkdtemp('cube', (error, path) => {
      if (error) {
        reject(error)
      }
      resolve(path);
    });
}

function makeDataFile (path, data) {
  data = JSON.stringify(data);
  return new Promise((resolve, reject) => {
    fs.writeFile(dataPath, data, (err) => {
      if (err) reject("Unable to write data to file.", JSON.stringify(err, null, 2));
      resolve();
    });  
  });
}

function getData (config, path) {
  var table = "DemoUsers";
  var ids = config.users;
  var path = path + '/user_data'
  var params = {
    TableName: table,
  };
  return Promise.all(ids.map((id) => {
    params['Key'] = {
      "ID": id
    }
    return new Promise((resolve, reject) => {
      docClient.get(params, (err, data) => {
        if (err) {
          reject("Unable to read user data. Error JSON:", JSON.stringify(err, null, 2));
        } else {
          console.log("Get data succeeded.", JSON.stringify(data, null, 2));
          resolve(data);
        } 
      });
    }
  })
  .then(arr => makeDataFile(path, arr.join("\n")));
}

function getTemplateApp (tempPath) {
  var params = {
    Bucket: bucket, 
    Key: "appTemplate/dummyApp.js"
  };
  return new Promise((resolve, reject) => {
    s3.getObject(params, (err, data) => {
      if (err) reject(console.log(err, err.stack)); 
      var path = tempPath + '/app'    
      console.log(data);  
      resolve(makeDataFile(path, data));     
    });
  };
}

function zipApp (tempPath, dataPath) {
  var zipCommand = 'zip -r ' + path + ' ' + dataPath;
  return new Promise((resolve, reject) => {
    child_process.exec(zipCommand, (err) => {
      if (err) reject(console.error("Unable to zip files.", JSON.stringify(err, null, 2)));
      resolve();
    });
  });
}

function pushBundleToCloud (bundle) {
  var key = "appInstances/" + instanceId;
  var params = {
    Bucket: bucket,
    Key: key
  };

  s3.putObject(params, (err, data) => {
    if (err) console.log(err, err.stack); 
    else console.log(data);           
  });
}

function clearTempDir (path) {
  child_process('rm -r ' + path, (err) => {
    console.error("Unable to zip files.", JSON.stringify(err, null, 2));
 });
};

function buildApp (req, res) {
  var path = null;
  createTempDir()
  .then((tempPath) => {
    path = tempPath;
    return getData(req.body, tempPath);
  } 
  .then(() => {
    return getTemplateApp(path);
  })
  .then(() => {
    return zipApp(tempPath, dataPath);
  })
  .then(() => {
    return pushBundleToCloud();
  }
  .then(() => {
    clearTempDir(tempPath);
    res.send(JSON.stringify(bucketUrl + '/instanceId'));
  })
  .catch(res.status(500).send(JSON.stringify(error));
};

module.exports = {
  buildApp: buildApp
}

