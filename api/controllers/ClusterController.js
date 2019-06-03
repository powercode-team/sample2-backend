const BaseController = require('./BaseController');
const ClusterRepository = require('../repositories/ClusterRepository');
const SkillCatalogRepository = require('../repositories/SkillCatalogRepository');

class ClusterController extends BaseController {

  async getClusterColor ( req, res, next ) {
    try {

      const colors = await ClusterRepository.getClusterColor();
      const success = !!(colors && colors.length > 0);

      super.responseJSON(success ? 200 : 404, success, res, { colors } );

    } catch ( e ) {
      next( e );
    }
  }

  async getClusterIcon ( req, res, next ) {
    try {

      const icons = await ClusterRepository.getClusterIcon();
      const success = !!(icons && icons.length > 0);

      super.responseJSON(success ? 200 : 404, success, res, { icons } );

    } catch ( e ) {
      next( e );
    }
  }

  async getAllClusterByGroup ( req, res, next ) {
    try {
      let skill_catalog_id = req.params.id;
      let skill_cluster_id = req.query.skill_cluster_id;

      let cluster_group = await ClusterRepository.getAllClusterByGroup( skill_catalog_id, req.header_language_id, skill_cluster_id);

      super.responseJSON(200, true, res, { cluster_group } );

    } catch ( e ) {
      next( e );
    }
  }

  async searchSkillCluster( req, res, next ) {
    try {
      let skill_catalog_id = req.params.id;
      let search_data = req.query.search;
      let page = --req.query.page || 0;
      let perPage = req.query.perPage || 10;

      let query = await ClusterRepository.searchSkillCluster( skill_catalog_id, search_data, req.header_language_id, page, perPage );
      let success = !!query && query.results && query.results.length > 0;

      super.responseJSON(200, success, res, { search: query.results, totalCount: query.total } );
    } catch ( e ) {
      next( e );
    }
  }

  async updateSkillCluster ( req, res, next ) {
    try {
      let skill_cluster_id = req.params.skill_cluster_id;

      let data = {
        ...req.body,
        skill_cluster_id: skill_cluster_id,
        skill_catalog_id: req.params.id,
        skill_cluster_details: {
          ...req.body.skill_cluster_details,
          language_id: req.header_language_id
        }
      };

      let skill_cluster = await ClusterRepository.updateSkillCluster( data );
      super.responseJSON(200, true, res, { skill_cluster } );
    } catch ( e ) {
      next( e );
    }
  }

  async deleteSkillCluster (req, res, next) {
    try {

      let skill_cluster_id = req.params.id;
      await ClusterRepository.deleteSkillCluster( skill_cluster_id );

      super.responseJSON(204, true, res, { } );
    } catch ( e ) {
      next( e );
    }
  }

  async createSkillCluster ( req, res, next ) {
    try {
      let data = {
        ...req.body,
        skill_catalog_id: req.params.id,
        skill_cluster_details: {
          ...req.body.skill_cluster_details,
          language_id: req.header_language_id
        }
      };

      let skill_cluster = await ClusterRepository.createSkillCluster( data );

      super.responseJSON(201, true, res, { skill_cluster } );
    } catch ( e ) {
      next( e );
    }
  }

  async putSkillClusterSkills( req, res, next ) {
    try {

      await ClusterRepository
        .insertSkillsFromCluster(
          req.params.skill_cluster_id, req.body.skills.filter( el => el.assign ).map( el => el.skill_id));

      await ClusterRepository
        .removeSkillsFromCluster(
          req.params.skill_cluster_id, req.body.skills.filter( el => !el.assign ).map( el => el.skill_id));

      let assign_count = await ClusterRepository.getMappingTotalCount(req.params.id, req.params.skill_cluster_id);

      super.responseJSON(202, true, res, { assign_count: assign_count.count } );

    } catch (e) {
      next(e);
    }
  }

  /////////////////////////////////////GROUP

  async getClusterGroup( req, res, next ) {
    try {
      let skill_cluster_id = req.query.skill_cluster_id;
      let skill_catalog_id = req.params.id;

      let cluster_group = await ClusterRepository.getClusterGroup( skill_catalog_id, skill_cluster_id, req.header_language_id );
      const success = !!(cluster_group && cluster_group.length > 0);

      super.responseJSON(success ? 200 : 404, success, res, { cluster_group } );
    } catch ( e ) {
      next( e );
    }
  }

  async createClusterGroup( req, res, next ) {
    try {
      let data = {
        skill_catalog_id: req.params.id,
        cluster_group_details: {
          ...req.body,
          language_id: req.header_language_id
        }
      };

      let cluster_group = await ClusterRepository.createClusterGroup(data);
      super.responseJSON(201, true, res, cluster_group);
    } catch ( e ) {
      next( e );
    }
  }

  async updateClusterGroup( req, res, next ) {
    try {
      let cluster_group_id = req.params.id;
      let cluster_group_details = req.body;
      cluster_group_details.language_id = 1;
      let response = await ClusterRepository.updateClusterGroup(cluster_group_id, cluster_group_details);
      super.responseJSON(!!response ? 202 : 404, !!response, res, {} );
    } catch ( e ) {
      next( e );
    }
  }

  async deleteClusterGroup( req, res, next ) {
    try {
      let cluster_group_id = req.params.id;

      let response = await ClusterRepository.deleteClusterGroup(cluster_group_id);
      super.responseJSON(!!response ? 204 : 404, !!response, res, {} );
    } catch ( e ) {
      next( e );
    }
  }

}

module.exports = new ClusterController();
