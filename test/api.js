var App = require('../index').App
var assert = require('assert')
var request = require('request')

describe('Pic', function(){

  var PORT = 9998 // TODO: Use a random port
  var BASE = 'http://localhost:' + PORT + '/'
  var USER = 'abi'
  var PASS = 'password'

  before(function (done) {

    var opts = {port: PORT, csrf: false}

    var app = new App(function () {
      // Wait for indexes to be set up (there should be a callback for this. Find it.)
      setTimeout(function () {
        request.post({
          url: BASE + 'login',
          form: {username: USER, password: PASS},
          jar: true
        }, function (error, response, body) {
          done()
        })
      }, 2000)
    }, opts)
  })

  var picId = null

  describe('upload', function () {
    it('should add the image to the database', function (done) {
      request.post({
        url: BASE + 'photos/upload',
        form: {title: 'test', caption: 'testy'},
        jar: true
      }, function (error, response, body) {
        assert(response.statusCode === 200)
        picId = JSON.parse(body)._id
        done()
      })

    })
  })

  after(function () {
    console.log('Inserted pic with id ' + picId)
  })
})