var App = require('../index').App
var assert = require('assert')
var config = require('../config')
var debug = require('debug')('testing')
var mongodb = require('mongodb')
var request = require('request')

function d (msg) {
  console.log(msg)
}

describe('Pic', function(){

  var PORT = 9998 // TODO: Use a random port
  var DB = 'pic_test'
  var BASE = 'http://localhost:' + PORT + '/'

  var USER = 'abi'
  var PASS = 'password'

  before(function (done) {
    var opts = {port: PORT, csrf: false, database: DB}

    var app = new App(function () {
      // Wait for indexes to be set up (there should be a callback for this. Find it.)
      setTimeout(function () {
        request.post({
          url: BASE + 'signup',
          form: {name: USER, username: USER, email: USER + '@email.com', password: PASS},
          jar: true
        }, function (error, response, body) {
          request.post({
            url: BASE + 'login',
            form: {username: USER, password: PASS},
            jar: true
          }, function (error, response, body) {
            done()
          })
        })
      }, 2000)
    }, opts)
  })

  var picId = null
  var userId = null

  describe('upload', function () {
    it('should add the image to the database', function (done) {
      request.post({
        url: BASE + 'pics/upload',
        form: {title: 'test', caption: 'testy'},
        jar: true
      }, function (error, response, body) {
        assert.equal(response.statusCode, 200)
        var pic = JSON.parse(body)
        picId = pic._id
        assert.equal(pic.title, 'test')
        assert.equal(pic.caption, 'testy')
        done()
      })
    })

    it('should sanitize title and caption', function (done) {
      request.post({
        url: BASE + 'pics/upload',
        form: {title: 'test <h1>hi</h1>    ', caption: 'testy <script>gah</script>'},
        jar: true
      }, function (error, response, body) {
        assert.equal(response.statusCode, 200)
        var pic = JSON.parse(body)
        assert.equal(pic.title, 'test &lt;h1&gt;hi&lt;/h1&gt;')
        assert.equal(pic.caption, 'testy &lt;script&gt;gah&lt;/script&gt;')
        done()
      })
    })
  })

  describe('like', function () {
    it('should increment the like count of the pic', function (done) {
      request.post({
        url: BASE + 'pics/' + picId + '/like',
        jar: true
      }, function (error, response, body) {
        assert.equal(response.statusCode, 200)
        var pic = JSON.parse(body)
        assert.equal(pic.title, 'test')
        assert.equal(pic.numLikes, 1)
        done()
      })
    })

    it('when called by the same user more than once should do nothing', function (done) {
      request.post({
        url: BASE + 'pics/' + picId + '/like',
        jar: true
      }, function (error, response, body) {
        assert.equal(response.statusCode, 200)
        var pic = JSON.parse(body)
        assert.equal(pic.title, 'test')
        assert.equal(pic.numLikes, 1)
        done()
      })
    })
  })

  describe('unlike', function () {
    it('should decrement the like count of the pic', function (done) {
      request.post({
        url: BASE + 'pics/' + picId + '/unlike',
        jar: true
      }, function (error, response, body) {
        assert.equal(response.statusCode, 200)
        var pic = JSON.parse(body)
        assert.equal(pic.title, 'test')
        assert.equal(pic.numLikes, 0)
        done()
      })
    })

    it('when called by the same user more than once should do nothing', function (done) {
      request.post({
        url: BASE + 'pics/' + picId + '/unlike',
        jar: true
      }, function (error, response, body) {
        assert.equal(response.statusCode, 200)
        var pic = JSON.parse(body)
        assert.equal(pic.title, 'test')
        assert.equal(pic.numLikes, 0)
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
        userId = pic.user
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
    it('should return the 2 most recent pics', function (done) {
      request.get({
        url: BASE + 'pics/new',
      }, function (error, response, body) {
        assert(response.statusCode === 200)
        var res = JSON.parse(body)
        assert.equal(res.pics.length, 2)
        // assert.equal(res.pics[0].title, 'test') (TODO)
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
    it('should return the 2 most recent pics', function (done) {
      request.get({
        url: BASE + 'pics/popular',
      }, function (error, response, body) {
        assert(response.statusCode === 200)
        var res = JSON.parse(body)
        assert.equal(res.pics.length, 2)
        // assert.equal(res.pics[0].title, 'test') (TODO)
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
        url: BASE + 'pics/user/' + userId,
      }, function (error, response, body) {
        assert.equal(response.statusCode, 200)
        var res = JSON.parse(body)
        assert.equal(res.pics.length, 2)
        // assert.equal(res.pics[0].title, 'test') (TODO)
        assert.equal(res.page, 1)
        done()
      })
    })

    it('when asked for page 10, it should return no pics', function (done) {
      request.get({
        url: BASE + 'pics/user/' + userId + '?page=10',
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
        url: BASE + 'pics/user/' + userId.slice(1) + '?page=10',
      }, function (error, response, body) {
        assert.equal(response.statusCode, 500)
        var res = JSON.parse(body)
        assert.equal(res.code, 'ID_NOT_FOUND')
        done()
      })
    })

  })

  after(function (done) {
    this.timeout(30000)
    var db = new mongodb.Db(DB, new mongodb.Server(config.mongo.host, config.mongo.port), {w: 0})
    db.open(function(err, db) {
      debug(err)
      assert.equal(null, err)
      db.dropDatabase(function(err, result) {
        if (err) {
          console.error('Unable to drop database')
          done()
        } else {
          debug('Test database dropped')
          done()
        }
      })
    })
  })
})