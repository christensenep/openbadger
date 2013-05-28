const test = require('./');
const conmock = require('./conmock');
const badgeFixtures = require('./badge-model.fixtures');

const Badge = require('../models/badge');
const db = require('../models');
const api = require('../routes/api');
const env = require('../lib/environment');

function ensureAlreadyClaimedError(t) {
  return function(err, mockRes, req) {
    if (err) throw err;
    t.equal(mockRes.status, 409);
    t.same(mockRes.body, {
      status: 'error',
      reason: "claim code `already-claimed` has already been used",
      code: 'already-claimed'
    });
    t.end();
  };
}

test.applyFixtures(badgeFixtures, function(fx) {
  test('api provides expected badge info', function(t) {
    env.temp({origin: 'https://example.org'}, function(done) {
      conmock({
        handler: api.badge,
        request: {
          badge: fx['with-criteria']
        }
      }, function(err, mockRes, req) {
        if (err) throw err;
        t.equal(mockRes.status, 200);
        t.same(JSON.parse(JSON.stringify(mockRes.body)), {
          status: 'ok',
          badge: {
            "name":"Badge with criteria",
            "description":"For doing random stuff",
            "criteria": "* person is awesome",
            "prerequisites": [],
            "tags": [],
            "program": "program",
            "image":"https://example.org/badge/image/with-criteria.png",
            "rubric":{
              "items":[{"text":"person is awesome","required":true}]
            }
          }
        });
        t.end();
        done();
      });
    });
  });

  test('api provides unclaimed badge info given claim code', function(t) {
    conmock({
      handler: api.getUnclaimedBadgeInfoFromCode,
      request: {
        query: {
          code: 'will-claim'
        }
      }
    }, function(err, mockRes, req) {
      if (err) throw err;
      t.equal(mockRes.status, 200);
      t.equal(mockRes.body.status, 'ok');
      t.equal(mockRes.body.badge.name, 'Offline badge');
      t.end();
    });
  });

  test('api awards badges w/ claim codes', function(t) {
    conmock({
      handler: api.awardBadgeFromClaimCode,
      request: {
        body: {
          email: 'foo@bar.org',
          code: 'will-claim'
        }
      }
    }, function(err, mockRes, req) {
      if (err) throw err;
      t.equal(mockRes.status, 200);
      t.equal(mockRes.body.status, 'ok');
      t.ok('url' in mockRes.body);
      Badge.findOne({_id: fx['offline-badge']._id}, function(err, badge) {
        if (err) throw err;
        t.ok(badge);
        t.same(badge.getClaimCode('will-claim').claimedBy, 'foo@bar.org');
        t.end();
      });
    });
  });

  test('api POST rejects used claim codes', function(t) {
    conmock({
      handler: api.awardBadgeFromClaimCode,
      request: {
        body: {
          email: 'foo@bar.org',
          code: 'already-claimed'
        }
      }
    }, ensureAlreadyClaimedError(t));
  });

  test('api GET rejects used claim codes', function(t) {
    conmock({
      handler: api.getUnclaimedBadgeInfoFromCode,
      request: {
        query: {
          code: 'already-claimed'
        }
      }
    }, ensureAlreadyClaimedError(t));
  });

  test('api rejects unknown claim codes', function(t) {
    conmock({
      handler: api.awardBadgeFromClaimCode,
      request: {
        body: {
          email: 'foo@bar.org',
          code: 'lololol'
        }
      }
    }, function(err, mockRes, req) {
      if (err) throw err;
      t.equal(mockRes.status, 404);
      t.same(mockRes.body, {
        status: 'error',
        reason: "unknown claim code",
        code: 'lololol'
      });
      t.end();
    });
  });

  test('api rejects claim code redemption w/o code', function(t) {
    conmock({
      handler: api.awardBadgeFromClaimCode,
      request: {
        body: {
          email: 'foo@bar.org'
        }
      }
    }, function(err, mockRes, req) {
      if (err) throw err;
      t.equal(mockRes.status, 400);
      t.same(mockRes.body, {
        status: 'error',
        reason: "missing claim code",
      });
      t.end();
    });
  });

  test('api rejects claim code redemption w/o email', function(t) {
    conmock({
      handler: api.awardBadgeFromClaimCode,
      request: {
        body: {
          code: 'already-claimed'
        }
      }
    }, function(err, mockRes, req) {
      if (err) throw err;
      t.equal(mockRes.status, 400);
      t.same(mockRes.body, {
        status: 'error',
        reason: "missing email address",
      });
      t.end();
    });
  });

  test('shutting down #', function (t) {
    db.close(); t.end();
  });
});
