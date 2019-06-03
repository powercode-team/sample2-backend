
module.exports = ( req, res ) => {

  res.status( 404 ).json({
      requestStatus: false,
      requestResult: {
        error: {
          message: '404 Not Found',
          property: 'route'
        }
      }
    })

};
