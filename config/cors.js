module.exports = (app) => {

  return app.use( ( req, res, next ) => {

    res.header('Access-Control-Allow-Origin', '*' );
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

    if ( req.method === 'OPTIONS' ) {

      res.status( 204 ).end();

    } else {

      next();

    }

  });

};
