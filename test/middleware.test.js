describe('version.layer() integration', function () {
  'use strict';

  var versions = require('../').clone().path('../').listen(portnumbers)
    , chai = require('chai')
    , expect = chai.expect;

  chai.Assertion.includeStack = true;

  // Add nodejitsu as home server
  versions.set('origin servers', [{
    "url": "https://www.nodejitsu.com",
    "id": "home"
  }]);

  describe('.layer(responseTime)', function () {
    it('should set a X-Response-Time header', function (done) {
      versions.app.request()
      .get('/index.js')
      .end(function (res) {
        var headers = res.headers;

        expect(parseInt(headers['x-response-time'], 0)).to.be.above(-1);
        expect(res.statusCode).to.equal(200);
        done();
      });
    });
  });

  describe('.layer(initalize)', function () {
    it('sets the proper headers', function (done) {
      versions.app.request()
      .get('/index.js')
      .end(function (res) {
        var headers = res.headers;

        expect(headers['x-powered-by']).to.equal('Versions/'+ versions.version);
        expect(headers.vary).to.equal('Accept-Encoding');
        expect(res.statusCode).to.equal(200);
        done();
      });
    });

    it('sets the proper cors headers', function (done) {
      versions.app.request()
      .get('/index.js')
      .end(function (res) {
        var headers = res.headers;

        expect(headers['access-control-allow-origin']).to.equal(versions.get('cors'));
        expect(headers['access-control-allow-credentials']).to.equal('true');
        expect(res.statusCode).to.equal(200);
        done();
      });
    });

    it('should increase the requests metrics', function (done) {
      var metric = versions.metrics.requests;

      versions.app.request()
      .get('/index.js')
      .end(function (res) {
        expect(versions.metrics.requests).to.be.above(metric);
        expect(res.statusCode).to.equal(200);
        done();
      });
    });
  });

  describe('.layer(conditional)', function () {
    it('should respond with a 304', function (done) {
      versions.app.request()
      .set('if-modified-since', new Date().toUTCString())
      .set('if-none-match', 'etag')
      .get('/index.js')
      .end(function (res) {
        expect(res.statusCode).to.equal(304);
        expect(res.body).to.equal('');

        done();
      });
    });

    it('should increase the 304 metric', function (done) {
      var metric = versions.metrics['304'];

      versions.app.request()
      .set('if-modified-since', new Date().toUTCString())
      .set('if-none-match', 'etag')
      .get('/index.js')
      .end(function (res) {
        expect(res.statusCode).to.equal(304);
        expect(versions.metrics['304']).to.be.above(metric);
        expect(res.body).to.equal('');

        done();
      });
    });

    it('should set correct response headers', function (done) {
      versions.app.request()
      .set('if-modified-since', new Date().toUTCString())
      .set('if-none-match', 'etag')
      .get('/index.js')
      .end(function (res) {
        var headers = res.headers;

        expect(headers).to.not.have.property('vary');
        expect(headers).to.have.property('expires');
        expect(headers['x-cache']).to.equal('304');
        expect(res.statusCode).to.equal(304);

        done();
      });
    });
  });

  describe('.layer(done)', function (done) {
    it('should respond with 404 errors', function (done) {
      versions.app.request()
      .get('/unkown')
      .end(function (res) {
        expect(res.statusCode).to.equal(404);
        done();
      });
    });

    it('should respond with css / js friendly content', function (done) {
      versions.app.request()
      .get('/unkown')
      .end(function (res) {
        expect(res.body).to.include('404');
        expect(res.body).to.include('/*');
        expect(res.body).to.include('*/');

        expect(res.headers['content-type']).to.equal('text/plain');

        done();
      });
    });

    it('should increase the 404 metric', function (done) {
      var metric = versions.metrics['404'];

      versions.app.request()
      .get('/unknown')
      .end(function (res) {
        expect(res.statusCode).to.equal(404);
        expect(versions.metrics['404']).to.be.above(metric);

        done();
      });
    });
  });

  describe('.layer(pull)', function () {
    it('should respond with the correct headers', function (done) {
      versions.app.request()
      .get('/img/trusted.png')
      .end(function (res) {
        expect(res.headers['content-type']).to.equal('image/png');
        expect(res.headers['x-cache']).to.equal('Pull');
        expect(res.statusCode).to.equal(200);

        done();
      });
    });

    it('should only pull requests that get a 200 statusCode', function (done) {
      versions.app.request()
      .get('/img/superpoweredmegathunderstorm.png')
      .end(function (res) {
        // Should be the same response as a regular 404 call
        expect(res.body).to.include('404');
        expect(res.body).to.include('/*');
        expect(res.body).to.include('*/');

        expect(res.headers['content-type']).to.equal('text/plain');
        expect(res.statusCode).to.equal(404);

        done();
      });
    });

    it('should respect the blacklist', function (done) {
      versions.app.request()
      .get('/img/trusted.png')
      .end(function (res) {
        expect(res.headers['content-type']).to.equal('image/png');
        expect(res.statusCode).to.equal(200);

        // Add png's as blacklisted items and clear the cache so we don't get
        // a HIT from memory
        versions.set('blacklisted extensions', ['.png']);
        versions.cache.destroy().start();

        versions.app.request()
        .get('/img/trusted.png')
        .end(function (res) {
          expect(res.body).to.include('404');
          expect(res.body).to.include('/*');
          expect(res.body).to.include('*/');

          expect(res.headers['content-type']).to.equal('text/plain');
          expect(res.statusCode).to.equal(404);

          // reset the blacklist again
          versions.config['blacklisted extensions'] = [];
          done();
        });
      });
    });

    it('should increase the origin pull metric', function (done) {
      var metric = versions.metrics['origin server pull'];

      versions.app.request()
      .get('/img/random.png')
      .end(function (res) {
        expect(versions.metrics['origin server pull']).to.be.above(metric);
        expect(res.statusCode).to.equal(404);

        done();
      });
    });

    it('should cache pull requests in memory');
  });

  describe('.layer(memorize)', function () {
    it('should memorize look up in an internal cache', function (done) {
      versions.app.request()
      .get('/img/sprite.png')
      .end(function (res) {
        expect(res.headers['x-cache']).to.equal('Pull');
        expect(res.statusCode).to.equal(200);

        versions.app.request()
        .get('/img/sprite.png')
        .end(function (res) {
          expect(res.headers['x-cache']).to.equal('HIT');
          expect(res.statusCode).to.equal(200);

          done();
        });
      });
    });

    it('should increase the cache hit metric', function (done) {
      var metric = versions.metrics['cache hit'];

      versions.app.request()
      .get('/img/sprite.png')
      .end(function (res) {
        expect(versions.metrics['cache hit']).to.be.above(metric);
        expect(res.statusCode).to.equal(200);

        done();
      });
    });
  });

  describe('.layer(rest)', function () {
    versions.set('auth', 'foobar');

    describe('authorization', function () {
      it('ignores requests when the auth key is set', function (done) {
        versions.app.request()
        .get('/version')
        .end(function (res) {
          expect(res.statusCode).to.equal(404);

          done();
        });
      });

      it('accepts requets when the auth key is set and ?auth is used', function (done) {
        versions.app.request()
        .get('/version?auth=foobar')
        .end(function (res) {
          versions.set('auth', '');
          expect(res.statusCode).to.equal(200);
          done();
        });
      });
    });

    describe('/version', function () {
      it('sends the current version', function (done) {
        versions.app.request()
        .get('/version')
        .end(function (res) {
          var body = JSON.parse(res.body);

          expect(body.version).to.equal(versions.get('version'));
          expect(res.statusCode).to.equal(200);

          done();
        });
      });
    });

    describe('/keys', function () {
      it('sends the list of keys that are in memory', function (done) {
        versions.app.request()
        .get('/keys')
        .end(function (res) {
          var body = JSON.parse(res.body);

          expect(body.keys).to.be.a('array');
          expect(res.body).to.contain('/img/sprite.png');
          expect(res.statusCode).to.equal(200);

          done();
        });
      });
    });

    describe('/metrics', function () {
      it('sends the list of metrics', function (done) {
        versions.app.request()
        .get('/metrics')
        .end(function (res) {
          var body = JSON.parse(res.body);

          [
              'requests per second'
            , 'cache size'
            , '404'
            , '304'
            , 'cache hit'
            , 'origin server pull'
            , 'requests'
          ].forEach(function (prop) {
            expect(body).to.have.property(prop);
          });

          expect(res.statusCode).to.equal(200);

          done();
        });
      });
    });

    describe('/inspect', function () {
      it('sends the matched item from the cache for inspection', function (done) {
        versions.app.request()
        .get('/inspect?key='+ escape('#/img/sprite.png'))
        .end(function (res) {
          expect(res.body).to.contain('/img/sprite.png');
          expect(res.body).to.contain('Content-Length');
          expect(res.body).to.contain('Content-Type');
          expect(res.body).to.contain('Last-Modified');
          expect(res.statusCode).to.equal(200);

          done();
        });
      });

      it('sends a failed message if the key does not exist', function (done) {
        versions.app.request()
        .get('/inspect?key='+ escape('adfaj;fjasd;flakdjs;'))
        .end(function (res) {
          expect(res.body).to.contain('Failed to find the requested key');
          expect(res.statusCode).to.equal(200);

          done();
        });
      });
    });

    describe('/flush', function () {
      it('flushes the complete in memory cache', function (done) {
        expect(versions.cache.length).to.be.above(0);

        versions.app.request()
        .get('/flush')
        .end(function (res) {
          expect(res.body).to.contain('OK');
          expect(res.statusCode).to.equal(200);
          expect(versions.cache.length).to.equal(0);

          done();
        });
      });
    });
  });

  describe('.layer(versioning)', function () {
    it('removes the /versions:<what ever>/ path', function (done) {
      versions.app.request()
      .get('/versions:0.0.0/index.js')
      .end(function (res) {
        var content = res.body;

        versions.app.request()
        .get('/index.js')
        .end(function (res) {
          expect(res.body).to.equal(content);
          expect(res.statusCode).to.equal(200);

          done();
        });
      });
    });
  });

  after(function () {
    versions.end();
  });
});