const { raw } = require('objection');

// lowestLangPriority helps to define the lowest order for multi lingual queries
// for any instance without with empty translation.
const lowestLangPriority = require('../../config/index').request.lowestLanguagePriority;

// Part of knex query, which add to query builder instance custom order.
// `lowestLangPriority` for instances with empty translation
// else order by specified language
// or if translation for this language doesn't exist - gets first translation ( order by language_id priority ).
const multilingualQuery = ( qb, prop, name, lng_id ) =>
  qb
    .orderByRaw(`CASE WHEN ${prop}.${name} = '' THEN ${lowestLangPriority} ` + // set lowest value to custom order
            `WHEN ${prop}.language_id = ${ lng_id } THEN 1 ` + // set 1 for existing translation in this language
            `ELSE ${prop}.language_id + 1 END` ); // shift all languages by 1 down in custom order


// CTE separated to skills and job.
module.exports = {

  cluster: {

    clusterAllGroupDetailsCte : ( qb, lang_id ) =>
      qb
        .distinct( raw( 'ON (cluster_group_details.cluster_group_id) cluster_group_details.cluster_group_id ' ) )
        .select(
          'cluster_group_details.id',
          'cluster_group_details.cluster_group_name',
          'cluster_group_details.language_id')
        .from('cluster_group_details')
        .orderBy('cluster_group_details.cluster_group_id')
      && multilingualQuery( qb, 'cluster_group_details', 'cluster_group_name', lang_id ),

    clusterAllSkillDetailsCte: ( qb, lang_id ) =>
      qb
        .distinct( raw( 'ON (skill_cluster_details.skill_cluster_id) skill_cluster_details.skill_cluster_id' ) )
        .select(
          'skill_cluster_details.id',
          'skill_cluster_details.skill_cluster_name',
          'skill_cluster_details.language_id',
          'skill_cluster_details.display_icon_id',
          'skill_cluster_details.display_color_id')
        .from('skill_cluster_details')
        .orderBy('skill_cluster_details.skill_cluster_id')
      && multilingualQuery( qb, 'skill_cluster_details', 'skill_cluster_name', lang_id ),

  },

};
