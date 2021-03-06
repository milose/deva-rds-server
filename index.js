#!/usr/bin/env node
'use strict'

require('dotenv').config()

const fs = require('fs')
const path = require('path')
const request = require('request')
const chokidar = require('chokidar')
const server = require("http").createServer();
const io = require("socket.io")(server);

const watchPath = path.join(__dirname, process.env.RDS_WATCH)

// States
let lastMessage = []
let connections = []

// Start a web socket server
server.listen(process.env.WS_PORT)
console.log('Web-socket server is running on port', process.env.WS_PORT)

// Start a front-end server
// require('./app/index.js').start(express, process.env.PORT, io, lastMessage)

// Notify slack on start
// notify('Server started: http://deva.co:3338')

// RDS Loader
let loadRds = function (file) {
  if (path.extname(file) !== '.txt') {
    return;
  }

  let channel = path.dirname(file)
        .split(process.env.RDS_WATCH)
        .pop()

  let data = fs.readFileSync(file, 'utf8').trim()

  if (data.length > 0 && data !== lastMessage[channel]) {
    lastMessage[channel] = data

    io.emit(process.env.WS_KEY + '.' + channel, data)

    if (process.env.NODE_ENV !== 'production') {
      console.log('Channel:', channel, '| Data:', data)
    }
  }
}

// Watcher
chokidar.watch(watchPath, {
  ignored: /[\\]\./,
  depth: 1,
  awaitWriteFinish: true,
  ignoreInitial: false,
  followSymlinks: true
}).on('change', loadRds)

console.log('Watching', watchPath)

// Read all channels on start
fs.readdirSync(watchPath).forEach(function (dir) {
  if (fs.lstatSync(path.join(watchPath, dir)).isFile()) return

  fs.readdirSync(path.join(watchPath, dir))
    .filter((file) => file === process.env.RDS_FILE)
    .forEach(function (file) {
      loadRds(path.join(watchPath, dir, file))
    })
})

// Middleware
io.use((socket, next) => {
  socket.username = socket.request._query['username']
  next()
})

// On connection
io.on('connection', (socket) => {
  if (socket.username === '') return

  let msg = 'Client connected: ' + socket.username + ' / ' + socket.request.connection.remoteAddress

  if (process.env.NODE_ENV !== 'production') {
    console.log(msg)
  }

  // Emmit the last message for the reconnected client
  if (lastMessage[socket.username]) {
    io.emit(process.env.WS_KEY + '.' + socket.username, lastMessage[socket.username])
  }

  // Reduce Slack spam
  if (typeof connections[socket.username] !== 'undefined') {
    clearTimeout(connections[socket.username].timeout)
  } else {
    connections[socket.username] = {
      shouldNotify: true,
      timeout: null
    }
  }

  if (connections[socket.username].shouldNotify === true) {
    notify(msg)
  }

  socket.on('disconnect', () => {
    let msg = 'Client disconnected: ' + socket.username + '!'

    if (process.env.NODE_ENV !== 'production') {
      console.log(msg)
    }

    connections[socket.username] = {
      shouldNotify: false,
      timeout: setTimeout(function () {
        notify(msg)
        connections[socket.username].shouldNotify = true
      }, 15000)
    }
  })
})

// Slack Notifier
function notify (text) {
  if (process.env.SLACK_URL === '') return

  try {
    request.post(process.env.SLACK_URL, {
      form: {
        payload: JSON.stringify({
          'username': 'rds.deva.co',
          'icon_emoji': ':cloud:',
          'text': text
        })
      }
    })
  } catch (ex) {
    var msg = 'Slack error: ' + ex

    if (process.env.NODE_ENV !== 'production') {
      console.log(msg)
    }
  }
}
