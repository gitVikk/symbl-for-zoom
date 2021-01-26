/**
 * Sample inbound integration showing how to use Twilio Flex
 * with Symbl's websocket API as the inbound audio stream
 */

/* import necessary modules for the web-socket API */
require("dotenv").config();
const express = require("express");
const app = express();
const server = require("http").createServer(app);
var path = require("path");
const sdk = require("symbl-node").sdk;
const bodyParser = require("body-parser");
const zoomParser = require("./zoomParser");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + "/"));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname + "/index.html"));
});

app.post("/join", (req, res) => {
  console.log(req.body);
  const sample = req.body.meetingInvite;
  const closedcaptionapi = req.body.meetingCC;
  const meetingName = req.body.meetingName;
  const parser = zoomParser();

  if (parser.isValid(sample)) {
    const result = parser.parse(sample);
    result.then((data) => {
      sdk
        .init({
          appId: process.env.APP_ID,
          appSecret: process.env.APP_SECRET,
          basePath: "https://api.symbl.ai",
        })
        .then(() => {
          
          console.log("SDK Initialized");
          sdk
            .startEndpoint({
              endpoint: {
                type: "pstn",
                phoneNumber: data.joiningDetails[0].phoneNumbers[0],
                dtmf: data.joiningDetails[0].dtmf,
              },
              actions: [
                {
                  invokeOn: "stop",
                  name: "sendSummaryEmail",
                  parameters: {
                    emails: [req.body.email],
                  },
                },
              ],
              data: {
                session: {
                  name: meetingName,
                },
              },
            })
            .then((connection) => {
              const connectionId = connection.connectionId;
              console.log("Successfully connected.", connectionId);
              let sequenceID = 0
              sdk.subscribeToConnection(connectionId, (data) => {
                // console.log(data);
                const {type} = data
                //SequenceID to increment CC sequence for Zoom Closed Caption to work
                const ccrequest = require('request')
                if (type === 'transcript_response') {
                  const {payload} = data
                  //Vikram's Logic here
                  //increment sequence ID logic
                  sequenceID++      
                  //Post to Zoom
                  const options = {
                    'method': 'POST',
                    'url': closedcaptionapi+'&seq='+sequenceID,
                    'headers':{
                      'Content-Type': 'text/plain',
                      'Accept': '*/*'
                    },
                    body: payload.content
                  };
                  ccrequest(options, function (error, response) {
                    if (error) throw new Error(error);
                    console.log(response.body);
                  });
                  console.log('Live: ' + payload && payload.content)
                } 
              })
              res.sendFile(path.join(__dirname + "/success.html"));
            })
            .catch((err) => {
              console.error("Error while starting the connection", err);
              res.sendFile(path.join(__dirname + "/error.html"));
            });
        })
        .catch((err) => {
          console.error("Error in SDK initialization.", err);
          res.sendFile(path.join(__dirname + "/error.html"));
        });
    });
  } else {
    res.sendFile(path.join(__dirname + "/error.html"));
  }
});

var port = process.env.PORT || 5000;

app.listen(port, function () {
  console.log("Symbl Personal Assistant app listening on port " + port + "!");
});
