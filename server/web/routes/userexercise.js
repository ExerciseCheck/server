'use strict';
const internals = {};
const Async = require('async');
const Boom = require('boom');
const Config = require('../../../config');
const UserExercise = require('../../models/userExercise');
const Exercise = require('../../models/exercise');

internals.applyRoutes = function (server, next) {

  server.route({
    method: 'GET',
    path: '/userexercise',
    config: {
      auth: {
        strategy: 'session'
      }
    },
    handler: function (request, reply) {

      return reply.view('userexercise/index', {
        user: request.auth.credentials.user,
        projectName: Config.get('/projectName')
      });
    }
  });

  server.route({
    method: 'GET',
    path: '/userexercise/create',
    config: {
      auth: {
        strategy: 'session'
      }
    },
    handler: function (request, reply) {

      return reply.view('userexercise/create', {
        user: request.auth.credentials.user,
        projectName: Config.get('/projectName')
      });
    }
  });

  server.route({
    method: 'GET',
    path: '/userexercise/create/practice',
    config: {
      auth: {
        strategy: 'session'
      }
    },
    handler: function (request, reply) {

      return reply.view('userexercise/createpractice', {
        user: request.auth.credentials.user,
        projectName: Config.get('/projectName')
      });
    }
  });

  server.route({
    method: 'GET',
    path: '/userexercise/start/{exerciseId}',
    config: {
      auth: {
        strategy: 'session'
      }
    },
    handler: function (request, reply) {

      /*Exercise.findById(request.params.exerciseId, (err, exercise) => {

        if (err) {
          return reply(err);
        }

        return reply.view('userexercise/start', {
          user: request.auth.credentials.user,
          projectName: Config.get('/projectName'),
          exercise
        });
      });*/
      Async.auto({
        findNumSets: function (done) {

          const query = {
            userId: request.auth.credentials.user._id.toString(),
            exerciseId: request.params.exerciseId,
            type: 'Reference'
          };

          UserExercise.findOne(query, done);
        },
        findNumPractices:['findNumSets', function (results, done) {

          if (!results.findNumSets || results.findNumSets === undefined ) {
            return reply(Boom.notFound('Reference exercise not found'));
          }
          const query = {
            userId: request.auth.credentials.user._id.toString(),
            exerciseId: request.params.exerciseId,
            type: 'Practice'
          };

          UserExercise.find(query, done);
        }],
        findExercise:['findNumPractices', function (results, done) {

          Exercise.findById(request.params.exerciseId, done);
        }]
      }, (err, results) => {

        if (err) {
          return reply(err);
        }
        if (!results.findExercise || results.findExercise === undefined) {
          return reply(Boom.notFound('exercise not found'));
        }
        return reply.view('userexercise/start', {
          user: request.auth.credentials.user,
          projectName: Config.get('/projectName'),
          numSets: results.findNumSets.numRepetition,
          setNumber: results.findNumPractices.length + 1,
          exercise : results.findExercise
        });
      });
    }
  });

  server.route({
    method: 'GET',
    path: '/userexercise/play/{exerciseId}',
    config: {
      auth: {
        strategy: 'session'
      }
    },
    handler: function (request, reply) {

      Exercise.findById(request.params.exerciseId, (err, exercise) => {

        if (err) {
          return reply(err);
        }

        return reply.view('userexercise/play', {
          user: request.auth.credentials.user,
          projectName: Config.get('/projectName'),
          exercise
        });
      });
    }
  });

  server.route({
    method: 'GET',
    path: '/userexercise/stop/{exerciseId}',
    config: {
      auth: {
        strategy: 'session'
      }
    },
    handler: function (request, reply) {

      Exercise.findById(request.params.exerciseId, (err, exercise) => {

        if (err) {
          return reply(err);
        }

        return reply.view('userexercise/stop', {
          user: request.auth.credentials.user,
          projectName: Config.get('/projectName'),
          exercise
        });
      });
    }
  });

  server.route({
    method: 'GET',
    path: '/userexercise/create/ref',
    config: {
      auth: {
        strategy: 'session'
      }
    },
    handler: function (request, reply) {

      return reply.view('userexercise/createref', {
        user: request.auth.credentials.user,
        projectName: Config.get('/projectName')
      });
    }
  });

  server.route({
    method: 'GET',
    path: '/userexercise/{id}',
    config: {
      auth: {
        strategy: 'session',
        scope: ['root','admin']
      }
    },
    handler: function (request, reply) {

      UserExercise.findById(request.params.id, (err, document) => {

        if (err) {
          return reply(err);
        }

        return reply.view('userexercise/edit', {
          user: request.auth.credentials.user,
          projectName: Config.get('/projectName')
        });
      });
    }
  });

  server.route({
    method: 'GET',
    path: '/userexercise/viewexercises',
    config: {
      auth: {
        strategy: 'session'
        //scope: ['root','admin', 'patient']
      }
    },
    handler: function (request, reply) {

      Exercise.find({}, (err, exercises) => {

        if (err) {
          return reply(err);
        }

        return reply.view('userexercise/viewExercises', {
          user: request.auth.credentials.user,
          projectName: Config.get('/projectName'),
          exercises
        });
      });
    }
  });


  server.route({
    method: 'GET',
    path: '/refexercises/play/{id}',
    config: {
      // auth: {
      //   strategy: 'session',
      //   scope: ['root','admin']
      // }
    },
    handler: function (request, reply) {

      //noinspection JSAnnotator
      UserExercise.findOne({ 'auth.user._id':request.params.id }, (err, document) => {

        if (err) {
          return reply(err);
        }

        return reply.view('refexercises/play', {
          projectName: Config.get('/projectName'),
          frameData: JSON.stringify(document.bodyFrames)
        });
      });
    }
  });

  server.route({
    method: 'GET',
    path: '/userexercise/play',
    config: {
      // auth: {
      //   strategy: 'session',
      //   scope: ['root','admin']
      // }
    },
    handler: function (request, reply) {

      //noinspection JSAnnotator
      UserExercise.findOne({}, (err, document) => {

        if (err) {
          return reply(err);
        }

        return reply.view('userexercises/play', {
          frameData: JSON.stringify(document.bodyFrames)
        });
      });
    }
  });

  next();
};


exports.register = function (server, options, next) {

  server.dependency(['auth'], internals.applyRoutes);

  next();
};

exports.register.attributes = {
  name: 'userexerciseList',
  dependencies: 'visionary'
};
