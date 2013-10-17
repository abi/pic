var App = require('../index').App
var assert = require('assert')
var request = require('request')

function d (msg) {
  console.log(msg)
}

describe('Pic', function(){

  var PORT = 9998 // TODO: Use a random port
  var BASE = 'http://localhost:' + PORT + '/'

  var USER = 'abi'
  var PASS = 'password'
  var USER_ID = '525f435a58e202dc28000001'

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
        url: BASE + 'pics/upload',
        form: {title: 'test', caption: 'testy'},
        jar: true
      }, function (error, response, body) {
        assert.equal(response.statusCode, 200)
        picId = JSON.parse(body)._id
        done()
      })

    })
  })

  describe('get pic by id', function () {
    it('should return the previously inserted image when queried by ID', function (done) {
      request.get({
        url: BASE + 'pics/' + picId,
      }, function (error, response, body) {
        assert.equal(response.statusCode, 200)
        var pic = JSON.parse(body)
        assert.equal(pic.title, 'test')
        done()
      })
    })

    // The difference between wrong and nonsense ID is a subtle implementation
    // detail. It does not conern the end-user of the API.

    it('should return an error when queried by wrong ID', function (done) {
      request.get({
        url: BASE + 'pics/' + '4' + picId.slice(1),
      }, function (error, response, body) {
        assert.equal(response.statusCode, 500)
        var error = JSON.parse(body)
        assert.equal(error.code, 'ID_NOT_FOUND')
        done()
      })
    })

    it('should return an error when queried by nonsense ID', function (done) {
      request.get({
        url: BASE + 'pics/' + picId.slice(1),
      }, function (error, response, body) {
        assert.equal(response.statusCode, 500)
        var error = JSON.parse(body)
        assert.equal(error.code, 'ID_NOT_FOUND')
        done()
      })
    })
  })

  describe('get new pics', function () {
    it('should return the 20 most recent pics', function (done) {
      request.get({
        url: BASE + 'pics/new',
      }, function (error, response, body) {
        assert(response.statusCode === 200)
        var res = JSON.parse(body)
        assert.equal(res.pics.length, 20)
        assert.equal(res.pics[0].title, 'test')
        assert.equal(res.page, 1)
        done()
      })
    })

    it('when asked for page 10, it should return no pics', function (done) {
      request.get({
        url: BASE + 'pics/new?page=10',
      }, function (error, response, body) {
        assert(response.statusCode === 200)
        var res = JSON.parse(body)
        assert.equal(res.pics.length, 0)
        assert.equal(res.page, 10)
        done()
      })
    })
  })

  describe('get popular pics', function () {
    it('should return the 20 most recent pics', function (done) {
      request.get({
        url: BASE + 'pics/popular',
      }, function (error, response, body) {
        assert(response.statusCode === 200)
        var res = JSON.parse(body)
        assert.equal(res.pics.length, 20)
        assert.equal(res.pics[0].title, 'test')
        assert.equal(res.page, 1)
        done()
      })
    })

    it('when asked for page 10, it should return no pics', function (done) {
      request.get({
        url: BASE + 'pics/popular?page=10',
      }, function (error, response, body) {
        assert.equal(response.statusCode, 200)
        var res = JSON.parse(body)
        assert.equal(res.pics.length, 0)
        assert.equal(res.page, 10)
        done()
      })
    })
  })

  describe('get pics by a user', function () {
    it('should return the 20 most recent pics', function (done) {
      request.get({
        url: BASE + 'pics/user/' + USER_ID,
      }, function (error, response, body) {
        assert.equal(response.statusCode, 200)
        var res = JSON.parse(body)
        assert.equal(res.pics.length, 20)
        assert.equal(res.pics[0].title, 'test')
        assert.equal(res.page, 1)
        done()
      })
    })

    it('when asked for page 10, it should return no pics', function (done) {
      request.get({
        url: BASE + 'pics/user/' + USER_ID + '?page=10',
      }, function (error, response, body) {
        assert.equal(response.statusCode, 200)
        var res = JSON.parse(body)
        assert.equal(res.pics.length, 0)
        assert.equal(res.page, 10)
        done()
      })
    })

    it('when asked for pics by a non-existent user, it should return an error', function (done) {
      request.get({
        url: BASE + 'pics/user/' + USER_ID.slice(1) + '?page=10',
      }, function (error, response, body) {
        assert.equal(response.statusCode, 500)
        var res = JSON.parse(body)
        assert.equal(res.code, 'ID_NOT_FOUND')
        done()
      })
    })

  })

  after(function () {
    // TODO: Clean up the test database
  })
})