/* global process */

/**
 * Module dependencies
 */

var fs = require('fs')
var mkdirp = require('mkdirp')
var path = require('path')
var pemjwk = require('pem-jwk')
var childProcess = require('child_process')

/**
 * Constructor
 */

function AnvilConnectKeys (directory) {
  // base directory for keys to be read from and written to
  this.directory = path.join(directory || process.cwd(), 'keys')

  // signature key pair file paths
  this.sig = {
    pub: path.join(this.directory, 'sig.rsa.pub.pem'),
    prv: path.join(this.directory, 'sig.rsa.prv.pem')
  }

  // encryption key pair file paths
  this.enc = {
    pub: path.join(this.directory, 'sig.rsa.pub.pem'),
    prv: path.join(this.directory, 'sig.rsa.prv.pem')
  }

  // setup token
  this.setup = path.join(this.directory, 'setup.token')
}

/**
 * Generate keys
 */

function generateKeyPairs () {
  AnvilConnectKeys.generateKeyPair(this.sig.pub, this.sig.prv)
  AnvilConnectKeys.generateKeyPair(this.enc.pub, this.enc.prv)
}

AnvilConnectKeys.prototype.generateKeyPairs = generateKeyPairs

/**
 * OpenSSL
 */

function generateKeyPair (pub, prv) {
  try {
    mkdirp.sync(path.dirname(pub))
    mkdirp.sync(path.dirname(prv))

    childProcess.execFileSync('openssl', [
      'genrsa',
      '-out',
      prv,
      '4096'
    ])

    childProcess.execFileSync('openssl', [
      'rsa',
      '-pubout',
      '-in',
      prv,
      '-out',
      pub
    ])
  } catch (e) {
    throw new Error(
      'Failed to generate keys using OpenSSL. Please ensure you have OpenSSL ' +
      'installed and configured on your system.'
    )
  }
}

AnvilConnectKeys.generateKeyPair = generateKeyPair

/**
 * Load
 */

function loadKeypairs (recurse) {
  var keys = null

  try {
    keys = {
      sig: {
        pub: fs.readFileSync(this.sig.pub).toString('ascii'),
        prv: fs.readFileSync(this.sig.prv).toString('ascii')
      },
      enc: {
        pub: fs.readFileSync(this.enc.pub).toString('ascii'),
        prv: fs.readFileSync(this.enc.prv).toString('ascii')
      }
    }
  } catch (err) {}

  if (!keys && !!recurse) {
    this.generate()
    keys = this.loadKeypairs(false)

    // if the keys still can't be loaded, throw an error
    if (!keys) {
      throw new Error(
        'Unable to read the token-signing key pair from ' + this.directory
      )
    }
  }

  // translate pems to jwks
  var sig = pemjwk.pem2jwk(keys.sig.pub)
  var enc = pemjwk.pem2jwk(keys.enc.pub)

  // format the JWK set
  keys.jwks = {
    keys: [
      {
        kty: sig.kty,
        use: 'sig',
        alg: 'RS256',
        n: sig.n,
        e: sig.e
      },
      {
        kty: enc.kty,
        use: 'enc',
        alg: 'RS256',
        n: enc.n,
        e: enc.e
      }
    ]
  }

  return keys
}

AnvilConnectKeys.prototype.loadKeypairs = loadKeypairs

/**
 * Export
 */

module.exports = AnvilConnectKeys
