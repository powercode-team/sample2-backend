const Joi = require('joi');

/*
 *  Joi constants
*/
const arrayJoi = ( element ) => Joi.array().items( element );
const positiveJoi = Joi.number().integer().positive();

const wikiRegexp = /(?!.*\s$[@\w])(((http|https)(:\/\/))?[\w.]+)wikipedia.org\/wiki\/([\w.,@?^=%&amp;:\/~+#-]*[\w@?^=%&amp;\/~+#-])/;
const JoiStringRegex = Joi.string().regex(/^(?![`0-9~!@#$%^&*()_|+\-=?;:'",.<>\/{\\}\[\]])(.+)$/).trim();

module.exports = {

  passwordAuth: Joi.object({
    password : Joi.string().required()
  }),

  pathId: Joi.object({
    id: positiveJoi,
  }),

};
