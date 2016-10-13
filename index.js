#!/usr/bin/env node

'use strict';

require('dotenv').config({
    path: __dirname + '/.env'
});
let previous = {};
const fs = require('fs');
const path = require('path');
let request = require('request');
let express = require('express');
let chokidar = require('chokidar');
let S = require('string').extendPrototype();
let server = require('http').Server(express());
let io = require('socket.io')(server);

// Start a web socket server
server.listen(process.env.WS_PORT);
console.log('Web-socket server is running on port', process.env.WS_PORT);

// Start a front-end server
require('./app/index.js').start(express, process.env.PORT, io);

// Watcher
let watch_path = __dirname + '/' + process.env.RDS_WATCH + '**/*.txt';
if (process.env.RDS_SILENT == 'false') {
    console.log('Watching', watch_path);
}
chokidar.watch(watch_path, {
    ignored: /[\/\\]\./,
    ignoreInitial: true,
}).on('change', file => {
    let channel = path.dirname(file)
        .split(process.env.RDS_WATCH)
        .pop();

    let data = fs.readFileSync(file, 'utf8').trim();

    if (data.length > 0 && data != previous[channel]) {
        previous[channel] = data;

        io.emit(process.env.WS_KEY + '.' + channel, data);

        if (process.env.RDS_SILENT == 'false') {
            console.log('Channel:', channel, '| Data:', data);
        }
    }
});

// Middleware
io.use((socket, next) => {
    socket.username = socket.request._query['username'];
    next();
});

// On connection
io.on('connection', function(socket) {
    if (socket.username == '') return;

    if (previous[socket.username] != '') {
        io.emit(process.env.WS_KEY + '.' + socket.username, previous[socket.username])
    }
    let msg = 'Client connected: ' + socket.username + ' / ' + socket.request.connection.remoteAddress;

    if (process.env.RDS_SILENT == 'false') {
        console.log(msg);
    }

    if (io.engine.clientsCount == 1) {
        notify(msg);
    }

    socket.on('disconnect', function() {
        let msg = 'Client disconnected: ' + socket.username + '. No more clients!';

        if (process.env.RDS_SILENT == 'false') {
            console.log(msg);
        }

        if (io.engine.clientsCount < 1) {
            notify(msg);
        }

    });
});

function notify(text) {
    if (process.env.SLACK_URL == '') return;

    request.post(process.env.SLACK_URL, {
        form: {
            payload: JSON.stringify({
                'username': 'rds.deva.co',
                'icon_emoji': ':cloud:',
                'text': text,
            })
        }
    });
}
