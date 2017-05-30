require('console-stamp')(console, 'HH:MM:ss.l')

if (!process.argv[2]) {
  console.log("Object parameter is required")
  process.exit(1)
};

var request = require('request')
var AWS = require('aws-sdk')

if (process.env.MODE === 'local') {
  AWS.config.update({
    endpoint: 'http://0.0.0.0:8000'
  })
};

var sqs = new AWS.SQS({apiVersion: '2012-11-05'})

/*
 * Send a new dummy message in the queue
 */

function sendDummyMessage () {
  var string = process.argv[2]
  var params = {
    DelaySeconds: 10,
    MessageBody: string,
    QueueUrl: process.env.QUEUE_URL
  }

  sqs.sendMessage(params, function (err, data) {
    if (err) {
      console.log('Error', err)
    } else {
      console.log('> Message sent', data.MessageId)
    }
  })
}

sendDummyMessage()

