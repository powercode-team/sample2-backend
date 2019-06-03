'use strict';

const express = require( 'express' );
const config = require( './config' );
const app = express();

const setupExpress = require( './config/express' );

const LanguageController = require('./api/controllers/LanguageController');

const enableRoutes = require( './api/routes' );

const errorHandler = require( './api/errorHandlers/400' );
const noFound = require( './api/errorHandlers/404' );


setupExpress( app );

/*
 * OpenApi documentation by swagger
 */
require('./config/swagger')( app );

/*
 * Setup knex and knex logs
 */
const knexLogger = require('knex-logger');
app.use(knexLogger( require('./api/knex') ));

/*
 * Enable api routes
 */
enableRoutes( app );

app.use( errorHandler );
app.use( noFound );



app.listen(config.server.port, async () => {
  console.log( `HTTP-server was started at #${ config.server.port } port` );

  // check environment params such as wiki syn language, etc.

  if ( ! await LanguageController.checkEnvWikiLanguage() )
    console.warn( 'Invalid SYNC_SKILL_NAME_LANGUAGE parameter that can lead to problems with wiki sync' )

});
