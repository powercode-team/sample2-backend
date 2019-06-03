const redis = require('redis');
const redisConfig = require('../../config/').redis;
const client = redis.createClient( redisConfig );

const { to } = require('await-to-js');

const { promisify } = require('util');
const getAsyncRedis = promisify( client.get ).bind( client );

class RedisStorage {

  constructor( dataKey, updateDataMethod, expirationTime ) {
    this.dataKey = dataKey;
    this.updateDataMethod = updateDataMethod;
    this.expirationTime = expirationTime;
  }

  async getJson() {

    let data = JSON.parse( await getAsyncRedis( this.dataKey ) );

    return data ? data : this.updateStorage( true );
  }


  async updateStorage( forceReturnResult ) {

    let [ err, newDataResult ] = await to ( this.updateDataMethod() );

    if ( !err ) {
      await client.set( this.dataKey, JSON.stringify(newDataResult), 'EX', this.expirationTime );
    }

    return new Promise(( resolve, reject ) => {  if ( !err ){ resolve ( forceReturnResult ? this.getJson() : null )} else reject( err )});

  }

}


module.exports = RedisStorage;