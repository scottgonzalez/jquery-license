var getHashedSignatures = require( "../../lib/signatures" ).hashed;
var logger = require( "simple-log" ).init( "jquery-license" );
var debug = require( "debug" )( "server-signatures" );

function Signature( options ) {
	this.options = options;
	this.running = false;
	this.start();
}

Signature.prototype.start = function() {
	debug( "getting signatures, updating every " + this.options.refresh + "ms" );
	this.running = true;
	this.promise = getHashedSignatures();

	var startUpdates = function() {

		// Handle stop() being called before the first retrieval
		if ( !this.running ) {
			return;
		}

		this.timeout = setTimeout( this.update.bind( this ), this.options.refresh );
	}.bind( this );
	this.promise.then( startUpdates, startUpdates );
}

Signature.prototype.update = function() {
	var updatedPromise = getHashedSignatures();

	debug( "updating signatures" );
	updatedPromise
		.then(function() {
			debug( "successfully updated signatures" );
			this.promise = updatedPromise;
		}.bind( this ) )
		.catch(function( error ) {
			logger.error( "Error getting signatures", error.stack );
			debug( "error updating signatures", error );
		})
		.then(function() {
			this.timeout = setTimeout( this.update.bind( this ), this.options.refresh );
		}.bind( this ) );
}

Signature.prototype.stop = function() {
	this.running = false;
	clearTimeout( this.timeout );
}

Signature.prototype.get = function() {
	return this.promise;
}

exports.init = function( options ) {
	return new Signature( options );
};
