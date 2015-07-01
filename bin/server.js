#!/usr/bin/env node

var http = require( "http" ),
	Notifier = require( "git-notifier" ).Notifier,
	logger = require( "simple-log" ).init( "jquery-license" ),
	debug = require( "debug" )( "server" ),
	Repo = require( "../lib/repo" ),
	auditPr = require( "../lib/pr" ).audit,
	config = require( "../lib/config" ),
	signatureUtil = require( "./server/signature" );

var server = http.createServer(),
	notifier = new Notifier(),
	signatureManager = signatureUtil.init({
		refresh: config.signatureRefresh
	});

process.on( "uncaughtException", function( error ) {
	logger.error( "Uncaught exception", error.stack );
	debug( "Shutting down due to uncaught exception" );
	server.close();
	signatureManager.stop();
});

// Create the notifier
server.on( "request", notifier.handler );
server.listen( config.port );
notifier.on( config.owner + "/*/pull_request", prHook );
notifier.on( "error", function( error ) {
	debug( "invalid hook request", error );
});

debug( "listening on port " + config.port );

setTimeout(function() {
	throw new Error( "wat?" );
}, 1000 );
return;

function prHook( event ) {
	if ( event.payload.action !== "opened" && event.payload.action !== "synchronize" ) {
		return;
	}

	debug( "processing hook", event.repo, event.pr );
	signatureUtil.get().then(
		function( signatures ) {
			auditPr({
				repo: event.repo,
				pr: event.pr,
				baseRemote: event.payload.pull_request.base.git_url,
				baseBranch: event.payload.pull_request.base.ref,
				base: event.base,
				headRemote: event.payload.pull_request.head.git_url,
				headBranch: event.payload.pull_request.head.ref,
				head: event.head,
				signatures: signatures
			})
				.then(function( status ) {
					if ( status.auditError ) {
						throw status.auditError;
					}
				})
				.catch(function( error ) {
					logger.error( "Error auditing hook", {
						repo: event.repo,
						pr: event.pr,
						head: event.head,
						error: error.stack
					});
				});
		},

		// If we can't get the signatures, set the status to error
		function() {
			var repo = Repo.get( event.repo );
			repo.setStatus({
				sha: event.head,
				state: "error",
				description: "There was an error checking the CLA status"
			})
				.catch(function( error ) {
					logger.error( "Error setting status", {
						repo: event.repo,
						pr: event.pr,
						head: event.head,
						error: error.stack
					});
				});
		}
	);
}
