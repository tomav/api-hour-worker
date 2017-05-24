require('console-stamp')(console, 'HH:MM:ss.l')

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
  var string = JSON.stringify({ monitorId: 1, url: 'http://www.google.fr', method: 'GET' })
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