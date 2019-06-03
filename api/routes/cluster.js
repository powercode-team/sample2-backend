const ClusterController = require('../controllers/ClusterController');

const validate = require('express-joi-validation')({ passError: true });
const schemas = require('../joi/schemas');

module.exports = ( app ) => {

  app.get('/api/v1/skill-cluster/color',
    ClusterController.getClusterColor
  );

  app.get('/api/v1/skill-cluster/icon',
    ClusterController.getClusterIcon
  );

  app.get( '/api/v1/skill-catalog/:id/cluster-group',
    validate.params( schemas.pathId ),
    validate.query( schemas.cluster_group.skill_cluster_id ),
    ClusterController.setHeaderLanguageId,
    ClusterController.getClusterGroup
  );

  app.post ('/api/v1/skill-catalog/:id/cluster-group/',
    validate.params( schemas.pathId ),
    validate.body( schemas.cluster_group.create ),
    ClusterController.setHeaderLanguageId,
    ClusterController.createClusterGroup
  );
  app.patch ('/api/v1/cluster-group/:id',
    validate.params( schemas.pathId ),
    validate.body( schemas.cluster_group.create ),
    ClusterController.setHeaderLanguageId,
    ClusterController.updateClusterGroup
  );

  app.delete ('/api/v1/cluster-group/:id',
    validate.params( schemas.pathId ),
    ClusterController.deleteClusterGroup
  );

  app.get( '/api/v1/skill-catalog/:id/skill-cluster/search',
    validate.params( schemas.pathId ),
    validate.query( schemas.skill_cluster.search ),
    ClusterController.setHeaderLanguageId,
    ClusterController.searchSkillCluster
  );

  app.get( '/api/v1/skill-catalog/:id/skill-cluster',
    validate.params( schemas.pathId ),
    validate.query( schemas.skill_cluster.queryAll ),
    ClusterController.setHeaderLanguageId,
    ClusterController.getAllClusterByGroup
  );

  app.delete ('/api/v1/skill-cluster/:id',
    validate.params( schemas.pathId ),
    ClusterController.deleteSkillCluster
  );

  app.post( '/api/v1/skill-catalog/:id/skill-cluster',
    validate.params( schemas.pathId ),
    validate.body( schemas.skill_cluster.create ),
    ClusterController.setHeaderLanguageId,
    ClusterController.createSkillCluster
  );

  app.patch( '/api/v1/skill-catalog/:id/skill-cluster/:skill_cluster_id',
    validate.params( schemas.skill_cluster.catalogAndClusterId ),
    validate.body( schemas.skill_cluster.update ),
    ClusterController.setHeaderLanguageId,
    ClusterController.updateSkillCluster
  );

  app.put( '/api/v1/skill-catalog/:id/skill-cluster/:skill_cluster_id',
    validate.params( schemas.skill_cluster.catalogAndClusterId ),
    validate.body( schemas.skill_cluster.putSkills ),
    ClusterController.setHeaderLanguageId,
    ClusterController.putSkillClusterSkills
  );

};
