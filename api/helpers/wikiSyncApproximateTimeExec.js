

// All const variables based on statistic data with 100 test wiki request

// Average time for one request with one language
const averageTimeWikiReq = 1281.3165;

// Average time for one more language ( excluding first ) sync in required_language array
const averageTimeIncrLanguage = 360;

const syncConfig = require('../../config/index').wikiSyncApi;

module.exports = ( totalCount, requiredLanguagesCount ) => {

  let timeToSyncOneWiki = averageTimeWikiReq + ( requiredLanguagesCount - 1 ) * averageTimeIncrLanguage;

  let threadsIter = Math.ceil( totalCount / syncConfig.syncRange / syncConfig.syncThreads ); // How many threads iteration requires

  let totalCountInThreads = ( threadsIter - 1 ) * syncConfig.syncRange + ( totalCount % syncConfig.syncRange ); // Actual count of sync request

  return (
    ( totalCountInThreads * timeToSyncOneWiki )
    / ( 1000 * 60 ) // convert to minutes
  ).toFixed(2) + ' minutes';

};