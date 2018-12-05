const express = require('express')

const app = express()
var port = 8201

app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  next()
})

app.get('/healthcheck', function (req, res) {
  res.send('OK')
})

function respondSuccess (req, res) {
  res.status(202).end()
}

// app.post('/v1/client-side/*', respondSuccess)
app.post('/v1/client-side/transactions', respondSuccess)
app.post('/v1/client-side/errors', respondSuccess)
app.post('/v1/rum/*', respondSuccess)

app.listen(port)

console.log('serving MockApmServer on: ', port)
