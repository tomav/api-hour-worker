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
    console.log('-- Using Local development mode (local database endpoint)')
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
 * param 'message' Message to display
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
        var config = json['config']
        apiMonitor(monitorId, config, MessageId, ReceiptHandle)
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
 */

function apiMonitor (monitorId, options, MessageId, ReceiptHandle) {
  options = Object.assign(options, { time: true })
  request(
    options, function (error, response, body) {
      if (!error) {
        var json = { timestamp: getDateInMS(), location: process.env.LOCATION, MessageId: MessageId, statusCode: response.statusCode, timingPhases: response.timingPhases }
        postResult(monitorId, json, ReceiptHandle, MessageId)
      } else {
        console.log('Error', err)
      }
    }
  )
}

/*
 * Post apiMonitor result to backend
 * param "monitorId" (integer) Id of the tested monitor entry
 * param "result" (object) result for apiMonitor
 * param "MessageId" (uuid) Message UUID
 * param "ReceiptHandle"
 */

function postResult (monitorId, result, MessageId, ReceiptHandle) {
  console.log('> Posting data to database')

  var table = 'api_hour_pings'
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
 * param "MessageId" (string) Message Id
 * param "ReceiptHandle" (object) Message Handle
 */

function deleteMessage (MessageId, ReceiptHandle) {
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

initServer()
