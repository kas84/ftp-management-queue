let Uploader = require("./uploader"),
  kue = require("kue"),
  common = require("../common/index");

  let moveFileToErrorDir = function(item) {
    console.log("----Moving file from processing to error ---", item.file);
   common.moveFile(
      item.brand.ftp,
      item.brand.dir.processing + item.file.name,
      item.brand.dir.error + item.file.name,
      function (err) {
        console.log(err);
      }
    );
  };
  


module.exports = function(queue,cbuploader,globalPath,numberOfProcess) {
  console.log(globalPath);
  var brandHash ={};
  queue.process("catalogbatchqueue", numberOfProcess, function(job, ctx, done) {
    job.log("-----process----");
    let item = job.data;
    if (item != undefined && brandHash[job.data.optId] == undefined) {
      brandHash[job.data.optId] = 1;
      let uploader = new Uploader(item,job,globalPath,queue);
      uploader.cbuploader = cbuploader
      uploader.on("error", function(err) {
        console.log("++++error++++++");
        console.log(err);
        delete brandHash[job.data.optId];
        moveFileToErrorDir(item);
        common.sendErrorEmail(queue,uploader.item, err.message);
        done(err);
      });
      uploader.on("done", function(message) {
        job.progress(90, 100);
        console.log("done", message);
        delete brandHash[job.data.optId];
        // moveFileToProcessedDir(message);
        done(null, item);
      });
      uploader.start();
    } else {
      var delay = (60*5) * 1000;
      console.log("in line number 39");
      console.log(job.id);
      console.log(job.data.brand.name);
      job.log(job.data.file.name, " file will process in next iteration...");
      
      common.addBrandFileToQueue(
        queue,
        job.data.brand,
        job.data.file,
        job.data.brand.priority,
        delay,
        function(cb) {
          done(null, item);
          // cb();
        }
      );
    }
  });
};
