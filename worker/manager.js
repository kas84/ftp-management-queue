let CronJob = require("cron").CronJob,
  async_lib = require("async"),
  FtpClient = require("ftp"),
  common = require("../common/index"),
  _ = require("lodash");
var path = require("path");
var supportedFormat;
const kue = require("kue");
module.exports = function(queue, brands, fileFormats, numberOfProcess) {
  supportedFormat = fileFormats;
  console.log("in managaer");
  console.log(supportedFormat);
  var job = new CronJob({
    cronTime: "*/10 * * * * *", //every 5 second
    onTick: function() {
      console.log("----- Manager Cron ------");
      selectRandomBrand(queue, brands, fileFormats);
    },
    start: true,
    timeZone: "America/Los_Angeles"
  });

  job.start();
  processQueue(queue, numberOfProcess);
};

var i = 0;
let selectRandomBrand = function(queue, brands, fileFormats) {
  let items = brands;
  let length = items.length;
  if (items.length == i) {
    i = 0;
  }
  var brand = items[i];
  i++;
  console.log("brand", brand.optId);
  let priority = "normal";
  if (brand.priority) {
    priority = brand.priority;
  }
  var mangerjob = queue
    .create("managerqueue", {
      brand: brand,
      title: brand.name
    })
    .priority(priority)
    .save(function(err) {
      if (!err) console.log("managerjobid", mangerjob.id);
      if (err) console.log("brand queueerr", err);
    });
  mangerjob
    .on("complete", function(id, result) {
      console.log(" mangerjob Job completed with data ", result);
      kue.Job.get(mangerjob.id, function(err, job) {
        if (err) return;
        job.remove(function(err) {
          if (err) throw err;
          console.log("removed completed mangerjob #%d", job.id);
        });
      });
    })
    .on("failed attempt", function(errorMessage, doneAttempts) {
      console.log("mangerjob failed attempt");
    })
    .on("failed", function(errorMessage) {
      console.log("mangerjob failed", errorMessage);
    })
    .on("progress", function(progress, data) {
      console.log(
        "\r  job #" + job.id + " " + progress + "% complete with data ",
        data
      );
    });
};

function isFileInSupportedFormat(name) {
  var ext = path.extname(name);
  return supportedFormat.indexOf(ext) > -1;
}

let processQueue = (queue, numberOfProcess) => {
  queue.process("managerqueue", numberOfProcess, async function(
    job,
    ctx,
    done
  ) {
    job.log("----Processing managerqueue-----", job.data.brand.optId);
    let brand = job.data.brand;
    console.log("++++++++");
    console.log(brand);
    try {
      var old_files = await getFiles(brand);
      setTimeout(function() {
        manageFiles(queue, old_files, job, brand, done);
      }, 10000);
    } catch (e) {
      console.log("e", e);
      done(e);
    }
  });
};

let manageFiles = async function(queue, old_files, job, brand, done) {
  try {
    var files = [];
    files = await getFiles(brand);

    console.log("Before files", old_files.length);
    console.log("After files", files.length);

    files = _.filter(files, function(file) {
      //to check is it file
      if (file.type != "-") return false;

      //check supported file format
      var isFileFormatSupported = isFileInSupportedFormat(file.name);
      if (!isFileFormatSupported) return false;

      //  is file ready
      var isFileReady = _.find(old_files, {
        name: file.name,
        size: file.size
      });
      return !!isFileReady;
      return true;
    });

    console.log("After files", files.length);
    // files = _.sortBy(files, function(file) {
    //   return -file.date;
    // });

    let priority = "normal";
    if (brand.hasOwnProperty("priority")) {
      priority = "high";
    }
    async_lib.eachSeries(
      files,
      function(file, cb) {
        job.log(
          `Brand : ${JSON.stringify(brand.name)} File: ${JSON.stringify(
            file.name
          )}`
        );

        addBrandFileToQueue(queue, job, brand, file, priority, cb);
      },
      function() {
        job.log("---All files added to queue -----");
        console.log("--All files finished---");
        done(null, brand);
      }
    );
  } catch (e) {
    done(e);
  }
};

let addBrandFileToQueue = function(queue, job, brand, file, priority, cb) {
  cb = cb || function() {};
  var that = this;
  job.log("----Calling addBrandFileToQueue");
  async_lib.series(
    {
      moveFileToEnqueued: function(callback) {
        job.log("--Moving file to enqueued");
        let ftp = new FtpClient();
        ftp.connect(brand.ftp);
        ftp.on("error", err => {
          console.error("err");
          callback();
        });

        job.log(
          "move file from " +
            brand.dir.upload +
            file.name +
            " to " +
            brand.dir.enqueued +
            file.name
        );
        ftp.rename(
          brand.dir.upload + file.name,
          brand.dir.enqueued + file.name,
          function(err) {
            if (err) job.log(err);
            callback();
            ftp.end();
          }
        );
      },
      addtoqueue: function(callback) {
        job.log("--Adding File to queue", file.name);
        common.addBrandFileToQueue(
          queue,
          brand,
          file,
          priority,
          null,
          callback
        );
      }
    },
    function(err) {
      cb();
    }
  );
};
let getFiles = function(brand) {
  // Return new promise
  return new Promise(function(resolve, reject) {
    let ftp = new FtpClient();
    ftp.connect(brand.ftp);
    ftp.on("error", function(err) {
      reject(err);
    });
    ftp.on("ready", () => {
      ftp.list(brand.dir.upload, function(err, list) {
        if (err) return reject(err);
        resolve(list);
        ftp.end();
      });
    });
  });
};
