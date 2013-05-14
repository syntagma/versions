'use strict';

/**
 * versioning.js:
 *
 * Allow prefixing of the urls for caching busting or cache references. If the
 * url starts with `versions:` it will remove supplied path and stitches back
 * the correct url.
 */
module.exports = function prefix(req, res, next) {
  this.rejectRequestOnUnallowedVersion = function(requiredVersion) {
      var versionChunks = requiredVersion.split(":");
      if (this.get('allowed versions').indexOf(versionChunks[1]) === -1) {
          res.statusCode = 409;
          res.write("Unallowed version detected");

          this.metrics.incr('unallowed version detected', { version: versionChunks[1] });
          throw "Unallowed version detected";
      }
    };

  req.versioned = ''; // Add a default value, so we don't end up with undefineds

  if (!/^\/versions\:/i.test(req.url)) return next();

  req.urlchunks = req.urlchunks|| req.url.split('/');

  // Remove the matched versioning path from the url and restore the url to the
  // correct path.
  req.versioned = req.urlchunks.splice(1, 1);
  req.url = req.originalUrl = req.urlchunks.join('/');

  this.rejectRequestOnUnallowedVersion(req.versioned[0]);

  this.metrics.incr('versioned', { req: req, res: res, version: req.versioned });
  next();
};
