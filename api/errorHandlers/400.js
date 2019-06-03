const {
  ValidationError,
  NotFoundError
} = require('objection');

const {
  DBError,
  ConstraintViolationError,
  UniqueViolationError,
  NotNullViolationError,
  ForeignKeyViolationError,
  CheckViolationError,
  DataError
} = require('objection-db-errors');

module.exports = (err, req, res, next) => {

  // Use error.error.isJoi to catch validation error
  if( err.error && err.error.isJoi ) {
    res
      .status( 400 )
      .json({
        requestStatus: false,
        requestResult: {
          error: { message: err }
        }
      });
  } else if ( err instanceof ValidationError ) {
    switch ( err.type ) {
      case 'ModelValidation':
        res.status( 400 ).json({
          requestStatus: false,
          requestResult: {
            message: err.message,
            type: 'ModelValidation',
            data: err.data
          }
        });
        break;
      case 'RelationExpression':
        res.status( 400 ).json({
          requestStatus: false,
          requestResult: {
            message: err.message,
            type: 'InvalidRelationExpression',
            data: {}
          }
        });
        break;
      case 'UnallowedRelation':
        res.status( 400 ).json({
          requestStatus: false,
          requestResult: {
            message: err.message,
            type: 'UnallowedRelation',
            data: {}
          }
        });
        break;
      case 'InvalidGraph':
        res.status( 400 ).json({
          requestStatus: false,
          requestResult: {
            message: err.message,
            type: 'InvalidGraph',
            data: {}
          }
        });
        break;
      default:
        res.status( 400 ).json({
          requestStatus: false,
          requestResult: {
            message: err.message,
            type: 'UnknownValidationError',
            data: {}
          }
        });
        break;
    }
  } else if ( err instanceof NotFoundError ) {
    res.status( 404 ).json({
      requestStatus: false,
      requestResult: {
        message: err.message,
        type: 'NotFound',
        data: {}
      }
    });
  } else if ( err instanceof UniqueViolationError ) {
    res.status( 409 ).json({
      requestStatus: false,
      requestResult: {
        message: err.message,
        type: 'UniqueViolation',
        data: {
          columns: err.columns,
          table: err.table,
          constraint: err.constraint
        }
      }
    });
  } else if ( err instanceof NotNullViolationError ) {
    res.status( 400 ).json({
      requestStatus: false,
      requestResult: {
        message: err.message,
        type: 'NotNullViolation',
        data: {
          column: err.column,
          table: err.table,
        }
      }
    });
  } else if ( err instanceof ForeignKeyViolationError ) {
    res.status( 409 ).json({
      requestStatus: false,
      requestResult: {
        message: err.message,
        type: 'ForeignKeyViolation',
        data: {
          table: err.table,
          constraint: err.constraint
        }
      }
    });
  } else if ( err instanceof CheckViolationError ) {
    res.status(400).json( {
      requestStatus: false,
      requestResult: {
        message: err.message,
        type: 'CheckViolation',
        data: {
          table: err.table,
          constraint: err.constraint
        }
      }
    } );
  } else if ( err instanceof DataError ) {
    res.status( 400 ).json({
      requestStatus: false,
      requestResult: {
        message: err.message,
        type: 'InvalidData',
        data: {}
      }
    });
  } else if ( err instanceof DBError ) {
    res.status( 500 ).json({
      requestStatus: false,
      requestResult: {
        message: err.message,
        type: 'UnknownDatabaseError',
        data: {}
      }
    });
  } else {
    res.status( 500 ).json({
      requestStatus: false,
      requestResult: {
        message: err.message,
        type: 'UnknownError',
        data: {}
      }
    });
  }


};
