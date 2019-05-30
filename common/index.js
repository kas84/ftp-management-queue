const _ = require("underscore"),
  FtpClient = require("ftp");
SftpClient = require("ssh2-sftp-client");

let moveFile = function(ftpobj, src, dest, type, cb) {
  cb = cb || function() {};
  type = type || "ftp";
  if (type == "ftp") {
    var c = new FtpClient();
    c.on("ready", function() {
      c.rename(src, dest, function(err) {
        if (err) cb(err);
        c.end();
        cb();
      });
    });
    c.connect(ftpobj);
    c.on("error", function(err) {
      cb(err);
    });
  } else {
    sftp = new SftpClient();
    sftp.connect(ftpobj).then(function() {
      sftp
        .rename(src, dest)
        .then(function(data) {
          console.log(data);
          console.log("move file");
          sftp.end();
          cb();
        })
        .catch("error", function(err) {
          cb(err);
          console.log(err);
        });
    });
  }
};

let uploadFile = function(ftpobj, localFile, remotePath, type, cb) {
  cb = cb || function() {};
  if (type == "ftp") {
    var c = new FtpClient();
    c.on("ready", function() {
      c.put(localFile, remotePath, function(err) {
        if (err) cb(err);
        c.end();
        cb();
      });
    });
    // connect to localhost:21 as anonymous
    c.connect(ftpobj);
    c.on("error", function(err) {
      cb(err);
    });
  } else {
    sftp = new SftpClient();
    sftp.connect(ftpobj).then(function() {
      sftp
        .put(localFile, remotePath)
        .then(function(data) {
          console.log(data);
          console.log("move file");
          sftp.end();
          cb();
        })
        .catch("error", function(err) {
          cb(err);
          console.log(err);
        });
    });
  }
};

var getUploadType = function(name) {
  if (name && name.toLowerCase().indexOf("full") > -1) {
    return "full";
  } else if (name && name.toLowerCase().indexOf("verify") > -1) {
    return "verification";
  }
  return "partial";
};

let addBrandFileToQueue = function(
  queue,
  brand,
  file,
  priority,
  delay,
  queuename,
  cb
) {
  if (delay == undefined || delay == null || delay == "") {
    delay = 0;
  }
  console.log("----Calling addBrandFileToQueue");
  var job = queue
    .create(queuename, {
      optId: brand.optId,
      brand,
      file,
      title: `Brand: ${brand.name} (${brand.optId})   File: ${file.name}`
    })
    .priority(priority)
    .delay(delay)
    .searchKeys(["optId"])
    .save(function(err) {
      // {2:[1,2,3,4,5]}
      if (!err) console.log("jobid", job.data.brand.name);
      if (err) console.log("err", err);
      cb();
    });
  job
    .on("complete", function(id, result) {
      console.log("uploaderqueue Job completed with data ", result);
    })
    .on("failed attempt", function(errorMessage, doneAttempts) {
      console.log("Job failed attempt");
    })
    .on("failed", function(errorMessage) {
      console.log("line number 337");
      console.log(errorMessage);
      console.log("Job failed", errorMessage);
    })
    .on("progress", function(progress, data) {
      console.log(
        "\r  job #" + job.id + " " + progress + "% complete with data ",
        data
      );
    });
};
const sendErrorEmail = function(queue, item, err) {
  console.log("Calling sendErrorEmail");
  var emailjob = queue
    .create("emailqueue", {
      item: item,
      err: err,
      title: err
    })
    .attempts(2)
    .save(function(err) {
      if (!err) console.log("emailjobid", emailjob.id);
      if (err) console.log("email queueerr", err);
    });
  emailjob
    .on("complete", function(id, result) {
      console.log(" mangerjob Job completed with data ", result, id);
    })
    .on("failed attempt", function(errorMessage, doneAttempts) {
      console.log("mangerjob failed attempt");
    })
    .on("failed", function(errorMessage) {
      console.log("mangerjob failed", errorMessage);
    })
    .on("progress", function(progress, data) {
      console.log(
        "\r  job #" + emailjob.id + " " + progress + "% complete with data ",
        data
      );
    });
};
module.exports = {
  addBrandFileToQueue,
  moveFile,
  uploadFile,
  getUploadType,
  sendErrorEmail
};
