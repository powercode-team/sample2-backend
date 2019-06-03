const Model = require('../Model');

class ClusterGroup extends Model {

  static get tableName () {
    return 'cluster_group'
  }

  static get idColumn() {
    return 'cluster_group_id';
  }

  static get relationMappings() {

    const SkillCatalog = require('../skill/SkillCatalog');
    const ClusterGroupDetails = require('./ClusterGroupDetails');
    const ClusterGroupMapping = require('./ClusterGroupMapping');

    return {
      skill_catalog: {
        relation: Model.HasManyRelation,
        modelClass: SkillCatalog,
        join: {
          from: 'skill_catalog.skill_catalog_id',
          to: 'cluster_group.skill_catalog_id'
        }
      },
      cluster_group_details: {
        relation: Model.HasManyRelation,
        modelClass: ClusterGroupDetails,
        join: {
          from: 'cluster_group.cluster_group_id',
          to: 'cluster_group_details.cluster_group_id'
        }
      },

      cluster_group_mapping: {
        relation: Model.HasManyRelation,
        modelClass: ClusterGroupMapping,
        join: {
          from: 'cluster_group.cluster_group_id',
          to: 'cluster_group_mapping.cluster_group_id'
        }
      }

    }
  }

}

module.exports = ClusterGroup;
