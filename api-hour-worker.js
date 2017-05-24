require('dotenv').config()
require('console-stamp')(console, 'HH:MM:ss.l')

var request = require('request')
var AWS = require('aws-sdk')

if (process.env.MODE === 'local') {
  AWS.config.update({
    endpoint: 'http://0.0.0.0:8000'
  })
};

var sqs = new AWS.SQS({apiVersion: '2012-11-05'})
var docClient = new AWS.DynamoDB.DocumentClient()

/*
 * Returns readable date with milliseconds
 */

function getDateInMS () {
  return new Date().toJSON()
}

/*
 * Starts worker
 */

function initServer () {
  if (!process.env.LOCATION) { die('LOCATION env must be defined with 2 letter country code') }
  if (process.env.LOCATION.length !== 2) { die('LOCATION env must be defined with 2 letter country code') }
  if (!process.env.QUEUE_URL) { die('QUEUE_URL env must be defined') }

  console.log('-- Starting worker in "' + process.env.LOCATION + '" location')
  console.log('-- Using queue ' + process.env.QUEUE_URL)
  if (process.env.MODE === 'local') {
    console.log('-- Using Local development mode (local DynamoDB endpoint)')
  };
  var params = {
    AttributeNames: [
      'SentTimestamp'
    ],
    MaxNumberOfMessages: 1,
    MessageAttributeNames: [
      'All'
    ],
    QueueUrl: process.env.QUEUE_URL,
    WaitTimeSeconds: 5
  }

  getNextMessage(params)
}

/*
 * Stop process and display error message
 */

function die (message) {
  console.error('> ERROR => ' + message)
  process.exit(1)
}

/*
 * Retreive and process first message in the queue
 * param params (object) provided by initServer()
 */

function getNextMessage (params) {
  console.log('> Polling SQS...')
  sqs.receiveMessage(params, function (err, data) {
    if (err) {
      console.log('Receive Error', err)
    } else {
      if (data.Messages) {
        var MessageId = data.Messages[0].MessageId
        var ReceiptHandle = data.Messages[0].ReceiptHandle
        console.log('> Executing message', MessageId)

        var json = JSON.parse(data.Messages[0].Body)
        var monitorId = json['monitorId']
        var url = json['url']
        var method = json['method']
        apiMonitor(monitorId, {url: url, method: method}, MessageId, ReceiptHandle)
      }
      getNextMessage(params)
    }
  })
}

/*
 * Monitors url provided in configuration options
 * param "monitorId" (integer) Id of the tested monitor entry
 * param "options" (object) configuration containing 'method' and 'url'
 * param "MessageId" (uuid) Message UUID
 * param "ReceiptHandle"
 * returns object
 */

function apiMonitor (monitorId, options, MessageId, ReceiptHandle) {
  options = Object.assign(options, { time: true })
  console.log(options)
  request(
    options, function (error, response, body) {
      if (error) { /* TODO */ };
      var json = { timestamp: getDateInMS(), location: process.env.LOCATION, MessageId: MessageId, statusCode: response.statusCode, timingPhases: response.timingPhases }
      postResult(monitorId, json, ReceiptHandle, MessageId)
    }
  )
}

/*
 * Post apiMonitor result to backend
 * param "result" (object) result for apiMonitor
 */

function postResult (monitorId, result, ReceiptHandle, MessageId) {
  console.log('> Posting data to database')

  var table = 'Pings'
  var timestampCountry = result['timestamp'] + '-' + result['location']

  var params = {
    TableName: table,
    Item: {
      'monitor_id': monitorId,
      'timestamp_country': timestampCountry,
      'data': result
    }
  }

  docClient.put(params, function (err, data) {
    if (err) {
      console.error('Unable to add item. Error JSON:', JSON.stringify(err, null, 2))
    } else {
      console.log('> Saved item to database')
      deleteMessage(ReceiptHandle, MessageId)
    }
  })
}

/*
 * Delete message in the queue
 * param "ReceiptHandle" (object) Message Handle
 * param "MessageId" (string) Message Id
 */

function deleteMessage (ReceiptHandle, MessageId) {
  var deleteParams = {
    QueueUrl: process.env.QUEUE_URL,
    ReceiptHandle: ReceiptHandle
  }
  sqs.deleteMessage(deleteParams, function (err, data) {
    if (err) {
      console.log('Delete Error', err)
    } else {
      console.log('> Deleted message', MessageId)
    }
  })
}

/*
 * Send a new dummy message in the queue
 * param params (object) provided by initServer()
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

initServer()