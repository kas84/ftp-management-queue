"use strict";

// concurrentProcess:{
//     brandManagerProcess: 4,
//     catalogBatchProcess:4,
//     emailProcess:2,
//   },

var uploader = function({
  queue,
  items,
  numberOfProcess,
  fileFormats,
  customCallback,
  cbemailfunction,
  filePath,
  kue,
  processNames
}) {
  // console.log(config);
  // console.log(filePath)

  Object.keys(items[0].dir).forEach(function(keys) {
    if (items[0].dir[keys].split("/").pop() != "") {
      items[0].dir[keys] = items[0].dir[keys] + "/";
    }
  });

  console.log(items);
  var manager = require("../worker/manager");
  manager(
    queue,
    items,
    fileFormats,
    numberOfProcess.itemsManagerProcess,
    kue,
    processNames
  );

  //inialize processor
  processNames = processNames || {};
  processNames.manager = processNames.manager || "managerqueue";
  processNames.processor = processNames.processor || "processorqueue";
  processNames.email = processNames.email || "emailqueue";
  var processor = require("../worker/processor");
  processor(
    queue,
    customCallback,
    filePath,
    numberOfProcess.fileBatchProcess,
    processNames
  );

  var email = require("../worker/email");
  email(queue, cbemailfunction, numberOfProcess.emailProcess, processNames);
};

module.exports = uploader;
