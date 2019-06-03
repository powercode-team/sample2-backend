const syncConfig = require('../../config').wikiSyncApi;

class WikiSync {

  constructor( wikiTotalCount, getWikiFromSource, syncWithDatabase ) {

    this.wikiSyncTasks = this.syncWikiGenerator( wikiTotalCount, getWikiFromSource );

    this.syncWithDatabase = syncWithDatabase;

  }

  *syncWikiGenerator( totalCount, getWikiFromSource ) {
    for ( let i = 0; i < totalCount; i+= +syncConfig.syncRange ) {
      yield getWikiFromSource( syncConfig.syncRange, i );
    }
  }

  async synchronizeAsync() {

    let nextTask = this.wikiSyncTasks.next();

    while( !nextTask.done ) {

      await this.syncWithDatabase( await nextTask.value );

      nextTask = this.wikiSyncTasks.next();

    }

  }

  startWikiSync() {
    let promises = [];

    for ( let i = 0; i < syncConfig.syncThreads; i++ )
      promises.push( this.synchronizeAsync() )

    return Promise.all( promises )
  }
}

module.exports = WikiSync;