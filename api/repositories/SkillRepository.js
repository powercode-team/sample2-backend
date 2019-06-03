const { raw } = require('objection');

const Skill = require('../models/skill/Skill');
const SkillDetails = require('../models/skill/SkillDetails');
const SkillImportance = require('../models/skill/attributes/SkillImportance');
const SkillType = require('../models/skill/attributes/SkillType');
const SkillSeniority = require('../models/skill/attributes/SkillSeniority');
const Language = require('../models/Language');
const SkillSynonymDetails = require('../models/skill/SkillSynonymDetails');
const stringSearchConverter = require('../helpers/stringSearchConverter');
const skillCte = require('../knex/knexCommonTableExpressions').skill;

const Wiki = require('../models/wiki/Wiki');

class SkillRepository {

  async getSkillsWikiRange( catalog_id, syncLangId, requiredLangIds, limit, offset ) {
    return Wiki
      .query()
      // CTE for fetch all skills which have appropriate language_id and have wiki link
      .with('wiki_skill', qb => qb
        .select('skill_details.skill_id')
        .from('skill')
        .leftJoin('skill_details', 'skill.skill_id', 'skill_details.skill_id')
        .where('language_id', syncLangId)
        .whereNotNull('wiki_id')
        .andWhere('skill.skill_catalog_id', catalog_id)
        .orderBy('skill_details.skill_id')
        .limit(limit)
        .offset(offset)
      )
      .with ('skill_synonym_lang', qb => qb
        .select ('skill_synonym_details.skill_id',' skill_synonym_details.language_id')
        .select ( raw ( ' jsonb_agg ( skill_synonym_details.skill_synonym_name ) as keywords ') )
        .from('skill_synonym_details')
        .groupBy('skill_synonym_details.skill_id', 'skill_synonym_details.language_id')
      )
      // CTE for grouping this skills with all their translations in objects
      .with('skill_lang', qb => qb
        .select('wiki_skill.skill_id')
        .select( raw("json_agg( json_build_object(" +
          "'skill_id', skill_details.skill_id, " +
          "'skill_name', skill_details.skill_name, " +
          "'skill_synonym', skill_synonym_lang.keywords, " +
          "'language_id',  skill_details.language_id " +
          ")) as skill_langs") )
        .from('wiki_skill')
        // join again to adding all skill translation in json object format
        .leftJoin('skill_details', 'wiki_skill.skill_id', 'skill_details.skill_id')
        .leftJoin('skill_synonym_lang', qb => qb
          .on('skill_synonym_lang.skill_id', '=', 'wiki_skill.skill_id')
          .andOn('skill_synonym_lang.language_id', '=', 'skill_details.language_id')
        )
        .whereIn('skill_details.language_id', requiredLangIds) // grab only required languages        .whereNotNull('wiki_id')
        .groupBy('wiki_skill.skill_id')
      )
      // CTE for additional left join with skill_details for getting wiki_id
      .with('skill_wiki_lang', qb => qb
        .select('skill_lang.skill_id', 'skill_langs', 'skill_details.wiki_id' )
        .from('skill_lang')
        .leftJoin('skill_details', 'skill_lang.skill_id', 'skill_details.skill_id' )
        .where('language_id', syncLangId)
      )
      // CTE for additional left join with skill_details for getting wiki_id
      .with('wiki_agg', qb => qb
        .select('wiki_id')
        .select(raw('json_agg ( skills ) as agg')) // merge arrays of objects in group by with LATERAL subquery
        .from(raw('skill_wiki_lang,json_array_elements(skill_langs) skills')) // LATERAL
        .groupBy('wiki_id')
      )
      .select( 'wiki.wiki_url', 'wiki_agg.wiki_id', 'wiki_agg.agg as skills_data' )
      .rightJoin('wiki_agg', 'wiki.wiki_id', 'wiki_agg.wiki_id')
      .orderBy('wiki_agg.wiki_id', 'asc');
  }

  async getSkillsWikiTotalCount( catalog_id, language_id ) {
    return Skill
      .query()
      .countDistinct('wiki_id' )
      .leftJoin( 'skill_details', 'skill_details.skill_id', 'skill.skill_id' )
      .where( 'skill_catalog_id', catalog_id )
      .andWhere( 'skill_details.language_id', language_id )
      .whereNotNull( 'wiki_id' )
      .first()
      .pluck('count')
  }

  async getFullHierarchySkills( skillCatalogId, maxLevel, filter, orderRow, orderDirection, page, perPage, lng_id, search_data, skill_cluster ) {

    let selectWikiCountQuery = [];

    let search_hierarchy_data;

    if ( search_data.skill_id ) {

      search_hierarchy_data = await Skill
        .query()
        .select('skill_hierarchy_id', raw('array_agg(skill.skill_id) as skill_ids'))
        .from('skill')
        .where('skill_id', search_data.skill_id)
        .groupBy('skill_hierarchy_id');

    } else if ( search_data.search_text && ! search_data.skill_id  ) {

     // search_data.search_text = stringSearchConverter(search_data.search_text);

      search_hierarchy_data = await Skill
        .query()
        .select('skill_hierarchy_id', raw('array_agg(skill.skill_id) as skill_ids'))
        .from('skill')
        .leftJoin('skill_details', 'skill_details.skill_id', 'skill.skill_id')
        .leftJoin('skill_synonym_details', 'skill_synonym_details.skill_id', 'skill.skill_id')
        .where(function () {
          // this.where('skill_details.skill_name', '~*', `\\m${search_data.search_text}`)
          //   .orWhere('skill_synonym_details.skill_synonym_name', '~*', `\\m${search_data.search_text}`);
          this
            .where('skill_details.skill_name', 'ilike', `%${search_data.search_text}%`)
            .orWhere('skill_synonym_details.skill_synonym_name', 'ilike', `%${search_data.search_text}%`)
        })
        .andWhere('skill.skill_catalog_id', skillCatalogId)
        .andWhere('skill_details.language_id', lng_id)
        .groupBy('skill.skill_hierarchy_id');

    }

    for ( let i = 0; i < maxLevel; i++ ) {
      selectWikiCountQuery.push(`CASE WHEN "dtlLvl${i+1}".wiki_id IS NOT NULL THEN 1 ELSE 0 END`);
    }

    let mainQuery = Skill
      .query()
      .with ('keywords_count', qb => qb
        .select('skill_synonym_details.skill_id')
        .select( raw(' count(skill_synonym_details.skill_synonym_id) as keywords_count' ))
        .from('skill_synonym_details')
        .groupBy('skill_synonym_details.skill_id') )
      .with( 'skill_details_lang', qb => skillCte.skillDetailsCte( qb, skillCatalogId, lng_id ))
      .with( 'importance_details_lang', qb => skillCte.importanceDetailsCte( qb, skillCatalogId, lng_id ))
      .with( 'skill_type_details_lang', qb => skillCte.skillTypeDetailsCte( qb, skillCatalogId, lng_id ))
      .select(
        `level${maxLevel}.skill_id as level${maxLevel}_id`,
        `dtlLvl${maxLevel}.skill_name as level${maxLevel}_name`,
        `dtlLvl${maxLevel}.language_id as level${maxLevel}_language_id`,
        'skill_importance_name',
        'skill_type_name',
      )
      .select ( raw ('coalesce(cast(keywords_count.keywords_count as int), 0) as keywords_count' ))
      .select(raw(`(${selectWikiCountQuery.join(' + ')}) as wiki_count`))
      .from(`skill as level${maxLevel}`)
      .leftJoin(`skill_details_lang as dtlLvl${maxLevel}`, `level${maxLevel}.skill_id`, `dtlLvl${maxLevel}.skill_id`)
      .leftJoin('skill_hierarchy', `level${maxLevel}.skill_hierarchy_id`, 'skill_hierarchy.skill_hierarchy_id' )
      .leftJoin('importance_details_lang', `level${maxLevel}.skill_importance_id`, 'importance_details_lang.skill_importance_id')
      .leftJoin('skill_type_details_lang', `level${maxLevel}.skill_type_id`, 'skill_type_details_lang.skill_type_id')
      .leftJoin('keywords_count', `keywords_count.skill_id`, `level${maxLevel}.skill_id`)
      .andWhere(`level${maxLevel}.skill_catalog_id`, skillCatalogId )
      .andWhere('skill_hierarchy_level', maxLevel )
      .orderBy( orderRow, orderDirection )
      .page( page, perPage );

    for ( let i = maxLevel - 1; i > 0; i-- ) {
      mainQuery
        .select(
          `level${i}.skill_id as level${i}_id `,
          `dtlLvl${i}.skill_name as level${i}_name`,
          `dtlLvl${i}.language_id as level${i}_language_id`
        )
        .leftJoin( `skill as level${i}`, `level${i + 1}.skill_parent_id`, `level${i}.skill_id` )
        .leftJoin( `skill_details_lang as dtlLvl${i}`, `level${i}.skill_id`, `dtlLvl${i}.skill_id` )
    }

    for ( let elem of filter ) {
      if ( elem.level <= maxLevel)
        mainQuery
          .whereIn(`level${elem.level}.skill_id`, elem.likeIn)
    }

    if ( skill_cluster.skill_cluster_id ) {
      mainQuery
        .select(raw(`CASE WHEN (skill_cluster_mapping.skill_cluster_id = ${skill_cluster.skill_cluster_id}) THEN true ELSE false END as assign`))
        .select(raw(`CASE WHEN (skill_cluster_mapping.skill_cluster_id = ${skill_cluster.skill_cluster_id}) THEN skill_cluster_mapping.id ELSE 0 END as assign_id`))
        .leftJoin('skill_cluster_mapping', qb => {
          qb
              .on('skill_cluster_mapping.skill_id', `level${maxLevel}.skill_id`)
              .andOn('skill_cluster_mapping.skill_cluster_id', skill_cluster.skill_cluster_id)
        });

        if ( skill_cluster.skill_cluster_assign )
          mainQuery.where('skill_cluster_mapping.skill_cluster_id', skill_cluster.skill_cluster_id);
        else if (skill_cluster.skill_cluster_assign == false)
          mainQuery.andWhere(function() {
            this.whereNot('skill_cluster_mapping.skill_cluster_id', skill_cluster.skill_cluster_id)
              .orWhereNull('skill_cluster_mapping.skill_cluster_id')
          })
    }

    if (search_hierarchy_data && search_hierarchy_data.length > 0) {
       mainQuery.where( function (qb) {
        for (let i = 0; i < search_hierarchy_data.length; i++)
          qb.orWhereIn(`level${search_hierarchy_data[i].skill_hierarchy_id}.skill_id`, search_hierarchy_data[i].skill_ids)
      });

    }

    return mainQuery;
  }

  async findSkillLevels ( skillCatalogId, search, parentHierarchy, notIn, page, perPage, lng_id ) {

    let searchQuery = Skill
      .query()
      .with( 'skill_details_lang', qb => skillCte.skillDetailsCte( qb, skillCatalogId, lng_id ) )
      .select(
        'level1.skill_id as id',
        'dtlLvl1.skill_name as name'
      )
      .from( `skill as level1` )
      .joinRelation( 'skill_hierarchy' )
      .andWhere( 'level1.skill_catalog_id', skillCatalogId )
      .andWhere( 'skill_hierarchy.skill_hierarchy_level', 1 )
      .page( page, perPage );

    for ( let i = 0; i < Object.keys( parentHierarchy ).length; i++ ) {
      let lvlId = i + 2;

      searchQuery
        .clearSelect()
        .select( `level${lvlId}.skill_id as id ` )
        .leftJoin( `skill as level${lvlId}`, `level${lvlId - 1 }.skill_id`, `level${lvlId}.skill_parent_id` )
        .whereNotNull(`level${lvlId}.skill_id`);

      if (  parentHierarchy[ lvlId - 1 ] &&  parentHierarchy[ lvlId - 1 ].length > 0 )
        searchQuery
          .whereIn( `level${ lvlId - 1 }.skill_id`, parentHierarchy[ lvlId - 1 ] );

    }

    let childId = Object.keys( parentHierarchy ).length + 1;

    searchQuery
      .select( `dtlLvl${childId}.skill_name as name` )
      .leftJoin( `skill_details_lang as dtlLvl${childId}`, `level${childId}.skill_id`, `dtlLvl${childId}.skill_id` );

    if ( search ) {
      searchQuery
        .andWhere( `dtlLvl${childId}.skill_name`, 'ILIKE', `${search}%` );
    }

    searchQuery
      .whereNotIn( `level${childId}.skill_id`, notIn );

    return searchQuery;
  }

  async getSkillKeywordsWithID ( skillId ) {
    return Language
      .query()
      .select(
       raw(`COALESCE(array_agg(
                json_build_object(
                  'skill_synonym_name', skill_synonym_details.skill_synonym_name, 
                  'skill_synonym_id', skill_synonym_details.skill_synonym_id
                )
            ) FILTER (WHERE skill_synonym_details.skill_synonym_name IS NOT NULL), ARRAY[]::json[]) as keywords`),
        'language.language_id',
        'language_name'
      )
      .leftOuterJoin('skill_synonym_details', ( qb ) => qb
        .on( 'skill_synonym_details.skill_id', skillId )
        .on( 'skill_synonym_details.language_id', 'language.language_id' )
      )
      .groupBy('language.language_id')
      .orderBy('language.language_id', 'asc')
  }

  async getSkillKeywords ( skillId ) {
    return Language
      .query()
      .select(
        raw(`COALESCE(array_agg(
                json_build_object(
                  'skill_synonym_name', skill_synonym_details.skill_synonym_name, 
                  'is_from_wiki', skill_synonym_details.is_from_wiki, 
                  'is_reviewed', skill_synonym_details.is_reviewed
                )
            ) FILTER (WHERE skill_synonym_details.skill_synonym_name IS NOT NULL), ARRAY[]::json[]) as keywords`),
        'language.language_id',
        'language_name'
      )
      .leftOuterJoin('skill_synonym_details', ( qb ) => qb
        .on( 'skill_synonym_details.skill_id', skillId )
        .on( 'skill_synonym_details.language_id', 'language.language_id' )
      )
      .groupBy('language.language_id')
      .orderBy('language.language_id', 'asc')
  }

  async checkSkillDuplicate ( skillId, syn_array, langId ) {
    return Skill
        .query()
        .select('skill_synonym_id', 'skill_synonym_name')
        .from('skill as s1')
        .leftJoin('skill as s2', 's1.skill_hierarchy_id', 's2.skill_hierarchy_id')
        .leftJoin('skill_synonym_details as ssd',
            's2.skill_id',
            'ssd.skill_id')
        .whereIn(raw('lower(ssd.skill_synonym_name)'), syn_array)
        .andWhere('s1.skill_id', skillId)
        .andWhere('ssd.language_id', langId)
  }

  async removeSkillKeywords ( keyword_ids ) {
    return SkillSynonymDetails
      .query()
      .delete()
      .whereIn('skill_synonym_id', keyword_ids);
  }

  async patchSkillKeywords ( keywords ) {
    //return SkillSynonymDetails
     // .query()
      //.insert(keywords);

    const detailsInsQuery = SkillSynonymDetails.knex().insert(keywords).into('skill_synonym_details');
    return SkillDetails
      .knex()
      .raw(`? ON CONFLICT(skill_synonym_name, skill_id, language_id) 
        DO UPDATE SET 
          is_from_wiki = EXCLUDED.is_from_wiki, 
          is_reviewed = EXCLUDED.is_reviewed, 
          skill_synonym_name = EXCLUDED.skill_synonym_name, 
          skill_id = EXCLUDED.skill_id, 
          language_id = EXCLUDED.language_id
        `, [detailsInsQuery]);
  }

  async getSkillImportance( skillId, lng_id, page, perPage ) {
    return skillCte.importanceDetailsCte( SkillImportance.query(), skillId, lng_id ).page( page, perPage );
  }

  async getSkillType( skillId, lng_id, page, perPage ) {
    return skillCte.skillTypeDetailsCte( SkillType.query(), skillId, lng_id ).page( page, perPage );
  }

  async insertSkills( skillCatalogId, new_skills, hierarchy_ids, attributes, language_id ) {

    let searchResult = {}, currentLevel = 0, lastSkillParent = null;

    let { importance_id, keywords, wiki } = attributes;

    for ( let iter = 0; ( iter < new_skills.length - 1 ) && ( iter === 0 || searchResult ) ; iter++ ) {
      searchResult = await this.findSkillInHierarchyByParent( skillCatalogId, new_skills[iter], lastSkillParent, language_id );

      if ( searchResult ) {
        currentLevel++;
        lastSkillParent = searchResult;
      }

    }

    let skillInsertData = [];
    for ( let i = currentLevel; i < new_skills.length; i++ ) {
      skillInsertData.push({
        "#id": `newSkill${i}`,
        skill_hierarchy_id: hierarchy_ids[i].skill_hierarchy_id,
        skill_parent_id: i === currentLevel ? lastSkillParent : `#ref{newSkill${i-1}.skill_id}`,
        skill_catalog_id: skillCatalogId,
        skill_type_id: 1, //Dunno what I should set
        skill_details: [{
          skill_name: new_skills[i],
          language_id: language_id
        }]
      })
    }
    // Setting attributes
    let lastSkillIndex = skillInsertData.length - 1;

    skillInsertData[ lastSkillIndex ]['skill_importance_id'] = importance_id;

    if ( wiki && keywords && keywords.length > 0 ) {
      let wiki_id = await this.findOrCreateWikiUrl( wiki, language_id )

      for ( let i = 0; i < keywords.length; i++ ) {

        if ( keywords[ i ].language_id === language_id ) { // update
          skillInsertData[ lastSkillIndex ][ 'skill_details' ][ 0 ][ 'wiki_id' ] = wiki_id;
          skillInsertData[ lastSkillIndex ][ 'skill_details' ][ 0 ][ 'is_wiki_sync' ] = true;
        } else { // push
          skillInsertData[ lastSkillIndex ][ 'skill_details' ].push({
            skill_name: '',
            language_id: keywords[ i ].language_id
          });
        }
      }
    }

    let skill_id = await Skill
      .query()
      .insertGraph(skillInsertData)
      .pick(['skill_id']);

    if ( wiki && keywords && keywords.length > 0 ) {
      let insertSynonyms = [];
      keywords.map(keyword => {
        keyword.synonyms.map(k_word => {
          insertSynonyms.push({
            skill_synonym_name: k_word,
            skill_id: skill_id[skill_id.length - 1].skill_id,
            is_from_wiki: !!wiki,
            language_id: keyword.language_id,
            last_updated_by_user_id: 1
          })
        })
      });

      await SkillSynonymDetails
        .query()
        .insert(insertSynonyms)
        .into('skill_synonym_details');
    }
    return skill_id;
  }

  async deleteById( skillId, maxHierarchy ) {

    let hierarchy_id;
    let temp_data;
    let mainQuery;

    for ( let i = 0; i < maxHierarchy; i++ ) {

      mainQuery = Skill
        .query()
        .select('s2.skill_parent_id', 's2.skill_id')
        .from('skill as s1');
      if ( i === (maxHierarchy - 1) ) {
        mainQuery
          .leftJoin('skill as s2', 's1.skill_id', 's2.skill_id')
      } else {
        mainQuery
          .leftJoin('skill as s2', 's1.skill_parent_id', 's2.skill_parent_id')
      }
      mainQuery
        .where( ( i === 0 ) ? raw(`s1.skill_id = ${skillId}`) : raw(`s1.skill_id = ${hierarchy_id[0].skill_parent_id}`) );

      temp_data = await mainQuery;
console.log(temp_data);
      if ( temp_data.length === 1 ) {
        hierarchy_id = temp_data
      } else {
        break;
      }

    }

    let skillDelete = Skill
      .query()
      .delete();

    if ( hierarchy_id && hierarchy_id[0].skill_parent_id) {
      skillDelete.where('skill_id', hierarchy_id[0].skill_parent_id);
    } else if (hierarchy_id) {
      skillDelete.where('skill_id', hierarchy_id[0].skill_id);
    } else {
      skillDelete.where('skill_id', skillId);
    }

    return skillDelete;
  }

  async getCatalogId( skillId ) {
    return Skill
      .query()
      .select('skill_catalog_id')
      .where('skill_id', skillId)
      .pluck('skill_catalog_id')
      .first();
  }

  async patchSkillHierarchy ( skillId, skillHierarchy, catalog_id, catalog_hierarchy, skill_name, language_id ) {

    // Find index in hierarchy where we change skill
    let currentIndex = skillHierarchy.findIndex( el => el === skillId ), findResult = {};

    let insertSkillsData = await Skill // Fetch all skills data according to hierarchy and starting from current index
      .query()
      .eager('skill_details')
      .leftJoinRelation('skill_hierarchy')
      .whereIn('skill.skill_id', skillHierarchy.slice( currentIndex ))
      .orderBy('skill_hierarchy.skill_hierarchy_level', 'asc')
      .omit(['skill_id', 'id']);

    // map only old names
    let oldSkillsName = insertSkillsData.map( el => {
      let filter = el.skill_details.filter( det => det.language_id === language_id )[0];
      return filter ? filter.skill_name : el.skill_details[0].skill_name
    });

    let parent_skill_id = skillHierarchy[ currentIndex - 1 ] || null;
    // How much skill were found from oldSkillsName array
    let oldFound = 0;

    oldSkillsName[oldFound] = skill_name;


    let lastSkillParent = null;
    // Try to find next levels
    for ( currentIndex; currentIndex < skillHierarchy.length - 1 && findResult && oldSkillsName[oldFound]; currentIndex++ ) {

      findResult = await this.findSkillInHierarchyByParent( catalog_id, oldSkillsName[oldFound], lastSkillParent || parent_skill_id, language_id )

      if ( findResult ) {
        oldFound++;
        lastSkillParent = findResult;
      }

    }

    // Remove skills from data by currentIndex
    insertSkillsData.splice( 0, lastSkillParent? oldFound : 0 );

    insertSkillsData[0].skill_parent_id = lastSkillParent || insertSkillsData[0].skill_parent_id;

    if ( ! oldFound ) {
      insertSkillsData[0].skill_details = [{
        skill_name: skill_name,
        language_id: language_id
      }]
    }

    for ( let i = 0; i < insertSkillsData.length; i++ ) {

      insertSkillsData[ i ]["#id"] = `newSkill${i}`;

      // Overwrite skill parent for fist clone data
      insertSkillsData[ i ].skill_parent_id = i === 0 ? insertSkillsData[ i ].skill_parent_id : `#ref{newSkill${i-1}.skill_id}`;

    }

    insertSkillsData[ insertSkillsData.length - 1 ].skill_id = skillHierarchy[ skillHierarchy.length -1 ];

    await Skill
      .query()
      .delete()
      .where('skill_id', skillHierarchy[ skillHierarchy.length -1 ]);

    return Skill
      .query()
      .insertGraph( insertSkillsData )
      .first();

  }

  async patchSkill( skillId, patchData ) {
    return Skill
      .query()
      .patch(patchData)
      .where('skill_id', skillId)
  }

  async getSkillParentIds( skillId ) {
    let parent_skills, ids = [];

    parent_skills = await Skill
      .query()
      .select('skill_id')
      .eager('[skillParentIds.^]')
      .where('skill_id', skillId)
      .first();

    if ( parent_skills ) {
      // Flattening result after eager
      const pickRecursive = ( obj, field_name, recursive_field ) =>
        [ obj[ field_name ] ].concat( obj[ recursive_field ] ? pickRecursive( obj[ recursive_field ], field_name, recursive_field ) : [] );

      ids = pickRecursive( parent_skills, 'skill_id', 'skillParentIds' );

    }

    return ids;
  }

  async getSkillWiki( skillId, language_id ) {

    let skillsIds = await this.getSkillParentIds( skillId );

    return SkillDetails
      .query()
      .with( 'skills_wiki_details_lang', qb =>
        skillCte.skillsWikiDetailsCte ( qb.whereIn('skill_details.skill_id', skillsIds), language_id )
      )
      .from('skills_wiki_details_lang')
      .select(
        'skills_wiki_details_lang.skill_details_id',
        'skills_wiki_details_lang.wiki_url',
        'skills_wiki_details_lang.is_wiki_sync'
      )
  }

  async findOrCreateWikiUrl( wiki_url, language_id ) {
    let wiki_id = await Wiki.query().select('wiki_id').where('wiki_url', wiki_url ).first().pluck('wiki_id');

    if ( ! wiki_id ) {
      wiki_id = await Wiki
        .query()
        .insert({ wiki_url: wiki_url, language_id: language_id })
        .pluck('wiki_id')
    }
    return wiki_id;
  }

  async checkAddSkillDuplicate ( skill_name, skillCatalogId, hierarchy_id ) {
    return !!(await Skill
        .query()
        .select('id')
        .from('skill')
        .leftJoin('skill_details', 'skill.skill_id', 'skill_details.skill_id')
        .where('skill.skill_catalog_id', skillCatalogId)
        .andWhere('skill.skill_hierarchy_id', hierarchy_id)
        .where(raw('LOWER(skill_details.skill_name)'), skill_name.toLowerCase())
    ).length;
  }

  async checkEditSkillDuplicate ( names, ids, language_id, hierarchy_id ) {

    return Skill
      .query()
      .select('skill_name')
      .from('skill')
      .leftJoin('skill_details', 'skill_details.skill_id', 'skill.skill_id')
      .where('skill_details.language_id', language_id)
      .where('skill.skill_hierarchy_id', hierarchy_id)
      .whereIn(raw('LOWER(skill_details.skill_name)'), names)
      .whereNotIn('skill.skill_id', ids);
  }

  async IsSKILL ( ids ) {
    return Skill
      .query()
      .with('max_hierarchy', qb => qb
        .select(raw('max(s2.skill_hierarchy_id) as hierarchy_id'))
        .from('skill as s1')
        .leftJoin('skill as s2', 's1.skill_catalog_id', 's2.skill_catalog_id')
        .whereIn('s1.skill_id', ids)
      )
      .select('skill_id', 'hierarchy_id')
      .from('max_hierarchy')
      .leftJoin('skill', 'skill.skill_hierarchy_id', 'max_hierarchy.hierarchy_id')
      .whereIn('skill_id', ids)
  }


  async findSkillByWikiUrl ( wiki_url, skillCatalogId ) {
    let duplicate = false;
    let wiki_id = await Wiki.query().select('wiki_id').where('wiki_url', wiki_url ).first().pluck('wiki_id');

    if ( wiki_id ) {
      let skills = !!(await Skill
        .query()
        .with('max_hierarchy', qb => qb
          .select(raw('max(skill_hierarchy_id) as hierarchy_id'), 'skill_catalog_id')
          .from('skill')
          .groupBy('skill_catalog_id')
          .where('skill_catalog_id', skillCatalogId)
        )
        .select('id')
        .from('skill')
        .rightJoin('max_hierarchy', qb => qb
          .on('max_hierarchy.hierarchy_id', 'skill.skill_hierarchy_id')
        )
        .leftJoin('skill_details', 'skill.skill_id', 'skill_details.skill_id')
        .where('wiki_id', wiki_id)
        .andWhere(raw('max_hierarchy.skill_catalog_id = skill.skill_catalog_id'))
      ).length;

      if ( skills )
        return true;
    }

    return duplicate;
  }

  async patchSkillWiki ( skillId, data, language_id ) {

    let duplicate = false;
    for ( let i = 0; i < data.length; i++ ) {

      let wiki_id = null;

      if( data[i].wiki_url ) {

        wiki_id = await this.findOrCreateWikiUrl( data[i].wiki_url, language_id );

        if ( i === 0 ) {
          duplicate = !!(await Skill
            .query()
            .with('get_skill_details_data', qb => qb
              .select('skill.skill_catalog_id', 'skill.skill_hierarchy_id')
              .from('skill')
              .leftJoin('skill_details', 'skill_details.skill_id', 'skill.skill_id')
              .where('skill_details.id', data[i].skill_details_id)
            )
            .with('get_skill_data', qb => qb
              .select('skill.skill_id', 'skill.skill_hierarchy_id')
              .from('skill')
              .leftJoin('get_skill_details_data', qb => qb
                .on('get_skill_details_data.skill_catalog_id', 'skill.skill_catalog_id')
              )
              .where(raw('get_skill_details_data.skill_hierarchy_id = skill.skill_hierarchy_id'))
            )
            .select('id')
            .from('skill_details')
            .leftJoin('get_skill_data', 'get_skill_data.skill_id', 'skill_details.skill_id')
            .whereNot('skill_details.id', data[i].skill_details_id)
            .andWhere('wiki_id', wiki_id)
            .whereNotNull('get_skill_data.skill_hierarchy_id')).length;

          if (duplicate === true)
            return true;
        }

      }

      await SkillDetails
        .query()
        .patch({wiki_id: wiki_id, is_wiki_sync: data[i].is_wiki_sync})
        .where('id', data[i].skill_details_id)
    }
    return false;
  }

  async getSkillSeniority( skillId, lng_id, page, perPage ) {

    return skillCte.seniorityDetailsCte( SkillSeniority.query(), skillId, lng_id )
      .orderBy('skill_seniority_ranking' , 'desc')
      .page( page, perPage );

  }

  async translateSkill( data ) {

    const skillDetailsInsQuery = SkillDetails.knex().insert(data).into('skill_details');

    return SkillDetails
      .knex()
      .raw('? ON CONFLICT(skill_id, language_id) DO UPDATE SET skill_name = EXCLUDED.skill_name ', [skillDetailsInsQuery])

  }

  /*
   *  Find next existing skill for current catalog according to parent name, hierarchy level
   */
  async findSkillInHierarchyByParent ( catalog_id, skill_name, skill_parent_id, language_id ) {
    return Skill
      .query()
      .with('skill_details_lang', qb => skillCte
        .skillDetailsCte( qb, catalog_id, language_id )
        .clearSelect() // clear cte select.
        .select('skill_details.skill_id', 'skill_details.skill_name')
      )
      .select('skill.skill_id')
      .leftJoin('skill_details_lang', 'skill.skill_id', 'skill_details_lang.skill_id')
      .where('skill.skill_catalog_id', catalog_id)
      .andWhere('skill.skill_parent_id', skill_parent_id ) // clarify catalog level
      .andWhere('skill_details_lang.skill_name', skill_name)
      .limit(1)
      .first()
      .pluck('skill_id')

  }

  async findHierarchySkillByTitles( catalogId, maxLevel, titles, limit, lng_id ) {

    let mainQuery = Skill
      .query()
      .with( 'skill_category', qb =>
        qb
          .select('skill_details.skill_id')
          .count('skill_details.skill_id')
          .from('skill')
          .leftJoin('skill_details','skill.skill_id', 'skill_details.skill_id')
          .leftJoin('wiki','skill_details.wiki_id', 'wiki.wiki_id')
          .leftJoin('wiki_category_mapping','wiki.wiki_id', 'wiki_category_mapping.wiki_id')
          .leftJoin('category', 'wiki_category_mapping.category_id', 'category.category_id')
          .whereIn('category_title', titles)
          .andWhere('skill_catalog_id', catalogId)
          .groupBy('skill_details.skill_id')
          .orderBy('count', 'desc')
          .limit(limit)
      )
      .with( 'skill_details_lang', qb => skillCte.skillDetailsCte( qb, catalogId, lng_id ) )
      .select(
        `level${maxLevel}.skill_id as level${maxLevel}_id`,
        `dtlLvl${maxLevel}.skill_name as level${maxLevel}_name`,
      )
      .from(`skill as level${maxLevel}`)
      .leftJoin(`skill_details_lang as dtlLvl${maxLevel}`, `level${maxLevel}.skill_id`, `dtlLvl${maxLevel}.skill_id`)
      .rightJoin(`skill_category`, `skill_category.skill_id`, `level${maxLevel}.skill_id`)
      .andWhere(`level${maxLevel}.skill_catalog_id`, catalogId)
      .orderBy('skill_category.count', 'desc');

    for ( let i = maxLevel - 1; i > 0; i-- ) {
      mainQuery
        .select(
          `level${i}.skill_id as level${i}_id `,
          `dtlLvl${i}.skill_name as level${i}_name`,
        )
        .leftJoin( `skill as level${i}`, `level${i + 1}.skill_parent_id`, `level${i}.skill_id` )
        .leftJoin( `skill_details_lang as dtlLvl${i}`, `level${i}.skill_id`, `dtlLvl${i}.skill_id` )
    }

    return mainQuery;

  }
}

module.exports = new SkillRepository();
